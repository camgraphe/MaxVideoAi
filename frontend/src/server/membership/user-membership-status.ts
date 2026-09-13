import { LIVE_MEMBERSHIP_POLICY } from '@/lib/membership-policy';
import { query, type QueryExecutor } from '@/lib/db';
import {
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
  getMembershipTiers?(): Promise<MembershipTierConfig[]>;
};

type MembershipSpendRow = {
  sum_30: unknown;
  sum_today: unknown;
};

const defaultDependencies: UserMembershipStatusDependencies = { executor: { query } };

function parseLedgerCents(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^-?\d+$/u.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed)) throw new Error('Invalid membership spend result.');
  return parsed;
}

export function resolveAuthoritativeMembershipTier(
  spent30Cents: number,
  tiers: MembershipTierConfig[] = [],
): MembershipTierConfig & { tier: AuthoritativeMembershipTier } {
  if (!Number.isSafeInteger(spent30Cents)) throw new Error('Invalid membership spend result.');
  void tiers;
  return { tier: LIVE_MEMBERSHIP_POLICY.tier, spendThresholdCents: 0, discountPercent: 0 };
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
  const tiers: MembershipTierConfig[] = [];
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
