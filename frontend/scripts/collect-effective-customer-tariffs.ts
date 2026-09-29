import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'dotenv';
import { Pool } from 'pg';

import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import {
  collectEffectiveCustomerTariffBaseline,
  collectSellableManualTariffCoverage,
} from '@/lib/pricing-audit/manual-tariff-coverage';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function main(): Promise<void> {
  const output = process.env.PRICING_BASELINE_OUTPUT?.trim();
  if (!output) throw new Error('Set PRICING_BASELINE_OUTPUT to a new, ignored report path');
  const envPath = process.env.PRICING_BASELINE_ENV_FILE?.trim() ?? resolve('frontend/.env.local');
  const env = parse(await readFile(envPath));
  const databaseUrl = process.env.DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const address = new URL(databaseUrl);
  const databaseIdentity = digest(`${address.hostname}|${address.pathname}|${address.username}`);
  const registryHash = digest(await readFile(new URL('../config/model-registry.json', import.meta.url), 'utf8'));
  const coverage = collectSellableManualTariffCoverage();
  const pool = new Pool({ connectionString: databaseUrl });
  let client: Awaited<ReturnType<Pool['connect']>> | null = null;
  try {
    client = await pool.connect();
    const connection = client;
    await connection.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const status = await connection.query<{ read_only: string; captured_at: Date }>(
      "SELECT current_setting('transaction_read_only') AS read_only, transaction_timestamp() AS captured_at"
    );
    if (status.rows[0]?.read_only !== 'on') throw new Error('Baseline transaction must be read-only');
    const loaded = await loadPricingPolicyOverridesWithExecutor({
      async query<TRecord>(sql: string, params?: ReadonlyArray<unknown>) {
        return (await connection.query<TRecord>(sql, params)).rows;
      },
    });
    if (loaded.status !== 'loaded') throw new Error('Effective database pricing rules are unavailable');
    const baseline = await collectEffectiveCustomerTariffBaseline({
      at: status.rows[0]!.captured_at.toISOString(), registryHash, databaseIdentity,
      scenarios: coverage.scenarios,
      quote: ({ context }) => computeCanonicalBillingSnapshot(context, {
        pricingPolicy: { loadOverrides: async () => loaded },
      }),
    });
    const report = {
      ...baseline,
      source: 'configured_database_repeatable_read_only',
      databaseRuleCount: loaded.rules.length,
      databaseRulesHash: digest(JSON.stringify([...loaded.rules].sort((left, right) => left.id.localeCompare(right.id)))),
      coverageGaps: coverage.gaps,
      expectedScenarioCount: coverage.scenarios.length,
    };
    await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    console.log(`[customer-tariff-baseline] read-only ${baseline.rows.length}/${coverage.scenarios.length} quotes; ${baseline.gaps.length} quote gaps; ${coverage.gaps.length} capability gaps`);
  } finally {
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error('[customer-tariff-baseline] failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
