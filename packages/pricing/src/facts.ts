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
  const duration = clampDuration(input.durationSec, definition.durationSteps);
  const resolutionMultiplier = definition.resolutionMultipliers[input.resolution] ?? 1;
  const baseRateCents = normaliseCents(definition.baseUnitPriceCents * resolutionMultiplier);
  let baseAmountCents = normaliseCents(baseRateCents * duration);
  if (definition.minChargeCents && baseAmountCents < definition.minChargeCents) {
    baseAmountCents = definition.minChargeCents;
  }

  const addons: PricingAddonLine[] = [];
  for (const key of Object.keys(definition.addons ?? {})) {
    const addon = computeAddonAmount(key, input.addons?.[key], definition, duration, input.resolution);
    if (addon) addons.push(addon);
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
      durationSteps: definition.durationSteps,
      availability: definition.availability,
      baseUnitPriceCents: definition.baseUnitPriceCents,
    },
  };
}
