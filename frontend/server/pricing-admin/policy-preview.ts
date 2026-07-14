import type {
  PricingPolicyDocument,
  PricingPolicyRule,
} from '@maxvideoai/pricing';

import { listFalEngines } from '@/config/falEngines';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import type { PricingRule } from '@/lib/pricing-rule-store';

import {
  compareCanonicalAdminScenarios,
  quoteCanonicalAdminScenarios,
  resolveCanonicalAdminScenarioPolicy,
  selectAffectedPricingScenarios,
  type AdminCanonicalScenarioQuote,
  type PricingScenarioSelector,
  type RequestedPricingSurcharge,
} from './canonical-scenarios';
import { PricingAdminError } from './errors';
import { buildPricingPreviewFingerprint } from './fingerprint';
import type {
  PreviewContext,
  PricingChangePreview,
  PricingPolicyChangeProposal,
  PricingPolicyServiceDependencies,
} from './policy-contract';
import { DEFAULT_POLICY_SERVICE_DEPENDENCIES } from './policy-dependencies';
import {
  asRecord,
  canonicalRule,
  jsonRule,
  projectionJson,
  requiredText,
  selectorOf,
  sortRules,
  validateOverrides,
} from './policy-rules';

async function loadDatabaseRules(
  dependencies: PricingPolicyServiceDependencies
): Promise<{
  rules: PricingPolicyRule[];
  routingRules: PricingRule[];
}> {
  const loaded = await dependencies.loadOverrides();
  if (loaded.status === 'unavailable') {
    throw new PricingAdminError(
      'database_unavailable',
      'Pricing policy database is unavailable'
    );
  }
  return {
    rules: loaded.rules.map(canonicalRule),
    routingRules: (loaded.routingRules ?? []).map((rule) => ({ ...rule })),
  };
}

async function buildPreviewContext(
  proposalInput: PricingPolicyChangeProposal,
  dependencies: PricingPolicyServiceDependencies,
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
  const { rules: currentRules, routingRules: currentRoutingRules } =
    await loadDatabaseRules(dependencies);

  if (operation === 'rollback') {
    const requestedTargetId = requiredText(proposal.targetId, 'targetId');
    const eventId = requiredText(proposal.eventId, 'eventId');
    const event = await dependencies.getEvent(eventId, 'policy_rule');
    if (!event) throw new PricingAdminError('missing_target', 'Pricing change event not found');
    if (event.targetId !== requestedTargetId) {
      throw new PricingAdminError(
        'missing_target',
        'Pricing change event does not match the requested target'
      );
    }
    const targetId = event.targetId;
    const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
    const currentRouting = currentRoutingRules.find((rule) => rule.id === targetId);
    if (event.previousState === null) {
      if (targetId === 'default') {
        throw new PricingAdminError(
          'default_rule_delete_forbidden',
          'The default pricing rule cannot be deleted'
        );
      }
      if (!currentRule) throw new PricingAdminError('missing_target', 'Pricing rule not found');
      if (currentRouting?.vendorAccountId) {
        throw new PricingAdminError(
          'routing_conflict',
          'Cannot delete a pricing rule that owns vendor routing'
        );
      }
      const proposedRules = validateOverrides(
        currentRules.filter((rule) => rule.id !== targetId),
        policy
      );
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
    if (
      !currentRule &&
      typeof previousState.vendorAccountId === 'string' &&
      previousState.vendorAccountId.trim()
    ) {
      throw new PricingAdminError(
        'routing_conflict',
        'Cannot recreate historical vendor routing from pricing policy state'
      );
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
      throw new PricingAdminError(
        'default_rule_delete_forbidden',
        'The default pricing rule cannot be deleted'
      );
    }
    const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
    if (!currentRule) throw new PricingAdminError('missing_target', 'Pricing rule not found');
    if (currentRoutingRules.find((rule) => rule.id === targetId)?.vendorAccountId) {
      throw new PricingAdminError(
        'routing_conflict',
        'Cannot delete a pricing rule that owns vendor routing'
      );
    }
    const proposedRules = validateOverrides(
      currentRules.filter((rule) => rule.id !== targetId),
      policy
    );
    return {
      operation,
      targetId,
      currentRule,
      proposedRule: null,
      currentRules,
      proposedRules,
      currentRoutingRules,
    };
  }

  const rawRule = asRecord(proposal.rule, 'rule');
  const targetId = operation === 'update'
    ? requiredText(proposal.targetId, 'targetId')
    : requiredText(rawRule.id, 'rule.id');
  const currentRule = currentRules.find((rule) => rule.id === targetId) ?? null;
  if (operation === 'update' && !currentRule)
    throw new PricingAdminError('missing_target', 'Pricing rule not found');
  if (operation === 'create' && currentRule) {
    throw new PricingAdminError('invalid_payload', `Pricing rule ${targetId} already exists`);
  }
  const proposedRules = validateOverrides(
    [...currentRules.filter((rule) => rule.id !== targetId), { ...rawRule, id: targetId }],
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
  };
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
      const current = resolveCanonicalAdminScenarioPolicy(
        { databaseRules: input.currentRules, scenario }
      ).rule[field];
      const proposed = resolveCanonicalAdminScenarioPolicy(
        { databaseRules: input.proposedRules, scenario }
      ).rule[field];
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
    const entry = entries.find(
      (candidate) => candidate.id === engineId || candidate.engine.id === engineId
    );
    return kind === 'audio' ? entry?.engine.audio === true : entry?.engine.upscale4k === true;
  };
  const affectedEngineIds = [...new Set(scenarios.map((scenario) => scenario.engineId))].sort();
  return changedKinds.flatMap((kind) =>
    affectedEngineIds
      .filter((engineId) => supports(engineId, kind))
      .map((engineId) => ({ kind, selector: { engineId } }))
  );
}

