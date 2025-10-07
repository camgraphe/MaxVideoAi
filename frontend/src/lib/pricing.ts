import { query } from '@/lib/db';
import type { EngineCaps, EnginePricingDetails } from '@/types/engines';
import type { PricingSnapshot } from '@/types/engines';
import { getPricingDetails } from '@/lib/fal-catalog';

type RawPricingRule = {
  id: string;
  engine_id: string | null;
  resolution: string | null;
  margin_percent: number | null;
  margin_flat_cents: number | null;
  surcharge_audio_percent: number | null;
  surcharge_upscale_percent: number | null;
  currency: string | null;
  vendor_account_id: string | null;
};

type PricingRule = {
  id: string;
  engineId?: string;
  resolution?: string;
  marginPercent: number;
  marginFlatCents: number;
  surchargeAudioPercent: number;
  surchargeUpscalePercent: number;
  currency: string;
  vendorAccountId?: string;
};

const DEFAULT_RULE: PricingRule = {
  id: 'default',
  marginPercent: 0.2,
  marginFlatCents: 0,
  surchargeAudioPercent: 0.2,
  surchargeUpscalePercent: 0.5,
  currency: 'USD',
};

const CACHE_TTL_MS = 60_000;
let cachedRules: PricingRule[] | null = null;
let cacheLoadedAt = 0;

function normaliseRule(raw: RawPricingRule): PricingRule {
  return {
    id: raw.id,
    engineId: raw.engine_id ?? undefined,
    resolution: raw.resolution ?? undefined,
    marginPercent: raw.margin_percent ?? 0,
    marginFlatCents: raw.margin_flat_cents ?? 0,
    surchargeAudioPercent: raw.surcharge_audio_percent ?? 0,
    surchargeUpscalePercent: raw.surcharge_upscale_percent ?? 0,
    currency: raw.currency ?? 'USD',
    vendorAccountId: raw.vendor_account_id ?? undefined,
  };
}

async function loadRules(): Promise<PricingRule[]> {
  if (cachedRules && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedRules;
  }

  try {
    const rows = await query<RawPricingRule>(
      `SELECT id, engine_id, resolution, margin_percent, margin_flat_cents, surcharge_audio_percent, surcharge_upscale_percent, currency, vendor_account_id
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

export type PricingContext = {
  engine: EngineCaps;
  durationSec: number;
  resolution: string;
  addons?: { audio?: boolean; upscale4k?: boolean };
  membershipTier?: string | null;
  currency?: string;
};

export async function computePricingSnapshot(context: PricingContext): Promise<PricingSnapshot> {
  const { engine, durationSec, resolution } = context;
  const pricingDetails: EnginePricingDetails | undefined = engine.pricingDetails ?? (await getPricingDetails(engine.id));
  const currency = context.currency ?? pricingDetails?.currency ?? 'USD';
  const rules = await loadRules();
  const rule = selectRule(rules, engine.id, resolution);
  const vendorAccountId = rule.vendorAccountId ?? engine.vendorAccountId;

  const perSecondCentsFromFal = pricingDetails?.perSecondCents?.byResolution?.[resolution] ?? pricingDetails?.perSecondCents?.default;
  const flatCentsFromFal =
    pricingDetails?.flatCents?.byResolution?.[resolution] ??
    pricingDetails?.flatCents?.default ??
    0;

  let baseAmount = 0;
  let baseRate = 0;
  if (perSecondCentsFromFal != null || flatCentsFromFal) {
    const perSecondCents = perSecondCentsFromFal ?? 0;
    baseAmount = perSecondCents * durationSec + (flatCentsFromFal ?? 0);
    baseRate = perSecondCentsFromFal != null ? perSecondCentsFromFal / 100 : baseAmount / Math.max(1, durationSec) / 100;
  } else {
    const fallbackRate = engine.pricing?.byResolution?.[resolution] ?? engine.pricing?.base ?? 0;
    baseRate = fallbackRate;
    baseAmount = Math.max(0, Math.round(fallbackRate * durationSec * 100));
  }

  const addons: PricingSnapshot['addons'] = [];
  if (context.addons?.audio && engine.audio) {
    const audioPricing = pricingDetails?.addons?.audio;
    if (audioPricing) {
      const perSecond = audioPricing.perSecondCents ?? 0;
      const flat = audioPricing.flatCents ?? 0;
      const audioSubtotal = perSecond * durationSec + flat;
      addons.push({ type: 'audio', amountCents: audioSubtotal });
    } else {
      const audioSubtotal = Math.round(baseAmount * rule.surchargeAudioPercent);
      addons.push({ type: 'audio', amountCents: audioSubtotal });
    }
  }
  if (context.addons?.upscale4k && engine.upscale4k) {
    const upscalePricing = pricingDetails?.addons?.upscale4k;
    if (upscalePricing) {
      const perSecond = upscalePricing.perSecondCents ?? 0;
      const flat = upscalePricing.flatCents ?? 0;
      const upscaleSubtotal = perSecond * durationSec + flat;
      addons.push({ type: 'upscale4k', amountCents: upscaleSubtotal });
    } else {
      const upscaleSubtotal = Math.round(baseAmount * rule.surchargeUpscalePercent);
      addons.push({ type: 'upscale4k', amountCents: upscaleSubtotal });
    }
  }

  const addonsTotal = addons.reduce((acc, line) => acc + line.amountCents, 0);
  const subtotalBeforeMargin = baseAmount + addonsTotal;

  const marginFromPercent = Math.round(subtotalBeforeMargin * rule.marginPercent);
  const marginFromFlat = rule.marginFlatCents;
  const marginTotal = Math.max(0, marginFromPercent + marginFromFlat);

  const subtotalBeforeDiscount = subtotalBeforeMargin + marginTotal;

  const membership = (context.membershipTier ?? 'Member').toLowerCase();
  let discountPercent = 0;
  if (membership === 'plus') discountPercent = 0.05;
  if (membership === 'pro') discountPercent = 0.1;
  const discountAmount = Math.round(subtotalBeforeDiscount * discountPercent);

  const totalCents = Math.max(0, subtotalBeforeDiscount - discountAmount);
  const discountAppliedToMargin = Math.min(marginTotal, discountAmount);
  const platformFeeCents = Math.max(0, marginTotal - discountAppliedToMargin);
  const vendorShareCents = Math.max(0, totalCents - platformFeeCents);

  return {
    currency,
    totalCents,
    subtotalBeforeDiscountCents: subtotalBeforeDiscount,
    base: {
      seconds: durationSec,
      rate: baseRate,
      unit: engine.pricing?.unit,
      amountCents: baseAmount,
    },
    addons,
    margin: {
      amountCents: marginTotal,
      percentApplied: rule.marginPercent,
      flatCents: rule.marginFlatCents,
      ruleId: rule.id,
    },
    discount: discountAmount
      ? {
          amountCents: discountAmount,
          percentApplied: discountPercent,
          tier: membership,
        }
      : undefined,
    membershipTier: context.membershipTier ?? 'Member',
    vendorAccountId,
    platformFeeCents,
    vendorShareCents,
    meta: {
      ruleId: rule.id,
      vendorAccountId,
      platformFeeCents,
      vendorShareCents,
    },
  };
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
