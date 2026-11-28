import type { PricingSnapshot } from '@/types/engines';
import type { WanPurchaseCanary } from '@/server/video-providers/router';
import { customerPurchaseCeiling, planWanPurchase } from '@/server/video-providers/purchase-router';
import type { WanRequestFacts } from '@/lib/video-routing/wan-request';

export function buildWanPurchaseDecision(
  params: {
    engineId: string;
    fallbackToFalEnabled: boolean;
    purchaseCanary?: WanPurchaseCanary;
    pricing: PricingSnapshot;
  },
  request: WanRequestFacts
) {
  const ceiling = params.engineId === 'wan-3-prime' ? process.env.WAN_PRIME_PURCHASE_CEILING_USD
    : params.engineId === 'wan-3' && params.purchaseCanary ? process.env.WAN_STANDARD_PURCHASE_CEILING_USD : undefined;
  const configured = ceiling?.trim();
  const serverCap = configured ? Math.floor(Number(configured) * 1e6) : Number.MAX_SAFE_INTEGER;
  const cap = Math.min(serverCap, customerPurchaseCeiling(params.pricing));
  return planWanPurchase(request, {
    ceilingMicros: cap,
    unavailable: params.fallbackToFalEnabled ? {} : { fal: 'Fal fallback disabled' },
  }, params.purchaseCanary);
}
