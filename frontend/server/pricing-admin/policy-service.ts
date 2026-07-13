import {
  PricingPolicyValidationError,
  resolvePricingPolicy,
  validatePricingPolicyOverrides,
  type PricingPolicyDocument,
  type PricingPolicyReferences,
  type PricingPolicyRule,
  type PricingPolicyScenario,
} from '@maxvideoai/pricing';

import { listFalEngines } from '@/config/falEngines';
import type {
  InsertPricingChangeEventInput,
  ListPricingChangeEventsInput,
  PricingChangeDomain,
  PricingChangeEvent,
  PricingChangeJsonObject,
  PricingChangeJsonValue,
  PricingChangeOperation,
} from '@/lib/admin/pricing-change-contract';
import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { buildPricingAuditScenarios } from '@/lib/pricing-audit/scenarios';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import {
  deletePricingRuleWithExecutor,
  invalidatePricingRulesCache,
  loadPricingPolicyOverrides,
  loadPricingPolicyOverridesWithExecutor,
  upsertPricingRuleWithExecutor,
  type PricingPolicyOverrideLoadResult,
  type PricingRule,
} from '@/lib/pricing-rule-store';

import {
  compareCanonicalAdminScenarios,
  quoteCanonicalAdminScenarios,
  resolveCanonicalAdminScenarioPolicy,
  selectAffectedPricingScenarios,
  type AdminCanonicalScenarioQuote,
  type PricingChangePreviewRow,
  type PricingScenarioSelector,
  type RequestedPricingSurcharge,
} from './canonical-scenarios';
import { PricingAdminError } from './errors';
import {
  getPricingChangeEventById,
  insertPricingChangeEvent,
  listLatestPricingChangeEventsByTargets,
  listPricingChangeEvents,
} from './event-store';
import { buildPricingPreviewFingerprint } from './fingerprint';
import { revalidatePricingChangeSurfaces } from './revalidation';

export type PricingPolicyChangeProposal =
  | { operation: 'create'; rule: unknown }
  | { operation: 'update'; targetId: string; rule: unknown }
  | { operation: 'delete'; targetId: string }
  | { operation: 'rollback'; targetId: string; eventId: string };

export type PricingChangePreview = {
  previewFingerprint: string;
  domain: 'policy_rule';
  operation: PricingChangeOperation;
  targetId: string;
  currentState: PricingChangeJsonValue | null;
  proposedState: PricingChangeJsonValue | null;
  affectedScenarioIds: string[];
  affectedSurfaces: string[];
  rows: PricingChangePreviewRow[];
  warnings: string[];
  rollbackEventId?: string;
};

export type PricingChangeConfirmation = {
  committed: true;
  preview: PricingChangePreview;
  persistedState: PricingChangeJsonValue | null;
  event: PricingChangeEvent;
  operationalWarnings: Array<{
    code: 'cache_invalidation_failed' | 'path_revalidation_failed';
    message: string;
  }>;
};

export type PricingPolicyInventoryRow = {
  selector: PricingScenarioSelector;
  versionedRule: PricingPolicyRule | null;
  databaseOverride: PricingPolicyRule | null;
  effectiveProvenance: AdminCanonicalScenarioQuote['policyProvenance'] | null;
  representativeQuotes: AdminCanonicalScenarioQuote[];
  routingContext: Pick<PricingRule, 'vendorAccountId' | 'effectiveFrom' | 'updatedAt' | 'updatedBy'> | null;
  lastEvent: PricingChangeEvent | null;
};

export type PricingPolicyInventoryResponse = {
  versionedPolicyVersion: number;
  databaseStatus: PricingPolicyOverrideLoadResult['status'];
  warnings: string[];
  rows: PricingPolicyInventoryRow[];
};

