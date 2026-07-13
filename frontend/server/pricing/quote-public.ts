import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';

import { computeCanonicalBillingSnapshot } from './quote-billing';

export function computeCanonicalPublicSnapshot(context: PricingContext): Promise<PricingSnapshot> {
  return computeCanonicalBillingSnapshot(context, {
    pricingPolicy: { warn: () => undefined },
  });
}
