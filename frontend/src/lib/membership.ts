import { isDatabaseConfigured, query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

export type MembershipTierConfig = {
  tier: string;
  spendThresholdCents: number;
  discountPercent: number;
};

export type MembershipTierLoadResult =
  | { status: 'loaded'; tiers: MembershipTierConfig[] }
  | { status: 'unavailable'; tiers: MembershipTierConfig[] };

type MembershipRow = {
  tier: string;
  spend_threshold_cents: string | number;
  discount_percent: string | number;
};

export const DEFAULT_MEMBERSHIP_TIERS: MembershipTierConfig[] = [
  { tier: 'member', spendThresholdCents: 0, discountPercent: 0 },
  { tier: 'plus', spendThresholdCents: 5_000, discountPercent: 0.05 },
  { tier: 'pro', spendThresholdCents: 20_000, discountPercent: 0.1 },
];

const CACHE_TTL_MS = 60_000;
let cachedTiers: MembershipTierConfig[] | null = null;
let cacheLoadedAt = 0;

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function sortTiers(tiers: MembershipTierConfig[]): MembershipTierConfig[] {
  return [...tiers].sort((a, b) => a.spendThresholdCents - b.spendThresholdCents);
}

function normaliseRow(row: MembershipRow): MembershipTierConfig {
  return {
    tier: row.tier,
    spendThresholdCents: Math.max(0, Math.round(toNumber(row.spend_threshold_cents))),
    discountPercent: Math.max(0, Number(toNumber(row.discount_percent).toFixed(6))),
  };
}

export async function loadMembershipTiersWithExecutor(
  executor: QueryExecutor,
  options: { lock?: boolean } = {}
): Promise<MembershipTierConfig[]> {
  const rows = await executor.query<MembershipRow>(
    `SELECT tier, spend_threshold_cents, discount_percent
       FROM app_membership_tiers
       ${options.lock ? 'FOR UPDATE' : ''}`
  );
  return sortTiers(rows.length ? rows.map(normaliseRow) : DEFAULT_MEMBERSHIP_TIERS);
}

async function loadTiers(): Promise<MembershipTierConfig[]> {
  if (cachedTiers && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedTiers;
  }

  if (!isDatabaseConfigured()) {
    cachedTiers = DEFAULT_MEMBERSHIP_TIERS;
    cacheLoadedAt = Date.now();
    return cachedTiers;
  }

  try {
    await ensureBillingSchema();
    const rows = await query<MembershipRow>(
      `SELECT tier, spend_threshold_cents, discount_percent
       FROM app_membership_tiers`
    );
    const tiers = rows.length ? rows.map(normaliseRow) : DEFAULT_MEMBERSHIP_TIERS;
    cachedTiers = sortTiers(tiers);
  } catch (error) {
    console.warn('[membership] failed to load tiers, using defaults', error);
    cachedTiers = DEFAULT_MEMBERSHIP_TIERS;
  }

  cacheLoadedAt = Date.now();
  return cachedTiers!;
}

export async function getMembershipTiers(): Promise<MembershipTierConfig[]> {
  return sortTiers(await loadTiers());
}

export async function getMembershipDiscountMap(): Promise<Record<string, number>> {
  const tiers = await loadTiers();
  return tiers.reduce<Record<string, number>>((acc, tier) => {
    acc[tier.tier.toLowerCase()] = tier.discountPercent;
    return acc;
  }, {});
}

export async function getMembershipThresholds(): Promise<MembershipTierConfig[]> {
  return getMembershipTiers();
}

export function invalidateMembershipCache(): void {
  cachedTiers = null;
  cacheLoadedAt = 0;
}

export type UpsertMembershipTierInput = {
  tier: string;
  spendThresholdCents: number;
  discountPercent: number;
  updatedBy?: string | null;
};

function normaliseTierInput(tier: UpsertMembershipTierInput): MembershipTierConfig {
  return {
    tier: tier.tier.trim().toLowerCase(),
    spendThresholdCents: Math.max(0, Math.round(tier.spendThresholdCents)),
    discountPercent: Math.max(0, Number(tier.discountPercent.toFixed(6))),
  };
}

export async function upsertMembershipTiersWithExecutor(
  executor: QueryExecutor,
  tiers: UpsertMembershipTierInput[],
  actorId: string
): Promise<MembershipTierConfig[]> {
  const updates = tiers.map(normaliseTierInput);
  for (const tier of updates) {
    await executor.query(
      `INSERT INTO app_membership_tiers (tier, spend_threshold_cents, discount_percent, updated_at, updated_by)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (tier)
       DO UPDATE SET
         spend_threshold_cents = EXCLUDED.spend_threshold_cents,
         discount_percent = EXCLUDED.discount_percent,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [tier.tier, tier.spendThresholdCents, tier.discountPercent, actorId]
    );
  }
  return sortTiers(updates);
}

export async function upsertMembershipTiers(tiers: UpsertMembershipTierInput[]): Promise<MembershipTierConfig[]> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database not configured');
  }
  await ensureBillingSchema();

  const actors = new Set(tiers.map((tier) => tier.updatedBy ?? null));
  if (actors.size !== 1) throw new Error('Membership tier updates require one actor');
  const actorId = [...actors][0];
  if (!actorId) throw new Error('Membership tier updates require an actor');
  const updates = await withDbTransaction((executor) =>
    upsertMembershipTiersWithExecutor(executor, tiers, actorId)
  );
  invalidateMembershipCache();
  return updates;
}
