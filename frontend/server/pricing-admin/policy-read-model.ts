import {
  resolvePricingPolicy,
  type PricingPolicyRule,
  type PricingPolicyScenario,
} from '@maxvideoai/pricing';

import type {
  ListPricingChangeEventsInput,
  PricingChangeEvent,
} from '@/lib/admin/pricing-change-contract';
import { getFalEngineById, listFalEngines } from '@/config/falEngines';
import { listRuntimeModels } from '@/config/model-runtime';
import { buildPricingAuditScenarios } from '@/lib/pricing-audit/scenarios';
import { collectSellableManualTariffCoverage, type ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import type { PricingAuditScenario } from '@/lib/pricing-audit/types';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import {
  isBytePlusSeedanceSubmissionEnabled,
  resolveBytePlusSeedanceRouteProfile,
} from '@/server/video-providers/byteplus-modelark-profile-policy';
import { getBytePlusArkConfig, isBytePlusModelArkEnabled } from '@/server/video-providers/byteplus-modelark';

import {
  quoteCanonicalAdminScenarios,
  resolveCanonicalAdminScenarioPolicy,
  selectAffectedPricingScenarios,
  type AdminCanonicalScenarioQuote,
  type PricingScenarioSelector,
} from './canonical-scenarios';
import type {
  PricingPolicyInventoryResponse,
  PricingPolicyInventoryRow,
  PricingPolicyServiceDependencies,
} from './policy-contract';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from './policy-dependencies';
import {
  buildProviderCostComparisonRows,
  providerComparisonInputFromScenario,
} from './provider-cost-comparison';
import {
  canonicalRule,
  scenarioSelectorKey,
  selectorKey,
  selectorOf,
} from './policy-rules';

export function buildAllModelComparisonScenarios(auditScenarios: PricingAuditScenario[] = buildPricingAuditScenarios()) {
  const appPublished = new Set(listRuntimeModels().filter((model) => model.publication.app.published).map((model) => model.id));
  return listFalEngines().flatMap((entry) => {
    if (!appPublished.has(entry.id)) return [];
    const baseline = auditScenarios.find((scenario) => scenario.engineId === entry.id
      && scenario.surface === 'billing' && scenario.membershipTier === 'member'
      && scenario.id.startsWith(`billing:${entry.id}:`));
    const image = entry.category === 'image';
    const mode = baseline?.mode ?? (image ? 't2i' : 't2v');
    const resolution = baseline?.resolution ?? (entry.engine.resolutions.includes('720p') ? '720p' : entry.engine.resolutions[0]);
    const durationSec = baseline?.durationSec ?? (image ? 1 : 5);
    if (!resolution || !entry.modes.some((item) => item.mode === mode)) return [];
    const scenario: PricingAuditScenario = {
      ...(baseline ?? {
        surface: 'billing' as const,
        engineId: entry.id,
        membershipTier: 'member' as const,
        input: {},
      }),
      id: `provider-comparison:${entry.id}:${mode}:${image ? '1-image' : `${durationSec}s`}:${resolution}:member`,
      mode,
      resolution,
      durationSec,
      input: image ? { quantity: 1, referenceImageCount: 0 } : { audio: false, aspectRatio: entry.engine.aspectRatios[0] ?? '16:9' },
    };
    return [{ scenario, entry }];
  });
}

export function selectRepresentativeTariffScenario(
  entry: ReturnType<typeof listFalEngines>[number], scenario: PricingAuditScenario,
  options: readonly ManualTariffCoverageScenario[],
): ManualTariffCoverageScenario | null {
  const fields = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])];
  const defaultAspect = fields.find((field) => field.id === 'aspect_ratio' && typeof field.default === 'string' && field.default !== 'auto')?.default
    ?? (typeof scenario.input.aspectRatio === 'string' && scenario.input.aspectRatio !== 'auto' ? scenario.input.aspectRatio : undefined)
    ?? (entry.engine.aspectRatios.includes('16:9') ? '16:9' : entry.engine.aspectRatios.includes('1:1') ? '1:1' : undefined);
  const defaultQuality = fields.find((field) => field.id === 'quality' && typeof field.default === 'string')?.default;
  let chosen: ManualTariffCoverageScenario | null = null;
  let best = Infinity;
  for (const candidate of options) {
    const selector = candidate.selector;
    const score = (selector.mode === scenario.mode ? 0 : 10_000)
      + (selector.resolution.toLowerCase() === scenario.resolution?.toLowerCase() ? 0 : 1_000)
      + Math.abs(Number(selector.durationSec) - (scenario.durationSec ?? 1)) * 10
      + (defaultAspect && selector.aspectRatio !== defaultAspect ? 4 : 0)
      + (defaultQuality && selector.quality !== defaultQuality ? 3 : 0)
      + (scenario.input.audio === false && selector.audio === 'true' ? 2 : 0);
    if (score < best) { chosen = candidate; best = score; }
  }
  return chosen;
}

