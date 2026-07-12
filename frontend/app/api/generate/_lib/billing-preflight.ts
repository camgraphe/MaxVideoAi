import type { NextRequest } from 'next/server';
import Stripe from 'stripe';

import { ENV, receiptsPriceOnlyEnabled } from '@/lib/env';
import { getPlatformFeeCents } from '@/lib/pricing';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import { convertCents } from '@/lib/exchange';
import { buildEngineAddonInput, applyEngineVariantPricing } from '@/lib/pricing-addons';
import {
  ensureUserPreferredCurrency,
  getUserPreferredCurrency,
  resolveCurrency,
  type Currency,
} from '@/lib/currency';
import type { EngineCaps, Mode, PricingSnapshot } from '@/types/engines';
import { buildReceiptSnapshot } from './receipt-snapshot';
import type { PaymentMode, PendingReceipt } from './initial-video-job';

const DISPLAY_CURRENCY = 'USD';
const DISPLAY_CURRENCY_LOWER = 'usd';

type PaymentIntentLike = {
  id: string;
  status: string;
  amount?: number | null;
  amount_received?: number | null;
  currency?: string | null;
  latest_charge?: string | { id?: string | null } | null;
  metadata?: Record<string, string | undefined>;
};

type BillingPreflightDeps = {
  getUserPreferredCurrencyFn?: typeof getUserPreferredCurrency;
  resolveCurrencyFn?: typeof resolveCurrency;
  applyEngineVariantPricingFn?: typeof applyEngineVariantPricing;
  buildEngineAddonInputFn?: typeof buildEngineAddonInput;
  computePricingSnapshotFn?: typeof computeCanonicalBillingSnapshot;
  convertCentsFn?: typeof convertCents;
  receiptsPriceOnlyEnabledFn?: typeof receiptsPriceOnlyEnabled;
  buildReceiptSnapshotFn?: typeof buildReceiptSnapshot;
  getPlatformFeeCentsFn?: typeof getPlatformFeeCents;
  retrievePaymentIntentFn?: (paymentIntentId: string) => Promise<PaymentIntentLike>;
  ensureUserPreferredCurrencyFn?: typeof ensureUserPreferredCurrency;
};

export type GenerateBillingPreflight = {
  preferredCurrency: Currency | null;
  resolvedCurrencyLower: Currency;
  resolvedCurrencyUpper: string;
  pricing: PricingSnapshot;
  priceOnlyReceipts: boolean;
  costBreakdownUsd: Record<string, unknown> | null;
  receiptSnapshot: Record<string, unknown> | PricingSnapshot;
  pricingSnapshotJson: string;
  costBreakdownJson: string | null;
  vendorAccountId: string | null;
  applicationFeeCents: number;
  visibility: 'public' | 'private';
  indexable: boolean;
  paymentMode: PaymentMode;
  pendingReceipt: PendingReceipt | null;
  paymentStatus: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
};

export type GenerateBillingPreflightResult =
  | {
      ok: true;
      preflight: GenerateBillingPreflight;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
      metric?: {
        errorCode: string;
        meta?: Record<string, unknown>;
      };
    };

