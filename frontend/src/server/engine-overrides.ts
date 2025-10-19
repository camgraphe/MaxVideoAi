import { query } from '@/lib/db';
import { getBaseEngines } from '@/lib/engines';
import type { EngineCaps, EngineAvailability, EngineStatus, LatencyTier } from '@/types/engines';

export type EngineOverride = {
  engine_id: string;
  active: boolean;
  availability: string | null;
  status: string | null;
  latency_tier: string | null;
};

function normalizeStatus(value: string | null | undefined, fallback: EngineStatus): EngineStatus {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return ['live', 'busy', 'degraded', 'maintenance', 'early_access'].includes(normalized)
    ? (normalized as EngineStatus)
    : fallback;
}

function normalizeAvailability(value: string | null | undefined, fallback: EngineAvailability): EngineAvailability {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return ['available', 'limited', 'waitlist', 'paused'].includes(normalized)
    ? (normalized as EngineAvailability)
    : fallback;
}

function normalizeLatency(value: string | null | undefined, fallback: LatencyTier): LatencyTier {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return ['fast', 'standard'].includes(normalized) ? (normalized as LatencyTier) : fallback;
}

export async function fetchEngineOverrides(): Promise<Map<string, EngineOverride>> {
  if (!process.env.DATABASE_URL) return new Map();
  const rows = await query<EngineOverride>(
    `SELECT engine_id, active, availability, status, latency_tier FROM engine_overrides`
  );
  return new Map(rows.map((row) => [row.engine_id, row]));
}

export async function upsertEngineOverride(
  engineId: string,
  override: Partial<Omit<EngineOverride, 'engine_id'>>,
  updatedBy?: string
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database not configured');
  }
  await query(
    `INSERT INTO engine_overrides (engine_id, active, availability, status, latency_tier, updated_at, updated_by)
     VALUES ($1, COALESCE($2, TRUE), $3, $4, $5, NOW(), $6::uuid)
     ON CONFLICT (engine_id)
     DO UPDATE SET
       active = COALESCE($2, engine_overrides.active),
       availability = COALESCE($3, engine_overrides.availability),
       status = COALESCE($4, engine_overrides.status),
       latency_tier = COALESCE($5, engine_overrides.latency_tier),
       updated_at = NOW(),
       updated_by = $6::uuid`,
    [
      engineId,
      override.active,
      override.availability ?? null,
      override.status ?? null,
      override.latency_tier ?? null,
      updatedBy ?? null,
    ]
  );
}

export async function getAdminEngineEntries(): Promise<
  Array<{ engine: EngineCaps; disabled: boolean; override: EngineOverride | null }>
> {
  const engines = process.env.DATABASE_URL ? await (await import('@/server/engines')).getConfiguredEngines(true) : getBaseEngines();
  if (!process.env.DATABASE_URL) {
    return engines.map((engine) => ({ engine, disabled: false, override: null }));
  }

  const overridesMap = await fetchEngineOverrides();
  return engines.map((engine) => {
    const override = overridesMap.get(engine.id) ?? null;
    const disabled = override?.active === false || false;
    if (override) {
      engine.availability = normalizeAvailability(override.availability, engine.availability);
      engine.status = normalizeStatus(override.status, engine.status);
      engine.latencyTier = normalizeLatency(override.latency_tier, engine.latencyTier);
    }
    return { engine, disabled, override };
  });
}

export async function getPublicEngines(): Promise<EngineCaps[]> {
  const entries = await getAdminEngineEntries();
  return entries.filter((entry) => !entry.disabled).map((entry) => entry.engine);
}
