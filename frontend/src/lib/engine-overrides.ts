import { query } from '@/lib/db';

export type EngineOverride = {
  engine_id: string;
  active: boolean;
  availability: string | null;
  status: string | null;
  latency_tier: string | null;
};

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
