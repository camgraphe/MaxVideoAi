import {
  quoteCanonicalPricing,
  resolvePricingPolicy,
  type CanonicalPricingQuote,
  type PricingPolicyRule,
  type ResolvedPricingPolicy,
} from '@maxvideoai/pricing';
import { listFalEngines } from '@/config/falEngines';
import { buildCanonicalPricingFacts } from '@/lib/pricing-audit/canonical-facts';
import { buildPricingAuditScenarios } from '@/lib/pricing-audit/scenarios';
import type { PricingAuditScenario, PricingAuditSurface } from '@/lib/pricing-audit/types';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';

import { PricingAdminError } from './errors';

export type PricingScenarioSelector = Pick<PricingPolicyRule, 'engineId' | 'mode' | 'resolution'>;
export type PricingMembershipDiscountMap = Record<'member' | 'plus' | 'pro', number>;
export type RequestedPricingSurcharge = {
  kind: 'audio' | 'upscale';
  selector: PricingScenarioSelector;
};

export type AdminCanonicalScenarioQuote = CanonicalPricingQuote & {
  status: 'quoted';
  surface: PricingAuditSurface;
  equivalenceKey?: string;
  surcharge?: 'audio' | 'upscale';
};

export type AdminUnsupportedScenarioOutcome = {
  status: 'unsupported';
  scenarioId: string;
  engineId: string;
  surface: PricingAuditSurface;
  reason: 'canonical_facts_unavailable' | 'surcharge_policy_not_authoritative';
  warning: string;
  policyProvenance: CanonicalPricingQuote['policyProvenance'];
  surcharge?: 'audio' | 'upscale';
};

export type AdminCanonicalScenarioOutcome = AdminCanonicalScenarioQuote | AdminUnsupportedScenarioOutcome;

export type PricingChangePreviewRow = {
  scenarioId: string;
  engineId: string;
  surface: PricingAuditSurface;
  currentTotalCents: number;
  proposedTotalCents: number;
  deltaCents: number;
  deltaPercent: number | null;
  currentProvenance: CanonicalPricingQuote['policyProvenance'];
  proposedProvenance: CanonicalPricingQuote['policyProvenance'];
  compatibilityProfile: string;
};

const DEFAULT_MEMBERSHIP_DISCOUNTS: PricingMembershipDiscountMap = {
  member: 0,
  plus: 0.05,
  pro: 0.1,
};
const engineCapabilitiesById = new Map(
  listFalEngines().flatMap((entry) => [
    [entry.id, entry.engine] as const,
    [entry.engine.id, entry.engine] as const,
  ])
);

function scenarioMatchesSelector(scenario: PricingAuditScenario, selector: PricingScenarioSelector): boolean {
  return (
    (!selector.engineId || scenario.engineId === selector.engineId) &&
    (!selector.mode || scenario.mode === selector.mode) &&
    (!selector.resolution || scenario.resolution === selector.resolution)
  );
}

function resolveScenarioSurcharge(scenario: PricingAuditScenario): 'audio' | 'upscale' | undefined {
  if (scenario.input.requestedSurcharge === 'audio' || scenario.input.requestedSurcharge === 'upscale') {
    return scenario.input.requestedSurcharge;
  }
  if (scenario.input.audio === true) return 'audio';
  if (scenario.engineId === 'upscale' || scenario.input.product === 'upscale') return 'upscale';
  return undefined;
}

function buildRequestedSurchargeScenario(
  scenarios: PricingAuditScenario[],
  request: RequestedPricingSurcharge
): PricingAuditScenario {
  const matching = request.selector.engineId
    ? scenarios.filter((scenario) => scenarioMatchesSelector(scenario, request.selector))
    : [];
  const representative =
    matching.find((scenario) => scenario.surface === 'billing' && scenario.membershipTier === 'member') ??
    matching.find((scenario) => scenario.surface === 'estimator' && scenario.membershipTier === 'member') ??
    matching[0];
  const engineId = request.selector.engineId ?? representative?.engineId ?? '*';
  const mode = request.selector.mode ?? representative?.mode;
  const resolution = request.selector.resolution ?? representative?.resolution;
  return {
    id: `admin-surcharge:${request.kind}:${engineId}:${mode ?? 'default'}:${resolution ?? 'default'}`,
    surface: 'billing',
    engineId,
    ...(mode ? { mode } : {}),
    ...(resolution ? { resolution } : {}),
    ...(representative?.durationSec != null ? { durationSec: representative.durationSec } : {}),
    membershipTier: 'member',
    ...(representative?.compatibilityProfile
      ? { compatibilityProfile: representative.compatibilityProfile }
      : {}),
    input: {
      ...(representative?.input ?? {}),
      requestedSurcharge: request.kind,
      requestedSurchargeAuthoritative: Boolean(representative),
    },
  };
}

