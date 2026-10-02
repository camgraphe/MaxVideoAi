import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { QueryExecutor } from '@/lib/db';
import { ENV } from '@/lib/env';
import { LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS } from './cutover-factual-environment';
import { cutoverDigest } from './customer-tariff-cutover-evidence';

/** No bootstrap, provider call, or customer/receipt read. Timestamp-only settings
 * updates do not change price inputs; policy timestamps retain selection order. */
export async function customerTariffCommercialHash(executor: QueryExecutor) {
  const policy = await executor.query(`SELECT id,engine_id,resolution,mode,margin_percent,margin_flat_cents,
    surcharge_audio_percent,surcharge_upscale_percent,currency,compatibility_profile,vendor_account_id,
    effective_from,updated_at,updated_by FROM app_pricing_rules ORDER BY id`);
  const settings = await executor.query(`SELECT engine_id,options,pricing,updated_by FROM engine_settings ORDER BY engine_id`);
  const overrides = await executor.query(`SELECT engine_id,active,availability,status,latency_tier FROM engine_overrides ORDER BY engine_id`);
  const products = await executor.query(`SELECT product_key,surface,label,currency,unit_kind,unit_price_cents,active,metadata
    FROM app_billing_products ORDER BY surface,product_key`);
  // Serialize SQL dates explicitly; canonical object hashing must not erase Date.
  return cutoverDigest(JSON.parse(JSON.stringify({ policy,settings,overrides,products })));
}

export async function captureCustomerTariffCutoverBindings(executor: QueryExecutor, databaseIdentity: string) {
  const root = process.cwd();
  const codeRevision = execFileSync('git',['rev-parse','HEAD'],{ cwd: root,encoding: 'utf8' }).trim();
  const factual = Object.fromEntries(LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS.map(name => [name,
    name in ENV ? ENV[name as keyof typeof ENV] ?? null : process.env[name]?.trim() || null]));
  return { databaseIdentity,commercialHash: await customerTariffCommercialHash(executor),codeRevision,
    registryHash: cutoverDigest(readFileSync(resolve(root,'frontend/config/model-registry.json'),'utf8')),
    factualEnvironmentHash: cutoverDigest(factual) };
}

export async function customerTariffCurrentGridHash(executor: QueryExecutor) {
  const cells = await executor.query(`SELECT id,selector_json,price_json,currency,effective_from,effective_until,revision,updated_by
    FROM app_customer_tariff_cells ORDER BY id`);
  const versions = await executor.query(`SELECT tariff_id,selector_json,price_json,currency,effective_from,effective_until,revision,updated_by
    FROM app_customer_tariff_cell_versions ORDER BY tariff_id,revision`);
  return cutoverDigest(JSON.parse(JSON.stringify({ cells,versions })));
}
