import { isDatabaseConfigured, query } from '@/lib/db';
import type { EngineCaps, EnginePricingDetails } from '@/types/engines';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { PricingEngineDefinition } from '@maxvideoai/pricing';
import { computePricingSnapshot as computeKernelSnapshot } from '@maxvideoai/pricing';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { getPricingDetails } from '@/lib/fal-catalog';
import { ensureBillingSchema } from '@/lib/schema';
import { getMembershipDiscountMap } from '@/lib/membership';
import { ENV } from '@/lib/env';
import { calculateLumaRay2Price } from '@/lib/luma-ray2-pricing';
import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  normaliseLumaRay2Loop,
  LUMA_RAY2_ERROR_UNSUPPORTED,
} from '@/lib/luma-ray2';

const DECIMAL_PLACES = 6;

export type RawPricingRule = {
  id: string;
  engine_id: string | null;
  resolution: string | null;
  margin_percent: number | string | null;
  margin_flat_cents: number | string | null;
  surcharge_audio_percent: number | string | null;
  surcharge_upscale_percent: number | string | null;
  currency: string | null;
  vendor_account_id: string | null;
  effective_from: string | null;
};

export type PricingRule = {
  id: string;
  engineId?: string;
  resolution?: string;
  marginPercent: number;
  marginFlatCents: number;
  surchargeAudioPercent: number;
  surchargeUpscalePercent: number;
  currency: string;
  vendorAccountId?: string;
  effectiveFrom?: string;
};

const DEFAULT_RULE: PricingRule = {
  id: 'default',
  marginPercent: 0.3,
  marginFlatCents: 0,
  surchargeAudioPercent: 0.2,
  surchargeUpscalePercent: 0.5,
  currency: 'USD',
};

const CACHE_TTL_MS = 60_000;
let cachedRules: PricingRule[] | null = null;
let cacheLoadedAt = 0;

function toNumber(value: number | string | null | undefined, fallback = 0, precision?: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return precision != null ? Number(value.toFixed(precision)) : value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return precision != null ? Number(parsed.toFixed(precision)) : parsed;
    }
  }
  return fallback;
}

function normaliseRule(raw: RawPricingRule): PricingRule {
  return {
    id: raw.id,
    engineId: raw.engine_id ?? undefined,
    resolution: raw.resolution ?? undefined,
    marginPercent: toNumber(raw.margin_percent, 0, DECIMAL_PLACES),
    marginFlatCents: Math.round(toNumber(raw.margin_flat_cents, 0)),
    surchargeAudioPercent: toNumber(raw.surcharge_audio_percent, 0, DECIMAL_PLACES),
    surchargeUpscalePercent: toNumber(raw.surcharge_upscale_percent, 0, DECIMAL_PLACES),
    currency: raw.currency?.trim() || 'USD',
    vendorAccountId: raw.vendor_account_id?.trim() || undefined,
    effectiveFrom: raw.effective_from ?? undefined,
  };
}

async function loadRules(): Promise<PricingRule[]> {
  if (cachedRules && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedRules;
  }

  try {
    const rows = await query<RawPricingRule>(
      `SELECT id, engine_id, resolution, margin_percent, margin_flat_cents, surcharge_audio_percent, surcharge_upscale_percent, currency, vendor_account_id, effective_from
       FROM app_pricing_rules
       ORDER BY engine_id NULLS LAST, resolution NULLS LAST, effective_from DESC`
    );
    const rules = rows.map(normaliseRule);
    cachedRules = rules.length ? rules : [DEFAULT_RULE];
  } catch {
    // Table peut ne pas exister encore — fallback sur la règle par défaut
    cachedRules = [DEFAULT_RULE];
  }

  cacheLoadedAt = Date.now();
  return cachedRules!;
}

function selectRule(rules: PricingRule[], engineId: string, resolution: string): PricingRule {
  let candidate = rules.find((rule) => rule.engineId === engineId && rule.resolution === resolution);
  if (candidate) return candidate;

  candidate = rules.find((rule) => rule.engineId === engineId && !rule.resolution);
  if (candidate) return candidate;

  candidate = rules.find((rule) => !rule.engineId && !rule.resolution);
  return candidate ?? DEFAULT_RULE;
}