export async function previewPricingPolicyChange(
  proposal: PricingPolicyChangeProposal,
  dependencies: PricingPolicyServiceDependencies =
    DEFAULT_POLICY_SERVICE_DEPENDENCIES
): Promise<PricingChangePreview> {
  const policy = getVersionedPricingPolicy();
  const context = await buildPreviewContext(proposal, dependencies, policy);
  const selectorRule = context.proposedRule ?? context.currentRule;
  if (!selectorRule) {
    throw new PricingAdminError('missing_target', 'Pricing rule selector is unavailable');
  }
  const selector = selectorOf(selectorRule);
  const scenarios = selectAffectedPricingScenarios(selector);
  if (!scenarios.length) {
    throw new PricingAdminError('invalid_payload', 'No canonical pricing scenario matches this selector');
  }
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
  const unsupportedScenarioIds = [
    ...new Set(
      unsupportedOutcomes
        .filter((outcome) => outcome.scenarioId.startsWith('admin-surcharge:'))
        .map((outcome) => outcome.scenarioId)
    ),
  ];
  const warnings = [
    ...new Set(
      unsupportedOutcomes
        .filter((outcome) => !outcome.scenarioId.startsWith('admin-surcharge:'))
        .map((outcome) => outcome.warning)
    ),
  ];
  const affectedScenarioIds = [...new Set(
    currentOutcomes.map((outcome) => outcome.scenarioId)
  )].sort();
  const currentState = jsonRule(context.currentRule);
  const proposedState = jsonRule(context.proposedRule);
  const comparableCurrent = currentOutcomes.filter(
    (outcome): outcome is AdminCanonicalScenarioQuote =>
      outcome.status === 'quoted'
  );
  const comparableProposed = proposedOutcomes.filter(
    (outcome): outcome is AdminCanonicalScenarioQuote =>
      outcome.status === 'quoted'
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
      currentRoutingRules: [...context.currentRoutingRules]
        .sort((left, right) => left.id.localeCompare(right.id)),
      currentOutcomes,
      proposedOutcomes,
      rows,
      ...(context.rollbackEventId ? { rollbackEventId: context.rollbackEventId } : {}),
    }),
  });
  if (!rows.length) {
    throw new PricingAdminError('invalid_payload', 'Pricing proposal has no observable canonical impact');
  }
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
