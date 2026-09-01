import { query, type QueryExecutor } from '@/lib/db';
import type { EnginePricingDetails } from '@/types/engines';

export type EngineSettingsRecord = {
  engine_id: string;
  options: Record<string, unknown> | null;
  pricing: EnginePricingDetails | null;
  updated_at: string;
  updated_by: string | null;
};

export type EngineOverride = {
  engine_id: string;
  active: boolean;
  availability: string | null;
  status: string | null;
  latency_tier: string | null;
};

function isProductionBuildPhase() {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

export async function fetchEngineSettingsReadOnly(): Promise<Map<string, EngineSettingsRecord>> {
  if (isProductionBuildPhase() || !process.env.DATABASE_URL) return new Map();
  const rows = await query<EngineSettingsRecord>(
    'SELECT engine_id, options, pricing, updated_at, updated_by FROM engine_settings',
  );
  return new Map(rows.map((row) => [row.engine_id, row]));
}

export async function fetchEngineSettingsReadOnlyWithExecutor(
  executor: QueryExecutor,
): Promise<Map<string, EngineSettingsRecord>> {
  const rows = await executor.query<EngineSettingsRecord>(
    'SELECT engine_id, options, pricing, updated_at, updated_by FROM engine_settings',
  );
  return new Map(rows.map((row) => [row.engine_id, row]));
}

export async function fetchEngineOverridesReadOnly(): Promise<Map<string, EngineOverride>> {
  if (!process.env.DATABASE_URL) return new Map();
  const rows = await query<EngineOverride>(
    'SELECT engine_id, active, availability, status, latency_tier FROM engine_overrides',
  );
  return new Map(rows.map((row) => [row.engine_id, row]));
}

export async function fetchEngineOverridesReadOnlyWithExecutor(
  executor: QueryExecutor,
): Promise<Map<string, EngineOverride>> {
  const rows = await executor.query<EngineOverride>(
    'SELECT engine_id, active, availability, status, latency_tier FROM engine_overrides',
  );
  return new Map(rows.map((row) => [row.engine_id, row]));
}
