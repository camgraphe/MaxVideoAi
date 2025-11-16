import { clampDuration, applyRounding, toMemberTier } from './utils';
import type {
  PricingAddonLine,
  PricingEngineDefinition,
  PricingInput,
  PricingKernel,
  PricingQuote,
  PricingSnapshot,
  MemberTier,
} from './types';

const CENTS_PRECISION = 1000;

function normaliseCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * CENTS_PRECISION) / CENTS_PRECISION;
}

function computeAddonAmount(
  addonKey: string,
  enabledValue: boolean | number | undefined,
  definition: PricingEngineDefinition,
  duration: number
): PricingAddonLine | null {
  if (!enabledValue) return null;
  const rule = definition.addons?.[addonKey];
  if (!rule) return null;
  const perSecondCents = rule.perSecondCents ?? 0;
  const flatCents = rule.flatCents ?? 0;
  const total = normaliseCents(perSecondCents * duration + flatCents);
  if (total === 0) return null;
  return { type: addonKey, amountCents: total };
}

export function computePricingSnapshot(
  definition: PricingEngineDefinition,
  input: PricingInput
): { quote: PricingQuote; snapshot: PricingSnapshot } {
  const memberTier: MemberTier = toMemberTier(input.memberTier);
  const duration = clampDuration(input.durationSec, definition.durationSteps);
  const resolutionMultiplier = definition.resolutionMultipliers[input.resolution] ?? 1;
  const baseRateCents = normaliseCents(definition.baseUnitPriceCents * resolutionMultiplier);

  let baseAmountCents = normaliseCents(baseRateCents * duration);
  if (definition.minChargeCents && baseAmountCents < definition.minChargeCents) {
    baseAmountCents = definition.minChargeCents;
  }

  const addons: PricingAddonLine[] = [];
  if (definition.addons) {
    for (const key of Object.keys(definition.addons)) {
      const addonLine = computeAddonAmount(key, input.addons?.[key], definition, duration);
      if (addonLine) {
        addons.push(addonLine);
      }
    }
  }

  const addonsTotal = addons.reduce((sum, line) => sum + line.amountCents, 0);
  const subtotalBeforeMargin = normaliseCents(baseAmountCents + addonsTotal);

  const platformFeePct = definition.platformFeePct ?? 0;
  const platformFeeFlatCents = definition.platformFeeFlatCents ?? 0;
  const marginFromPercent = platformFeePct > 0 ? Math.round(subtotalBeforeMargin * platformFeePct) : 0;
  const marginAmount = Math.max(0, marginFromPercent + platformFeeFlatCents);
  const subtotalBeforeDiscount = normaliseCents(subtotalBeforeMargin + marginAmount);

  const discountPercent = definition.memberTierDiscounts[memberTier] ?? 0;
  const discountAmount = discountPercent > 0 ? Math.round(subtotalBeforeDiscount * discountPercent) : 0;

  const totalCentsPreRound = subtotalBeforeDiscount - discountAmount;
  const totalCents = applyRounding(totalCentsPreRound, definition.rounding);

  const discountAppliedToMargin = Math.min(marginAmount, discountAmount);
  const platformFeeCents = Math.max(0, marginAmount - discountAppliedToMargin);
  const vendorShareCents = Math.max(0, totalCents - platformFeeCents);

  const snapshot: PricingSnapshot = {
    currency: definition.currency,
    totalCents,
    subtotalBeforeDiscountCents: subtotalBeforeDiscount,
    base: {
      seconds: duration,
      rate: baseRateCents / 100,
      unit: 'sec',
      amountCents: baseAmountCents,
    },
    addons,
    margin: {
      amountCents: marginAmount,
      percentApplied: platformFeePct,
      flatCents: platformFeeFlatCents,
    },
    discount: discountAmount
      ? {
          amountCents: discountAmount,
          percentApplied: discountPercent,
          tier: memberTier,
        }
      : undefined,
    membershipTier: memberTier,
    platformFeeCents,
    vendorShareCents,
    meta: {
      taxPolicyHint: definition.taxPolicyHint,
      resolutionMultiplier,
      rounding: definition.rounding,
      durationSteps: definition.durationSteps,
      availability: definition.availability,
      baseUnitPriceCents: definition.baseUnitPriceCents,
    },
  };

  const quote: PricingQuote = {
    engineId: definition.engineId,
    resolution: input.resolution,
    memberTier,
    snapshot,
    definition,
    effectiveDurationSec: duration,
  };

  return { quote, snapshot };
}

export function createPricingKernel(definitions: PricingEngineDefinition[]): PricingKernel {
  const map = new Map<string, PricingEngineDefinition>();
  const primaryIds: PricingEngineDefinition[] = [];

  function normaliseDefinition(definition: PricingEngineDefinition): PricingEngineDefinition {
    return {
      ...definition,
      resolutionMultipliers: { ...definition.resolutionMultipliers },
      memberTierDiscounts: { ...definition.memberTierDiscounts },
      durationSteps: { ...definition.durationSteps },
      addons: definition.addons ? { ...definition.addons } : undefined,
      metadata: definition.metadata ? { ...definition.metadata } : undefined,
    };
  }

  function aliasVariants(engineId: string): string[] {
    const variants = new Set<string>();
    variants.add(engineId);
    variants.add(engineId.toLowerCase());
    const camelToKebab = engineId
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    variants.add(camelToKebab);
    const digitsToKebab = engineId
      .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    variants.add(digitsToKebab);
    return Array.from(variants).filter((value) => value.length > 0);
  }

  definitions.forEach((definition) => {
    const normalised = normaliseDefinition(definition);
    primaryIds.push(normalised);
    aliasVariants(definition.engineId).forEach((alias) => {
      if (!map.has(alias)) {
        map.set(alias, normalised);
      }
    });
  });

  return {
    listDefinitions() {
      return primaryIds.map((definition) => normaliseDefinition(definition));
    },
    getDefinition(engineId: string) {
      const def = map.get(engineId);
      return def ? normaliseDefinition(def) : undefined;
    },
    getDurations(engineId: string) {
      const def = map.get(engineId);
      return def ? { ...def.durationSteps } : undefined;
    },
    quote(input: PricingInput) {
      const definition = map.get(input.engineId);
      if (!definition) {
        throw new Error(`Unknown engineId "${input.engineId}" for pricing`);
      }
      const hasResolution =
        typeof definition.resolutionMultipliers[input.resolution] === 'number' ||
        typeof definition.resolutionMultipliers.default === 'number';
      if (!hasResolution) {
        throw new Error(`Unsupported resolution "${input.resolution}" for engine "${definition.engineId}"`);
      }
      return computePricingSnapshot(definition, input).quote;
    },
  };
}
