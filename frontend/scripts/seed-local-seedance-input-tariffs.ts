import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { localTariffReleaseConnection } from './_lib/local-tariff-release-input';

async function main() {
  const source = await readFile(resolve('frontend/.env.local'),'utf8');
  const env = parse(source);
  const databaseUrl = localTariffReleaseConnection(env);
  const status = spawnSync('git',['status','--porcelain'],{ encoding: 'utf8' });
  if (status.status !== 0 || status.stdout.trim()) throw new Error('Commit reviewed code before preparing Seedance tariffs.');
  if (env.LOCAL_ADMIN_BYPASS !== '1' || !env.LOCAL_ADMIN_BYPASS_USER_ID) throw new Error('Configured local admin actor required.');
  Object.assign(process.env,env,{ DATABASE_URL: databaseUrl,NODE_ENV: 'development',PRICING_SANDBOX: '1' });
  const { getDb,withDbTransaction } = await import('@/lib/db');
  const { collectSellableManualTariffCoverage } = await import('@/lib/pricing-audit/manual-tariff-coverage');
  const { loadEffectiveCustomerTariffState } = await import('@/server/pricing/customer-tariff-store');
  const { prepareSeedanceInputTariffSeed } = await import('@/server/pricing/seedance-input-tariff-seed');
  const { applyLocalSeedanceInputTariffs } = await import('@/server/pricing/apply-local-seedance-input-tariffs');
  try {
    const result = await withDbTransaction(async executor => {
      const confirmation = process.env.SEEDANCE_INPUT_SEED_CONFIRM?.trim();
      if (confirmation) {
        if (await readFile(resolve('frontend/.env.local'),'utf8') !== source) throw new Error('Local environment changed.');
        return applyLocalSeedanceInputTariffs(executor,{ actorId: env.LOCAL_ADMIN_BYPASS_USER_ID,fingerprint: confirmation });
      }
      await executor.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const prepared = await prepareSeedanceInputTariffSeed({ scenarios: collectSellableManualTariffCoverage().scenarios,
        state: await loadEffectiveCustomerTariffState(executor),at: new Date().toISOString() });
      return { fingerprint: prepared.fingerprint,sourceRevision: prepared.sourceRevision,cells: prepared.cells.length,
        correctedMinimumCount: prepared.correctedMinimumCount,examples: prepared.rows.filter(row =>
          row.scenarioId.includes('resolution=480p|durationSec=4|') && row.scenarioId.includes('aspectRatio=16%3A9|')).slice(0,8) };
    });
    console.log(JSON.stringify({ ...result,environment: 'isolated_local_sandbox',productionActivated: false }));
  } finally { await getDb().end(); }
}
void main().catch(error => {
  console.error('Local Seedance input tariff preparation failed:',error instanceof Error ? error.message : 'unknown error');
  process.exitCode=1;
});