function resolveCompatibilityProfileId(
  scenario: PricingAuditScenario,
  policy: ResolvedPricingPolicy
): string {
  if (scenario.surface === 'billing' || scenario.surface === 'audio') {
    return policy.rule.compatibilityProfile ?? scenario.compatibilityProfile ?? 'standard';
  }
  return scenario.compatibilityProfile ?? policy.rule.compatibilityProfile ?? 'standard';
}

function resolveScenarioPolicy(
  scenario: PricingAuditScenario,
  databaseRules: PricingPolicyRule[],
  versionedRules: PricingPolicyRule[] = getVersionedPricingPolicy().rules
): ResolvedPricingPolicy {
  return resolvePricingPolicy({
    scenario: {
      engineId: scenario.engineId,
      ...(scenario.mode ? { mode: scenario.mode } : {}),
      ...(scenario.resolution ? { resolution: scenario.resolution } : {}),
    },
    databaseRules,
    versionedRules,
  });
}

export function selectAffectedPricingScenarios(selector: PricingScenarioSelector): PricingAuditScenario[] {
  return buildPricingAuditScenarios().filter((scenario) => scenarioMatchesSelector(scenario, selector));
}

export function resolveCanonicalAdminScenarioPolicy(input: {
  databaseRules: PricingPolicyRule[];
  scenario: PricingAuditScenario;
}): ResolvedPricingPolicy {
  return resolveScenarioPolicy(input.scenario, input.databaseRules);
}

export function quoteCanonicalAdminScenarios(input: {
  databaseRules: PricingPolicyRule[];
  scenarios?: PricingAuditScenario[];
  membershipDiscounts?: Partial<PricingMembershipDiscountMap>;
  requestedSurcharges?: RequestedPricingSurcharge[];
}): AdminCanonicalScenarioOutcome[] {
  const policyDocument = getVersionedPricingPolicy();
  const profiles = new Map(policyDocument.compatibilityProfiles.map((profile) => [profile.id, profile]));
  const membershipDiscounts = { ...DEFAULT_MEMBERSHIP_DISCOUNTS, ...input.membershipDiscounts };
  const scenarios = input.scenarios ?? buildPricingAuditScenarios();
  const projectionScenarios = [
    ...scenarios,
    ...(input.requestedSurcharges ?? []).map((request) => buildRequestedSurchargeScenario(scenarios, request)),
  ];

  return projectionScenarios
    .map((scenario): AdminCanonicalScenarioOutcome => {
      const policy = resolveScenarioPolicy(scenario, input.databaseRules, policyDocument.rules);
      const profileId = resolveCompatibilityProfileId(scenario, policy);
      const compatibilityProfile = profiles.get(profileId);
      if (!compatibilityProfile) {
        throw new PricingAdminError(
          'unknown_compatibility_profile',
          `Missing pricing compatibility profile ${profileId}`
        );
      }
      const surcharge = resolveScenarioSurcharge(scenario);
      const requestedSurcharge =
        scenario.input.requestedSurcharge === 'audio' || scenario.input.requestedSurcharge === 'upscale'
          ? scenario.input.requestedSurcharge
          : undefined;
      const capabilities = engineCapabilitiesById.get(scenario.engineId);
      const requestedSurchargeIsAuthoritative =
        scenario.input.requestedSurchargeAuthoritative === true &&
        (requestedSurcharge === 'audio'
          ? capabilities?.audio === true
          : requestedSurcharge === 'upscale'
            ? capabilities?.upscale4k === true
            : true);
      if (requestedSurcharge && !requestedSurchargeIsAuthoritative) {
        return {
          status: 'unsupported',
          scenarioId: scenario.id,
          engineId: scenario.engineId,
          surface: scenario.surface,
          reason: 'surcharge_policy_not_authoritative',
          warning: `No authoritative policy scenario exists for ${requestedSurcharge} surcharge impact.`,
          policyProvenance: {
            source: policy.source,
            matchedBy: policy.matchedBy,
            sourceRuleId: policy.sourceRuleId,
            compatibilityProfile: profileId,
          },
          surcharge: requestedSurcharge,
        };
      }
      if (surcharge === 'upscale' && scenario.surface === 'tool') {
        return {
          status: 'unsupported',
          scenarioId: scenario.id,
          engineId: scenario.engineId,
          surface: scenario.surface,
          reason: 'surcharge_policy_not_authoritative',
          warning: 'No authoritative policy scenario exists for upscale surcharge impact.',
          policyProvenance: {
            source: policy.source,
            matchedBy: policy.matchedBy,
            sourceRuleId: policy.sourceRuleId,
            compatibilityProfile: profileId,
          },
          surcharge,
        };
      }
      const facts = buildCanonicalPricingFacts(scenario);
      if (!facts) {
        return {
          status: 'unsupported',
          scenarioId: scenario.id,
          engineId: scenario.engineId,
          surface: scenario.surface,
          reason: 'canonical_facts_unavailable',
          warning: surcharge
            ? `Canonical facts are unavailable; ${surcharge} surcharge impact cannot be quoted.`
            : 'Canonical facts are unavailable for this pricing scenario.',
          policyProvenance: {
            source: policy.source,
            matchedBy: policy.matchedBy,
            sourceRuleId: policy.sourceRuleId,
            compatibilityProfile: profileId,
          },
          ...(surcharge ? { surcharge } : {}),
        };
      }
      const membershipTier = scenario.membershipTier ?? 'member';
      const quote = quoteCanonicalPricing({
        facts,
        scenario: {
          id: scenario.id,
          engineId: scenario.engineId,
          ...(scenario.mode ? { mode: scenario.mode } : {}),
          ...(scenario.resolution ? { resolution: scenario.resolution } : {}),
          membershipTier,
          discountPercent: membershipDiscounts[membershipTier],
          ...(surcharge ? { surcharge } : {}),
        },
        policy,
        compatibilityProfile,
      });
      return {
        ...quote,
        status: 'quoted',
        surface: scenario.surface,
        ...(scenario.equivalenceKey ? { equivalenceKey: scenario.equivalenceKey } : {}),
        ...(surcharge ? { surcharge } : {}),
      };
    })
    .sort((left, right) => left.scenarioId.localeCompare(right.scenarioId));
}

