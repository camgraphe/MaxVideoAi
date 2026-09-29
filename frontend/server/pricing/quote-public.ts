import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import type { ResolveServerPricingPolicyDependencies } from './resolve-pricing-policy';

import {
  computeCanonicalBillingSnapshot,
  computeCanonicalStoryboardBillingSnapshot,
  type CanonicalStoryboardSnapshotInput,
} from './quote-billing';

export function computeCanonicalPublicSnapshot(
  context: PricingContext,
  dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {},
): Promise<PricingSnapshot> {
  return computeCanonicalBillingSnapshot(context, {
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