export type PricingPolicyServiceDependencies = {
  loadOverrides(executor?: QueryExecutor): Promise<PricingPolicyOverrideLoadResult>;
  getEvent(id: string, domain: PricingChangeDomain, executor?: QueryExecutor): Promise<PricingChangeEvent | null>;
  listLatestEventsByTargets(domain: PricingChangeDomain, targetIds: string[]): Promise<PricingChangeEvent[]>;
  listEvents(input?: ListPricingChangeEventsInput): Promise<PricingChangeEvent[]>;
  withTransaction<TResult>(callback: (executor: QueryExecutor) => Promise<TResult>): Promise<TResult>;
  upsertRule(executor: QueryExecutor, rule: PricingPolicyRule, actorId: string): Promise<PricingRule>;
  deleteRule(executor: QueryExecutor, id: string): Promise<PricingRule>;
  insertEvent(executor: QueryExecutor, input: InsertPricingChangeEventInput): Promise<PricingChangeEvent>;
  invalidateCache(): void;
  revalidate(preview: PricingChangePreview): void;
};

const DEFAULT_DEPENDENCIES: PricingPolicyServiceDependencies = {
  loadOverrides: (executor) =>
    executor
      ? loadPricingPolicyOverridesWithExecutor(executor, { lock: true })
      : loadPricingPolicyOverrides(),
  getEvent: (id, domain, executor) => getPricingChangeEventById(id, domain, executor),
  listLatestEventsByTargets: listLatestPricingChangeEventsByTargets,
  listEvents: listPricingChangeEvents,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  upsertRule: (executor, rule, actorId) => upsertPricingRuleWithExecutor(executor, rule, actorId),
  deleteRule: deletePricingRuleWithExecutor,
  insertEvent: insertPricingChangeEvent,
  invalidateCache: invalidatePricingRulesCache,
  revalidate: revalidatePricingChangeSurfaces,
};

