import type { PricingPolicyRule } from '@maxvideoai/pricing';

import type {
  InsertPricingChangeEventInput,
  ListPricingChangeEventsInput,
  PricingChangeEvent,
  PricingChangeJsonObject,
  PricingChangeJsonValue,
  PricingChangePreview,
  PricingChangePreviewRow,
} from '@/lib/admin/pricing-change-contract';
import { isDatabaseConfigured, query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import {
  DEFAULT_MEMBERSHIP_TIERS,
  invalidateMembershipCache,
  loadMembershipTiersWithExecutor,
  upsertMembershipTiersWithExecutor,
  type MembershipTierConfig,
  type MembershipTierLoadResult,
} from '@/lib/membership';
import { buildPricingAuditScenarios } from '@/lib/pricing-audit/scenarios';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import {
  loadPricingPolicyOverrides,
  loadPricingPolicyOverridesWithExecutor,
  type PricingPolicyOverrideLoadResult,
} from '@/lib/pricing-rule-store';
import { ensureBillingSchema } from '@/lib/schema';

import {
  compareCanonicalAdminScenarios,
  quoteCanonicalAdminScenarios,
  type AdminCanonicalScenarioQuote,
  type PricingMembershipDiscountMap,
} from './canonical-scenarios';
import { PricingAdminError } from './errors';
import {
  getPricingChangeEventById,
  insertPricingChangeEvent,
  listPricingChangeEvents,
} from './event-store';
import { buildPricingPreviewFingerprint } from './fingerprint';
import { revalidatePricingChangeSurfaces } from './revalidation';

const MEMBERSHIP_TARGET_ID = 'membership-tiers';
const MEMBERSHIP_TIER_NAMES = ['member', 'plus', 'pro'] as const;
type MembershipTierName = (typeof MEMBERSHIP_TIER_NAMES)[number];

export type MembershipChangeProposal =
  | { operation?: 'update'; tiers: unknown }
  | { operation: 'rollback'; targetId: string; eventId: string };

export type MembershipInventory = {
  databaseStatus: MembershipTierLoadResult['status'];
  tiers: MembershipTierConfig[];
  warnings: string[];
};

export type MembershipChangeConfirmation = {
  committed: true;
  preview: PricingChangePreview;
  persistedState: PricingChangeJsonValue;
  event: PricingChangeEvent;
  operationalWarnings: Array<{
    code: 'cache_invalidation_failed' | 'path_revalidation_failed';
    message: string;
  }>;
};

export type MembershipPricingServiceDependencies = {
  loadTiers(executor?: QueryExecutor): Promise<MembershipTierLoadResult>;
  loadRules(executor?: QueryExecutor): Promise<PricingPolicyOverrideLoadResult>;
  getEvent(id: string, domain: 'membership', executor?: QueryExecutor): Promise<PricingChangeEvent | null>;
  listEvents(input?: ListPricingChangeEventsInput): Promise<PricingChangeEvent[]>;
  withTransaction<TResult>(callback: (executor: QueryExecutor) => Promise<TResult>): Promise<TResult>;
  upsertTiers(
    executor: QueryExecutor,
    tiers: MembershipTierConfig[],
    actorId: string
  ): Promise<MembershipTierConfig[]>;
  insertEvent(executor: QueryExecutor, input: InsertPricingChangeEventInput): Promise<PricingChangeEvent>;
  invalidateCache(): void;
  revalidate(preview: PricingChangePreview): void;
};

async function loadDefaultTiers(executor?: QueryExecutor): Promise<MembershipTierLoadResult> {
  if (!isDatabaseConfigured()) {
    return { status: 'unavailable', tiers: cloneTiers(DEFAULT_MEMBERSHIP_TIERS) };
  }
  try {
    if (!executor) await ensureBillingSchema();
    const tiers = await loadMembershipTiersWithExecutor(executor ?? { query }, { lock: Boolean(executor) });
    return { status: 'loaded', tiers };
  } catch {
    return { status: 'unavailable', tiers: cloneTiers(DEFAULT_MEMBERSHIP_TIERS) };
  }
}

const DEFAULT_DEPENDENCIES: MembershipPricingServiceDependencies = {
  loadTiers: loadDefaultTiers,
  loadRules: (executor) =>
    executor
      ? loadPricingPolicyOverridesWithExecutor(executor, { lock: true })
      : loadPricingPolicyOverrides(),
  getEvent: (id, domain, executor) => getPricingChangeEventById(id, domain, executor),
  listEvents: listPricingChangeEvents,
  withTransaction: async (callback) => {
    if (!isDatabaseConfigured()) {
      throw new PricingAdminError('database_unavailable', 'Membership database is unavailable');
    }
    await ensureBillingSchema();
    return withDbTransaction((executor) => callback(executor));
  },
  upsertTiers: upsertMembershipTiersWithExecutor,
  insertEvent: insertPricingChangeEvent,
  invalidateCache: invalidateMembershipCache,
  revalidate: revalidatePricingChangeSurfaces,
};

function cloneTiers(tiers: MembershipTierConfig[]): MembershipTierConfig[] {
  return tiers.map((tier) => ({ ...tier }));
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PricingAdminError('invalid_payload', `${label} is required`);
  }
  return value.trim();
}

