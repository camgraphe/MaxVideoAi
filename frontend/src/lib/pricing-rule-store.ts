import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

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

export async function loadPricingRules(): Promise<PricingRule[]> {
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

export function selectPricingRuleForBilling(rules: PricingRule[], engineId: string, resolution: string): PricingRule {
  let candidate = rules.find((rule) => rule.engineId === engineId && rule.resolution === resolution);
  if (candidate) return candidate;

  candidate = rules.find((rule) => rule.engineId === engineId && !rule.resolution);
  if (candidate) return candidate;

  candidate = rules.find((rule) => !rule.engineId && !rule.resolution);
  return candidate ?? DEFAULT_RULE;
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
  return loadPricingRules();
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
