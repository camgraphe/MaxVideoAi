import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import Stripe from 'stripe';
import { ENV, isConnectPayments } from '@/lib/env';
import { computePricingSnapshot, getPlatformFeeCents, getVendorShareCents } from '@/lib/pricing';
import { randomUUID } from 'crypto';
import { ensureBillingSchema } from '@/lib/schema';
import { applyMockWalletTopUp, getMockWalletBalance } from '@/lib/wallet';
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

const WALLET_DISPLAY_CURRENCY = 'USD';
const WALLET_DISPLAY_CURRENCY_LOWER = 'usd';

async function resolveAuthenticatedUser(): Promise<string | null> {
  try {
    const supabase = createSupabaseRouteClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch {
    // ignore helper errors and fall back
  }
  return null;
}

export async function GET(req: NextRequest) {
  const userId = await resolveAuthenticatedUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let useMock = false;
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[wallet] falling back to mock ledger (schema init failed)', error);
    useMock = true;
  }

  let preferredCurrency: Currency | null = null;
  if (!useMock && databaseConfigured) {
    preferredCurrency = await getUserPreferredCurrency(userId);
  }
  const fallbackResolution = resolveCurrency(req, preferredCurrency ? { preferred_currency: preferredCurrency } : undefined);

  if (useMock || !databaseConfigured) {
    const balanceCents = getMockWalletBalance(userId);
    return NextResponse.json({
      balance: balanceCents / 100,
      currency: WALLET_DISPLAY_CURRENCY,
      settlementCurrency: fallbackResolution.currency.toUpperCase(),
      mock: true,
    });
  }

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
    return NextResponse.json({
      balance: balanceCents / 100,
      currency: walletCurrencyUpper,
      settlementCurrency: fallbackResolution.currency.toUpperCase(),
    });
  } catch (error) {
    console.warn('[wallet] query failed, using mock ledger', error);
    const balanceCents = getMockWalletBalance(userId);
    return NextResponse.json({
      balance: balanceCents / 100,
      currency: WALLET_DISPLAY_CURRENCY,
      settlementCurrency: fallbackResolution.currency.toUpperCase(),
      mock: true,
    });
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
    const balanceCents = applyMockWalletTopUp(userId, amountCents);
    return NextResponse.json({
      ok: true,
      balanceCents,
      currency: WALLET_DISPLAY_CURRENCY,
      settlementCurrency: resolvedCurrencyUpper,
      mock: true,
    });
  }

  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });

  if (body.mode === 'direct') {
    const engineId = String(body.engineId || '');
    const engine = await getConfiguredEngine(engineId);
    if (!engine) {
      return NextResponse.json({ error: 'Unknown engine' }, { status: 400 });
    }

    let durationSec = Number(body.durationSec ?? engine.maxDurationSec ?? 4);
    let resolution = String(body.resolution || engine.resolutions?.[0] || '1080p');
    const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : 't2v';
    let mode: Mode = 't2v';
    if (rawMode === 'i2v' || rawMode === 'i2i') {
      mode = rawMode as Mode;
    }
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
      membershipTier: body.membershipTier,
    });

    const destinationAccountId = isConnectPayments()
      ? pricing.vendorAccountId ?? ENV.COGS_VAULT_ACCOUNT_ID ?? process.env.COGS_VAULT_ACCOUNT_ID
      : null;

    if (isConnectPayments() && !destinationAccountId) {
      return NextResponse.json({ error: 'No destination account configured' }, { status: 503 });
    }

    const applicationFeeCents = getPlatformFeeCents(pricing);
    const vendorShareCents = getVendorShareCents(pricing);
    const settlementCurrencyUpper = resolvedCurrencyUpper;
    const { cents: settlementAmountCents, rate: fxRate, source: fxSource } = await convertCents(
      pricing.totalCents,
      WALLET_DISPLAY_CURRENCY_LOWER,
      resolvedCurrencyLower
    );
    const totalUsd = Math.max(1, pricing.totalCents);
    let applicationFeeSettlementCents = 0;
    let vendorShareSettlementCents = 0;
    if (isConnectPayments() && destinationAccountId) {
      applicationFeeSettlementCents = totalUsd > 0 ? Math.round((settlementAmountCents * applicationFeeCents) / totalUsd) : 0;
      vendorShareSettlementCents = Math.max(0, settlementAmountCents - applicationFeeSettlementCents);
    }
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
    if (isConnectPayments() && destinationAccountId) {
      metadata.destination_account_id = destinationAccountId;
      metadata.pricing_platform_fee_cents = String(applicationFeeCents);
      metadata.pricing_vendor_share_cents = String(vendorShareCents);
      metadata.vendor_share_cents = String(vendorShareCents);
      metadata.platform_fee_cents_settlement = String(applicationFeeSettlementCents);
      metadata.vendor_share_cents_settlement = String(vendorShareSettlementCents);
    }
    if (isConnectPayments() && pricing.vendorAccountId) {
      metadata.vendor_account_id = pricing.vendorAccountId;
    }

    try {
      const params: Stripe.PaymentIntentCreateParams = {
        amount: settlementAmountCents,
        currency: resolvedCurrencyLower,
        automatic_payment_methods: { enabled: true },
        metadata,
      };

      if (isConnectPayments() && destinationAccountId) {
        params.application_fee_amount = applicationFeeSettlementCents;
        params.transfer_data = { destination: destinationAccountId };
      }

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
        mode: isConnectPayments() ? 'connect' : 'platform',
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
    const destinationAccountId =
      isConnectPayments() ? ENV.COGS_VAULT_ACCOUNT_ID ?? process.env.COGS_VAULT_ACCOUNT_ID : null;

    if (isConnectPayments() && !destinationAccountId) {
      return NextResponse.json({ error: 'COGS vault account not configured' }, { status: 503 });
    }

    const sessionMetadata: Record<string, string> = {
      kind: 'topup',
      user_id: userId,
      wallet_currency: WALLET_DISPLAY_CURRENCY,
      wallet_amount_cents: String(amountCents),
      settlement_currency: resolvedCurrencyUpper,
      currency: resolvedCurrencyUpper,
      currency_source: currencyResolution.source,
    };
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

    let platformFeeCentsUsd = 0;
    let vendorShareCentsUsd = 0;
    let platformFeeCentsSettlement = 0;
    let vendorShareCentsSettlement = 0;
    if (isConnectPayments() && destinationAccountId) {
      platformFeeCentsUsd = Math.round(amountCents * 0.3);
      vendorShareCentsUsd = Math.max(0, amountCents - platformFeeCentsUsd);
      platformFeeCentsSettlement = amountCents > 0
        ? Math.round((settlementAmountCents * platformFeeCentsUsd) / amountCents)
        : 0;
      vendorShareCentsSettlement = Math.max(0, settlementAmountCents - platformFeeCentsSettlement);
      sessionMetadata.destination_account_id = destinationAccountId;
      sessionMetadata.platform_fee_cents = String(platformFeeCentsSettlement);
      sessionMetadata.vendor_share_cents = String(vendorShareCentsSettlement);
      sessionMetadata.platform_fee_cents_usd = String(platformFeeCentsUsd);
      sessionMetadata.vendor_share_cents_usd = String(vendorShareCentsUsd);
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${origin}/billing?status=success`,
      cancel_url: `${origin}/billing?status=cancelled`,
      line_items: [
        {
          price_data: {
            currency: resolvedCurrencyLower,
            product_data: { name: 'Wallet top-up' },
            unit_amount: settlementAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: sessionMetadata,
    };

    const paymentIntentMetadata: Record<string, string> = {
      ...sessionMetadata,
    };

    if (isConnectPayments() && destinationAccountId) {
      sessionParams.payment_intent_data = {
        application_fee_amount: platformFeeCentsSettlement,
        transfer_data: {
          destination: destinationAccountId,
        },
        metadata: paymentIntentMetadata,
      };
    } else {
      sessionParams.payment_intent_data = {
        metadata: paymentIntentMetadata,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.info('[payments] checkout session created', {
      sessionId: session.id,
      amountCents,
      settlementAmountCents,
      settlementCurrency: resolvedCurrencyUpper,
      currency: WALLET_DISPLAY_CURRENCY,
      fxRate,
      fxSource,
      currencySource: currencyResolution.source,
      currencyCountry: currencyResolution.country ?? null,
      userId,
      mode: isConnectPayments() ? 'connect' : 'platform',
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe error creating checkout session';
    console.error('POST /api/wallet error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
