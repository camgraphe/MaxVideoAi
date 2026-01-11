import { query } from '@/lib/db';
import { getBaseEngines } from '@/lib/engines';
import type { EngineCaps, EnginePricingDetails } from '@/types/engines';

export type EngineSettingsRecord = {
  engine_id: string;
  options: Record<string, unknown> | null;
  pricing: EnginePricingDetails | null;
  updated_at: string;
  updated_by: string | null;
};

function normalizeOptions(engine: EngineCaps): Record<string, unknown> {
  return {
    label: engine.label,
    provider: engine.provider,
    maxDurationSec: engine.maxDurationSec,
    modes: engine.modes,
    resolutions: engine.resolutions,
    aspectRatios: engine.aspectRatios,
    fps: engine.fps,
    audio: engine.audio,
    upscale4k: engine.upscale4k,
    extend: engine.extend,
    motionControls: engine.motionControls,
    keyframes: engine.keyframes,
    inputLimits: engine.inputLimits,
    params: engine.params,
    availability: engine.availability,
    latencyTier: engine.latencyTier,
    apiAvailability: engine.apiAvailability ?? null,
    brandId: engine.brandId ?? null,
  };
}

function extractPricing(engine: EngineCaps): EnginePricingDetails | null {
  if (engine.pricingDetails) {
    return engine.pricingDetails;
  }
  if (!engine.pricing) return null;
  const pricingDetails: EnginePricingDetails = {
    currency: engine.pricing.currency ?? 'USD',
    perSecondCents: engine.pricing.byResolution
      ? {
          default:
            engine.pricing.base != null ? Math.round(engine.pricing.base * 100) : undefined,
          byResolution: Object.fromEntries(
            Object.entries(engine.pricing.byResolution).map(([key, dollars]) => [key, Math.round(dollars * 100)])
          ),
        }
      : engine.pricing.base != null
        ? { default: Math.round(engine.pricing.base * 100) }
        : undefined,
    maxDurationSec: engine.maxDurationSec,
  };
  return pricingDetails;
}

export async function fetchEngineSettings(): Promise<Map<string, EngineSettingsRecord>> {
  if (!process.env.DATABASE_URL) return new Map();
  const rows = await query<EngineSettingsRecord>(
    `SELECT engine_id, options, pricing, updated_at, updated_by FROM engine_settings`
  );
  return new Map(rows.map((row) => [row.engine_id, row]));
}

export async function listEnginePricingOverrides(): Promise<Record<string, EnginePricingDetails>> {
  if (!process.env.DATABASE_URL) return {};
  const settings = await fetchEngineSettings();
  const overrides: Record<string, EnginePricingDetails> = {};
  settings.forEach((record, engineId) => {
    if (record.pricing) {
      overrides[engineId] = record.pricing;
    }
  });
  return overrides;
}

export async function ensureEngineSettingsSeed(updatedBy?: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const rows = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM engine_settings`);
  const total = Number(rows[0]?.count ?? '0');
  if (Number.isFinite(total) && total > 0) {
    return;
  }

  const baseEngines = getBaseEngines();
  const now = new Date().toISOString();

  const inserts = baseEngines.map((engine) => ({
    engine_id: engine.id,
    options: normalizeOptions(engine),
    pricing: extractPricing(engine),
    updated_at: now,
    updated_by: updatedBy ?? null,
  }));

  const values: unknown[] = [];
  const placeholders = inserts
    .map((entry, index) => {
      const offset = index * 4;
      values.push(entry.engine_id, JSON.stringify(entry.options ?? null), JSON.stringify(entry.pricing ?? null), updatedBy ?? null);
      return `($${offset + 1}, $${offset + 2}::jsonb, $${offset + 3}::jsonb, NOW(), $${offset + 4}::uuid)`;
    })
    .join(', ');

  if (!placeholders) return;

  await query(
    `INSERT INTO engine_settings (engine_id, options, pricing, updated_at, updated_by)
     VALUES ${placeholders}
     ON CONFLICT (engine_id) DO NOTHING`,
    values
  );
}

export async function upsertEngineSettings(
  engineId: string,
  options: Record<string, unknown> | null,
  pricing: EnginePricingDetails | null,
  updatedBy?: string
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database not configured');
  }
  await query(
    `INSERT INTO engine_settings (engine_id, options, pricing, updated_at, updated_by)
     VALUES ($1, $2::jsonb, $3::jsonb, NOW(), $4::uuid)
     ON CONFLICT (engine_id)
     DO UPDATE SET
       options = EXCLUDED.options,
       pricing = EXCLUDED.pricing,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [engineId, options ? JSON.stringify(options) : null, pricing ? JSON.stringify(pricing) : null, updatedBy ?? null]
  );
}

export async function removeEngineSettings(engineId: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database not configured');
  }
  await query(`DELETE FROM engine_settings WHERE engine_id = $1`, [engineId]);
}
