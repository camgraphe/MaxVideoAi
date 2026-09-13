import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { MEMBERSHIP_PRICING_REFRESH_MESSAGE, requiresMembershipPricingRefresh } from '@/lib/membership-policy';
import { requireCurrentWebPricingPolicy } from './web-pricing-policy';

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
