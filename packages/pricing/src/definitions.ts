// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import outside the package root is supported within the monorepo workspace.
import enginesFixture from '../../../fixtures/engines.json';
import type { PricingAddonRule, PricingEngineDefinition } from './types';

type FixtureEngine = {
  id: string;
  label?: string;
  version?: string;
  availability?: string;
  maxDurationSec?: number;
  inputSchema?: {
    optional?: Array<{
      id?: string;
      min?: number;
      max?: number;
      step?: number;
      default?: number;
    }>;
  };
  pricingDetails?: {
    currency?: string;
    perSecondCents?: {
      default?: number;
      byResolution?: Record<string, number>;
    };
    flatCents?: {
      default?: number;
      byResolution?: Record<string, number>;
    };
    addons?: Record<string, PricingAddonRule>;
    maxDurationSec?: number;
  };
  pricing?: {
    unit?: string;
    base?: number;
    byResolution?: Record<string, number>;
    currency?: string;
  };
  metadata?: Record<string, unknown>;
  platform_fee_pct?: number;
};

const DEFAULT_MEMBER_DISCOUNTS = {
  member: 0,
  plus: 0.05,
  pro: 0.1,
} as const;

function resolveDurationSteps(engine: FixtureEngine) {
  const durationField = engine.inputSchema?.optional?.find((field) => field.id === 'duration_seconds');
  const min = Math.max(1, Math.floor(durationField?.min ?? 1));
  const max = Math.max(min, Math.floor(durationField?.max ?? engine.pricingDetails?.maxDurationSec ?? engine.maxDurationSec ?? 30));
  const step = Math.max(1, Math.floor(durationField?.step ?? 1));
  const defaultValue = durationField?.default ?? undefined;
  return { min, max, step, default: defaultValue };
}

function normaliseResolutionMultipliers(
  baseRateCents: number,
  byResolution: Record<string, number> | undefined,
  pricingFallback: Record<string, number> | undefined
) {
  const multipliers: Record<string, number> = {};
  if (byResolution) {
    for (const [resolution, cents] of Object.entries(byResolution)) {
      const rateCents = Math.round(cents);
      const multiplier = baseRateCents > 0 ? rateCents / baseRateCents : 1;
      multipliers[resolution] = multiplier;
    }
  } else if (pricingFallback) {
    for (const [resolution, amount] of Object.entries(pricingFallback)) {
      const rateCents = Math.round(Number(amount) * 100);
      const multiplier = baseRateCents > 0 ? rateCents / baseRateCents : 1;
      multipliers[resolution] = multiplier;
    }
  }
  if (!Object.values(multipliers).some((value) => Math.abs(value - 1) < 1e-6)) {
    multipliers.default = 1;
  }
  return multipliers;
}

function resolveBaseUnitPriceCents(engine: FixtureEngine): { baseUnitPriceCents: number; currency: string; byResolution: Record<string, number> | undefined } | null {
  const currency =
    engine.pricingDetails?.currency ??
    engine.pricing?.currency ??
    'USD';

  let base = engine.pricingDetails?.perSecondCents?.default;
  let byResolution = engine.pricingDetails?.perSecondCents?.byResolution;

  if (typeof base !== 'number') {
    const resolutionEntries = byResolution ? Object.values(byResolution) : [];
    if (resolutionEntries.length > 0) {
      base = resolutionEntries[0];
    }
  }

  if (typeof base === 'number') {
    return {
      baseUnitPriceCents: Math.round(base),
      currency,
      byResolution,
    };
  }

  const fallbackBase = engine.pricing?.base;
  const fallbackByResolution = engine.pricing?.byResolution;
  if (typeof fallbackBase === 'number' && fallbackBase > 0) {
    return {
      baseUnitPriceCents: Math.round(fallbackBase * 100),
      currency,
      byResolution: undefined,
    };
  }

  if (fallbackByResolution) {
    const [firstResolution] = Object.values(fallbackByResolution);
    if (typeof firstResolution === 'number') {
      return {
        baseUnitPriceCents: Math.round(firstResolution * 100),
        currency,
        byResolution: fallbackByResolution,
      };
    }
  }

  return null;
}

export function buildPricingDefinitionsFromFixtures(): PricingEngineDefinition[] {
  const engines: FixtureEngine[] = Array.isArray(enginesFixture.engines) ? (enginesFixture.engines as FixtureEngine[]) : [];
  const definitions: PricingEngineDefinition[] = [];

  for (const engine of engines) {
    if (!engine?.id) {
      continue;
    }
    const baseInfo = resolveBaseUnitPriceCents(engine);
    if (!baseInfo || baseInfo.baseUnitPriceCents <= 0) {
      continue;
    }

    const durationSteps = resolveDurationSteps(engine);
    const resolutionMultipliers = normaliseResolutionMultipliers(
      baseInfo.baseUnitPriceCents,
      baseInfo.byResolution,
      engine.pricing?.byResolution
    );

    definitions.push({
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
      addons: engine.pricingDetails?.addons ?? undefined,
      platformFeePct: engine.platform_fee_pct ?? 0.2,
      platformFeeFlatCents: 0,
      availability: engine.availability,
      metadata: {
        source: 'fixtures',
      },
    });
  }

  return definitions;
}
