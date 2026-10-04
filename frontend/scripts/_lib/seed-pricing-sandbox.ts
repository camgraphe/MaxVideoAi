import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { collectSellableManualTariffCoverage, type EffectiveCustomerTariffBaseline } from '@/lib/pricing-audit/manual-tariff-coverage';
import { buildCustomerTariffSeed } from '@/server/pricing/customer-tariff-seed';

export async function seedPricingSandbox(pool: Pool, baselinePath: string): Promise<number> {
  const baseline = JSON.parse(await readFile(baselinePath, 'utf8')) as EffectiveCustomerTariffBaseline;
  const coverage = collectSellableManualTariffCoverage();
  const registryHash = createHash('sha256').update(await readFile('frontend/config/model-registry.json')).digest('hex');
  const seed = buildCustomerTariffSeed({ baseline, scenarios: coverage.scenarios, registryHash, coverageGaps: coverage.gaps });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const identity = await client.query<{ address: string | null }>('SELECT inet_server_addr() AS address');
    if (identity.rows[0]?.address !== null) throw new Error('Sandbox seeding requires a local Unix socket');
    const state = await client.query<{ revision: number | string; active: boolean }>('SELECT revision, active FROM app_customer_tariff_state FOR UPDATE');
    if (state.rows[0]?.active || Number(state.rows[0]?.revision) !== 0) throw new Error('Sandbox seed requires a fresh inactive tariff store');
    for (let start = 0; start < seed.cells.length; start += 1000) {
      const rows = seed.cells.slice(start, start + 1000).map((cell) => ({
        id: cell.id, selector_key: JSON.stringify(Object.entries(cell.selector).sort(([a], [b]) => a.localeCompare(b))),
        selector_json: cell.selector, price_json: cell.price, currency: cell.currency, effective_from: cell.effectiveFrom,
      }));
      await client.query(`INSERT INTO app_customer_tariff_cells
        (id, selector_key, selector_json, price_json, currency, effective_from, revision, updated_by)
        SELECT id, selector_key, selector_json, price_json, currency, effective_from, 1,
          '11111111-1111-4111-8111-111111111111'::uuid FROM jsonb_to_recordset($1::jsonb)
          AS cell(id TEXT, selector_key TEXT, selector_json JSONB, price_json JSONB, currency TEXT, effective_from TIMESTAMPTZ)`,
      [JSON.stringify(rows)]);
    }
    await client.query('UPDATE app_customer_tariff_state SET revision = 1, active = FALSE');
    await client.query(`INSERT INTO app_pricing_change_events
      (domain, operation, target_id, actor_id, previous_state, next_state, preview_summary, affected_scenario_ids)
      VALUES ('customer_tariff', 'create', 'local-baseline-seed',
        '11111111-1111-4111-8111-111111111111', NULL, $1::jsonb, $1::jsonb, '[]'::jsonb)`,
    [JSON.stringify({ registryHash, baselineAt: baseline.at, cells: seed.cells.length,
      coverageGapCount: seed.coverageGapCount, active: false, environment: 'isolated_local_sandbox' })]);
    await client.query('COMMIT');
    return seed.cells.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
