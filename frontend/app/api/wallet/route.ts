import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { computePricingSnapshot } from '@/lib/pricing';
import { randomUUID } from 'crypto';
import { ensureBillingSchema } from '@/lib/schema';
import { applyMockWalletTopUp } from '@/lib/wallet';
import { getConfiguredEngine } from '@/server/engines';
import { getSoraVariantForEngine, isSoraEngineId, parseSoraRequest, type SoraRequest } from '@/lib/sora';
import {
  getUserPreferredCurrency,
  normalizeCurrencyCode,
  resolveCurrency,
  resolveEnabledCurrencies,
} from '@/lib/currency';
import { convertCents } from '@/lib/exchange';
import type { Currency } from '@/lib/currency';
import type { Mode } from '@/types/engines';
import { applyEngineVariantPricing } from '@/lib/pricing-addons';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { CONSENT_COOKIE_NAME, parseConsent } from '@/lib/consent';
import { findTopupTier } from '@/config/topupTiers';
import { extractGaClientId } from '@/server/ga4';
import {
  buildWalletTopUpCheckoutSessionParams,
  normalizeWalletTopUpAmountCents,
} from '@/lib/stripe-checkout';
import { defaultLocale, type AppLocale } from '@/i18n/locales';
import { getOrCreateStripeCustomerForUser } from '@/server/stripe-customers';
import { buildRestrictedAccountPayload, getActiveAccountRestriction } from '@/server/fraud-cleanup';
import {
  evaluateWalletCheckoutGuard,
  markCheckoutAttemptSessionCreated,
  markCheckoutAttemptSessionFailed,
  resolveCheckoutClientIp,
} from '@/server/checkout-guard';
import { findReusableExpressCheckoutSession } from '@/server/checkout-session-reuse';
import {
  buildCheckoutAttemptAttributionMetadata,
  buildWalletAttributionMetadata,
  normalizeWalletAttribution,
} from '@/server/wallet-attribution';

const WALLET_DISPLAY_CURRENCY = 'USD';
const WALLET_DISPLAY_CURRENCY_LOWER = 'usd';
const STRIPE_TAX_CODE_ELECTRONIC_SERVICES = ENV.STRIPE_TAX_CODE_ELECTRONIC_SERVICES ?? 'txcd_10103001';
const STRIPE_API_VERSION = '2023-10-16';
const STRIPE_CHECKOUT_BRAND_RESTRICTIONS_API_VERSION = '2025-02-24.acacia' as Stripe.LatestApiVersion;
const STRIPE_CHECKOUT_ELEMENTS_API_VERSION = '2026-03-25.dahlia' as Stripe.LatestApiVersion;
const CHECKOUT_COPY_BY_LOCALE: Record<
  AppLocale,
  {
    productName: string;
  }
> = {
  en: {
    productName: 'Wallet top-up',
  },
  fr: {
    productName: 'Recharge portefeuille',
  },
  es: {
    productName: 'Recarga de billetera',
  },
};

export const dynamic = 'force-dynamic';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

