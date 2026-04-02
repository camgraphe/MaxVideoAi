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

type EngineSettingsUpsert = {
  engine_id: string;
  options: Record<string, unknown>;
  pricing: EnginePricingDetails | null;
  updated_by: string | null;
};

let ensureSeedPromise: Promise<void> | null = null;

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

function shouldRefreshEngineOptions(engine: EngineCaps, current?: EngineSettingsRecord | null): boolean {
  return !current || current.updated_by == null;
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
  if (ensureSeedPromise) return ensureSeedPromise;

  ensureSeedPromise = (async () => {
    const existing = await fetchEngineSettings();
    const baseEngines = getBaseEngines();
    const upserts = baseEngines
      .map((engine) => {
        const current = existing.get(engine.id);
        if (!shouldRefreshEngineOptions(engine, current)) {
          return null;
        }
        const upsert: EngineSettingsUpsert = {
          engine_id: engine.id,
          options: normalizeOptions(engine),
          pricing: extractPricing(engine) ?? current?.pricing ?? null,
          updated_by: current?.updated_by ?? updatedBy ?? null,
        };
        return upsert;
      })
      .filter((entry): entry is EngineSettingsUpsert => entry != null);

    if (!upserts.length) return;

    const values: unknown[] = [];
    const placeholders = upserts
      .map((entry, index) => {
        const offset = index * 4;
        values.push(
          entry.engine_id,
          JSON.stringify(entry.options),
          JSON.stringify(entry.pricing ?? null),
          entry.updated_by
        );
        return `($${offset + 1}, $${offset + 2}::jsonb, $${offset + 3}::jsonb, NOW(), $${offset + 4}::uuid)`;
      })
      .join(', ');

    await query(
      `INSERT INTO engine_settings (engine_id, options, pricing, updated_at, updated_by)
       VALUES ${placeholders}
       ON CONFLICT (engine_id)
       DO UPDATE SET
         options = EXCLUDED.options,
         pricing = EXCLUDED.pricing,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       WHERE engine_settings.updated_by IS NULL`,
      values
    );
  })();

  return ensureSeedPromise;
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