export async function resolveGenerateBillingPreflight(params: {
  req: NextRequest;
  engine: EngineCaps;
  mode: Mode;
  userId: string;
  payment: { mode?: PaymentMode; paymentIntentId?: string | null };
  jobId: string;
  durationSec: number;
  durationLabel: string | undefined;
  pricingResolution: string;
  effectiveResolution: string;
  aspectRatio: string | null;
  membershipTier: string | null | undefined;
  soraVariant?: string;
  isLumaRay2: boolean;
  loop: boolean;
  hasVideoInput?: boolean;
  rawDurationOption: number | string | null;
  lumaDurationLabel: string | null;
  audioEnabled: boolean | undefined;
  voiceControl: boolean;
  deps?: BillingPreflightDeps;
}): Promise<GenerateBillingPreflightResult> {
  const deps = params.deps ?? {};
  const getUserPreferredCurrencyFn = deps.getUserPreferredCurrencyFn ?? getUserPreferredCurrency;
  const resolveCurrencyFn = deps.resolveCurrencyFn ?? resolveCurrency;
  const applyEngineVariantPricingFn = deps.applyEngineVariantPricingFn ?? applyEngineVariantPricing;
  const buildEngineAddonInputFn = deps.buildEngineAddonInputFn ?? buildEngineAddonInput;
  const computePricingSnapshotFn = deps.computePricingSnapshotFn ?? computeCanonicalBillingSnapshot;
  const convertCentsFn = deps.convertCentsFn ?? convertCents;
  const receiptsPriceOnlyEnabledFn = deps.receiptsPriceOnlyEnabledFn ?? receiptsPriceOnlyEnabled;
  const buildReceiptSnapshotFn = deps.buildReceiptSnapshotFn ?? buildReceiptSnapshot;
  const getPlatformFeeCentsFn = deps.getPlatformFeeCentsFn ?? getPlatformFeeCents;
  const ensureUserPreferredCurrencyFn = deps.ensureUserPreferredCurrencyFn ?? ensureUserPreferredCurrency;

  let preferredCurrency = await getUserPreferredCurrencyFn(String(params.userId));
  const currencyResolution = resolveCurrencyFn(
    params.req,
    preferredCurrency ? { preferred_currency: preferredCurrency } : undefined
  );
  const resolvedCurrencyLower = currencyResolution.currency;
  const resolvedCurrencyUpper = resolvedCurrencyLower.toUpperCase();

  const pricingEngine = applyEngineVariantPricingFn(params.engine, params.mode);
  const pricingAddons = buildEngineAddonInputFn(pricingEngine, {
    audioEnabled: params.audioEnabled,
    voiceControl: params.voiceControl,
  });
  const pricing = await computePricingSnapshotFn({
    engine: pricingEngine,
    durationSec: params.durationSec,
    resolution: params.pricingResolution,
    aspectRatio: params.aspectRatio,
    mode: params.mode,
    membershipTier: params.membershipTier,
    loop: params.isLumaRay2 ? params.loop : undefined,
    hasVideoInput: params.hasVideoInput,
    durationOption: params.lumaDurationLabel ?? params.rawDurationOption ?? null,
    currency: DISPLAY_CURRENCY,
    addons: pricingAddons,
  });
  const { cents: settlementAmountCents, rate: settlementFxRate, source: settlementFxSource } = await convertCentsFn(
    pricing.totalCents,
    DISPLAY_CURRENCY_LOWER,
    resolvedCurrencyLower
  );

  const requestMeta: Record<string, unknown> = {
    engineId: params.engine.id,
    engineLabel: params.engine.label,
    mode: params.mode,
    durationSec: params.durationSec,
    variant: params.soraVariant,
    aspectRatio: params.aspectRatio ?? 'source',
    resolution: params.effectiveResolution,
    effectiveResolution: params.pricingResolution,
  };
  if (params.durationLabel) {
    requestMeta.durationLabel = params.durationLabel;
  }
  if (params.isLumaRay2) {
    requestMeta.loop = params.loop;
  }

  pricing.meta = {
    ...(pricing.meta ?? {}),
    request: requestMeta,
    currency_source: currencyResolution.source,
    currency_country: currencyResolution.country ?? null,
    display_currency: DISPLAY_CURRENCY,
    settlement_currency: resolvedCurrencyUpper,
    settlement_amount_cents: settlementAmountCents,
    settlement_fx_rate: settlementFxRate,
    settlement_fx_source: settlementFxSource,
  };

  const priceOnlyReceipts = receiptsPriceOnlyEnabledFn();
  const costBreakdownUsd = (pricing.meta?.cost_breakdown_usd as Record<string, unknown> | undefined) ?? null;
  const receiptSnapshot = priceOnlyReceipts ? buildReceiptSnapshotFn(pricing) : pricing;
  const pricingSnapshotJson = JSON.stringify(receiptSnapshot);
  const costBreakdownJson = !priceOnlyReceipts && costBreakdownUsd ? JSON.stringify(costBreakdownUsd) : null;

  const vendorAccountId: string | null = null;
  const applicationFeeCents = getPlatformFeeCentsFn(pricing);
  const visibility: 'public' | 'private' = 'private';
  const indexable = false;

  const paymentMode: PaymentMode = params.payment.mode ?? (params.userId ? 'wallet' : 'platform');
  let pendingReceipt: PendingReceipt | null = null;
  let paymentStatus = 'platform';
  let stripePaymentIntentId: string | null = null;
  let stripeChargeId: string | null = null;

  if (paymentMode === 'wallet') {
    const walletUserId = params.userId ? String(params.userId) : null;
    if (!walletUserId) {
      return {
        ok: false,
        status: 401,
        body: { ok: false, error: 'Wallet payment requires authentication' },
        metric: { errorCode: 'WALLET_AUTH_REQUIRED', meta: { paymentMode } },
      };
    }

    pendingReceipt = {
      userId: walletUserId,
      amountCents: pricing.totalCents,
      currency: DISPLAY_CURRENCY,
      description: `Run ${params.engine.label} - ${params.durationSec}s`,
      jobId: params.jobId,
      snapshot: receiptSnapshot,
      applicationFeeCents: priceOnlyReceipts ? null : applicationFeeCents,
      vendorAccountId,
    };
    paymentStatus = 'paid_wallet';
  } else if (paymentMode === 'direct') {
    if (!ENV.STRIPE_SECRET_KEY && !deps.retrievePaymentIntentFn) {
      return {
        ok: false,
        status: 501,
        body: { ok: false, error: 'Stripe not configured' },
        metric: { errorCode: 'STRIPE_NOT_CONFIGURED', meta: { paymentMode } },
      };
    }
    if (!params.userId) {
      return {
        ok: false,
        status: 401,
        body: { ok: false, error: 'Direct payment requires authentication' },
        metric: { errorCode: 'DIRECT_AUTH_REQUIRED', meta: { paymentMode } },
      };
    }
    if (!params.payment.paymentIntentId) {
      return {
        ok: false,
        status: 400,
        body: { ok: false, error: 'PaymentIntent required for direct mode' },
        metric: { errorCode: 'PAYMENT_INTENT_MISSING', meta: { paymentMode } },
      };
    }

    const intent = await retrievePaymentIntent(params.payment.paymentIntentId, deps.retrievePaymentIntentFn);
    const receivedSettlementCents = intent.amount_received ?? intent.amount ?? 0;
    const metadataSettlementCents = intent.metadata?.settlement_amount_cents
      ? Number(intent.metadata.settlement_amount_cents)
      : null;
    const expectedSettlementCents =
      metadataSettlementCents && metadataSettlementCents > 0
        ? metadataSettlementCents
        : (await convertCentsFn(pricing.totalCents, DISPLAY_CURRENCY_LOWER, resolvedCurrencyLower)).cents;
    if (intent.status !== 'succeeded' || receivedSettlementCents < expectedSettlementCents) {
      return {
        ok: false,
        status: 402,
        body: { ok: false, error: 'Payment not captured yet' },
        metric: { errorCode: 'PAYMENT_NOT_CAPTURED', meta: { paymentIntentId: intent.id } },
      };
    }

    const intentCurrency = intent.currency?.toUpperCase() ?? resolvedCurrencyUpper;
    if (intentCurrency !== resolvedCurrencyUpper) {
      console.warn('[payments] payment intent currency mismatch', {
        expected: resolvedCurrencyUpper,
        received: intentCurrency,
        userId: params.userId,
        paymentIntentId: intent.id,
      });
      return {
        ok: false,
        status: 409,
        body: {
          ok: false,
          error: `Wallet currency locked to ${resolvedCurrencyUpper}. Contact support to request a change.`,
        },
        metric: { errorCode: 'PAYMENT_CURRENCY_MISMATCH', meta: { expected: resolvedCurrencyUpper, received: intentCurrency } },
      };
    }
    if (!preferredCurrency) {
      await ensureUserPreferredCurrencyFn(String(params.userId), resolvedCurrencyLower);
      preferredCurrency = resolvedCurrencyLower;
    }

    stripePaymentIntentId = intent.id;
    stripeChargeId =
      typeof intent.latest_charge === 'string'
        ? intent.latest_charge
        : intent.latest_charge && typeof intent.latest_charge === 'object'
          ? intent.latest_charge.id ?? null
          : null;
    const intentJobId = typeof intent.metadata?.job_id === 'string' ? intent.metadata.job_id : null;
    if (intentJobId && intentJobId !== params.jobId) {
      return {
        ok: false,
        status: 409,
        body: { ok: false, error: 'Payment job mismatch' },
      };
    }

    const metadataWalletAmountCents = intent.metadata?.wallet_amount_cents
      ? Number(intent.metadata.wallet_amount_cents)
      : pricing.totalCents;

    pendingReceipt = {
      userId: String(params.userId),
      amountCents: metadataWalletAmountCents,
      currency: DISPLAY_CURRENCY,
      description: `Run ${params.engine.label} - ${params.durationSec}s`,
      jobId: params.jobId,
      snapshot: receiptSnapshot,
      applicationFeeCents: null,
      vendorAccountId,
      stripePaymentIntentId,
      stripeChargeId,
    };
    paymentStatus = 'paid_direct';
  } else if (paymentMode === 'platform') {
    paymentStatus = 'platform';
  } else {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: 'Unsupported payment mode' },
    };
  }

  return {
    ok: true,
    preflight: {
      preferredCurrency,
      resolvedCurrencyLower,
      resolvedCurrencyUpper,
      pricing,
      priceOnlyReceipts,
      costBreakdownUsd,
      receiptSnapshot,
      pricingSnapshotJson,
      costBreakdownJson,
      vendorAccountId,
      applicationFeeCents,
      visibility,
      indexable,
      paymentMode,
      pendingReceipt,
      paymentStatus,
      stripePaymentIntentId,
      stripeChargeId,
    },
  };
}

async function retrievePaymentIntent(
  paymentIntentId: string,
  retrievePaymentIntentFn: BillingPreflightDeps['retrievePaymentIntentFn']
): Promise<PaymentIntentLike> {
  if (retrievePaymentIntentFn) {
    return retrievePaymentIntentFn(paymentIntentId);
  }
  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
  return stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] }) as Promise<PaymentIntentLike>;
}
