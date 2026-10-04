import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { localTariffReleaseConnection } from './_lib/local-tariff-release-input';

async function main() {
  const source = await readFile(resolve('frontend/.env.local'), 'utf8');
  const env = parse(source);
  const databaseUrl = localTariffReleaseConnection(env);
  const status = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (status.status !== 0 || status.stdout.trim()) throw new Error('Commit reviewed code before preparing workflow tariffs.');
  if (env.LOCAL_ADMIN_BYPASS !== '1' || !env.LOCAL_ADMIN_BYPASS_USER_ID) throw new Error('Configured local admin actor required.');
  Object.assign(process.env, { DATABASE_URL: databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const { withDbTransaction, getDb } = await import('@/lib/db');
  const { collectSellableManualTariffCoverage } = await import('@/lib/pricing-audit/manual-tariff-coverage');
  const { loadEffectiveCustomerTariffState } = await import('@/server/pricing/customer-tariff-store');
  const { loadPricingPolicyOverridesWithExecutor } = await import('@/lib/pricing-rule-store');
  const { prepareSeedanceWorkflowTariffSeed } = await import('@/server/pricing/seedance-workflow-tariffs');
  const { applyLocalSeedanceWorkflowTariffs } = await import('@/server/pricing/apply-local-seedance-workflow-tariffs');
  try {
    const result = await withDbTransaction(async executor => {
      const confirmation = process.env.SEEDANCE_WORKFLOW_SEED_CONFIRM?.trim();
      if (confirmation) {
        if (await readFile(resolve('frontend/.env.local'), 'utf8') !== source) throw new Error('Local environment changed.');
        return applyLocalSeedanceWorkflowTariffs(executor, { actorId: env.LOCAL_ADMIN_BYPASS_USER_ID, fingerprint: confirmation });
      }
      await executor.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const prepared = await prepareSeedanceWorkflowTariffSeed({ normalScenarios: collectSellableManualTariffCoverage().scenarios,
        state: await loadEffectiveCustomerTariffState(executor), policy: await loadPricingPolicyOverridesWithExecutor(executor) });
      return { fingerprint: prepared.fingerprint, sourceRevision: prepared.sourceRevision, cells: prepared.cells.length,
        examples: prepared.cells.filter(cell => cell.selector.durationSec === '5' && cell.selector.aspectRatio === '16:9')
          .map(cell => ({ step: cell.selector.workflowStep, resolution: cell.selector.resolution, price: cell.price })) };
    });
    console.log(JSON.stringify({ ...result, environment: 'isolated_local_sandbox', productionActivated: false }));
  } finally { await getDb().end(); }
}
void main().catch(() => { console.error('Local workflow tariff preparation failed; no production target was authorized.'); process.exitCode = 1; });