function buildLumaRay2Snapshot(params: {
  baseUsd: number;
  duration: number | string | null | undefined;
  resolution: string;
  loop?: boolean;
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
}): PricingSnapshot {
  const { baseSubtotalUsd, breakdown } = calculateLumaRay2Price({
    baseUsd: params.baseUsd,
    duration: params.duration,
    resolution: params.resolution,
    loop: params.loop,
  });

  const baseSubtotalCents = Math.max(0, Math.round(baseSubtotalUsd * 100));
  const marginPercent = params.rule.marginPercent;
  const marginFlatCents = params.rule.marginFlatCents;
  const marginAmount = Math.max(0, Math.round(baseSubtotalCents * marginPercent) + marginFlatCents);
  const subtotalBeforeDiscountCents = baseSubtotalCents + marginAmount;

  const discountPercent = params.memberTierDiscounts[params.memberTier] ?? 0;
  const discountAmount = discountPercent > 0 ? Math.round(subtotalBeforeDiscountCents * discountPercent) : 0;
  const totalCents = Math.max(0, subtotalBeforeDiscountCents - discountAmount);
  const discountAppliedToMargin = Math.min(marginAmount, discountAmount);
  const platformFeeCents = Math.max(0, marginAmount - discountAppliedToMargin);
  const vendorShareCents = Math.max(0, totalCents - platformFeeCents);

  const seconds = breakdown.duration === '9s' ? 9 : 5;
  const rateUsd = seconds > 0 ? Number((breakdown.computed_total_usd / seconds).toFixed(4)) : Number(breakdown.computed_total_usd.toFixed(4));

  return {
    currency: params.currency,
    totalCents,
    subtotalBeforeDiscountCents,
    base: {
      seconds,
      rate: rateUsd,
      unit: 'sec',
      amountCents: baseSubtotalCents,
    },
    addons: [],
    margin: {
      amountCents: marginAmount,
      percentApplied: marginPercent,
      flatCents: marginFlatCents,
    },
    discount: discountAmount
      ? {
          amountCents: discountAmount,
          percentApplied: discountPercent,
          tier: params.memberTier,
        }
      : undefined,
    membershipTier: params.memberTier,
    platformFeeCents,
    vendorShareCents,
    vendorAccountId: params.vendorAccountId ?? undefined,
    meta: {
      cost_breakdown_usd: breakdown,
      duration_label: breakdown.duration,
      resolution: breakdown.resolution,
      duration_factor: breakdown.duration_factor,
      resolution_factor: breakdown.resolution_factor,
      loop: typeof breakdown.loop === 'boolean' ? breakdown.loop : undefined,
    },
  };
}

