import { query } from '@/lib/db';
import { getBaseEngines } from '@/lib/engines';
import type { EnginePricingDetails } from '@/types/engines';
import {
  fetchEngineSettingsReadOnly,
  fetchEngineSettingsReadOnlyWithExecutor,
} from '@/server/engine-configuration-read';
import { buildEngineSettingsSeedPayload, type EngineSettingsSeedPayload } from '@/server/engine-settings-defaults';

export type { EngineSettingsRecord } from '@/server/engine-configuration-read';
export const fetchEngineSettings = fetchEngineSettingsReadOnly;
export const fetchEngineSettingsWithExecutor = fetchEngineSettingsReadOnlyWithExecutor;

let ensureSeedPromise: Promise<void> | null = null;

function isProductionBuildPhase() {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

export async function listEnginePricingOverrides(): Promise<Record<string, EnginePricingDetails>> {
  if (isProductionBuildPhase()) return {};
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
      .map((engine) => buildEngineSettingsSeedPayload(engine, existing.get(engine.id), updatedBy))
      .filter((entry): entry is EngineSettingsSeedPayload => entry != null);

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
