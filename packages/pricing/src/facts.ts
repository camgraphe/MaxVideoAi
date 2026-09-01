import { clampDuration } from './utils';
import type { PricingAddonLine, PricingEngineDefinition, PricingSnapshot } from './types';

const CENTS_PRECISION = 1000;

function normaliseCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * CENTS_PRECISION) / CENTS_PRECISION;
}

function computeAddonAmount(
  addonKey: string,
  enabledValue: boolean | number | undefined,
  definition: PricingEngineDefinition,
  duration: number,
  resolution: string
): PricingAddonLine | null {
  if (!enabledValue) return null;
  const rule = definition.addons?.[addonKey];
  if (!rule) return null;
  const perSecondCents =
    (rule.perSecondCentsByResolution && rule.perSecondCentsByResolution[resolution]) ??
    rule.perSecondCents ??
    0;
  const total = normaliseCents(perSecondCents * duration + (rule.flatCents ?? 0));
  return total === 0 ? null : { type: addonKey, amountCents: total };
}

export type PricingDefinitionFactsInput = {
  durationSec: number;
  resolution: string;
  mode?: string;
  referenceImageCount?: number;
  inputAudioDurationSec?: number;
  addons?: Record<string, boolean | number | undefined>;
};

export type PricingDefinitionFacts = {
  vendorSubtotalExactCents: number;
  base: PricingSnapshot['base'];
  addons: PricingSnapshot['addons'];
  meta: Record<string, unknown>;
};

export function computePricingDefinitionFacts(
  definition: PricingEngineDefinition,
  input: PricingDefinitionFactsInput
): PricingDefinitionFacts {
  const modeRate = input.mode ? definition.modePricing?.[input.mode] : undefined;
  const durationBasis = modeRate?.durationBasis ?? 'output';
  const duration = durationBasis === 'input_audio'
    ? (() => {
        if (
          typeof input.inputAudioDurationSec !== 'number'
          || !Number.isFinite(input.inputAudioDurationSec)
          || input.inputAudioDurationSec <= 0
        ) {
          throw new Error('Input-audio duration is required for this pricing mode.');
        }
        return input.inputAudioDurationSec;
      })()
    : clampDuration(input.durationSec, definition.durationSteps);
  const resolutionMultiplier = definition.resolutionMultipliers[input.resolution] ?? 1;
  const modePerSecond = modeRate?.perSecondCents;
  const modeRateCents = modePerSecond
    ? modePerSecond.byResolution?.[input.resolution] ?? modePerSecond.default
    : undefined;
  if (modePerSecond && typeof modeRateCents !== 'number') {
    throw new Error(`Pricing is unavailable for mode ${input.mode ?? 'default'} at ${input.resolution}.`);
  }
  const baseRateCents = normaliseCents(
    typeof modeRateCents === 'number'
      ? modeRateCents
      : definition.baseUnitPriceCents * resolutionMultiplier,
  );
  let baseAmountCents = normaliseCents(baseRateCents * duration);
  if (definition.minChargeCents && baseAmountCents < definition.minChargeCents) {
    baseAmountCents = definition.minChargeCents;
  }

  const addons: PricingAddonLine[] = [];
  for (const key of Object.keys(definition.addons ?? {})) {
    const addon = computeAddonAmount(key, input.addons?.[key], definition, duration, input.resolution);
    if (addon) addons.push(addon);
  }

  const referenceRule = definition.referenceImages;
  if (input.mode && referenceRule?.modes.includes(input.mode)) {
    const rawCount = input.referenceImageCount ?? 0;
    if (!Number.isSafeInteger(rawCount) || rawCount < 0) {
      throw new Error('Reference image count must be a non-negative safe integer.');
    }
    const paidCount = Math.max(0, rawCount - Math.max(0, referenceRule.includedCount ?? 0));
    const amountCents = normaliseCents(paidCount * referenceRule.unitCents);
    if (amountCents > 0) addons.push({ type: 'reference_images', amountCents });
  }

  return {
    vendorSubtotalExactCents: normaliseCents(
      baseAmountCents + addons.reduce((sum, addon) => sum + addon.amountCents, 0)
    ),
    base: {
      seconds: duration,
      rate: baseRateCents / 100,
      unit: 'sec',
      amountCents: baseAmountCents,
    },
    addons,
    meta: {
      taxPolicyHint: definition.taxPolicyHint,
      resolutionMultiplier,
      ...(modeRate ? { durationBasis } : {}),
      ...(input.mode ? { mode: input.mode } : {}),
      ...(typeof input.referenceImageCount === 'number'
        ? { referenceImageCount: input.referenceImageCount }
        : {}),
      ...(durationBasis === 'input_audio' ? { inputAudioDurationSec: duration } : {}),
      durationSteps: definition.durationSteps,
      availability: definition.availability,
      baseUnitPriceCents: definition.baseUnitPriceCents,
    },
  };
}