function tierName(value: unknown): MembershipTierName | null {
  return typeof value === 'string' && MEMBERSHIP_TIER_NAMES.includes(value as MembershipTierName)
    ? value as MembershipTierName
    : null;
}

function validateMembershipTiers(value: unknown): MembershipTierConfig[] {
  if (!Array.isArray(value) || value.length !== MEMBERSHIP_TIER_NAMES.length) {
    throw new PricingAdminError('invalid_payload', 'Membership tiers must contain exactly member, plus, and pro');
  }
  const tiers = value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new PricingAdminError('invalid_payload', 'Every membership tier must be an object');
    }
    const record = entry as Record<string, unknown>;
    const tier = tierName(record.tier);
    if (!tier) {
      throw new PricingAdminError('invalid_payload', 'Membership tiers must contain exactly member, plus, and pro');
    }
    if (!Number.isInteger(record.spendThresholdCents) || (record.spendThresholdCents as number) < 0) {
      throw new PricingAdminError('invalid_number', `${tier} threshold must be a non-negative integer`);
    }
    if (
      typeof record.discountPercent !== 'number' ||
      !Number.isFinite(record.discountPercent) ||
      record.discountPercent < 0 ||
      record.discountPercent > 1
    ) {
      throw new PricingAdminError('invalid_number', `${tier} discount must be between 0 and 1`);
    }
    return {
      tier,
      spendThresholdCents: record.spendThresholdCents as number,
      discountPercent: Number(record.discountPercent.toFixed(6)),
    };
  });
  const byName = new Map(tiers.map((tier) => [tier.tier, tier]));
  if (byName.size !== MEMBERSHIP_TIER_NAMES.length || MEMBERSHIP_TIER_NAMES.some((name) => !byName.has(name))) {
    throw new PricingAdminError('invalid_payload', 'Membership tiers must contain exactly member, plus, and pro');
  }
  const ordered = MEMBERSHIP_TIER_NAMES.map((name) => byName.get(name)!);
  if (
    ordered[0].spendThresholdCents > ordered[1].spendThresholdCents ||
    ordered[1].spendThresholdCents > ordered[2].spendThresholdCents
  ) {
    throw new PricingAdminError('invalid_number', 'Membership thresholds must be ordered member, plus, then pro');
  }
  return ordered;
}

function tiersJson(tiers: MembershipTierConfig[]): PricingChangeJsonValue {
  return tiers.map((tier) => ({
    tier: tier.tier,
    spendThresholdCents: tier.spendThresholdCents,
    discountPercent: tier.discountPercent,
  }));
}

function discountMap(tiers: MembershipTierConfig[]): PricingMembershipDiscountMap {
  const byTier = new Map(tiers.map((tier) => [tier.tier, tier.discountPercent]));
  return {
    member: byTier.get('member') ?? 0,
    plus: byTier.get('plus') ?? 0,
    pro: byTier.get('pro') ?? 0,
  };
}

function databaseRules(loaded: PricingPolicyOverrideLoadResult): PricingPolicyRule[] {
  if (loaded.status === 'unavailable') {
    throw new PricingAdminError('database_unavailable', 'Pricing policy database is unavailable');
  }
  return loaded.rules;
}

