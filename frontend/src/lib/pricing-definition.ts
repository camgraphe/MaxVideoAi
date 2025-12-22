import type { EngineCaps, EnginePricing, EnginePricingDetails } from '@/types/engines';
import type { PricingAddonRule, PricingEngineDefinition } from '@maxvideoai/pricing';

const DEFAULT_MEMBER_DISCOUNTS = {
  member: 0,
  plus: 0.05,
  pro: 0.1,
} as const;

function resolveDurationSteps(engine: EngineCaps) {
  const durationField =
    engine.inputSchema?.optional?.find((field) => field.id === 'duration_seconds') ??
    engine.inputSchema?.optional?.find((field) => field.id === 'duration');
  const min = Math.max(1, Math.floor(durationField?.min ?? 1));
  const max = Math.max(
    min,
    Math.floor(durationField?.max ?? engine.pricingDetails?.maxDurationSec ?? engine.maxDurationSec ?? 30)
  );
  const step = Math.max(1, Math.floor(durationField?.step ?? 1));
  const rawDefault = durationField?.default;
  let defaultValue: number | undefined;
  if (typeof rawDefault === 'number' && Number.isFinite(rawDefault)) {
    defaultValue = Math.round(rawDefault);
  } else if (typeof rawDefault === 'string') {
    const numeric = Number(rawDefault.replace(/[^\d.]/g, ''));
    if (Number.isFinite(numeric) && numeric > 0) {
      defaultValue = Math.round(numeric);
    }
  }
  return { min, max, step, default: defaultValue };
}

function normaliseResolutionMultipliers(
  baseRateCents: number,
  byResolution: Record<string, number> | undefined,
  pricingFallback: Record<string, number> | undefined
) {
  const multipliers: Record<string, number> = {};
  const parseNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  if (byResolution) {
    for (const [resolution, cents] of Object.entries(byResolution)) {
      const rateCents = parseNumber(cents);
      if (rateCents == null) continue;
      const multiplier = baseRateCents > 0 ? rateCents / baseRateCents : 1;
      multipliers[resolution] = multiplier;
    }
  } else if (pricingFallback) {
    for (const [resolution, amount] of Object.entries(pricingFallback)) {
      const numericUsd = parseNumber(amount);
      if (numericUsd == null) continue;
      const rateCents = numericUsd * 100;
      const multiplier = baseRateCents > 0 ? rateCents / baseRateCents : 1;
      multipliers[resolution] = multiplier;
    }
  }
  if (!Object.values(multipliers).some((value) => Math.abs(value - 1) < 1e-6)) {
    multipliers.default = 1;
  }
  return multipliers;
}

function resolveAddonPricing(engine: EngineCaps): Record<string, PricingAddonRule | undefined> | undefined {
  if (engine.pricingDetails?.addons) {
    return engine.pricingDetails.addons;
  }
  const legacy = engine.pricing?.addons;
  if (!legacy) return undefined;
  const mapped: Record<string, PricingAddonRule | undefined> = {};
  Object.entries(legacy).forEach(([key, value]) => {
    if (!value) return;
    mapped[key] = {
      perSecondCents: typeof value.perSecond === 'number' ? Math.round(value.perSecond * 100) : undefined,
      flatCents: typeof value.flat === 'number' ? Math.round(value.flat * 100) : undefined,
    };
  });
  return Object.keys(mapped).length ? mapped : undefined;
}

function resolveBaseUnitPriceCents(engine: EngineCaps): {
  baseUnitPriceCents: number;
  currency: string;
  byResolution: Record<string, number> | undefined;
} | null {
  const currency = engine.pricingDetails?.currency ?? engine.pricing?.currency ?? 'USD';

  let base = engine.pricingDetails?.perSecondCents?.default;
  const byResolution = engine.pricingDetails?.perSecondCents?.byResolution;

  if (typeof base !== 'number') {
    const resolutionEntries = byResolution ? Object.values(byResolution) : [];
    if (resolutionEntries.length > 0) {
      base = resolutionEntries[0];
    }
  }

  if (typeof base === 'number') {
    return {
      baseUnitPriceCents: base,
      currency,
      byResolution,
    };
  }

  const fallbackBase = engine.pricing?.base;
  const fallbackByResolution = engine.pricing?.byResolution;
  if (typeof fallbackBase === 'number' && fallbackBase > 0) {
    return {
      baseUnitPriceCents: fallbackBase * 100,
      currency,
      byResolution: undefined,
    };
  }

  if (fallbackByResolution) {
    const [firstResolution] = Object.values(fallbackByResolution);
    if (typeof firstResolution === 'number') {
      return {
        baseUnitPriceCents: firstResolution * 100,
        currency,
        byResolution: fallbackByResolution,
      };
    }
  }

  return null;
}

export function buildPricingDefinition(engine: EngineCaps): PricingEngineDefinition | null {
  const baseInfo = resolveBaseUnitPriceCents(engine);
  if (!baseInfo || baseInfo.baseUnitPriceCents <= 0) {
    return null;
  }
  const durationSteps = resolveDurationSteps(engine);
  const resolutionMultipliers = normaliseResolutionMultipliers(
    baseInfo.baseUnitPriceCents,
    baseInfo.byResolution,
    engine.pricing?.byResolution
  );

  return {
    engineId: engine.id,
    label: engine.label,
    version: engine.version,
    currency: baseInfo.currency,
    baseUnitPriceCents: baseInfo.baseUnitPriceCents,
    durationSteps,
    resolutionMultipliers,
    memberTierDiscounts: {
      member: DEFAULT_MEMBER_DISCOUNTS.member,
      plus: DEFAULT_MEMBER_DISCOUNTS.plus,
      pro: DEFAULT_MEMBER_DISCOUNTS.pro,
    },
    minChargeCents: 0,
    rounding: { mode: 'nearest', incrementCents: 1 },
    taxPolicyHint: 'standard',
    addons: resolveAddonPricing(engine),
    platformFeePct: 0.3,
    platformFeeFlatCents: 0,
    availability: engine.availability,
    metadata: {
      source: 'engine-caps',
    },
  };
}

export function applyEnginePricingOverride(
  engine: EngineCaps,
  override?: EnginePricingDetails | null
): EngineCaps {
  if (!override) return engine;
  const pricing: EnginePricing = {
    unit: 'sec',
    currency: override.currency,
  };
  if (override.perSecondCents?.default != null) {
    pricing.base = override.perSecondCents.default / 100;
  }
  if (override.perSecondCents?.byResolution) {
    pricing.byResolution = Object.fromEntries(
      Object.entries(override.perSecondCents.byResolution).map(([key, cents]) => [key, cents / 100])
    );
  }
  return {
    ...engine,
    pricingDetails: override,
    pricing,
  };
}
