import { query, type QueryExecutor } from '@/lib/db';
import {
  getMembershipTiers,
  type MembershipTierConfig,
} from '@/lib/membership';

export type AuthoritativeMembershipTier = 'member' | 'plus' | 'pro';

export type MembershipPricingContext = {
  tier: AuthoritativeMembershipTier;
  source: 'app_receipts_rolling_30d';
  spent30Cents: number;
  thresholdCents: number;
  discountPercent: number;
};

export type UserMembershipStatus = {
  pricing: MembershipPricingContext;
  spent30Cents: number;
  spentTodayCents: number;
  tiers: MembershipTierConfig[];
};

export type UserMembershipStatusDependencies = {
  executor: QueryExecutor;
  getMembershipTiers(): Promise<MembershipTierConfig[]>;
};

type MembershipSpendRow = {
  sum_30: unknown;
  sum_today: unknown;
};

const CANONICAL_TIERS = ['member', 'plus', 'pro'] as const;

const defaultDependencies: UserMembershipStatusDependencies = {
  executor: { query },
  getMembershipTiers,
};

function parseLedgerCents(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+$/u.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed)) throw new Error('Invalid membership spend result.');
  return parsed;
}

function canonicalTier(value: unknown): AuthoritativeMembershipTier | null {
  return typeof value === 'string' && CANONICAL_TIERS.includes(value as AuthoritativeMembershipTier)
    ? value as AuthoritativeMembershipTier
    : null;
}

function validateTiers(tiers: MembershipTierConfig[]): MembershipTierConfig[] {
  if (!Array.isArray(tiers) || tiers.length !== CANONICAL_TIERS.length) {
    throw new Error('Invalid membership tier configuration.');
  }
  const normalized = tiers.map((tier) => {
    const id = canonicalTier(tier?.tier);
    if (
      !id
      || !Number.isSafeInteger(tier.spendThresholdCents)
      || tier.spendThresholdCents < 0
      || typeof tier.discountPercent !== 'number'
      || !Number.isFinite(tier.discountPercent)
      || tier.discountPercent < 0
      || tier.discountPercent > 1
    ) {
      throw new Error('Invalid membership tier configuration.');
    }
    return { ...tier, tier: id };
  }).sort((left, right) => left.spendThresholdCents - right.spendThresholdCents);
  if (
    new Set(normalized.map((tier) => tier.tier)).size !== CANONICAL_TIERS.length
    || normalized.some((tier, index) => tier.tier !== CANONICAL_TIERS[index])
    || normalized[0]?.spendThresholdCents !== 0
    || normalized.some((tier, index) => index > 0
      && tier.spendThresholdCents <= normalized[index - 1].spendThresholdCents)
    || normalized.some((tier, index) => index > 0
      && tier.discountPercent < normalized[index - 1].discountPercent)
  ) {
    throw new Error('Invalid membership tier configuration.');
  }
  return normalized;
}

export function resolveAuthoritativeMembershipTier(
  spent30Cents: number,
  tiers: MembershipTierConfig[],
): MembershipTierConfig & { tier: AuthoritativeMembershipTier } {
  if (!Number.isSafeInteger(spent30Cents)) throw new Error('Invalid membership spend result.');
  const validTiers = validateTiers(tiers);
  const normalizedSpend = Math.max(0, spent30Cents);
  let active = validTiers[0] as MembershipTierConfig & { tier: AuthoritativeMembershipTier };
  for (const tier of validTiers) {
    if (normalizedSpend >= tier.spendThresholdCents) {
      active = tier as MembershipTierConfig & { tier: AuthoritativeMembershipTier };
    }
  }
  return active;
}

export async function getUserMembershipStatus(
  userId: string,
  dependencies: UserMembershipStatusDependencies = defaultDependencies,
): Promise<UserMembershipStatus> {
  if (
    typeof userId !== 'string'
    || userId.length < 1
    || userId.length > 128
    || userId !== userId.trim()
  ) {
    throw new Error('Invalid membership account.');
  }
  const rows = await dependencies.executor.query<MembershipSpendRow>(
    `SELECT
        COALESCE(
          SUM(
            CASE
              WHEN type = 'charge' THEN amount_cents
              WHEN type = 'refund' THEN -amount_cents
              ELSE 0
            END
          ),
          0
        )::bigint::text AS sum_30,
        COALESCE(
          SUM(
            CASE
              WHEN created_at >= now() - interval '1 day' THEN
                CASE
                  WHEN type = 'charge' THEN amount_cents
                  WHEN type = 'refund' THEN -amount_cents
                  ELSE 0
                END
              ELSE 0
            END
          ),
          0
        )::bigint::text AS sum_today
     FROM app_receipts
    WHERE user_id = $1 AND created_at >= now() - interval '30 days'`,
    [userId],
  );
  if (rows.length !== 1) throw new Error('Invalid membership spend result.');
  const spent30Cents = parseLedgerCents(rows[0].sum_30);
  const spentTodayCents = parseLedgerCents(rows[0].sum_today);
  const tiers = validateTiers(await dependencies.getMembershipTiers());
  const active = resolveAuthoritativeMembershipTier(spent30Cents, tiers);
  return {
    pricing: {
      tier: active.tier,
      source: 'app_receipts_rolling_30d',
      spent30Cents: Math.max(0, spent30Cents),
      thresholdCents: active.spendThresholdCents,
      discountPercent: active.discountPercent,
    },
    spent30Cents,
    spentTodayCents,
    tiers,
  };
}
