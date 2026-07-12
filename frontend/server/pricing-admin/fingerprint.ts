import { createHash } from 'node:crypto';

import type {
  PricingChangeDomain,
  PricingChangeJsonValue,
  PricingChangeOperation,
} from '@/lib/admin/pricing-change-contract';

export type PricingPreviewFingerprintInput = {
  domain: PricingChangeDomain;
  operation: PricingChangeOperation;
  targetId: string;
  currentState: PricingChangeJsonValue | null;
  proposedState: PricingChangeJsonValue | null;
  versionedPolicyVersion: number | string;
  affectedScenarioIds: string[];
};

function normalizeJson(value: PricingChangeJsonValue): PricingChangeJsonValue {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeJson(entry)])
    );
  }
  return value;
}

export function buildPricingPreviewFingerprint(input: PricingPreviewFingerprintInput): string {
  const payload: PricingChangeJsonValue = {
    affectedScenarioIds: [...input.affectedScenarioIds].sort((left, right) => left.localeCompare(right)),
    currentState: input.currentState == null ? null : normalizeJson(input.currentState),
    domain: input.domain,
    operation: input.operation,
    proposedState: input.proposedState == null ? null : normalizeJson(input.proposedState),
    targetId: input.targetId,
    versionedPolicyVersion: input.versionedPolicyVersion,
  };
  return createHash('sha256').update(JSON.stringify(normalizeJson(payload))).digest('hex');
}