function buildDefinitionFromEngine(
  engine: EngineCaps,
  pricingDetails?: EnginePricingDetails
): PricingEngineDefinition | null {
  const currency =
    pricingDetails?.currency ??
    engine.pricing?.currency ??
    'USD';

  const perSecondDefault = pricingDetails?.perSecondCents?.default ?? undefined;
  const perSecondByResolution = pricingDetails?.perSecondCents?.byResolution ?? undefined;

  let baseUnitPriceCents: number | undefined = typeof perSecondDefault === 'number' ? perSecondDefault : undefined;

  if (baseUnitPriceCents == null && perSecondByResolution) {
    const first = Object.values(perSecondByResolution)[0];
    if (typeof first === 'number') {
      baseUnitPriceCents = first;
    }
  }

  if (baseUnitPriceCents == null) {
    const fallbackBase = engine.pricing?.base;
    if (typeof fallbackBase === 'number') {
      baseUnitPriceCents = Math.round(fallbackBase * 100);
    } else if (engine.pricing?.byResolution) {
      const first = Object.values(engine.pricing.byResolution)[0];
      if (typeof first === 'number') {
        baseUnitPriceCents = Math.round(first * 100);
      }
    }
  }

  if (baseUnitPriceCents == null || baseUnitPriceCents <= 0) {
    return null;
  }

  const resolutionMultipliers: Record<string, number> = {};
  if (perSecondByResolution) {
    for (const [resolution, cents] of Object.entries(perSecondByResolution)) {
      resolutionMultipliers[resolution] = baseUnitPriceCents > 0 ? cents / baseUnitPriceCents : 1;
    }
  } else if (engine.pricing?.byResolution) {
    for (const [resolution, dollars] of Object.entries(engine.pricing.byResolution)) {
      const cents = Math.round(dollars * 100);
      resolutionMultipliers[resolution] = baseUnitPriceCents > 0 ? cents / baseUnitPriceCents : 1;
    }
  }

  if (!Object.values(resolutionMultipliers).some((value) => Math.abs(value - 1) < 1e-6)) {
    resolutionMultipliers.default = 1;
  }

  const durationField = engine.inputSchema?.optional?.find((field) => field.id === 'duration_seconds');
  const minDuration = Math.max(1, Math.floor(durationField?.min ?? 1));
  const maxDuration = Math.max(
    minDuration,
    Math.floor(durationField?.max ?? pricingDetails?.maxDurationSec ?? engine.maxDurationSec ?? 30)
  );
  const stepDuration = Math.max(1, Math.floor(durationField?.step ?? 1));
  const defaultDurationRaw = durationField?.default;
  const defaultDuration =
    typeof defaultDurationRaw === 'number'
      ? defaultDurationRaw
      : typeof defaultDurationRaw === 'string'
        ? Number(defaultDurationRaw)
        : undefined;

  return {
    engineId: engine.id,
    label: engine.label,
    version: engine.version,
    currency,
    baseUnitPriceCents,
    durationSteps: {
      min: minDuration,
      max: maxDuration,
      step: stepDuration,
      default: Number.isFinite(defaultDuration) ? Number(defaultDuration) : undefined,
    },
    resolutionMultipliers,
    memberTierDiscounts: {
      member: 0,
      plus: 0.05,
      pro: 0.1,
    },
    minChargeCents: 0,
    rounding: { mode: 'nearest', incrementCents: 1 },
    taxPolicyHint: 'standard',
    addons: pricingDetails?.addons ?? undefined,
    platformFeePct: 0.3,
    platformFeeFlatCents: 0,
    availability: engine.availability,
    metadata: {
      source: 'engine-caps',
    },
  };
}

export type PricingContext = {
  engine: EngineCaps;
  durationSec: number;
  resolution: string;
  membershipTier?: string | null;
  currency?: string;
  loop?: boolean;
  durationOption?: number | string | null;
  addons?: Record<string, boolean | number | undefined>;
};