function loadedTiers(result: MembershipTierLoadResult): MembershipTierConfig[] {
  if (result.status === 'unavailable') {
    throw new PricingAdminError('database_unavailable', 'Membership database is unavailable');
  }
  return validateMembershipTiers(result.tiers);
}

type MembershipPreviewContext = {
  operation: 'update' | 'rollback';
  currentTiers: MembershipTierConfig[];
  proposedTiers: MembershipTierConfig[];
  databaseRules: PricingPolicyRule[];
  rollbackEventId?: string;
};

async function buildPreviewContext(
  proposal: MembershipChangeProposal,
  dependencies: MembershipPricingServiceDependencies,
  executor?: QueryExecutor
): Promise<MembershipPreviewContext> {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new PricingAdminError('invalid_payload', 'Membership proposal must be an object');
  }
  const currentTiers = loadedTiers(await dependencies.loadTiers(executor));
  const rules = databaseRules(await dependencies.loadRules(executor));
  if (proposal.operation === 'rollback') {
    const targetId = requiredText(proposal.targetId, 'targetId');
    if (targetId !== MEMBERSHIP_TARGET_ID) {
      throw new PricingAdminError('missing_target', 'Membership change event not found');
    }
    const eventId = requiredText(proposal.eventId, 'eventId');
    const event = await dependencies.getEvent(eventId, 'membership', executor);
    if (!event || event.targetId !== targetId) {
      throw new PricingAdminError('missing_target', 'Membership change event not found');
    }
    return {
      operation: 'rollback',
      currentTiers,
      proposedTiers: validateMembershipTiers(event.previousState),
      databaseRules: rules,
      rollbackEventId: eventId,
    };
  }
  if (proposal.operation !== undefined && proposal.operation !== 'update') {
    throw new PricingAdminError('invalid_payload', 'Unsupported membership operation');
  }
  return {
    operation: 'update',
    currentTiers,
    proposedTiers: validateMembershipTiers(proposal.tiers),
    databaseRules: rules,
  };
}

function quoteProjectionState(quotes: AdminCanonicalScenarioQuote[]): PricingChangeJsonValue {
  return quotes.map((quote) => ({
    scenarioId: quote.scenarioId,
    customerTotalCents: quote.customerTotalCents,
    discountCents: quote.discountCents,
    policyProvenance: quote.policyProvenance,
  })) as PricingChangeJsonValue;
}

function previewRowsProjection(rows: PricingChangePreviewRow[]): PricingChangeJsonValue {
  return rows.map((row) => ({
    scenarioId: row.scenarioId,
    engineId: row.engineId,
    surface: row.surface,
    currentTotalCents: row.currentTotalCents,
    proposedTotalCents: row.proposedTotalCents,
    deltaCents: row.deltaCents,
    deltaPercent: row.deltaPercent,
    currentProvenance: row.currentProvenance,
    proposedProvenance: row.proposedProvenance,
    compatibilityProfile: row.compatibilityProfile,
  })) as PricingChangeJsonValue;
}

function firstQuoted(outcomes: ReturnType<typeof quoteCanonicalAdminScenarios>): AdminCanonicalScenarioQuote {
  const quote = outcomes.find((outcome): outcome is AdminCanonicalScenarioQuote => outcome.status === 'quoted');
  if (!quote) throw new PricingAdminError('unsupported_scenario', 'No canonical membership scenario can be quoted');
  return quote;
}

function buildEligibilityRow(
  tier: MembershipTierName,
  quote: AdminCanonicalScenarioQuote
): PricingChangePreviewRow {
  return {
    scenarioId: `membership-eligibility:${tier}`,
    engineId: quote.engineId,
    surface: quote.surface,
    currentTotalCents: quote.customerTotalCents,
    proposedTotalCents: quote.customerTotalCents,
    deltaCents: 0,
    deltaPercent: 0,
    currentProvenance: { ...quote.policyProvenance },
    proposedProvenance: { ...quote.policyProvenance },
    compatibilityProfile: quote.policyProvenance.compatibilityProfile,
  };
}

