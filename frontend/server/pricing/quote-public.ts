import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';

import {
  computeCanonicalBillingSnapshot,
  computeCanonicalStoryboardBillingSnapshot,
  type CanonicalStoryboardSnapshotInput,
} from './quote-billing';

export function computeCanonicalPublicSnapshot(context: PricingContext): Promise<PricingSnapshot> {
  return computeCanonicalBillingSnapshot(context, {
    pricingPolicy: { warn: () => undefined },
  });
}

export function computeCanonicalPublicStoryboardSnapshot(
  input: CanonicalStoryboardSnapshotInput
): Promise<PricingSnapshot> {
  return computeCanonicalStoryboardBillingSnapshot(input, {
    pricingPolicy: { warn: () => undefined },
  });
}
