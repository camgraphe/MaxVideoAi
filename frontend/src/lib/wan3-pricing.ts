import type { PricingDefinitionFacts } from '@maxvideoai/pricing';

export const WAN_3_PRICING_SOURCE = 'alibaba_singapore_input_plus_output_2026-09-22';
// Official billing basis: https://www.alibabacloud.com/help/en/model-studio/model-pricing
// Input/output limits: https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference

export function isWan3EngineId(engineId: string): boolean {
  return engineId === 'wan-3' || engineId === 'wan-3-prime';
}

/** Call only with owned, validated media metadata; request duration claims are not pricing facts. */
export function getWan3InputVideoDurationSec(
  references: readonly { kind: string; url?: string; durationSec?: number | null }[]
): number {
  const durationsByUrl = new Map<string, number>();
  for (const reference of references) {
    if (reference.kind !== 'video') continue;
    const url = reference.url?.trim();
    const duration = reference.durationSec;
    if (!url || typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      throw new Error('Verified input-video duration is required for Wan 3 pricing.');
    }
    // Aliased source/reference slots are charged once. Conflicting trusted records retain the larger duration.
    durationsByUrl.set(url, Math.max(durationsByUrl.get(url) ?? 0, duration));
  }
  return [...durationsByUrl.values()].reduce((sum, duration) => sum + duration, 0);
}

type Wan3PricingDurationInput = {
  mode?: string;
  durationSec: number;
  inputVideoDurationSec?: number;
  hasVideoInput?: boolean;
};

export function validateWan3PricingDuration(input: Wan3PricingDurationInput): {
  outputDurationSec: number;
  inputVideoDurationSec: number;
  billableDurationSec: number;
} {
  const mode = input.mode ?? 't2v';
  if (!['t2v', 'i2v', 'ref2v', 'v2v', 'extend'].includes(mode)) {
    throw new Error(`Unsupported Wan 3 pricing mode: ${mode}.`);
  }
  if (!Number.isInteger(input.durationSec) || input.durationSec < 2 || input.durationSec > 30) {
    throw new Error('Wan 3 output duration must be an integer from 2 to 30 seconds.');
  }
  const inputSeconds = input.inputVideoDurationSec ?? 0;
  if (!Number.isFinite(inputSeconds) || inputSeconds < 0 || inputSeconds > 15) {
    throw new Error('Wan 3 input-video duration must be between 0 and 15 seconds.');
  }
  const requiresVideo = mode === 'v2v' || mode === 'extend' || input.hasVideoInput === true;
  if (requiresVideo && inputSeconds <= 0) {
    throw new Error('Verified input-video duration is required for Wan 3 pricing.');
  }
  if ((mode === 't2v' || mode === 'i2v') && inputSeconds > 0) {
    throw new Error(`Wan 3 ${mode} does not accept input video.`);
  }
  const billableDurationSec = input.durationSec + inputSeconds;
  if (billableDurationSec > 30) {
    throw new Error('Wan 3 input and output video duration must not exceed 30 seconds combined.');
  }
  return { outputDurationSec: input.durationSec, inputVideoDurationSec: inputSeconds, billableDurationSec };
}

/** Adds provider input seconds at the same resolved rate as output, preserving rate overrides and output presentation. */
export function withWan3InputVideoPricing(
  outputFacts: PricingDefinitionFacts,
  input: Wan3PricingDurationInput
): PricingDefinitionFacts {
  const duration = validateWan3PricingDuration(input);
  const inputSubtotalExactCents = Math.round(duration.inputVideoDurationSec * outputFacts.base.rate * 100_000) / 1000;
  return {
    ...outputFacts,
    vendorSubtotalExactCents: Math.round((outputFacts.vendorSubtotalExactCents + inputSubtotalExactCents) * 1000) / 1000,
    addons: [
      ...outputFacts.addons,
      ...(inputSubtotalExactCents > 0 ? [{ type: 'input_video_duration', amountCents: inputSubtotalExactCents }] : []),
    ],
    meta: {
      ...outputFacts.meta,
      pricing_model: 'wan3_input_plus_output_duration',
      provider_cost_source: WAN_3_PRICING_SOURCE,
      output_duration_sec: duration.outputDurationSec,
      input_video_duration_sec: duration.inputVideoDurationSec,
      billable_duration_sec: duration.billableDurationSec,
      input_video_subtotal_exact_cents: inputSubtotalExactCents,
    },
  };
}