async function previewMembershipChangeWithExecutor(
  proposal: MembershipChangeProposal,
  dependencies: MembershipPricingServiceDependencies,
  executor?: QueryExecutor
): Promise<PricingChangePreview> {
  const context = await buildPreviewContext(proposal, dependencies, executor);
  const currentByTier = new Map(context.currentTiers.map((tier) => [tier.tier, tier]));
  const proposedByTier = new Map(context.proposedTiers.map((tier) => [tier.tier, tier]));
  const discountChanged = MEMBERSHIP_TIER_NAMES.filter(
    (tier) => currentByTier.get(tier)!.discountPercent !== proposedByTier.get(tier)!.discountPercent
  );
  const thresholdChanged = MEMBERSHIP_TIER_NAMES.filter(
    (tier) => currentByTier.get(tier)!.spendThresholdCents !== proposedByTier.get(tier)!.spendThresholdCents
  );
  if (!discountChanged.length && !thresholdChanged.length) {
    throw new PricingAdminError('invalid_payload', 'Membership change has no effect after normalization');
  }
  const scenarios = buildPricingAuditScenarios().filter(
    (scenario) => scenario.surface === 'billing' && discountChanged.includes(scenario.membershipTier ?? 'member')
  );
  const currentOutcomes = quoteCanonicalAdminScenarios({
    databaseRules: context.databaseRules,
    scenarios,
    membershipDiscounts: discountMap(context.currentTiers),
  });
  const proposedOutcomes = quoteCanonicalAdminScenarios({
    databaseRules: context.databaseRules,
    scenarios,
    membershipDiscounts: discountMap(context.proposedTiers),
  });
  const unsupported = [...currentOutcomes, ...proposedOutcomes].filter((outcome) => outcome.status === 'unsupported');
  if (unsupported.length) {
    throw new PricingAdminError('unsupported_scenario', unsupported[0]!.warning);
  }
  const currentQuotes = currentOutcomes as AdminCanonicalScenarioQuote[];
  const proposedQuotes = proposedOutcomes as AdminCanonicalScenarioQuote[];
  const rows: PricingChangePreviewRow[] = compareCanonicalAdminScenarios(currentQuotes, proposedQuotes);
  const warnings: string[] = [];
  for (const tier of thresholdChanged) {
    const currentTier = currentByTier.get(tier)!;
    const proposedTier = proposedByTier.get(tier)!;
    warnings.push(
      `${tier} eligibility threshold changes from ${currentTier.spendThresholdCents.toLocaleString('en-US')} to ${proposedTier.spendThresholdCents.toLocaleString('en-US')} cents.`
    );
    if (!discountChanged.includes(tier)) {
      const representativeScenario = buildPricingAuditScenarios().find(
        (scenario) => scenario.surface === 'billing' && scenario.membershipTier === tier
      );
      if (!representativeScenario) {
        throw new PricingAdminError('unsupported_scenario', `No canonical eligibility scenario exists for ${tier}`);
      }
      rows.push(buildEligibilityRow(tier, firstQuoted(quoteCanonicalAdminScenarios({
        databaseRules: context.databaseRules,
        scenarios: [representativeScenario],
        membershipDiscounts: discountMap(context.currentTiers),
      }))));
    }
  }
  rows.sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));
  const affectedScenarioIds = rows.map((row) => row.scenarioId);
  const currentState = tiersJson(context.currentTiers);
  const proposedState = tiersJson(context.proposedTiers);
  const projectionState: PricingChangeJsonValue = {
    current: quoteProjectionState(currentQuotes),
    proposed: quoteProjectionState(proposedQuotes),
    displayedRows: previewRowsProjection(rows),
    ...(context.rollbackEventId ? { rollbackEventId: context.rollbackEventId } : {}),
  };
  const previewFingerprint = buildPricingPreviewFingerprint({
    domain: 'membership',
    operation: context.operation,
    targetId: MEMBERSHIP_TARGET_ID,
    currentState,
    proposedState,
    versionedPolicyVersion: getVersionedPricingPolicy().version,
    affectedScenarioIds,
    unsupportedScenarioIds: [],
    projectionState,
  });
  return {
    previewFingerprint,
    domain: 'membership',
    operation: context.operation,
    targetId: MEMBERSHIP_TARGET_ID,
    currentState,
    proposedState,
    affectedScenarioIds,
    affectedSurfaces: [...new Set(rows.map((row) => row.surface))].sort(),
    rows,
    warnings,
    ...(context.rollbackEventId ? { rollbackEventId: context.rollbackEventId } : {}),
  };
}

