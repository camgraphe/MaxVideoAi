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
import { insertPricingChangeEvent, listPricingChangeEvents } from './event-store';
import { buildPricingPreviewFingerprint } from './fingerprint';
import { revalidatePricingChangeSurfaces } from './revalidation';

export type PricingPolicyChangeProposal =
  | { operation: 'create'; rule: unknown }
  | { operation: 'update'; targetId: string; rule: unknown }
  | { operation: 'delete'; targetId: string }
  | { operation: 'rollback'; eventId: string };

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
  preview: PricingChangePreview;
  persistedState: PricingChangeJsonValue | null;
  event: PricingChangeEvent;
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
  loadOverrides(): Promise<PricingPolicyOverrideLoadResult>;
  listEvents(input?: ListPricingChangeEventsInput): Promise<PricingChangeEvent[]>;
  withTransaction<TResult>(callback: (executor: QueryExecutor) => Promise<TResult>): Promise<TResult>;
  upsertRule(executor: QueryExecutor, rule: PricingPolicyRule, actorId: string): Promise<PricingRule>;
  deleteRule(executor: QueryExecutor, id: string): Promise<PricingRule>;
  insertEvent(executor: QueryExecutor, input: InsertPricingChangeEventInput): Promise<PricingChangeEvent>;
  invalidateCache(): void;
  revalidate(preview: PricingChangePreview): void;
};

const DEFAULT_DEPENDENCIES: PricingPolicyServiceDependencies = {
  loadOverrides: loadPricingPolicyOverrides,
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
  const { rules: currentRules } = await loadDatabaseRules(deps);

  if (operation === 'rollback') {
    const eventId = requiredText(proposal.eventId, 'eventId');
    const events = await deps.listEvents({ domain: 'policy_rule', limit: 200 });
    const event = events.find((candidate) => candidate.id === eventId && candidate.domain === 'policy_rule');
    if (!event) throw new PricingAdminError('missing_target', 'Pricing change event not found');
    const targetId = event.targetId;
    const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
    if (event.previousState === null) {
      if (targetId === 'default') {
        throw new PricingAdminError('default_rule_delete_forbidden', 'The default pricing rule cannot be deleted');
      }
      if (!currentRule) throw new PricingAdminError('missing_target', 'Pricing rule not found');
      const proposedRules = validateOverrides(currentRules.filter((rule) => rule.id !== targetId), policy);
      return { operation, targetId, currentRule, proposedRule: null, currentRules, proposedRules, rollbackEventId: eventId };
    }
    const previous = { ...asRecord(event.previousState, 'rollback previousState'), id: targetId };
    const proposedRules = validateOverrides(
      [...currentRules.filter((rule) => rule.id !== targetId), previous],
      policy
    );
    const proposedRule = proposedRules.find((rule) => rule.id === targetId)!;
    return { operation, targetId, currentRule, proposedRule, currentRules, proposedRules, rollbackEventId: eventId };
  }

  if (operation === 'delete') {
    const targetId = requiredText(proposal.targetId, 'targetId');
    if (targetId === 'default') {
      throw new PricingAdminError('default_rule_delete_forbidden', 'The default pricing rule cannot be deleted');
    }
    const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
    if (!currentRule) throw new PricingAdminError('missing_target', 'Pricing rule not found');
    const proposedRules = validateOverrides(currentRules.filter((rule) => rule.id !== targetId), policy);
    return { operation, targetId, currentRule, proposedRule: null, currentRules, proposedRules };
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
  return { operation, targetId, currentRule, proposedRule, currentRules, proposedRules };
}

function requestedSurcharges(context: PreviewContext, selector: PricingScenarioSelector): RequestedPricingSurcharge[] {
  const scenarios = selectAffectedPricingScenarios(selector);
  if (!scenarios.length) return [];
  const changed = (field: 'surchargeAudioPercent' | 'surchargeUpscalePercent') =>
    scenarios.some((scenario) => {
      const current = resolveCanonicalAdminScenarioPolicy({ databaseRules: context.currentRules, scenario }).rule[field];
      const proposed = resolveCanonicalAdminScenarioPolicy({ databaseRules: context.proposedRules, scenario }).rule[field];
      return current !== proposed;
    });
  return [
    ...(changed('surchargeAudioPercent') ? [{ kind: 'audio' as const, selector }] : []),
    ...(changed('surchargeUpscalePercent') ? [{ kind: 'upscale' as const, selector }] : []),
  ];
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
  const surchargeRequests = requestedSurcharges(context, selector);
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
  const unsupportedScenarioIds = [...currentOutcomes, ...proposedOutcomes]
    .filter((outcome) => outcome.status === 'unsupported')
    .map((outcome) => outcome.scenarioId);
  const affectedScenarioIds = [...new Set(currentOutcomes.map((outcome) => outcome.scenarioId))].sort();
  const currentState = jsonRule(context.currentRule);
  const proposedState = jsonRule(context.proposedRule);
  const previewFingerprint = buildPricingPreviewFingerprint({
    domain: 'policy_rule',
    operation: context.operation,
    targetId: context.targetId,
    currentState,
    proposedState,
    versionedPolicyVersion: policy.version,
    affectedScenarioIds,
    unsupportedScenarioIds,
  });
  const rows = compareCanonicalAdminScenarios(currentOutcomes, proposedOutcomes);
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
    warnings: [],
    ...(context.rollbackEventId ? { rollbackEventId: context.rollbackEventId } : {}),
  };
}

function previewSummary(preview: PricingChangePreview): PricingChangeJsonObject {
  return {
    previewFingerprint: preview.previewFingerprint,
    affectedSurfaces: preview.affectedSurfaces,
    rowCount: preview.rows.length,
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
      let persistedState: PricingChangeJsonValue | null;
      if (preview.proposedState === null) {
        await dependencies.deleteRule(executor, preview.targetId);
        persistedState = null;
      } else {
        const persisted = await dependencies.upsertRule(
          executor,
          preview.proposedState as unknown as PricingPolicyRule,
          serverActorId
        );
        persistedState = jsonRule(persisted);
      }
      const event = await dependencies.insertEvent(executor, {
        domain: 'policy_rule',
        operation: preview.operation,
        targetId: preview.targetId,
        actorId: serverActorId,
        previousState: preview.currentState,
        nextState: preview.proposedState,
        previewSummary: previewSummary(preview),
        affectedScenarioIds: preview.affectedScenarioIds,
      });
      return { persistedState, event };
    });
  } catch (error) {
    if (error instanceof PricingAdminError) throw error;
    throw new PricingAdminError('persistence_failed', 'Failed to persist pricing policy change');
  }

  dependencies.invalidateCache();
  dependencies.revalidate(preview);
  return { preview, ...result };
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
  const events = loaded.status === 'loaded' ? await dependencies.listEvents({ domain: 'policy_rule', limit: 200 }) : [];
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
      lastEvent: targetId ? events.find((event) => event.targetId === targetId) ?? null : null,
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
