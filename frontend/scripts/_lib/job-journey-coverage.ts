import { readFileSync } from 'node:fs';
import type { QueryExecutor } from '../../src/lib/db';

const coverageSql = readFileSync(new URL('../../../docs/analytics/job-journey-origin-coverage-v1.sql', import.meta.url), 'utf8');

const requiredColumns: Record<string, readonly string[]> = {
  app_jobs: ['job_id', 'user_id', 'surface', 'payment_status', 'status', 'settings_snapshot', 'created_at', 'updated_at',
    'entry_surface', 'entry_source', 'journey_version', 'entry_release_sha'],
  mcp_generation_quotes: ['job_id', 'user_id', 'auth_origin', 'funding_mode', 'state', 'created_at'],
  app_admins: ['user_id'],
  user_roles: ['user_id', 'role'],
  user_account_restrictions: ['user_id', 'active'],
  wallet_fraud_cleanup_audit: ['user_id'],
};

export type JobJourneyCoverageRow = {
  [column: string]: string | number | null;
  scope: 'all_non_admin' | 'without_documented_flags';
  media_surface: string | null;
  payment_status: string | null;
  resolved_surface: string;
  evidence_source: string;
  journey_version: number | null;
  known_reservation_release: string | null;
  jobs: string;
  accounts: string;
  observed_paid_completed_jobs: string;
  missing_job_context: string;
  explicit_unknown_job_context: string;
  missing_reservation_release: string;
  updated_after_cutoff: string;
};

/** Operational collection only. Caller supplies a read-only executor and private exclusions in memory. */
export async function collectJobJourneyCoverage(params: {
  executor: QueryExecutor;
  start: Date;
  end: Date;
  adminUserIds: readonly string[];
}): Promise<
  | { status: 'unavailable'; projectionVersion: 1; missing: string[] }
  | { status: 'available'; projectionVersion: 1; rows: JobJourneyCoverageRow[] }
> {
  if (!Number.isFinite(params.start.getTime()) || !Number.isFinite(params.end.getTime())
    || params.start.getTime() >= params.end.getTime()) throw new Error('Invalid coverage window: require finite start < end.');
  const required = Object.entries(requiredColumns).flatMap(([table, columns]) => columns.map(column => [table, column]));
  const missing = await params.executor.query<{ missing: string }>(`
    WITH required AS (
      SELECT table_name, column_name FROM jsonb_to_recordset($1::jsonb) AS r(table_name text,column_name text)
    ) SELECT table_name || '.' || column_name AS missing FROM required r
    WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a
      WHERE a.attrelid=to_regclass(r.table_name) AND a.attname=r.column_name AND a.attnum>0 AND NOT a.attisdropped)
    ORDER BY table_name,column_name`,
  [JSON.stringify(required.map(([table_name, column_name]) => ({ table_name, column_name })))]);
  if (missing.length) return { status: 'unavailable', projectionVersion: 1, missing: missing.map(row => row.missing) };
  const rows = await params.executor.query<JobJourneyCoverageRow>(coverageSql,
    [params.start.toISOString(), params.end.toISOString(), [...params.adminUserIds]]);
  return { status: 'available', projectionVersion: 1, rows };
}