function decodeCookieValue(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function hasAnalyticsConsent(req: NextRequest): boolean {
  const consentRaw = decodeCookieValue(req.cookies.get(CONSENT_COOKIE_NAME)?.value ?? null);
  const consent = parseConsent(consentRaw);
  return Boolean(consent?.categories.analytics);
}

function normalizeRequestLocale(value: unknown): AppLocale | null {
  if (value === 'fr' || value === 'es' || value === 'en') {
    return value;
  }
  return null;
}

function resolveCheckoutLocale(req: NextRequest, bodyLocale: unknown): AppLocale {
  const explicitLocale = normalizeRequestLocale(bodyLocale);
  if (explicitLocale) return explicitLocale;

  const cookieLocale =
    normalizeRequestLocale(req.cookies.get('NEXT_LOCALE')?.value) ??
    normalizeRequestLocale(req.cookies.get('mv-locale')?.value) ??
    normalizeRequestLocale(req.cookies.get('mvid_locale')?.value);
  if (cookieLocale) return cookieLocale;

  const acceptLanguage = req.headers.get('accept-language') ?? '';
  if (/\bfr\b/i.test(acceptLanguage)) return 'fr';
  if (/\bes\b/i.test(acceptLanguage)) return 'es';
  return defaultLocale;
}

async function resolveAuthenticatedUser(req: NextRequest): Promise<string | null> {
  try {
    const { userId } = await getRouteAuthContext(req);
    return userId;
  } catch {
    // ignore helper errors and fall back
  }
  return null;
}

async function hasCompletedWalletTopUp(userId: string): Promise<boolean> {
  const rows = await query<{ topup_count: number | string }>(
    `SELECT COUNT(*)::int AS topup_count
       FROM app_receipts
      WHERE user_id = $1
        AND type = 'topup'
        AND amount_cents > 0`,
    [userId]
  );
  return Number(rows[0]?.topup_count ?? 0) > 0;
}

type WalletLedgerSummaryRow = {
  topups_cents: number | string | null;
  charges_cents: number | string | null;
  refunds_cents: number | string | null;
  completed_topups: number | string | null;
  mismatched_currencies: string | null;
};

export async function GET(req: NextRequest) {
  const userId = await resolveAuthenticatedUser(req);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  if (!databaseConfigured) {
    return json({ error: 'Database unavailable' }, { status: 503 });
  }
  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[wallet] schema init failed', error);
    return json({ error: 'Database unavailable' }, { status: 503 });
  }

  let preferredCurrency: Currency | null = null;
  try {
    preferredCurrency = await getUserPreferredCurrency(userId);
  } catch (error) {
    console.warn('[wallet] failed to resolve preferred currency', error);
    return json({ error: 'Wallet lookup failed' }, { status: 500 });
  }
  const fallbackResolution = resolveCurrency(req, preferredCurrency ? { preferred_currency: preferredCurrency } : undefined);

  try {
    const walletCurrency = WALLET_DISPLAY_CURRENCY_LOWER as Currency;
    const walletCurrencyUpper = WALLET_DISPLAY_CURRENCY;
    const rows = await query<WalletLedgerSummaryRow>(
      `SELECT
          COALESCE(SUM(CASE WHEN type = 'topup' AND (currency IS NULL OR UPPER(currency) = $2) THEN amount_cents ELSE 0 END), 0)::bigint AS topups_cents,
          COALESCE(SUM(CASE WHEN type = 'charge' AND (currency IS NULL OR UPPER(currency) = $2) THEN amount_cents ELSE 0 END), 0)::bigint AS charges_cents,
          COALESCE(SUM(CASE WHEN type = 'refund' AND (currency IS NULL OR UPPER(currency) = $2) THEN amount_cents ELSE 0 END), 0)::bigint AS refunds_cents,
          COUNT(*) FILTER (WHERE type = 'topup' AND amount_cents > 0)::int AS completed_topups,
          COALESCE(STRING_AGG(DISTINCT LOWER(currency), ',') FILTER (WHERE currency IS NOT NULL AND LOWER(currency) <> $3), '') AS mismatched_currencies
         FROM app_receipts
        WHERE user_id = $1`,
      [userId, walletCurrencyUpper, walletCurrency]
    );
    const summary = rows[0];
    const normalizedMismatches = (summary?.mismatched_currencies ?? '')
      .split(',')
      .map((currency) => normalizeCurrencyCode(currency))
      .filter((currency): currency is Currency => Boolean(currency) && currency !== walletCurrency);

    if (normalizedMismatches.length) {
      console.warn('[wallet] detected receipts with mismatched currency', {
        userId,
        walletCurrency,
        mismatched: normalizedMismatches,
      });
    }

    const topups = Number(summary?.topups_cents ?? 0);
    const charges = Number(summary?.charges_cents ?? 0);
    const refunds = Number(summary?.refunds_cents ?? 0);
    const completedTopups = Number(summary?.completed_topups ?? 0);

    const balanceCents = Math.max(0, topups + refunds - charges);
    return json({
      balance: balanceCents / 100,
      currency: walletCurrencyUpper,
      settlementCurrency: fallbackResolution.currency.toUpperCase(),
      hasCompletedTopUp: completedTopups > 0,
    });
  } catch (error) {
    console.warn('[wallet] query failed', error);
    return json({ error: 'Wallet lookup failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveAuthenticatedUser(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const restriction = await getActiveAccountRestriction(userId);
  if (restriction) {
    return NextResponse.json(buildRestrictedAccountPayload(), { status: 403 });
  }

  let useMock = false;
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[wallet] using mock ledger for top-up (schema init failed)', error);
    useMock = true;
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const analyticsConsentGranted = hasAnalyticsConsent(req);
  const walletAttribution = normalizeWalletAttribution(body.analyticsJourney, analyticsConsentGranted);
  const walletAttributionMetadata = buildWalletAttributionMetadata(walletAttribution);

  const amountCents = normalizeWalletTopUpAmountCents(body.amountCents);
  if (amountCents === null) {
    return NextResponse.json({ error: 'Invalid top-up amount' }, { status: 400 });
  }
  const requestMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
  const isExpressCheckoutTopUp = requestMode === 'express_checkout' || requestMode === 'checkout_elements';
  const checkoutLocale = resolveCheckoutLocale(req, body.locale);
  const checkoutCopy = CHECKOUT_COPY_BY_LOCALE[checkoutLocale];

  let preferredCurrency: Currency | null = null;
  if (!useMock && databaseConfigured) {
    preferredCurrency = await getUserPreferredCurrency(userId);
  }
  let currencyResolution = resolveCurrency(req, preferredCurrency ? { preferred_currency: preferredCurrency } : undefined);
  const enabledCurrencies = resolveEnabledCurrencies();
  const requestedCurrency = normalizeCurrencyCode(body.currency);
  if (requestedCurrency && enabledCurrencies.includes(requestedCurrency)) {
    currencyResolution = {
      currency: requestedCurrency,
      source: 'manual',
      country: currencyResolution.country,
    };
  }
  const resolvedCurrencyLower = currencyResolution.currency;
  const resolvedCurrencyUpper = resolvedCurrencyLower.toUpperCase();

  if (useMock || !ENV.STRIPE_SECRET_KEY || !databaseConfigured) {
    if (isExpressCheckoutTopUp) {
      return NextResponse.json({ error: 'Express checkout unavailable' }, { status: 503 });
    }
    const balanceCents = applyMockWalletTopUp(userId, amountCents);
    return NextResponse.json({
      ok: true,
      balanceCents,
      currency: WALLET_DISPLAY_CURRENCY,
      settlementCurrency: resolvedCurrencyUpper,
      mock: true,
    });
  }

  const stripeApiVersion =
    requestMode === 'direct'
      ? STRIPE_API_VERSION
      : isExpressCheckoutTopUp
        ? STRIPE_CHECKOUT_ELEMENTS_API_VERSION
        : STRIPE_CHECKOUT_BRAND_RESTRICTIONS_API_VERSION;
  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY!, {
    apiVersion: stripeApiVersion,
  });

  if (body.mode === 'direct') {
    const engineId = String(body.engineId || '');
    const engine = await getConfiguredEngine(engineId);
    if (!engine) {
      return NextResponse.json({ error: 'Unknown engine' }, { status: 400 });
    }

    let durationSec = Number(body.durationSec ?? engine.maxDurationSec ?? 4);
    let resolution = String(body.resolution || engine.resolutions?.[0] || '1080p');
    const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : 't2v';
    const mode: Mode = engine.modes.includes(rawMode as Mode) ? (rawMode as Mode) : ('t2v' as Mode);
    let soraRequest: SoraRequest | null = null;

    if (isSoraEngineId(engine.id)) {
      const variant = getSoraVariantForEngine(engine.id);
      const defaultResolution =
        engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '720p';
      const candidate: Record<string, unknown> = {
        variant,
        mode,
        prompt: typeof body.prompt === 'string' && body.prompt.trim().length ? body.prompt : '',
        resolution: resolution === 'auto' && mode === 't2v' ? defaultResolution : resolution,
        aspect_ratio:
          typeof body.aspectRatio === 'string' && body.aspectRatio.trim().length ? body.aspectRatio.trim() : 'auto',
        duration: durationSec,
        api_key: typeof body.apiKey === 'string' && body.apiKey.trim().length ? body.apiKey.trim() : undefined,
      };
      if (mode === 'i2v') {
        const imageUrl =
          typeof body.imageUrl === 'string' && body.imageUrl.trim().length
            ? body.imageUrl.trim()
            : typeof body.image_url === 'string' && body.image_url.trim().length
              ? body.image_url.trim()
              : undefined;
        if (!imageUrl) {
          return NextResponse.json({ error: 'Image URL is required for Sora image-to-video' }, { status: 400 });
        }
        candidate.image_url = imageUrl;
      }

      try {
        soraRequest = parseSoraRequest(candidate);
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Invalid Sora payload',
            details: error instanceof Error ? error.message : undefined,
          },
          { status: 400 }
        );
      }

      durationSec = soraRequest.duration;
      resolution = soraRequest.resolution === 'auto' ? defaultResolution : soraRequest.resolution;
    }

    const pricingEngine = applyEngineVariantPricing(engine, mode);
    const pricing = await computePricingSnapshot({
      engine: pricingEngine,
      durationSec,
      resolution,
      mode,
      membershipTier: body.membershipTier,
    });

    const settlementCurrencyUpper = resolvedCurrencyUpper;
    const { cents: settlementAmountCents, rate: fxRate, source: fxSource } = await convertCents(
      pricing.totalCents,
      WALLET_DISPLAY_CURRENCY_LOWER,
      resolvedCurrencyLower
    );
    const jobId = typeof body.jobId === 'string' && body.jobId.trim() ? String(body.jobId).trim() : `job_${randomUUID()}`;
    const metadata: Record<string, string> = {
      kind: 'run',
      user_id: userId,
      engine_id: engine.id,
      job_id: jobId,
      engine_label: engine.label,
      duration_sec: String(durationSec),
      resolution,
      pricing_total_cents: String(pricing.totalCents),
      pricing_currency: pricing.currency,
      display_currency: WALLET_DISPLAY_CURRENCY,
      wallet_currency: WALLET_DISPLAY_CURRENCY,
      wallet_amount_cents: String(pricing.totalCents),
      settlement_currency: settlementCurrencyUpper,
      settlement_amount_cents: String(settlementAmountCents),
      fx_rate: fxRate.toString(),
      fx_source: fxSource,
      currency: settlementCurrencyUpper,
      currency_source: currencyResolution.source,
      currency_country: currencyResolution.country ?? '',
    };

    if (soraRequest) {
      metadata.variant = soraRequest.variant;
      metadata.mode = soraRequest.mode;
    }

    if (pricing.meta?.ruleId) {
      metadata.rule_id = String(pricing.meta.ruleId);
    }
    const pricingSnapshotJson = JSON.stringify(pricing);
    if (pricingSnapshotJson.length <= 450) {
      metadata.pricing_snapshot = pricingSnapshotJson;
    }

    try {
      const params: Stripe.PaymentIntentCreateParams = {
        amount: settlementAmountCents,
        currency: resolvedCurrencyLower,
        automatic_payment_methods: { enabled: true },
        metadata,
      };

      const intent = await stripe.paymentIntents.create(params);

      console.info('[payments] payment_intent created', {
        paymentIntentId: intent.id,
        jobId,
        amountCents: pricing.totalCents,
        settlementAmountCents,
        settlementCurrency: settlementCurrencyUpper,
        currency: WALLET_DISPLAY_CURRENCY,
        fxRate,
        fxSource,
        currencySource: currencyResolution.source,
        currencyCountry: currencyResolution.country ?? null,
        mode: 'platform',
      });

      return NextResponse.json({
        ok: true,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        amountCents: pricing.totalCents,
        currency: WALLET_DISPLAY_CURRENCY,
        settlementCurrency: settlementCurrencyUpper,
        settlementAmountCents,
        fxRate,
        fxSource,
        jobId,
        pricing,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stripe error creating PaymentIntent';
      console.error('POST /api/wallet direct error:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  let checkoutAttemptId: number | null = null;

  try {
    // Create a one-off Checkout Session for top-up
    const hasCompletedTopUp = await hasCompletedWalletTopUp(userId);
    const isFirstTopUp = !hasCompletedTopUp;
    const shouldBlockAmexForCheckoutSession = isFirstTopUp && !isExpressCheckoutTopUp;

    if (isExpressCheckoutTopUp && !isFirstTopUp) {
      const reusableSession = await findReusableExpressCheckoutSession(stripe, {
        userId,
        amountCents,
        attribution: walletAttribution,
        currency: resolvedCurrencyUpper,
      });
      if (reusableSession) {
        console.info('[payments] reusable checkout session returned', {
          sessionId: reusableSession.id,
          checkoutUiMode: 'elements',
          amountCents,
          settlementCurrency: resolvedCurrencyUpper,
          userId,
        });
        return NextResponse.json({
          id: reusableSession.id,
          checkoutAttemptId: reusableSession.checkoutAttemptId,
          clientSecret: reusableSession.clientSecret,
          client_secret: reusableSession.clientSecret,
          reused: true,
        });
      }
    }

    const tier = findTopupTier({ usdAmountCents: amountCents });
    const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken : null;
    const checkoutGuard = await evaluateWalletCheckoutGuard({
      userId,
      clientIp: resolveCheckoutClientIp(req.headers),
      amountCents,
      mode: isExpressCheckoutTopUp ? 'express_checkout' : 'hosted',
      hasCompletedTopUp,
      isPresetTopupTier: Boolean(tier),
      captchaToken,
      metadata: {
        currency: resolvedCurrencyUpper,
        locale: checkoutLocale,
        checkoutUiMode: isExpressCheckoutTopUp ? 'elements' : 'hosted',
        amexBlocked: shouldBlockAmexForCheckoutSession,
        brandsBlocked: shouldBlockAmexForCheckoutSession ? ['american_express'] : [],
        amexBlockSkippedReason: isFirstTopUp && isExpressCheckoutTopUp ? 'checkout_elements_unsupported' : null,
        ...buildCheckoutAttemptAttributionMetadata(walletAttribution),
      },
    });
    checkoutAttemptId = checkoutGuard.attemptId;

    if (checkoutGuard.action === 'captcha_required') {
      return json(
        {
          error: 'captcha_required',
          captchaRequired: true,
          reason: checkoutGuard.reason,
        },
        { status: 403 }
      );
    }

    if (checkoutGuard.action === 'rate_limited') {
      const retryAfterSeconds = checkoutGuard.retryAfterSeconds ?? 900;
      const response = json(
        {
          error: 'too_many_attempts',
          retryAfterSeconds,
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(retryAfterSeconds));
      return response;
    }

    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const stripeCustomerId = await getOrCreateStripeCustomerForUser(stripe, userId, {
      preferredLocale: checkoutLocale,
    });

    const sessionMetadata: Record<string, string> = {
      kind: 'topup',
      user_id: userId,
      wallet_currency: WALLET_DISPLAY_CURRENCY,
      wallet_amount_cents: String(amountCents),
      settlement_currency: resolvedCurrencyUpper,
      currency: resolvedCurrencyUpper,
      currency_source: currencyResolution.source,
      checkout_ui_mode: isExpressCheckoutTopUp ? 'elements' : 'hosted',
      first_wallet_topup: String(isFirstTopUp),
      checkout_attempt_id: String(checkoutGuard.attemptId),
      checkout_guard_reason: checkoutGuard.reason,
      checkout_captcha_passed: String(checkoutGuard.captchaPassed),
    };
    Object.assign(sessionMetadata, walletAttributionMetadata);
    if (shouldBlockAmexForCheckoutSession) {
      sessionMetadata.amex_block_required = 'true';
      sessionMetadata.brands_blocked = 'american_express';
    } else if (isFirstTopUp && isExpressCheckoutTopUp) {
      sessionMetadata.amex_block_skipped_reason = 'checkout_elements_unsupported';
    }
    sessionMetadata.topup_tier_id = tier?.id ?? 'custom';
    if (tier?.label) {
      sessionMetadata.topup_tier_label = tier.label;
    }
    sessionMetadata.analytics_consent = analyticsConsentGranted ? 'granted' : 'denied';
    if (analyticsConsentGranted) {
      const gaClientId = extractGaClientId(req.cookies.get('_ga')?.value ?? null);
      if (gaClientId) {
        sessionMetadata.ga_client_id = gaClientId;
      }
    }
    if (currencyResolution.country) {
      sessionMetadata.currency_country = currencyResolution.country;
    }
    const { cents: settlementAmountCents, rate: fxRate, source: fxSource } = await convertCents(
      amountCents,
      WALLET_DISPLAY_CURRENCY_LOWER,
      resolvedCurrencyLower
    );
    sessionMetadata.settlement_amount_cents = String(settlementAmountCents);
    sessionMetadata.fx_rate = fxRate.toString();
    sessionMetadata.fx_source = fxSource;

    const topupRedirectParams = new URLSearchParams({
      amount: (amountCents / 100).toFixed(2),
      amountCents: String(amountCents),
      currency: WALLET_DISPLAY_CURRENCY,
      settlementCurrency: resolvedCurrencyUpper,
      topupTier: sessionMetadata.topup_tier_id ?? 'custom',
    });
    const redirectQuery = `${topupRedirectParams.toString()}&checkoutSessionId={CHECKOUT_SESSION_ID}`;
    const successUrl = `${origin}/billing?status=success&${redirectQuery}`;
    const cancelUrl = `${origin}/billing?status=cancelled&${redirectQuery}`;

    const paymentIntentMetadata: Record<string, string> = {
      ...sessionMetadata,
    };
    const sessionParams = buildWalletTopUpCheckoutSessionParams({
      currency: resolvedCurrencyLower,
      settlementAmountCents,
      checkoutUiMode: isExpressCheckoutTopUp ? 'elements' : 'hosted',
      successUrl,
      cancelUrl,
      returnUrl: successUrl,
      locale: checkoutLocale,
      productName: checkoutCopy.productName,
      sessionMetadata,
      paymentIntentMetadata,
      productTaxCode: STRIPE_TAX_CODE_ELECTRONIC_SERVICES,
      customer: stripeCustomerId,
      customerUpdate: {
        address: 'auto',
        name: 'auto',
      },
      blockAmexCards: shouldBlockAmexForCheckoutSession,
    });

    const session = await stripe.checkout.sessions.create(sessionParams as Stripe.Checkout.SessionCreateParams);

    await markCheckoutAttemptSessionCreated(checkoutGuard.attemptId, session.id).catch((error) => {
      console.warn('[checkout-guard] failed to mark checkout session created', error);
    });

    console.info('[payments] checkout session created', {
      sessionId: session.id,
      checkoutUiMode: isExpressCheckoutTopUp ? 'elements' : 'hosted',
      amountCents,
      settlementAmountCents,
      settlementCurrency: resolvedCurrencyUpper,
      currency: WALLET_DISPLAY_CURRENCY,
      fxRate,
      fxSource,
      currencySource: currencyResolution.source,
      currencyCountry: currencyResolution.country ?? null,
      userId,
      mode: 'platform',
    });

    if (isExpressCheckoutTopUp) {
      if (!session.client_secret) {
        throw new Error('missing_checkout_client_secret');
      }
      return NextResponse.json({
        id: session.id,
        checkoutAttemptId: checkoutGuard.attemptId,
        clientSecret: session.client_secret,
        client_secret: session.client_secret,
      });
    }

    return NextResponse.json({ id: session.id, checkoutAttemptId: checkoutGuard.attemptId, url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe error creating checkout session';
    if (checkoutAttemptId) {
      await markCheckoutAttemptSessionFailed(checkoutAttemptId, message).catch((markError) => {
        console.warn('[checkout-guard] failed to mark checkout session failed', markError);
      });
    }
    console.error('POST /api/wallet error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
