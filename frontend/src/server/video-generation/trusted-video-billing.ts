import { getPlatformFeeCents } from '@maxvideoai/pricing';

import type { GenerateBillingPreflightResult } from '@/app/api/generate/_lib/billing-preflight';
import { normalizeCurrencyCode } from '@/lib/currency';
import type {
  TrustedIncludedTrialBilling,
  TrustedQuotedBilling,
} from '@/server/generations/initial-job-reservation';
import type { PricingSnapshot } from '@/types/engines';

export function buildTrustedQuotedVideoBilling(params: {
  trustedQuotedBilling: TrustedQuotedBilling;
  engineLabel: string;
  userId: string;
  jobId: string;
  durationSec: number;
}): GenerateBillingPreflightResult {
  const pricing = JSON.parse(JSON.stringify(params.trustedQuotedBilling.pricing)) as PricingSnapshot;
  const currency = typeof pricing.currency === 'string' ? pricing.currency.toUpperCase() : '';
  const resolvedCurrencyLower = normalizeCurrencyCode(currency);
  if (!Number.isSafeInteger(pricing.totalCents)
    || pricing.totalCents < 0
    || !resolvedCurrencyLower
    || pricing.membershipTier !== params.trustedQuotedBilling.membershipTier) {
    throw new Error('Invalid trusted quoted video billing.');
  }
  const applicationFeeCents = getPlatformFeeCents(pricing);
  const vendorAccountId = typeof pricing.vendorAccountId === 'string' ? pricing.vendorAccountId : null;
  return {
    ok: true,
    preflight: {
      preferredCurrency: resolvedCurrencyLower,
      resolvedCurrencyLower,
      resolvedCurrencyUpper: currency,
      pricing,
      priceOnlyReceipts: false,
      costBreakdownUsd: null,
      receiptSnapshot: pricing,
      pricingSnapshotJson: JSON.stringify(pricing),
      costBreakdownJson: null,
      vendorAccountId,
      applicationFeeCents,
      visibility: 'private',
      indexable: false,
      paymentMode: 'wallet',
      pendingReceipt: {
        userId: params.userId,
        amountCents: pricing.totalCents,
        currency,
        description: `MCP ${params.engineLabel} - ${params.durationSec}s`,
        jobId: params.jobId,
        snapshot: pricing,
        applicationFeeCents,
        vendorAccountId,
      },
      paymentStatus: 'paid_wallet',
      stripePaymentIntentId: null,
      stripeChargeId: null,
    },
  };
}

export function buildTrustedIncludedTrialVideoBilling(
  trusted: TrustedIncludedTrialBilling,
): GenerateBillingPreflightResult {
  let normalPricing: PricingSnapshot;
  let pricingSnapshot: Record<string, unknown>;
  try {
    normalPricing = JSON.parse(JSON.stringify(trusted.normalPricing)) as PricingSnapshot;
    pricingSnapshot = JSON.parse(JSON.stringify(trusted.pricingSnapshot)) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid trusted included trial billing.');
  }
  const funding = pricingSnapshot.funding;
  const currency = typeof normalPricing.currency === 'string' ? normalPricing.currency.toUpperCase() : '';
  const resolvedCurrencyLower = normalizeCurrencyCode(currency);
  if (trusted.customerChargeCents !== 0
    || trusted.paymentStatus !== 'included_mcp_trial'
    || !Number.isSafeInteger(normalPricing.totalCents)
    || normalPricing.totalCents <= 0
    || normalPricing.membershipTier !== trusted.membershipTier
    || !resolvedCurrencyLower
    || !funding
    || typeof funding !== 'object'
    || Array.isArray(funding)
    || (funding as Record<string, unknown>).kind !== 'included_trial'
    || (funding as Record<string, unknown>).customerChargeCents !== 0
    || (funding as Record<string, unknown>).normalPriceCents !== normalPricing.totalCents) {
    throw new Error('Invalid trusted included trial billing.');
  }
  const pricing = { ...normalPricing, totalCents: 0 } as PricingSnapshot;
  const costBreakdownUsd = normalPricing.meta?.cost_breakdown_usd;
  return {
    ok: true,
    preflight: {
      preferredCurrency: null,
      resolvedCurrencyLower,
      resolvedCurrencyUpper: currency,
      pricing,
      priceOnlyReceipts: false,
      costBreakdownUsd: costBreakdownUsd && typeof costBreakdownUsd === 'object'
        ? costBreakdownUsd as Record<string, unknown>
        : null,
      receiptSnapshot: pricingSnapshot as unknown as PricingSnapshot,
      pricingSnapshotJson: JSON.stringify(pricingSnapshot),
      costBreakdownJson: null,
      vendorAccountId: typeof normalPricing.vendorAccountId === 'string' ? normalPricing.vendorAccountId : null,
      applicationFeeCents: 0,
      visibility: 'private',
      indexable: false,
      paymentMode: 'mcp_trial',
      pendingReceipt: null,
      paymentStatus: 'included_mcp_trial',
      stripePaymentIntentId: null,
      stripeChargeId: null,
    },
  };
}
