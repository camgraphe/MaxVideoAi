import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { QueryExecutor } from '@/lib/db';

export const PRICING_CUTOVER_READ_ONLY_OPTIONS = '-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=2000';

/** Names are intentional: main also contains an unrelated migration 53. */
export const PRICING_CUTOVER_MIGRATIONS = [
  '53_seedance_draft_links.sql', '54_customer_tariff_cells.sql',
  '55_customer_tariff_versions.sql', '56_direct_payment_quotes.sql',
  '57_customer_tariff_local_activation_events.sql', '58_customer_tariff_bulk_interval_lock.sql',
  '59_seedance_draft_final_state.sql', '60_mcp_trial_provider_rasters.sql',
] as const;

export async function loadPricingCutoverMigrations(root: string) {
  return Promise.all(PRICING_CUTOVER_MIGRATIONS.map(async name => {
    const path = `neon/migrations/${name}`;
    return { path, sha256: createHash('sha256').update(await readFile(resolve(root, path))).digest('hex'),
      transactionRequired: true as const };
  }));
}

/** No ambient URL fallback, arbitrary host overrides, or PgBouncer target. */
export function pricingCutoverConnection(env: Record<string, string | undefined>): string {
  try {
    const connection = env.DATABASE_URL_UNPOOLED?.trim() || env.DATABASE_URL?.trim();
    if (!connection) throw new Error();
    const url = new URL(connection);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.username || !url.pathname.slice(1)) throw new Error();
    const hosts = url.searchParams.getAll('host');
    const local = ['localhost', '127.0.0.1'].includes(url.hostname) && hosts.length === 1 && hosts[0].startsWith('/');
    const neon = url.hostname.endsWith('.neon.tech') && !url.hostname.split('.').some(part => part.endsWith('-pooler'))
      && hosts.length === 0 && url.searchParams.get('sslmode') === 'require';
    if (!local && !neon) throw new Error();
    const allowed = local ? ['host'] : ['sslmode', 'channel_binding'];
    if ([...url.searchParams.keys()].some(key => !allowed.includes(key))) throw new Error();
    return connection;
  } catch { throw new Error('Use an explicit environment file with a direct Neon or local Unix socket connection.'); }
}

const prerequisiteTables = ['app_jobs', 'app_pricing_rules', 'app_pricing_change_events',
  'mcp_generation_quotes', 'mcp_trial_quote_prepared_audit', 'mcp_trial_entitlements',
  'mcp_trial_support_override_audit', 'mcp_trial_risk_events'] as const;
const newTables = ['seedance_draft_links', 'app_customer_tariff_state', 'app_customer_tariff_cells',
  'app_customer_tariff_cell_versions', 'app_direct_payment_quotes', 'app_customer_tariff_local_activation_events'] as const;
const functions = ['reject_overlapping_customer_tariff_cells', 'preserve_customer_tariff_version',
  'reject_direct_payment_quote_mutation', 'preserve_customer_tariff_local_activation_event',
  'mcp_trial_provider_cost_matches_snapshot', 'mcp_trial_snapshot_has_forbidden_funding_semantics'];

/** Catalog evidence only. Never runs DDL, reads customer rows, or certifies activation. */
export async function collectPricingCutoverSchema(executor: QueryExecutor) {
  const [state] = await executor.query<{ readOnly: string; isolation: string; at: Date; remote: boolean }>(
    `SELECT current_setting('transaction_read_only') AS "readOnly",
      current_setting('transaction_isolation') AS isolation, transaction_timestamp() AS at,
      inet_server_addr() IS NOT NULL AS remote`);
  if (!state || state.readOnly !== 'on' || state.isolation !== 'repeatable read') {
    throw new Error('Schema inventory requires a repeatable-read, read-only transaction.');
  }
  const names = [...prerequisiteTables, ...newTables, 'generation_poll_state'];
  const tables = await executor.query<{ name: string; present: boolean }>(
    `SELECT name, to_regclass('public.' || name) IS NOT NULL AS present
      FROM unnest($1::text[]) AS name ORDER BY name`, [names]);
  const columns = await executor.query(`SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position`, [names]);
  const constraints = await executor.query(`SELECT rel.relname AS table_name, con.conname,
    pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace WHERE ns.nspname = 'public'
    AND rel.relname = ANY($1::text[]) ORDER BY rel.relname, con.conname`, [names]);
  const triggers = await executor.query(`SELECT rel.relname AS table_name, trg.tgname,
    pg_get_triggerdef(trg.oid) AS definition FROM pg_trigger trg JOIN pg_class rel ON rel.oid = trg.tgrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace WHERE ns.nspname = 'public'
    AND NOT trg.tgisinternal AND rel.relname = ANY($1::text[]) ORDER BY rel.relname, trg.tgname`, [names]);
  const definitions = await executor.query<{ name: string; definition: string }>(`SELECT p.proname AS name,
    pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.proname = ANY($1::text[]) ORDER BY p.proname, p.oid`, [functions]);
  const present = new Set(tables.filter(row => row.present).map(row => row.name));
  const missingPrerequisites = prerequisiteTables.filter(name => !present.has(name));
  const missingTrialFunctions = functions.slice(-2).filter(name => !definitions.some(row => row.name === name));
  const schema = { tables, columns, constraints, triggers, functions: definitions };
  return { schemaVersion: 1, evidenceKind: 'pricing_schema_inventory', readOnly: true,
    at: state.at.toISOString(), remote: state.remote, activationReady: false,
    schemaReviewRequired: true, missingPrerequisites, missingTrialFunctions,
    missingCutoverTables: newTables.filter(name => !present.has(name)),
    ...schema, schemaHash: createHash('sha256').update(JSON.stringify(schema)).digest('hex') };
}
