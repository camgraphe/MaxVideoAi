import type {
  PricingChangeEvent,
} from '@/lib/admin/pricing-change-contract';

export const MEMBERSHIP_TIER_NAMES = ['member', 'plus', 'pro'] as const;
export type MembershipTierName = (typeof MEMBERSHIP_TIER_NAMES)[number];

export type MembershipTierDto = {
  tier: MembershipTierName;
  spendThresholdCents: number;
  discountPercent: number;
};

export type MembershipInventoryApiResponse = {
  ok: true;
  inventory: {
    databaseStatus: 'loaded' | 'unavailable';
    tiers: MembershipTierDto[];
    warnings: string[];
  };
};

export type MembershipHistoryApiResponse = { ok: true; events: PricingChangeEvent[] };
