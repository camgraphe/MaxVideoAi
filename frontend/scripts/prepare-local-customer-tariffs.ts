import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { localTariffReleaseConnection, refreshLocalReferenceFloorApproval } from './_lib/local-tariff-release-input';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function main() {
  const output = process.env.PRICING_RELEASE_OUTPUT?.trim();
  if (!output) throw new Error('Set PRICING_RELEASE_OUTPUT to a new ignored directory');
  const environmentSource = await readFile(resolve('frontend/.env.local'), 'utf8');
  const env = parse(environmentSource);
  const databaseUrl = localTariffReleaseConnection(env);
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('Cannot bind pricing evidence to the Git revision');
    return result.stdout.trim();
  };
  if (git(['status', '--porcelain'])) throw new Error('Commit reviewed pricing changes before preparing release evidence');
  const codeRevision = git(['rev-parse', 'HEAD']);
  // Next reads these six factual configuration keys from .env.local. Import the
  // quote owners only after matching that local configuration, ignoring ambient overrides.
  for (const key of ['LUMARAY2_BASE_5S_540P_USD', 'LUMARAY2_FLASH_BASE_5S_540P_USD',
    'LUMARAY2_MODIFY_PER_SECOND_USD', 'LUMARAY2_FLASH_MODIFY_PER_SECOND_USD',
    'LUMARAY2_REFRAME_PER_SECOND_USD', 'LUMARAY2_FLASH_REFRAME_PER_SECOND_USD']) {
    if (env[key]?.trim()) process.env[key] = env[key]; else delete process.env[key];
  }
  const { Pool } = await import('pg');
  const { loadPricingPolicyOverridesWithExecutor } = await import('@/lib/pricing-rule-store');
  const { collectSellableManualTariffCoverage, collectEffectiveCustomerTariffBaseline } = await import('@/lib/pricing-audit/manual-tariff-coverage');
  const { computeCanonicalBillingSnapshot } = await import('@/server/pricing/quote-billing');
  const { prepareLocalCustomerTariffRelease, localTariffSourceStateHash, localCustomerTariffBaseline } = await import('@/server/pricing/customer-tariff-release-evidence');
  const registryHash = hash(await readFile(resolve('frontend/config/model-registry.json'), 'utf8'));
  const coverage = collectSellableManualTariffCoverage();
  const address = new URL(databaseUrl);
  const databaseIdentity = hash(`${address.hostname}|${address.pathname}|${address.username}`);
  const pool = new Pool({ connectionString: databaseUrl });
  let client: Awaited<ReturnType<typeof pool.connect>> | null = null;
  try {
    client = await pool.connect();
    const connection = client;
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const status = (await client.query<{ address: string | null; readOnly: string; at: Date }>(
      `SELECT inet_server_addr() AS address, current_setting('transaction_read_only') AS "readOnly", transaction_timestamp() AS at`)).rows[0];
    if (!status || status.address !== null || status.readOnly !== 'on') throw new Error('Expected a read-only Unix socket transaction');
    const state = (await client.query<{ revision: string; active: boolean }>('SELECT revision, active FROM app_customer_tariff_state WHERE singleton = TRUE')).rows[0];
    if (!state || state.active) throw new Error('Preparation requires the existing inactive local tariff state');
    const staged = (await client.query(`SELECT id, selector_json, price_json, currency, effective_from, effective_until, revision
      FROM app_customer_tariff_cells ORDER BY id`)).rows;
    const executor = { async query<T>(sql: string, params?: ReadonlyArray<unknown>) { return (await connection.query<T>(sql, params)).rows; } };
    const policy = await loadPricingPolicyOverridesWithExecutor(executor);
    if (policy.status !== 'loaded') throw new Error('Effective local pricing policy unavailable');
    const baseline = await collectEffectiveCustomerTariffBaseline({ at: status.at.toISOString(), registryHash, databaseIdentity,
      scenarios: coverage.scenarios, quote: scenario => computeCanonicalBillingSnapshot(scenario.context,
        { pricingPolicy: { loadOverrides: async () => policy }, loadCustomerTariffState: async () => ({ status: 'loaded',
          active: false, revision: Number(state.revision), databaseCells: [], versionedCells: [] }) }) });
    const captured = localCustomerTariffBaseline(baseline,
      hash(JSON.stringify([...policy.rules].sort((a, b) => a.id.localeCompare(b.id)))), coverage.gaps);
    const approvedPath = process.env.PRICING_RELEASE_APPROVED_FLOORS?.trim();
    const approvedSource = approvedPath ? await readFile(resolve(approvedPath), 'utf8') : null;
    const approval = approvedSource ? refreshLocalReferenceFloorApproval(JSON.parse(approvedSource).approval, captured) : undefined;
    const sourceTariffStateHash = localTariffSourceStateHash(state, staged, databaseUrl);
    const release = await prepareLocalCustomerTariffRelease({ baseline: captured, scenarios: coverage.scenarios,
      registryHash, coverageGaps: coverage.gaps, policy, sourceTariffRevision: Number(state.revision), sourceTariffStateHash,
      codeRevision, factualEnvironmentHash: hash(JSON.stringify(Object.entries(env).filter(([key]) => key.startsWith('LUMARAY2_')).sort())),
      ...(approval ? { approvedGptImage25ReferenceFloor: approval } : {}) });
    if (git(['status', '--porcelain']) || git(['rev-parse', 'HEAD']) !== codeRevision
      || await readFile(resolve('frontend/.env.local'), 'utf8') !== environmentSource) {
      throw new Error('Pricing code or environment changed during the local capture');
    }
    const directory = resolve(output);
    await mkdir(directory, { mode: 0o700 }); // Exclusive; never overwrite preceding evidence.
    for (const [name, value] of Object.entries({ 'baseline.json': captured, 'customer-tariffs.json': release.seed,
      'report.json': release.report, 'manifest.json': { codeRevision, approvedSourceHash: approvedSource ? hash(approvedSource) : null,
        factualEnvironmentHash: release.report.bindings.factualEnvironmentHash } })) {
      await writeFile(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    }
    console.log(JSON.stringify({ output: directory, checkedScenarios: release.report.checkedScenarios,
      quotedScenarios: release.report.quotedScenarios, unchangedScenarios: release.report.unchangedScenarios,
      approvedPriceChanges: release.report.approvedPriceChanges.length, candidateCells: release.report.candidateCellCount,
      remainingCoverageGaps: release.report.remainingCoverageGaps, activationReady: false }));
  } finally {
    if (client) {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
    await pool.end();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch(() => {
    // Never print connection URLs or driver errors containing local credentials.
    console.error('Local tariff release preparation failed; no tariff was written or activated.');
    process.exitCode = 1;
  });
}
