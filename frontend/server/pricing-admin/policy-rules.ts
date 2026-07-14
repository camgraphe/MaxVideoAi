import {
  PricingPolicyValidationError,
  validatePricingPolicyOverrides,
  type PricingPolicyDocument,
  type PricingPolicyReferences,
  type PricingPolicyRule,
} from '@maxvideoai/pricing';

import { listFalEngines } from '@/config/falEngines';
import type { PricingChangeJsonValue } from '@/lib/admin/pricing-change-contract';
import { buildPricingAuditScenarios } from '@/lib/pricing-audit/scenarios';

import type { PricingScenarioSelector } from './canonical-scenarios';
import { PricingAdminError } from './errors';

export function asRecord(
  value: unknown,
  label: string
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PricingAdminError('invalid_payload', `${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PricingAdminError('invalid_payload', `${label} is required`);
  }
  return value.trim();
}

export function canonicalRule(rule: PricingPolicyRule): PricingPolicyRule {
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
    ...(rule.compatibilityProfile
      ? { compatibilityProfile: rule.compatibilityProfile }
      : {}),
  };
}

export function jsonRule(
  rule: PricingPolicyRule | null
): PricingChangeJsonValue | null {
  return rule
    ? (canonicalRule(rule) as unknown as PricingChangeJsonValue)
    : null;
}

export function selectorOf(
  rule: PricingPolicyRule
): PricingScenarioSelector {
  return {
    ...(rule.engineId ? { engineId: rule.engineId } : {}),
    ...(rule.mode ? { mode: rule.mode } : {}),
    ...(rule.resolution ? { resolution: rule.resolution } : {}),
  };
}

export function selectorKey(rule: PricingPolicyRule): string {
  return `${rule.engineId ?? '*'}|${rule.mode ?? '*'}|${rule.resolution ?? '*'}`;
}

export function scenarioSelectorKey(
  selector: PricingScenarioSelector
): string {
  return `${selector.engineId ?? '*'}|${selector.mode ?? '*'}|${selector.resolution ?? '*'}`;
}

function buildReferences(
  policy: PricingPolicyDocument
): PricingPolicyReferences {
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
      const resolutions =
        resolutionsByEngineId.get(engineId) ?? new Set<string>();
      resolutions.add(resolution);
      resolutionsByEngineId.set(engineId, resolutions);
    }
  };

  listFalEngines().forEach((entry) => {
    const ids = new Set([entry.id, entry.engine.id]);
    ids.forEach((id) => {
      add(id);
      entry.modes.forEach((mode) => add(id, mode.mode));
      entry.engine.resolutions?.forEach((resolution) =>
        add(id, undefined, resolution)
      );
    });
  });
  buildPricingAuditScenarios().forEach((scenario) =>
    add(scenario.engineId, scenario.mode, scenario.resolution)
  );
  policy.rules.forEach((rule) =>
    rule.engineId && add(rule.engineId, rule.mode, rule.resolution)
  );
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
  const code =
    mapped[error.code as keyof typeof mapped] ?? 'invalid_payload';
  throw new PricingAdminError(code, error.message);
}

export function validateOverrides(
  rules: unknown[],
  policy: PricingPolicyDocument
): PricingPolicyRule[] {
  try {
    return validatePricingPolicyOverrides(
      rules,
      policy,
      buildReferences(policy)
    );
  } catch (error) {
    return mapValidationError(error);
  }
}

export function projectionJson(value: unknown): PricingChangeJsonValue {
  return JSON.parse(JSON.stringify(value)) as PricingChangeJsonValue;
}

export function sortRules<T extends PricingPolicyRule>(rules: T[]): T[] {
  return [...rules].sort((left, right) =>
    `${selectorKey(left)}|${left.id}`.localeCompare(
      `${selectorKey(right)}|${right.id}`
    )
  );
}
