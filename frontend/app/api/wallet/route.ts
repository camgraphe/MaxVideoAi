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
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';
import { CONSENT_COOKIE_NAME, parseConsent } from '@/lib/consent';
import { findTopupTier } from '@/config/topupTiers';
import { extractGaClientId } from '@/server/ga4';
import { buildWalletTopUpCheckoutSessionParams } from '@/lib/stripe-checkout';
import { defaultLocale, type AppLocale } from '@/i18n/locales';
import { getOrCreateStripeCustomerForUser } from '@/server/stripe-customers';

const WALLET_DISPLAY_CURRENCY = 'USD';
const WALLET_DISPLAY_CURRENCY_LOWER = 'usd';
const STRIPE_TAX_CODE_ELECTRONIC_SERVICES = ENV.STRIPE_TAX_CODE_ELECTRONIC_SERVICES ?? 'txcd_10103001';
const STRIPE_API_VERSION = '2023-10-16';
const STRIPE_CHECKOUT_ELEMENTS_API_VERSION = '2026-03-25.dahlia' as Stripe.LatestApiVersion;
const CHECKOUT_COPY_BY_LOCALE: Record<
  AppLocale,
  {
    productName: string;
    taxLocationMessage: string;
  }
> = {
  en: {
    productName: 'Wallet top-up',
    taxLocationMessage: 'Used only to confirm tax location for this digital wallet top-up.',
  },
  fr: {
    productName: 'Recharge portefeuille',
    taxLocationMessage: 'Utilisee uniquement pour confirmer la localisation fiscale de cette recharge digitale.',
  },
  es: {
    productName: 'Recarga de billetera',
    taxLocationMessage: 'Se usa solo para confirmar la ubicacion fiscal de esta recarga digital.',
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

async function resolveAuthenticatedUser(): Promise<string | null> {
  try {
    const supabase = createSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      return user.id;
    }
  } catch {
    // ignore helper errors and fall back
  }
  return null;
}

export async function GET(req: NextRequest) {
  const userId = await resolveAuthenticatedUser();
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
    const rows = await query<{ type: string; amount_cents: number | string | null; currency: string | null }>(
      `SELECT type, amount_cents, currency FROM app_receipts WHERE user_id = $1`,
      [userId]
    );

    let walletCurrency: Currency | null = preferredCurrency ?? null;
    const mismatchedCurrencies = new Set<string>();

    for (const row of rows) {
      const normalized = normalizeCurrencyCode(row.currency);
      if (!walletCurrency && normalized) {
        walletCurrency = normalized;
        continue;
      }
      if (walletCurrency && normalized && normalized !== walletCurrency) {
        mismatchedCurrencies.add(normalized);
      }
    }

    walletCurrency = WALLET_DISPLAY_CURRENCY_LOWER as Currency;
    const normalizedMismatches = Array.from(mismatchedCurrencies).filter(
      (currency) => currency !== walletCurrency
    );

    if (normalizedMismatches.length) {
      console.warn('[wallet] detected receipts with mismatched currency', {
        userId,
        walletCurrency,
        mismatched: normalizedMismatches,
      });
    }

    const walletCurrencyUpper = WALLET_DISPLAY_CURRENCY;
    let topups = 0;
    let charges = 0;
    let refunds = 0;
    for (const r of rows) {
      const normalized = normalizeCurrencyCode(r.currency);
      if (normalized && normalized.toUpperCase() !== walletCurrencyUpper) {
        continue;
      }
      const amount = Number(r.amount_cents ?? 0);
      if (!Number.isFinite(amount)) continue;
      if (r.type === 'topup') topups += amount;
      if (r.type === 'charge') charges += amount;
      if (r.type === 'refund') refunds += amount;
    }

    const balanceCents = Math.max(0, topups + refunds - charges);
    return json({
      balance: balanceCents / 100,
      currency: walletCurrencyUpper,
      settlementCurrency: fallbackResolution.currency.toUpperCase(),
    });
  } catch (error) {
    console.warn('[wallet] query failed', error);
    return json({ error: 'Wallet lookup failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveAuthenticatedUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const amountCents = Math.max(1000, Number(body.amountCents ?? 0));
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

  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY!, {
    apiVersion: isExpressCheckoutTopUp ? STRIPE_CHECKOUT_ELEMENTS_API_VERSION : STRIPE_API_VERSION,
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

  try {
    // Create a one-off Checkout Session for top-up
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
    };
    const tier = findTopupTier({ usdAmountCents: amountCents });
    sessionMetadata.topup_tier_id = tier?.id ?? 'custom';
    if (tier?.label) {
      sessionMetadata.topup_tier_label = tier.label;
    }
    const analyticsConsentGranted = hasAnalyticsConsent(req);
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
    const successUrl = `${origin}/billing?status=success&${topupRedirectParams.toString()}`;
    const cancelUrl = `${origin}/billing?status=cancelled&${topupRedirectParams.toString()}`;

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
      taxLocationMessage: checkoutCopy.taxLocationMessage,
      sessionMetadata,
      paymentIntentMetadata,
      productTaxCode: STRIPE_TAX_CODE_ELECTRONIC_SERVICES,
      customer: stripeCustomerId,
      customerUpdate: {
        address: 'auto',
        name: 'auto',
        shipping: 'auto',
      },
    });

    const session = await stripe.checkout.sessions.create(sessionParams as Stripe.Checkout.SessionCreateParams);

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
        clientSecret: session.client_secret,
        client_secret: session.client_secret,
      });
    }

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe error creating checkout session';
    console.error('POST /api/wallet error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