function isActivePolicyRule(rule: PricingPolicyRule): boolean {
  if (!rule.engineId) return true;
  return getFalEngineById(rule.engineId)?.surfaces.pricing.includeInEstimator !== false;
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
  const auditScenarios = buildPricingAuditScenarios().filter((scenario) => {
    const engine = getFalEngineById(scenario.engineId);
    return !engine || engine.surfaces.pricing.includeInEstimator;
  });
  const bySelector = new Map<string, {
    selector: PricingScenarioSelector;
    versionedRule: PricingPolicyRule | null;
    databaseOverride: PricingPolicyRule | null;
  }>();
  policy.rules.filter(isActivePolicyRule).forEach((rule) => bySelector.set(selectorKey(rule), {
    selector: selectorOf(rule),
    versionedRule: canonicalRule(rule),
    databaseOverride: null,
  }));
  databaseRules.filter(isActivePolicyRule).forEach((rule) => {
    const key = selectorKey(rule);
    const existing = bySelector.get(key) ?? {
      selector: selectorOf(rule),
      versionedRule: null,
      databaseOverride: null,
    };
    bySelector.set(key, { ...existing, databaseOverride: canonicalRule(rule) });
  });
  auditScenarios.forEach((scenario) => {
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

  const allModelScenarios = buildAllModelComparisonScenarios(buildPricingAuditScenarios());
  const coverageByModel = new Map<string, ReturnType<typeof collectSellableManualTariffCoverage>['scenarios']>();
  for (const candidate of collectSellableManualTariffCoverage().scenarios) {
    const bucket = coverageByModel.get(candidate.modelId) ?? [];
    bucket.push(candidate);
    coverageByModel.set(candidate.modelId, bucket);
  }
  const comparisons = await Promise.all(allModelScenarios.map(async ({ scenario, entry }) => {
    const options = coverageByModel.get(entry.id) ?? [];
    const selected = selectRepresentativeTariffScenario(entry, scenario, options);
    const comparableScenario: PricingAuditScenario = selected ? {
      ...scenario,
      id: selected.id,
      mode: selected.selector.mode,
      resolution: selected.selector.resolution,
      durationSec: selected.context.durationSec,
      input: {
        ...(typeof selected.context.aspectRatio === 'string' ? { aspectRatio: selected.context.aspectRatio } : {}),
        ...(typeof selected.context.addons?.audio === 'boolean' ? { audio: selected.context.addons.audio } : {}),
      },
    } : scenario;
    const declaredProvider = entry.engine.providerMeta?.provider;
    const executionProvider = entry.category === 'image'
      ? declaredProvider === 'byteplus_modelark' ? 'byteplus_modelark' : 'fal'
      : resolveBytePlusSeedanceRouteProfile(entry.id, declaredProvider)
        ? 'byteplus_modelark' : 'fal';
    const comparison = providerComparisonInputFromScenario({
      scenario: comparableScenario,
      quote: null,
      engine: entry.engine,
      brandId: entry.brandId,
      familyId: entry.family,
      executionProvider,
      mediaType: entry.category === 'image' ? 'image' : 'video',
    });
    if (selected && loaded.status === 'loaded') {
      try {
        const snapshot = await computeCanonicalBillingSnapshot(selected.context, {
          pricingPolicy: { loadOverrides: async () => loaded },
        });
        const provenance = snapshot.meta?.pricingPolicy as { source?: unknown; sourceRuleId?: unknown } | undefined;
        if (Number.isSafeInteger(snapshot.totalCents) && typeof provenance?.sourceRuleId === 'string' &&
          (provenance.source === 'database' || provenance.source === 'versioned')) {
          comparison.customerQuote = {
            totalCents: snapshot.totalCents, currency: snapshot.currency,
            source: provenance.source, ruleId: provenance.sourceRuleId,
            pricingMode: snapshot.meta?.pricingMode === 'manual_tariff' ? 'manual_tariff' : 'legacy_margin_rule',
          };
        }
      } catch {
        // No numeric customer price when an exact billing quote cannot be produced.
      }
    }
    if (entry.id !== 'seedance-1-5-pro') return comparison;
    const ark = getBytePlusArkConfig();
    return {
      ...comparison,
      routeConfigured: isBytePlusSeedanceSubmissionEnabled(entry.id)
        && isBytePlusModelArkEnabled()
        && Boolean(ark.apiKey?.trim() && ark.seedance15ModelId.trim()),
    };
  }));

  return {
    versionedPolicyVersion: policy.version,
    databaseStatus: loaded.status,
    warnings: loaded.status === 'unavailable'
      ? ['Pricing policy database is unavailable; showing versioned policy only; effective customer quotes unavailable.']
      : [],
    rows: rows.sort((left, right) => scenarioSelectorKey(left.selector).localeCompare(
      scenarioSelectorKey(right.selector)
    )),
    providerComparisons: buildProviderCostComparisonRows(comparisons, new Date().toISOString()),
  };
}
