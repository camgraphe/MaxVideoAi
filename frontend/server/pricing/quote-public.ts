import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import { loadPricingPolicyOverrides } from '@/lib/pricing-rule-store';
import type { AudioPricingInput } from '@/lib/audio-generation';

import {
  computeCanonicalBillingSnapshot,
  computeCanonicalAudioBillingSnapshot,
  computeCanonicalStoryboardBillingSnapshot,
  type CanonicalStoryboardSnapshotInput,
} from './quote-billing';

/** A label claiming today's price requires a successful effective-policy read. */
export async function computeCurrentPublicSnapshot(
  context: PricingContext,
  dependencies: Parameters<typeof computeCanonicalBillingSnapshot>[1] = {},
): Promise<PricingSnapshot> {
  const policy = await (dependencies.pricingPolicy?.loadOverrides ?? loadPricingPolicyOverrides)();
  if (policy.status !== 'loaded') throw new Error('CURRENT_PRICING_POLICY_UNAVAILABLE');
  return computeCanonicalPublicSnapshot(context, {
    ...dependencies,
    pricingPolicy: { ...dependencies.pricingPolicy, loadOverrides: async () => policy },
  });
}

export async function computeCurrentAudioSnapshot(input: AudioPricingInput): Promise<PricingSnapshot> {
  const policy = await loadPricingPolicyOverrides();
  if (policy.status !== 'loaded') throw new Error('CURRENT_PRICING_POLICY_UNAVAILABLE');
  return computeCanonicalAudioBillingSnapshot(input, { pricingPolicy: { loadOverrides: async () => policy } });
}

export function computeCanonicalPublicSnapshot(
  context: PricingContext,
  dependencies: Parameters<typeof computeCanonicalBillingSnapshot>[1] = {},
): Promise<PricingSnapshot> {
  return computeCanonicalBillingSnapshot(context, {
    ...dependencies,
    pricingPolicy: { ...dependencies.pricingPolicy, warn: () => undefined },
  });
}

export function computeCanonicalPublicStoryboardSnapshot(
  input: CanonicalStoryboardSnapshotInput
): Promise<PricingSnapshot> {
  return computeCanonicalStoryboardBillingSnapshot(input, {
    pricingPolicy: { warn: () => undefined },
  });
}
