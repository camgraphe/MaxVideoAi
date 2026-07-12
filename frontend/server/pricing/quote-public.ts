import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing';

import { computeCanonicalBillingSnapshot } from './quote-billing';

export function computeCanonicalPublicSnapshot(context: PricingContext): Promise<PricingSnapshot> {
  return computeCanonicalBillingSnapshot(context, {
    pricingPolicy: { warn: () => undefined },
  });
}
