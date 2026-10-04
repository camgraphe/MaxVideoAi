import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';

/** The sandbox never inherits commercial credentials, including future env-file keys. */
export function buildPricingSandboxEnvironment(input: {
  parent: NodeJS.ProcessEnv;
  fileVariables: Record<string, string>;
  databaseUrl: string;
  port: number;
}): NodeJS.ProcessEnv {
  const address = new URL(input.databaseUrl);
  const sockets = address.searchParams.getAll('host');
  if (!['postgres:', 'postgresql:'].includes(address.protocol) ||
      !['localhost', '127.0.0.1'].includes(address.hostname) ||
      sockets.length !== 1 || !sockets[0]?.startsWith('/') ||
      [...address.searchParams.keys()].some((key) => key !== 'host')) {
    throw new Error('Pricing sandbox requires an unambiguous local socket database');
  }
  if (!Number.isInteger(input.port) || input.port < 1024 || input.port > 65535) throw new Error('Invalid sandbox port');
  const environment: NodeJS.ProcessEnv = { NODE_ENV: 'development' };
  for (const key of new Set([...Object.keys(input.parent), ...Object.keys(input.fileVariables)])) environment[key] = '';
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TERM']) {
    if (input.parent[key]) environment[key] = input.parent[key];
  }
  return {
    ...environment,
    NODE_ENV: 'development',
    DATABASE_URL: input.databaseUrl,
    NEXT_PUBLIC_API_BASE: `http://localhost:${input.port}`,
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-pricing-sandbox',
    NEXT_PUBLIC_ENABLE_CLARITY: 'false',
    NEXT_PUBLIC_RESULT_PROVIDER: 'mock',
    RESULT_PROVIDER: 'mock',
    PAYMENT_MODE: 'wallet',
    LOCAL_ADMIN_BYPASS: '1',
    LOCAL_ADMIN_BYPASS_USER_ID: '11111111-1111-4111-8111-111111111111',
    PRICING_SANDBOX: '1',
    // Price the intended direct route without enabling submissions or retaining credentials.
    SEEDANCE_2_PROVIDER: 'byteplus_modelark',
    SEEDANCE_FAST_PROVIDER: 'byteplus_modelark',
    SEEDANCE_2_5_PROVIDER: 'byteplus_modelark',
    SEEDANCE_1_5_BYTEPLUS_ENABLED: 'false',
    SEEDANCE_2_5_BYTEPLUS_ENABLED: 'false',
    ALIBABA_MODEL_STUDIO_ENABLED: 'true',
    ALIBABA_MODEL_STUDIO_PUBLIC_ROUTING_ENABLED: 'true',
    ALIBABA_MODEL_STUDIO_ADMIN_ONLY: 'false',
    ALIBABA_MODEL_STUDIO_FALLBACK_TO_FAL_ENABLED: 'false',
  };
}

/** Operational setup only; read routes never create the workflow tables. */
export async function migratePricingSandbox(pool: Pool, root: string): Promise<void> {
  const connection = (await pool.query<{ server_address: string | null; client_address: string | null }>(
    'SELECT inet_server_addr()::text AS server_address, inet_client_addr()::text AS client_address',
  )).rows[0];
  if (!connection || connection.server_address !== null || connection.client_address !== null) {
    throw new Error('Pricing sandbox migrations require an actual local Unix-socket connection.');
  }
  for (const migration of [
    '12_app_settings.sql', '27_pricing_admin_cockpit.sql', '42_toolbox_finishing_pricing.sql',
    '53_seedance_draft_links.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql',
    '56_direct_payment_quotes.sql', '57_customer_tariff_local_activation_events.sql',
    '58_customer_tariff_bulk_interval_lock.sql', '59_seedance_draft_final_state.sql',
  ]) {
    await pool.query(await readFile(join(root, 'neon/migrations', migration), 'utf8'));
  }
}