export function previewMembershipChange(
  proposal: MembershipChangeProposal,
  dependencies: MembershipPricingServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<PricingChangePreview> {
  return previewMembershipChangeWithExecutor(proposal, dependencies);
}

function previewSummary(preview: PricingChangePreview): PricingChangeJsonObject {
  const deltas = preview.rows.map((row) => row.deltaCents);
  return {
    previewFingerprint: preview.previewFingerprint,
    affectedSurfaces: preview.affectedSurfaces,
    rowCount: preview.rows.length,
    deltaCents: preview.rows.reduce((sum, row) => sum + row.deltaCents, 0),
    minimumDeltaCents: deltas.length ? Math.min(...deltas) : 0,
    maximumDeltaCents: deltas.length ? Math.max(...deltas) : 0,
    ...(preview.rollbackEventId ? { rollbackEventId: preview.rollbackEventId } : {}),
  };
}

export async function confirmMembershipChange(
  proposal: MembershipChangeProposal,
  fingerprint: string,
  actorId: string,
  dependencies: MembershipPricingServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<MembershipChangeConfirmation> {
  const serverActorId = requiredText(actorId, 'actorId');
  const preview = await previewMembershipChange(proposal, dependencies);
  if (!fingerprint || preview.previewFingerprint !== fingerprint) {
    throw new PricingAdminError('preview_stale', 'Membership preview is stale; review the current impact again');
  }
  let result: { persistedState: PricingChangeJsonValue; event: PricingChangeEvent };
  try {
    result = await dependencies.withTransaction(async (executor) => {
      const transactionPreview = await previewMembershipChangeWithExecutor(proposal, dependencies, executor);
      if (transactionPreview.previewFingerprint !== fingerprint) {
        throw new PricingAdminError('preview_stale', 'Membership preview became stale before persistence');
      }
      const proposedTiers = validateMembershipTiers(transactionPreview.proposedState);
      const persisted = await dependencies.upsertTiers(executor, proposedTiers, serverActorId);
      const persistedState = tiersJson(persisted);
      const event = await dependencies.insertEvent(executor, {
        domain: 'membership',
        operation: transactionPreview.operation,
        targetId: MEMBERSHIP_TARGET_ID,
        actorId: serverActorId,
        previousState: transactionPreview.currentState,
        nextState: transactionPreview.proposedState,
        previewSummary: previewSummary(transactionPreview),
        affectedScenarioIds: transactionPreview.affectedScenarioIds,
      });
      return { persistedState, event };
    });
  } catch (error) {
    if (error instanceof PricingAdminError) throw error;
    throw new PricingAdminError('persistence_failed', 'Failed to persist membership change');
  }
  const operationalWarnings: MembershipChangeConfirmation['operationalWarnings'] = [];
  try {
    dependencies.invalidateCache();
  } catch {
    operationalWarnings.push({
      code: 'cache_invalidation_failed',
      message: 'Membership change committed; in-process cache invalidation failed.',
    });
  }
  try {
    dependencies.revalidate(preview);
  } catch {
    operationalWarnings.push({
      code: 'path_revalidation_failed',
      message: 'Membership change committed; public path revalidation failed.',
    });
  }
  return { committed: true, preview, ...result, operationalWarnings };
}

export async function loadMembershipInventory(
  dependencies: MembershipPricingServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<MembershipInventory> {
  const loaded = await dependencies.loadTiers();
  return {
    databaseStatus: loaded.status,
    tiers: loaded.status === 'loaded' ? validateMembershipTiers(loaded.tiers) : cloneTiers(DEFAULT_MEMBERSHIP_TIERS),
    warnings: loaded.status === 'unavailable' ? ['Membership database is unavailable; showing defaults only.'] : [],
  };
}

export function loadMembershipHistory(
  filter: Omit<ListPricingChangeEventsInput, 'domain'> = {},
  dependencies: MembershipPricingServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<PricingChangeEvent[]> {
  return dependencies.listEvents({ ...filter, domain: 'membership' });
}
