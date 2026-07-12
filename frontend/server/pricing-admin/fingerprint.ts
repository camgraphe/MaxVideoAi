import { createHash } from 'node:crypto';

import type {
  PricingChangeDomain,
  PricingChangeJsonValue,
  PricingChangeOperation,
} from '@/lib/admin/pricing-change-contract';

import { PricingAdminError } from './errors';

export type PricingPreviewFingerprintInput = {
  domain: PricingChangeDomain;
  operation: PricingChangeOperation;
  targetId: string;
  currentState: PricingChangeJsonValue | null;
  proposedState: PricingChangeJsonValue | null;
  versionedPolicyVersion: number | string;
  affectedScenarioIds: string[];
  unsupportedScenarioIds: string[];
  projectionState?: PricingChangeJsonValue;
};

function invalidJson(path: string): never {
  throw new PricingAdminError('invalid_payload', `${path} must contain JSON values only`);
}

function normalizeJson(
  value: unknown,
  path = 'pricing preview fingerprint',
  activeObjects = new WeakSet<object>()
): PricingChangeJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : invalidJson(path);
  if (typeof value !== 'object') return invalidJson(path);
  if (activeObjects.has(value)) return invalidJson(path);
  activeObjects.add(value);

  try {
    if (Array.isArray(value)) {
      return Array.from({ length: value.length }, (_, index) => {
        if (!(index in value)) return invalidJson(`${path}[${index}]`);
        return normalizeJson(value[index], `${path}[${index}]`, activeObjects);
      });
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalidJson(path);
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) return invalidJson(path);
    const entries = (keys as string[])
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
      .map((key): [string, PricingChangeJsonValue] => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor?.enumerable || !('value' in descriptor)) return invalidJson(`${path}.${key}`);
        return [key, normalizeJson(descriptor.value, `${path}.${key}`, activeObjects)];
      });
    return Object.fromEntries(entries);
  } finally {
    activeObjects.delete(value);
  }
}

export function buildPricingPreviewFingerprint(input: PricingPreviewFingerprintInput): string {
  if (!Array.isArray(input.unsupportedScenarioIds)) {
    throw new PricingAdminError('invalid_payload', 'unsupportedScenarioIds must be an array');
  }
  if (input.unsupportedScenarioIds.length) {
    throw new PricingAdminError(
      'unsupported_scenario',
      `Cannot fingerprint unsupported pricing scenarios: ${input.unsupportedScenarioIds.join(', ')}`
    );
  }
  const payload: PricingChangeJsonValue = {
    affectedScenarioIds: [...input.affectedScenarioIds].sort((left, right) => left.localeCompare(right)),
    currentState: input.currentState === null ? null : normalizeJson(input.currentState, 'currentState'),
    domain: input.domain,
    operation: input.operation,
    proposedState: input.proposedState === null ? null : normalizeJson(input.proposedState, 'proposedState'),
    ...(input.projectionState === undefined
      ? {}
      : { projectionState: normalizeJson(input.projectionState, 'projectionState') }),
    targetId: input.targetId,
    versionedPolicyVersion: input.versionedPolicyVersion,
  };
  return createHash('sha256').update(JSON.stringify(normalizeJson(payload))).digest('hex');
}