function quotesDiffer(current: AdminCanonicalScenarioQuote, proposed: AdminCanonicalScenarioQuote): boolean {
  return (
    current.customerTotalCents !== proposed.customerTotalCents ||
    current.vendorSubtotalCents !== proposed.vendorSubtotalCents ||
    current.marginCents !== proposed.marginCents ||
    current.surchargeCents !== proposed.surchargeCents ||
    current.discountCents !== proposed.discountCents ||
    JSON.stringify(current.policyProvenance) !== JSON.stringify(proposed.policyProvenance)
  );
}

function indexQuotes(
  outcomes: AdminCanonicalScenarioOutcome[],
  label: string
): Map<string, AdminCanonicalScenarioQuote> {
  const byId = new Map<string, AdminCanonicalScenarioQuote>();
  for (const outcome of outcomes) {
    if (outcome.status === 'unsupported') {
      throw new PricingAdminError('unsupported_scenario', outcome.warning);
    }
    if (byId.has(outcome.scenarioId)) {
      throw new PricingAdminError('invalid_payload', `Duplicate ${label} scenario quote ${outcome.scenarioId}`);
    }
    byId.set(outcome.scenarioId, outcome);
  }
  return byId;
}

export function compareCanonicalAdminScenarios(
  current: AdminCanonicalScenarioOutcome[],
  proposed: AdminCanonicalScenarioOutcome[]
): PricingChangePreviewRow[] {
  const currentById = indexQuotes(current, 'current');
  const proposedById = indexQuotes(proposed, 'proposed');
  const scenarioIds = [...new Set([...currentById.keys(), ...proposedById.keys()])].sort((left, right) =>
    left.localeCompare(right)
  );

  return scenarioIds.flatMap((scenarioId): PricingChangePreviewRow[] => {
    const currentQuote = currentById.get(scenarioId);
    const proposedQuote = proposedById.get(scenarioId);
    if (!currentQuote || !proposedQuote) {
      throw new PricingAdminError('invalid_payload', `Current and proposed quotes differ for scenario ${scenarioId}`);
    }
    if (!quotesDiffer(currentQuote, proposedQuote)) return [];
    const deltaCents = proposedQuote.customerTotalCents - currentQuote.customerTotalCents;
    return [
      {
        scenarioId,
        engineId: proposedQuote.engineId,
        surface: proposedQuote.surface,
        currentTotalCents: currentQuote.customerTotalCents,
        proposedTotalCents: proposedQuote.customerTotalCents,
        deltaCents,
        deltaPercent: currentQuote.customerTotalCents === 0 ? null : deltaCents / currentQuote.customerTotalCents,
        currentProvenance: { ...currentQuote.policyProvenance },
        proposedProvenance: { ...proposedQuote.policyProvenance },
        compatibilityProfile: proposedQuote.policyProvenance.compatibilityProfile,
      },
    ];
  });
}
