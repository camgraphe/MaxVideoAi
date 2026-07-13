import type {
  PricingChangeEvent,
  PricingChangePreview,
} from '@/lib/admin/pricing-change-contract';

export const MEMBERSHIP_TIER_NAMES = ['member', 'plus', 'pro'] as const;
export type MembershipTierName = (typeof MEMBERSHIP_TIER_NAMES)[number];

export type MembershipTierDto = {
  tier: MembershipTierName;
  spendThresholdCents: number;
  discountPercent: number;
};

export type MembershipTierDraft = {
  tier: MembershipTierName;
  spendThresholdCents: string;
  discountPercent: string;
};

export type MembershipChangeProposal =
  | { operation: 'update'; tiers: MembershipTierDto[] }
  | { operation: 'rollback'; eventId: string };

export type MembershipInventoryApiResponse = {
  ok: true;
  inventory: {
    databaseStatus: 'loaded' | 'unavailable';
    tiers: MembershipTierDto[];
    warnings: string[];
  };
};

export type MembershipHistoryApiResponse = { ok: true; events: PricingChangeEvent[] };
export type MembershipPreviewApiResponse = { ok: true; preview: PricingChangePreview };
export type MembershipConfirmApiResponse = {
  ok: true;
  confirmation: {
    committed: true;
    operationalWarnings: Array<{ code: string; message: string }>;
  };
};

export type MembershipAdminError = { code: string; message: string };

export function createMembershipDraft(tiers: MembershipTierDto[]): MembershipTierDraft[] {
  const byTier = new Map(tiers.map((tier) => [tier.tier, tier]));
  return MEMBERSHIP_TIER_NAMES.map((tier) => {
    const value = byTier.get(tier);
    return {
      tier,
      spendThresholdCents: value ? String(value.spendThresholdCents) : '',
      discountPercent: value ? String(value.discountPercent) : '',
    };
  });
}

export function updateMembershipDraft(
  draft: MembershipTierDraft[],
  tier: MembershipTierName,
  field: 'spendThresholdCents' | 'discountPercent',
  value: string
): MembershipTierDraft[] {
  return draft.map((entry) => entry.tier === tier ? { ...entry, [field]: value } : entry);
}

export function buildMembershipProposal(draft: MembershipTierDraft[]): MembershipChangeProposal {
  return {
    operation: 'update',
    tiers: MEMBERSHIP_TIER_NAMES.map((tier) => {
      const entry = draft.find((candidate) => candidate.tier === tier);
      if (!entry) throw new Error(`Missing ${tier} tier`);
      const spendThresholdCents = Number(entry.spendThresholdCents);
      const discountPercent = Number(entry.discountPercent);
      if (!Number.isFinite(spendThresholdCents) || !Number.isFinite(discountPercent)) {
        throw new Error(`${tier} values must be numbers`);
      }
      return { tier, spendThresholdCents, discountPercent };
    }),
  };
}
