/** Live product policy. `member` is the legacy wire name for standard pricing.
 * Historical snapshots and the canonical kernel retain their original discounts.
 */
export const LIVE_MEMBERSHIP_POLICY = Object.freeze({
  status: 'retired' as const,
  tier: 'member' as const,
  discountPercent: 0,
  thresholdCents: 0,
});

export const LIVE_MEMBERSHIP_DISCOUNTS = Object.freeze({ member: 0, plus: 0, pro: 0 });

export function retireMembershipPricing<T extends { tier: string; discountPercent: number; thresholdCents: number }>(context: T): T {
  return { ...context, tier: LIVE_MEMBERSHIP_POLICY.tier, discountPercent: 0, thresholdCents: 0 };
}

/** Old web tabs may still display a discounted quote without a bound amount. */
export function requiresMembershipPricingRefresh(tier: unknown): boolean {
  return typeof tier === 'string' && ['plus', 'pro'].includes(tier.trim().toLowerCase());
}

export const MEMBERSHIP_PRICING_REFRESH_MESSAGE = 'Membership discounts have ended. Refresh the page and review the standard price before generating.';

export const LIVE_PRICING_POLICY_REVISION = 'standard-2026-09-07';
export const PRICING_POLICY_HEADER = 'x-maxvideoai-pricing-policy';
