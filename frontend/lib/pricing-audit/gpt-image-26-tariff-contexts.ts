import { GPT_IMAGE_2_6_ENGINE_REGISTRY } from '@/config/fal-engines/gpt-image-2-6';
import { GPT_IMAGE_26_SIZES, GPT_IMAGE_26_QUALITIES } from '@/lib/image/gptImage26';
import type { PricingContext } from '@/lib/pricing-context';

/** Inactive commercial inventory. No amount, activation or input-token assumption. */
export function gptImage26TariffContexts(): Array<{ context: PricingContext; capabilityKey: string }> {
  const scenarios: Array<{ context: PricingContext; capabilityKey: string }> = [];
  for (const { engine } of GPT_IMAGE_2_6_ENGINE_REGISTRY) for (const mode of ['t2i', 'i2i'] as const) {
    const counts = mode === 'i2i' ? Array.from({ length: 16 }, (_, i) => i + 1) : [0];
    for (const resolution of GPT_IMAGE_26_SIZES) for (const quality of GPT_IMAGE_26_QUALITIES) {
      for (const durationSec of [1, 2, 3, 4]) for (const referenceImageCount of counts) {
        scenarios.push({ context: { engine, mode, resolution, quality, durationSec, referenceImageCount }, capabilityKey: `${engine.id}:${mode}:${resolution}` });
      }
    }
  }
  return scenarios;
}