type PreviewContext = {
  operation: PricingChangeOperation;
  targetId: string;
  currentRule: PricingPolicyRule | null;
  proposedRule: PricingPolicyRule | null;
  currentRules: PricingPolicyRule[];
  proposedRules: PricingPolicyRule[];
  currentRoutingRules: PricingRule[];
  rollbackEventId?: string;
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PricingAdminError('invalid_payload', `${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PricingAdminError('invalid_payload', `${label} is required`);
  }
  return value.trim();
}

function canonicalRule(rule: PricingPolicyRule): PricingPolicyRule {
  return {
    id: rule.id,
    ...(rule.engineId ? { engineId: rule.engineId } : {}),
    ...(rule.mode ? { mode: rule.mode } : {}),
    ...(rule.resolution ? { resolution: rule.resolution } : {}),
    marginPercent: rule.marginPercent,
    marginFlatCents: rule.marginFlatCents,
    surchargeAudioPercent: rule.surchargeAudioPercent,
    surchargeUpscalePercent: rule.surchargeUpscalePercent,
    currency: rule.currency,
    ...(rule.compatibilityProfile ? { compatibilityProfile: rule.compatibilityProfile } : {}),
  };
}

function jsonRule(rule: PricingPolicyRule | null): PricingChangeJsonValue | null {
  return rule ? (canonicalRule(rule) as unknown as PricingChangeJsonValue) : null;
}

function selectorOf(rule: PricingPolicyRule): PricingScenarioSelector {
  return {
    ...(rule.engineId ? { engineId: rule.engineId } : {}),
    ...(rule.mode ? { mode: rule.mode } : {}),
    ...(rule.resolution ? { resolution: rule.resolution } : {}),
  };
}

function selectorKey(rule: PricingPolicyRule): string {
  return `${rule.engineId ?? '*'}|${rule.mode ?? '*'}|${rule.resolution ?? '*'}`;
}

function scenarioSelectorKey(selector: PricingScenarioSelector): string {
  return `${selector.engineId ?? '*'}|${selector.mode ?? '*'}|${selector.resolution ?? '*'}`;
}

function buildReferences(policy: PricingPolicyDocument): PricingPolicyReferences {
  const engineIds = new Set<string>();
  const modesByEngineId = new Map<string, Set<string>>();
  const resolutionsByEngineId = new Map<string, Set<string>>();
  const add = (engineId: string, mode?: string, resolution?: string) => {
    engineIds.add(engineId);
    if (mode) {
      const modes = modesByEngineId.get(engineId) ?? new Set<string>();
      modes.add(mode);
      modesByEngineId.set(engineId, modes);
    }
    if (resolution) {
      const resolutions = resolutionsByEngineId.get(engineId) ?? new Set<string>();
      resolutions.add(resolution);
      resolutionsByEngineId.set(engineId, resolutions);
    }
  };
  listFalEngines().forEach((entry) => {
    const ids = new Set([entry.id, entry.engine.id]);
    ids.forEach((id) => {
      add(id);
      entry.modes.forEach((mode) => add(id, mode.mode));
      entry.engine.resolutions?.forEach((resolution) => add(id, undefined, resolution));
    });
  });
  buildPricingAuditScenarios().forEach((scenario) => add(scenario.engineId, scenario.mode, scenario.resolution));
  policy.rules.forEach((rule) => rule.engineId && add(rule.engineId, rule.mode, rule.resolution));
  return { engineIds, modesByEngineId, resolutionsByEngineId };
}

function mapValidationError(error: unknown): never {
  if (!(error instanceof PricingPolicyValidationError)) throw error;
  const mapped = {
    invalid_number: 'invalid_number',
    unsupported_currency: 'unsupported_currency',
    unknown_engine: 'unknown_engine',
    unknown_mode: 'unknown_mode',
    unknown_resolution: 'unknown_resolution',
    unknown_compatibility_profile: 'unknown_compatibility_profile',
    ambiguous_selector: 'ambiguous_selector',
  } as const;
  const code = mapped[error.code as keyof typeof mapped] ?? 'invalid_payload';
  throw new PricingAdminError(code, error.message);
}

function validateOverrides(rules: unknown[], policy: PricingPolicyDocument): PricingPolicyRule[] {
  try {
    return validatePricingPolicyOverrides(rules, policy, buildReferences(policy));
  } catch (error) {
    return mapValidationError(error);
  }
}

async function loadDatabaseRules(deps: PricingPolicyServiceDependencies): Promise<{
  rules: PricingPolicyRule[];
  routingRules: PricingRule[];
}> {
  const loaded = await deps.loadOverrides();
  if (loaded.status === 'unavailable') {
    throw new PricingAdminError('database_unavailable', 'Pricing policy database is unavailable');
  }
  return {
    rules: loaded.rules.map(canonicalRule),
    routingRules: (loaded.routingRules ?? []).map((rule) => ({ ...rule })),
  };
}

async function buildPreviewContext(
  proposalInput: PricingPolicyChangeProposal,
  deps: PricingPolicyServiceDependencies,
  policy: PricingPolicyDocument
): Promise<PreviewContext> {
  const proposal = asRecord(proposalInput, 'pricing policy proposal');
  const operationValue = proposal.operation;
  if (
    operationValue !== 'create' &&
    operationValue !== 'update' &&
    operationValue !== 'delete' &&
    operationValue !== 'rollback'
  ) {
    throw new PricingAdminError('invalid_payload', 'Unsupported pricing policy operation');
  }
  const operation = operationValue;
  const { rules: currentRules, routingRules: currentRoutingRules } = await loadDatabaseRules(deps);

  if (operation === 'rollback') {
    const requestedTargetId = requiredText(proposal.targetId, 'targetId');
    const eventId = requiredText(proposal.eventId, 'eventId');
    const event = await deps.getEvent(eventId, 'policy_rule');
    if (!event) throw new PricingAdminError('missing_target', 'Pricing change event not found');
    if (event.targetId !== requestedTargetId) {
      throw new PricingAdminError('missing_target', 'Pricing change event does not match the requested target');
    }
    const targetId = event.targetId;
    const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
    const currentRouting = currentRoutingRules.find((rule) => rule.id === targetId);
    if (event.previousState === null) {
      if (targetId === 'default') {
        throw new PricingAdminError('default_rule_delete_forbidden', 'The default pricing rule cannot be deleted');
      }
      if (!currentRule) throw new PricingAdminError('missing_target', 'Pricing rule not found');
      if (currentRouting?.vendorAccountId) {
        throw new PricingAdminError('routing_conflict', 'Cannot delete a pricing rule that owns vendor routing');
      }
      const proposedRules = validateOverrides(currentRules.filter((rule) => rule.id !== targetId), policy);
      return {
        operation,
        targetId,
        currentRule,
        proposedRule: null,
        currentRules,
        proposedRules,
        currentRoutingRules,
        rollbackEventId: eventId,
      };
    }
    const previousState = asRecord(event.previousState, 'rollback previousState');
    if (!currentRule && typeof previousState.vendorAccountId === 'string' && previousState.vendorAccountId.trim()) {
      throw new PricingAdminError('routing_conflict', 'Cannot recreate historical vendor routing from pricing policy state');
    }
    const previous = { ...previousState, id: targetId };
    const proposedRules = validateOverrides(
      [...currentRules.filter((rule) => rule.id !== targetId), previous],
      policy
    );
    const proposedRule = proposedRules.find((rule) => rule.id === targetId)!;
    return {
      operation,
      targetId,
      currentRule,
      proposedRule,
      currentRules,
      proposedRules,
      currentRoutingRules,
      rollbackEventId: eventId,
    };
  }

  if (operation === 'delete') {
    const targetId = requiredText(proposal.targetId, 'targetId');
    if (targetId === 'default') {
      throw new PricingAdminError('default_rule_delete_forbidden', 'The default pricing rule cannot be deleted');
    }
    const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
    if (!currentRule) throw new PricingAdminError('missing_target', 'Pricing rule not found');
    if (currentRoutingRules.find((rule) => rule.id === targetId)?.vendorAccountId) {
      throw new PricingAdminError('routing_conflict', 'Cannot delete a pricing rule that owns vendor routing');
    }
    const proposedRules = validateOverrides(currentRules.filter((rule) => rule.id !== targetId), policy);
    return { operation, targetId, currentRule, proposedRule: null, currentRules, proposedRules, currentRoutingRules };
  }

  const rawRule = asRecord(proposal.rule, 'rule');
  const targetId = operation === 'update' ? requiredText(proposal.targetId, 'targetId') : requiredText(rawRule.id, 'rule.id');
  const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
  if (operation === 'update' && !currentRule) throw new PricingAdminError('missing_target', 'Pricing rule not found');
  if (operation === 'create' && currentRule) {
    throw new PricingAdminError('invalid_payload', `Pricing rule ${targetId} already exists`);
  }
  const proposedRules = validateOverrides(
    [...currentRules.filter((rule) => rule.id !== targetId), { ...rawRule, id: targetId }],
    policy
  );
  const proposedRule = proposedRules.find((rule) => rule.id === targetId)!;
  return { operation, targetId, currentRule, proposedRule, currentRules, proposedRules, currentRoutingRules };
}

export function deriveRequestedPricingSurcharges(input: {
  selector: PricingScenarioSelector;
  currentRules: PricingPolicyRule[];
  proposedRules: PricingPolicyRule[];
}): RequestedPricingSurcharge[] {
  const scenarios = selectAffectedPricingScenarios(input.selector);
  if (!scenarios.length) return [];
  const changed = (field: 'surchargeAudioPercent' | 'surchargeUpscalePercent') =>
    scenarios.some((scenario) => {
      const current = resolveCanonicalAdminScenarioPolicy({ databaseRules: input.currentRules, scenario }).rule[field];
      const proposed = resolveCanonicalAdminScenarioPolicy({ databaseRules: input.proposedRules, scenario }).rule[field];
      return current !== proposed;
    });
  const changedKinds = [
    ...(changed('surchargeAudioPercent') ? ['audio' as const] : []),
    ...(changed('surchargeUpscalePercent') ? ['upscale' as const] : []),
  ];
  if (input.selector.engineId) {
    return changedKinds.map((kind) => ({ kind, selector: input.selector }));
  }

  const entries = listFalEngines();
  const supports = (engineId: string, kind: RequestedPricingSurcharge['kind']) => {
    const entry = entries.find((candidate) => candidate.id === engineId || candidate.engine.id === engineId);
    return kind === 'audio' ? entry?.engine.audio === true : entry?.engine.upscale4k === true;
  };
  const affectedEngineIds = [...new Set(scenarios.map((scenario) => scenario.engineId))].sort();
  return changedKinds.flatMap((kind) =>
    affectedEngineIds
      .filter((engineId) => supports(engineId, kind))
      .map((engineId) => ({ kind, selector: { engineId } }))
  );
}

function projectionJson(value: unknown): PricingChangeJsonValue {
  return JSON.parse(JSON.stringify(value)) as PricingChangeJsonValue;
}

function sortRules<T extends PricingPolicyRule>(rules: T[]): T[] {
  return [...rules].sort((left, right) =>
    `${selectorKey(left)}|${left.id}`.localeCompare(`${selectorKey(right)}|${right.id}`)
  );
}

export async function previewPricingPolicyChange(
  proposal: PricingPolicyChangeProposal,
  dependencies: PricingPolicyServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<PricingChangePreview> {
  const policy = getVersionedPricingPolicy();
  const context = await buildPreviewContext(proposal, dependencies, policy);
  const selectorRule = context.proposedRule ?? context.currentRule;
  if (!selectorRule) throw new PricingAdminError('missing_target', 'Pricing rule selector is unavailable');
  const selector = selectorOf(selectorRule);
  const scenarios = selectAffectedPricingScenarios(selector);
  if (!scenarios.length) throw new PricingAdminError('invalid_payload', 'No canonical pricing scenario matches this selector');
  const surchargeRequests = deriveRequestedPricingSurcharges({
    selector,
    currentRules: context.currentRules,
    proposedRules: context.proposedRules,
  });
  const currentOutcomes = quoteCanonicalAdminScenarios({
    databaseRules: context.currentRules,
    scenarios,
    requestedSurcharges: surchargeRequests,
  });
  const proposedOutcomes = quoteCanonicalAdminScenarios({
    databaseRules: context.proposedRules,
    scenarios,
    requestedSurcharges: surchargeRequests,
  });
  const unsupportedOutcomes = [...currentOutcomes, ...proposedOutcomes]
    .filter((outcome) => outcome.status === 'unsupported');
  const unsupportedScenarioIds = [...new Set(
    unsupportedOutcomes
      .filter((outcome) => outcome.scenarioId.startsWith('admin-surcharge:'))
      .map((outcome) => outcome.scenarioId)
  )];
  const warnings = [...new Set(
    unsupportedOutcomes
      .filter((outcome) => !outcome.scenarioId.startsWith('admin-surcharge:'))
      .map((outcome) => outcome.warning)
  )];
  const affectedScenarioIds = [...new Set(currentOutcomes.map((outcome) => outcome.scenarioId))].sort();
  const currentState = jsonRule(context.currentRule);
  const proposedState = jsonRule(context.proposedRule);
  const comparableCurrent = currentOutcomes.filter(
    (outcome): outcome is AdminCanonicalScenarioQuote => outcome.status === 'quoted'
  );
  const comparableProposed = proposedOutcomes.filter(
    (outcome): outcome is AdminCanonicalScenarioQuote => outcome.status === 'quoted'
  );
  const rows = unsupportedScenarioIds.length
    ? []
    : compareCanonicalAdminScenarios(comparableCurrent, comparableProposed);
  const previewFingerprint = buildPricingPreviewFingerprint({
    domain: 'policy_rule',
    operation: context.operation,
    targetId: context.targetId,
    currentState,
    proposedState,
    versionedPolicyVersion: policy.version,
    affectedScenarioIds,
    unsupportedScenarioIds,
    projectionState: projectionJson({
      currentDatabaseRules: sortRules(context.currentRules),
      currentRoutingRules: [...context.currentRoutingRules].sort((left, right) => left.id.localeCompare(right.id)),
      currentOutcomes,
      proposedOutcomes,
      rows,
    }),
  });
  if (!rows.length) throw new PricingAdminError('invalid_payload', 'Pricing proposal has no observable canonical impact');
  return {
    previewFingerprint,
    domain: 'policy_rule',
    operation: context.operation,
    targetId: context.targetId,
    currentState,
    proposedState,
    affectedScenarioIds,
    affectedSurfaces: [...new Set(rows.map((row) => row.surface))].sort(),
    rows,
    warnings,
    ...(context.rollbackEventId ? { rollbackEventId: context.rollbackEventId } : {}),
  };
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

export async function confirmPricingPolicyChange(
  proposal: PricingPolicyChangeProposal,
  fingerprint: string,
  actorId: string,
  dependencies: PricingPolicyServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<PricingChangeConfirmation> {
  const serverActorId = requiredText(actorId, 'actorId');
  const preview = await previewPricingPolicyChange(proposal, dependencies);
  if (!fingerprint || preview.previewFingerprint !== fingerprint) {
    throw new PricingAdminError('preview_stale', 'Pricing preview is stale; review the current impact again');
  }

  let result: { persistedState: PricingChangeJsonValue | null; event: PricingChangeEvent };
  try {
    result = await dependencies.withTransaction(async (executor) => {
      const transactionDependencies: PricingPolicyServiceDependencies = {
        ...dependencies,
        loadOverrides: () => dependencies.loadOverrides(executor),
        getEvent: (id, domain) => dependencies.getEvent(id, domain, executor),
      };
      const transactionPreview = await previewPricingPolicyChange(proposal, transactionDependencies);
      if (transactionPreview.previewFingerprint !== fingerprint) {
        throw new PricingAdminError('preview_stale', 'Pricing preview became stale before persistence');
      }
      let persistedState: PricingChangeJsonValue | null;
      if (transactionPreview.proposedState === null) {
        await dependencies.deleteRule(executor, transactionPreview.targetId);
        persistedState = null;
      } else {
        const persisted = await dependencies.upsertRule(
          executor,
          transactionPreview.proposedState as unknown as PricingPolicyRule,
          serverActorId
        );
        persistedState = jsonRule(persisted);
      }
      const event = await dependencies.insertEvent(executor, {
        domain: 'policy_rule',
        operation: transactionPreview.operation,
        targetId: transactionPreview.targetId,
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
    throw new PricingAdminError('persistence_failed', 'Failed to persist pricing policy change');
  }

  const operationalWarnings: PricingChangeConfirmation['operationalWarnings'] = [];
  try {
    dependencies.invalidateCache();
  } catch {
    operationalWarnings.push({
      code: 'cache_invalidation_failed',
      message: 'Pricing change committed; in-process cache invalidation failed.',
    });
  }
  try {
    dependencies.revalidate(preview);
  } catch {
    operationalWarnings.push({
      code: 'path_revalidation_failed',
      message: 'Pricing change committed; public path revalidation failed.',
    });
  }
  return { committed: true, preview, ...result, operationalWarnings };
}

export async function loadPricingPolicyHistory(
  filter: Omit<ListPricingChangeEventsInput, 'domain'> = {},
  dependencies: PricingPolicyServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<PricingChangeEvent[]> {
  return dependencies.listEvents({ ...filter, domain: 'policy_rule' });
}

export async function loadPricingPolicyInventory(
  dependencies: PricingPolicyServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<PricingPolicyInventoryResponse> {
  const policy = getVersionedPricingPolicy();
  const loaded = await dependencies.loadOverrides();
  const databaseRules = loaded.status === 'loaded' ? loaded.rules.map(canonicalRule) : [];
  const routingRules = loaded.status === 'loaded' ? loaded.routingRules ?? [] : [];
  const bySelector = new Map<string, {
    selector: PricingScenarioSelector;
    versionedRule: PricingPolicyRule | null;
    databaseOverride: PricingPolicyRule | null;
  }>();
  policy.rules.forEach((rule) => bySelector.set(selectorKey(rule), {
    selector: selectorOf(rule),
    versionedRule: canonicalRule(rule),
    databaseOverride: null,
  }));
  databaseRules.forEach((rule) => {
    const key = selectorKey(rule);
    const existing = bySelector.get(key) ?? {
      selector: selectorOf(rule),
      versionedRule: null,
      databaseOverride: null,
    };
    bySelector.set(key, { ...existing, databaseOverride: canonicalRule(rule) });
  });
  buildPricingAuditScenarios().forEach((scenario) => {
    const selector: PricingScenarioSelector = {
      engineId: scenario.engineId,
      ...(scenario.mode ? { mode: scenario.mode } : {}),
      ...(scenario.resolution ? { resolution: scenario.resolution } : {}),
    };
    const policyScenario: PricingPolicyScenario = { ...selector, engineId: scenario.engineId };
    const key = scenarioSelectorKey(selector);
    if (bySelector.has(key)) return;
    const versionedRule = resolvePricingPolicy({
      scenario: policyScenario,
      databaseRules: [],
      versionedRules: policy.rules,
    }).rule;
    const effective = resolvePricingPolicy({
      scenario: policyScenario,
      databaseRules,
      versionedRules: policy.rules,
    });
    bySelector.set(key, {
      selector,
      versionedRule: canonicalRule(versionedRule),
      databaseOverride:
        effective.source === 'database'
          ? databaseRules.find((rule) => rule.id === effective.sourceRuleId) ?? null
          : null,
    });
  });

  bySelector.forEach((entry, key) => {
    if (!entry.selector.engineId) return;
    const effective = resolvePricingPolicy({
      scenario: { ...entry.selector, engineId: entry.selector.engineId },
      databaseRules,
      versionedRules: policy.rules,
    });
    if (effective.source !== 'database') return;
    bySelector.set(key, {
      ...entry,
      databaseOverride: databaseRules.find((rule) => rule.id === effective.sourceRuleId) ?? null,
    });
  });

  const eventTargetIds = [...new Set(
    [...bySelector.values()].flatMap((entry) => [
      ...(entry.databaseOverride ? [entry.databaseOverride.id] : []),
      ...(entry.versionedRule ? [entry.versionedRule.id] : []),
    ])
  )];
  const latestEvents = loaded.status === 'loaded'
    ? await dependencies.listLatestEventsByTargets('policy_rule', eventTargetIds)
    : [];
  const latestEventByTarget = new Map(latestEvents.map((event) => [event.targetId, event]));

  const rows = [...bySelector.values()].map(({ selector, versionedRule, databaseOverride }): PricingPolicyInventoryRow => {
    const scenarios = selectAffectedPricingScenarios(selector);
    const outcomes = quoteCanonicalAdminScenarios({ databaseRules, scenarios: scenarios.slice(0, 6) });
    const representativeQuotes = outcomes.filter(
      (outcome): outcome is AdminCanonicalScenarioQuote => outcome.status === 'quoted'
    ).slice(0, 3);
    const representativeScenario = scenarios[0];
    const matchedVersionedRule =
      versionedRule ??
      (representativeScenario
        ? resolvePricingPolicy({
            scenario: {
              engineId: representativeScenario.engineId,
              ...(representativeScenario.mode ? { mode: representativeScenario.mode } : {}),
              ...(representativeScenario.resolution ? { resolution: representativeScenario.resolution } : {}),
            },
            databaseRules: [],
            versionedRules: policy.rules,
          }).rule
        : null);
    const effectiveProvenance = representativeScenario
      ? (() => {
          const resolved = resolveCanonicalAdminScenarioPolicy({ databaseRules, scenario: representativeScenario });
          const compatibilityProfile = representativeQuotes[0]?.policyProvenance.compatibilityProfile ??
            resolved.rule.compatibilityProfile ?? 'standard';
          return {
            source: resolved.source,
            matchedBy: resolved.matchedBy,
            sourceRuleId: resolved.sourceRuleId,
            compatibilityProfile,
          };
        })()
      : null;
    const routing = databaseOverride ? routingRules.find((rule) => rule.id === databaseOverride.id) : undefined;
    const targetId = databaseOverride?.id ?? matchedVersionedRule?.id;
    return {
      selector,
      versionedRule: matchedVersionedRule ? canonicalRule(matchedVersionedRule) : null,
      databaseOverride,
      effectiveProvenance,
      representativeQuotes,
      routingContext: routing
        ? {
            ...(routing.vendorAccountId ? { vendorAccountId: routing.vendorAccountId } : {}),
            ...(routing.effectiveFrom ? { effectiveFrom: routing.effectiveFrom } : {}),
            ...(routing.updatedAt ? { updatedAt: routing.updatedAt } : {}),
            ...(routing.updatedBy ? { updatedBy: routing.updatedBy } : {}),
          }
        : null,
      lastEvent: targetId ? latestEventByTarget.get(targetId) ?? null : null,
    };
  });

  return {
    versionedPolicyVersion: policy.version,
    databaseStatus: loaded.status,
    warnings: loaded.status === 'unavailable' ? ['Pricing policy database is unavailable; showing versioned policy only.'] : [],
    rows: rows.sort((left, right) => scenarioSelectorKey(left.selector).localeCompare(
      scenarioSelectorKey(right.selector)
    )),
  };
}