export async function computePricingSnapshot(context: PricingContext): Promise<PricingSnapshot> {
  const { engine, durationSec, resolution } = context;
  const pricingDetails: EnginePricingDetails | undefined =
    engine.pricingDetails ?? (await getPricingDetails(engine.id));
  const rules = await loadRules();
  const rule = selectRule(rules, engine.id, resolution);
  const vendorAccountId = rule.vendorAccountId ?? engine.vendorAccountId;

  let definition: PricingEngineDefinition | null = null;
  if (pricingDetails || engine.pricing) {
    definition = buildDefinitionFromEngine(engine, pricingDetails);
  }

  if (!definition) {
    const kernel = getPricingKernel();
    const fallback = kernel.getDefinition(engine.id);
    if (!fallback) {
      throw new Error(`Pricing definition not found for engine ${engine.id}`);
    }
    definition = fallback;
  }

  if (
    !definition.resolutionMultipliers[resolution] &&
    pricingDetails?.perSecondCents?.byResolution?.[resolution]
  ) {
    const perSecond = pricingDetails.perSecondCents.byResolution[resolution];
    if (typeof perSecond === 'number' && definition.baseUnitPriceCents > 0) {
      definition = {
        ...definition,
        resolutionMultipliers: {
          ...definition.resolutionMultipliers,
          [resolution]: perSecond / definition.baseUnitPriceCents,
        },
      };
    }
  }

  const membershipDiscounts = await getMembershipDiscountMap();
  const memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'] = {
    ...definition.memberTierDiscounts,
  };
  (Object.keys(memberTierDiscounts) as Array<keyof PricingEngineDefinition['memberTierDiscounts']>).forEach((key) => {
    const override = membershipDiscounts[key];
    if (typeof override === 'number' && Number.isFinite(override)) {
      memberTierDiscounts[key] = Math.max(0, override);
    }
  });

  const memberTier = (context.membershipTier ?? 'member').toLowerCase() as 'member' | 'plus' | 'pro';

  let snapshot: PricingSnapshot;

  if (engine.id === 'lumaRay2') {
    const baseRaw = ENV.LUMARAY2_BASE_5S_540P_USD;
    if (!baseRaw) {
      throw new Error('LUMARAY2_BASE_5S_540P_USD is not configured');
    }
    const baseUsd = Number(baseRaw);
    if (!Number.isFinite(baseUsd) || baseUsd <= 0) {
      throw new Error('LUMARAY2_BASE_5S_540P_USD must be a positive number');
    }

    const durationInfo = getLumaRay2DurationInfo(context.durationOption ?? durationSec);
    if (!durationInfo) {
      throw new Error(LUMA_RAY2_ERROR_UNSUPPORTED);
    }
    const resolutionInfo = getLumaRay2ResolutionInfo(resolution);
    if (!resolutionInfo) {
      throw new Error(LUMA_RAY2_ERROR_UNSUPPORTED);
    }

    const loop = normaliseLumaRay2Loop(context.loop);
    const currency = (context.currency ?? rule.currency ?? definition.currency ?? 'USD').toUpperCase();

    snapshot = buildLumaRay2Snapshot({
      baseUsd,
      duration: durationInfo.label,
      resolution: resolutionInfo.value,
      loop,
      rule,
      memberTier,
      memberTierDiscounts,
      currency,
      vendorAccountId,
    });
    snapshot.base.seconds = durationInfo.seconds;
  } else {
    const augmentedDefinition: PricingEngineDefinition = {
      ...definition,
      currency: context.currency ?? definition.currency,
      platformFeePct: rule.marginPercent,
      platformFeeFlatCents: rule.marginFlatCents,
      memberTierDiscounts,
      metadata: {
        ...(definition.metadata ?? {}),
        ruleId: rule.id,
        vendorAccountId,
      },
    };

    const kernelInput = {
      engineId: engine.id,
      durationSec,
      resolution,
      memberTier,
      ...(context.addons ? { addons: context.addons } : {}),
    } as const;

    const { quote } = computeKernelSnapshot(augmentedDefinition, kernelInput);
    snapshot = quote.snapshot;
  }

  snapshot.margin = {
    ...snapshot.margin,
    ruleId: rule.id,
  };
  snapshot.membershipTier = memberTier;
  snapshot.vendorAccountId = vendorAccountId;
  const existingMeta = snapshot.meta ?? {};
  snapshot.meta = {
    ...existingMeta,
    ruleId: rule.id,
    engineLabel: engine.label,
    engineVersion: engine.version,
    ruleCurrency: rule.currency,
    membershipDiscounts: memberTierDiscounts,
  };
  return snapshot;
}

export function getPlatformFeeCents(snapshot: PricingSnapshot): number {
  if (typeof snapshot.platformFeeCents === 'number') {
    return Math.max(0, snapshot.platformFeeCents);
  }
  const margin = snapshot.margin?.amountCents ?? 0;
  const discount = snapshot.discount?.amountCents ?? 0;
  const discountAppliedToMargin = Math.min(margin, discount);
  return Math.max(0, margin - discountAppliedToMargin);
}

export function getVendorShareCents(snapshot: PricingSnapshot): number {
  if (typeof snapshot.vendorShareCents === 'number') {
    return Math.max(0, snapshot.vendorShareCents);
  }
  const platformFee = getPlatformFeeCents(snapshot);
  return Math.max(0, snapshot.totalCents - platformFee);
}

