import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { MEMBERSHIP_PRICING_REFRESH_MESSAGE, requiresMembershipPricingRefresh } from '@/lib/membership-policy';
import { requireCurrentWebPricingPolicy } from './web-pricing-policy';
import { CUSTOMER_TARIFF_REVISION_HEADER, customerTariffRevision } from '@/lib/customer-tariff-revision';
import type { PricingSnapshot } from '@/types/engines';
import { assertDisplayedCustomerTariffRevision, CustomerTariffRevisionError } from './customer-tariff-revision';

export function requireDisplayedWalletCustomerTariff(request: NextRequest, snapshot: unknown): NextResponse | null {
  try { assertDisplayedCustomerTariffRevision(request.headers.get(CUSTOMER_TARIFF_REVISION_HEADER), snapshot); }
  catch (error) {
    if (!(error instanceof CustomerTariffRevisionError)) throw error;
    return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
  }
  return null;
}

export function walletCustomerPricingMetadata(pricing: PricingSnapshot): Record<string, string> {
  const revision = customerTariffRevision(pricing);
  const snapshot = JSON.stringify(pricing);
  return {
    ...(pricing.meta?.ruleId ? { rule_id: String(pricing.meta.ruleId) } : {}),
    ...(revision !== null ? { customer_tariff_revision: String(revision) } : {}),
    ...(snapshot.length <= 450 ? { pricing_snapshot: snapshot } : {}),
  };
}

/** Protects unbound wallet-direct charges while leaving top-ups and hosted checkout unchanged. */
export function requireCurrentWalletDirectPricingPolicy(
  request: NextRequest,
  mode: string,
  membershipTier: unknown,
): NextResponse | null {
  if (mode !== 'direct') return null;
  const revisionError = requireCurrentWebPricingPolicy(request, 'video');
  if (revisionError) return revisionError;
  return requiresMembershipPricingRefresh(membershipTier)
    ? NextResponse.json({ error: 'PRICING_REFRESH_REQUIRED', message: MEMBERSHIP_PRICING_REFRESH_MESSAGE }, { status: 409 })
    : null;
}
