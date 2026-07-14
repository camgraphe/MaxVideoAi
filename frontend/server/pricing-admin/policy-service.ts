import {
  resolvePricingPolicy,
  type PricingPolicyRule,
  type PricingPolicyScenario,
} from '@maxvideoai/pricing';

import type {
  ListPricingChangeEventsInput,
  PricingChangeEvent,
  PricingChangeJsonObject,
  PricingChangeJsonValue,
} from '@/lib/admin/pricing-change-contract';
import { buildPricingAuditScenarios } from '@/lib/pricing-audit/scenarios';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';

import {
  quoteCanonicalAdminScenarios,
  resolveCanonicalAdminScenarioPolicy,
  selectAffectedPricingScenarios,
  type AdminCanonicalScenarioQuote,
  type PricingScenarioSelector,
} from './canonical-scenarios';
import { PricingAdminError } from './errors';
import type {
  PricingChangeConfirmation,
  PricingChangePreview,
  PricingPolicyChangeProposal,
  PricingPolicyInventoryResponse,
  PricingPolicyInventoryRow,
  PricingPolicyServiceDependencies,
} from './policy-contract';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from './policy-dependencies';
import { previewPricingPolicyChange } from './policy-preview';
import {
  canonicalRule,
  jsonRule,
  requiredText,
  scenarioSelectorKey,
  selectorKey,
  selectorOf,
} from './policy-rules';

export {
  deriveRequestedPricingSurcharges,
  previewPricingPolicyChange,
} from './policy-preview';

export type {
  PricingChangeConfirmation,
  PricingChangePreview,
  PricingPolicyChangeProposal,
  PricingPolicyInventoryResponse,
  PricingPolicyInventoryRow,
  PricingPolicyServiceDependencies,
} from './policy-contract';

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
  dependencies: PricingPolicyServiceDependencies = DEFAULT_POLICY_SERVICE_DEPENDENCIES
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
  dependencies: PricingPolicyServiceDependencies = DEFAULT_POLICY_SERVICE_DEPENDENCIES
): Promise<PricingChangeEvent[]> {
  return dependencies.listEvents({ ...filter, domain: 'policy_rule' });
}

export async function loadPricingPolicyInventory(
  dependencies: PricingPolicyServiceDependencies = DEFAULT_POLICY_SERVICE_DEPENDENCIES
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
    const representativeSurfaces = [
      'billing',
      'pricing-hub',
      'estimator',
      'price-chip',
      'model-page',
      'json-ld',
      'audio',
      'tool',
    ] as const;
    const representativeScenarios = representativeSurfaces.flatMap((surface) => {
      const scenario = scenarios.find((candidate) => candidate.surface === surface);
      return scenario ? [scenario] : [];
    }).slice(0, 6);
    const outcomes = quoteCanonicalAdminScenarios({ databaseRules, scenarios: representativeScenarios });
    const representativeQuotes = outcomes.filter(
      (outcome): outcome is AdminCanonicalScenarioQuote => outcome.status === 'quoted'
    ).slice(0, 4);
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