export function invalidatePricingRulesCache(): void {
  cachedRules = null;
  cacheLoadedAt = 0;
}

export function generatePricingRuleId(engineId?: string | null, resolution?: string | null): string {
  const trimmedEngine = engineId?.trim();
  const trimmedResolution = resolution?.trim();
  if (!trimmedEngine) {
    return 'default';
  }
  const normalisedEngine = trimmedEngine.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  if (!trimmedResolution) {
    return `rule-${normalisedEngine}`;
  }
  const normalisedResolution = trimmedResolution.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return `rule-${normalisedEngine}-${normalisedResolution}`;
}

export type UpsertPricingRuleInput = {
  id?: string;
  engineId?: string | null;
  resolution?: string | null;
  marginPercent?: number | null;
  marginFlatCents?: number | null;
  surchargeAudioPercent?: number | null;
  surchargeUpscalePercent?: number | null;
  currency?: string | null;
  vendorAccountId?: string | null;
};

function sanitiseDecimal(value: number | null | undefined, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(DECIMAL_PLACES));
  }
  return fallback;
}

function sanitiseInteger(value: number | null | undefined, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  return fallback;
}

function sanitiseText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function listPricingRules(): Promise<PricingRule[]> {
  return loadRules();
}

export async function upsertPricingRule(input: UpsertPricingRuleInput): Promise<PricingRule> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database not configured');
  }

  await ensureBillingSchema();

  const engineId = sanitiseText(input.engineId ?? undefined);
  const resolution = sanitiseText(input.resolution ?? undefined);
  const id = sanitiseText(input.id ?? undefined) ?? generatePricingRuleId(engineId, resolution);
  const currency = sanitiseText(input.currency ?? undefined) ?? 'USD';
  const vendorAccountId = sanitiseText(input.vendorAccountId ?? undefined);
  const marginPercent = sanitiseDecimal(input.marginPercent, 0);
  const marginFlatCents = sanitiseInteger(input.marginFlatCents, 0);
  const surchargeAudioPercent = sanitiseDecimal(input.surchargeAudioPercent, 0);
  const surchargeUpscalePercent = sanitiseDecimal(input.surchargeUpscalePercent, 0);

  const rows = await query<RawPricingRule>(
    `INSERT INTO app_pricing_rules (
        id,
        engine_id,
        resolution,
        margin_percent,
        margin_flat_cents,
        surcharge_audio_percent,
        surcharge_upscale_percent,
        currency,
        vendor_account_id,
        effective_from,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        engine_id = EXCLUDED.engine_id,
        resolution = EXCLUDED.resolution,
        margin_percent = EXCLUDED.margin_percent,
        margin_flat_cents = EXCLUDED.margin_flat_cents,
        surcharge_audio_percent = EXCLUDED.surcharge_audio_percent,
        surcharge_upscale_percent = EXCLUDED.surcharge_upscale_percent,
        currency = EXCLUDED.currency,
        vendor_account_id = EXCLUDED.vendor_account_id,
        effective_from = NOW()
      RETURNING id, engine_id, resolution, margin_percent, margin_flat_cents, surcharge_audio_percent, surcharge_upscale_percent, currency, vendor_account_id, effective_from`,
    [
      id,
      engineId,
      resolution,
      marginPercent,
      marginFlatCents,
      surchargeAudioPercent,
      surchargeUpscalePercent,
      currency,
      vendorAccountId,
    ]
  );

  invalidatePricingRulesCache();

  const [row] = rows;
  if (!row) {
    throw new Error('Failed to persist pricing rule');
  }
  return normaliseRule(row);
}

export async function deletePricingRule(id: string): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database not configured');
  }
  const ruleId = sanitiseText(id);
  if (!ruleId) {
    throw new Error('Missing pricing rule id');
  }
  if (ruleId === 'default') {
    throw new Error('Cannot delete default pricing rule');
  }
  await ensureBillingSchema();
  await query(`DELETE FROM app_pricing_rules WHERE id = $1`, [ruleId]);
  invalidatePricingRulesCache();
}
