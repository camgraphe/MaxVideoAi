import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'dotenv';
import { pricingCutoverTarget } from '@/server/pricing/cutover-target';
import { LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS } from '@/server/pricing/cutover-factual-environment';
import { assertFlux3MaxReleaseReview, type Flux3MaxReleaseReview } from './_lib/flux-3-max-release-input';

/** Explicit maintenance entry point. No route, build or deployment invokes this writer. */
async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => args[args.indexOf(name) + 1];
  const mode = args[0], envFile = option('--environment'), actorId = option('--actor'), candidateCommit = option('--candidate');
  const reviewFile = option('--review'), pr = args.includes('--pr') ? option('--pr') : undefined;
  const approval = args.includes('--approve-fingerprint') ? option('--approve-fingerprint') : undefined;
  if (!['preview', 'apply'].includes(mode) || !args.includes('--environment') || !args.includes('--actor')
    || !args.includes('--candidate') || !args.includes('--review') || !/^[0-9a-f]{40}$/.test(candidateCommit ?? '')
    || !/^[0-9a-f-]{36}$/.test(actorId ?? '') || (mode === 'apply' && (!pr || !/^[0-9a-f]{64}$/.test(approval ?? '')))) {
    throw new Error('Explicit release inputs are required.');
  }
  const git = (arguments_: string[]) => execFileSync('git', arguments_, { encoding: 'utf8' }).trim();
  const assertGit = () => {
    if (git(['status', '--porcelain']) || git(['rev-parse', 'HEAD']) !== candidateCommit) throw new Error('A clean exact committed candidate is required.');
    if (!['https://github.com/camgraphe/MaxVideoAi', 'https://github.com/camgraphe/MaxVideoAi.git', 'git@github.com:camgraphe/MaxVideoAi.git'].includes(git(['remote', 'get-url', 'origin']))) throw new Error('Unexpected release repository.');
    git(['merge-base', '--is-ancestor', 'origin/main', candidateCommit]);
    const branch = git(['branch', '--show-current']);
    if (!branch.startsWith('codex/') || git(['ls-remote', 'origin', `refs/heads/${branch}`]).split(/\s/)[0] !== candidateCommit) throw new Error('The exact candidate must be published on its release branch.');
  };
  assertGit();
  if (mode === 'apply') {
    const checks = JSON.parse(execFileSync('gh', ['pr', 'view', pr!, '--json', 'headRefOid,statusCheckRollup'], { encoding: 'utf8' }));
    if (checks.headRefOid !== candidateCommit || !checks.statusCheckRollup.some((check: { name?: string; conclusion?: string }) => check.name === 'Quality CI' && check.conclusion === 'SUCCESS')) throw new Error('Quality CI must pass on the exact reviewed candidate.');
  }
  const source = await readFile(resolve(envFile), 'utf8'), env = parse(source);
  const target = pricingCutoverTarget(env);
  if (target.config.host.startsWith('/')) throw new Error('This operation requires the explicitly selected production target.');
  for (const key of Object.keys(process.env)) if (key.startsWith('PG')) delete process.env[key];
  for (const key of LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS) { if (env[key]?.trim()) process.env[key] = env[key]; else delete process.env[key]; }
  Object.assign(process.env, { DATABASE_URL: env.DATABASE_URL_UNPOOLED?.trim() || env.DATABASE_URL, NODE_ENV: 'production', PRICING_SANDBOX: '0' });
  const { withPricingCutoverTransaction, lockPricingCutoverAdministrator } = await import('@/server/pricing/customer-tariff-cutover');
  const { loadEffectiveCustomerTariffState } = await import('@/server/pricing/customer-tariff-store');
  const { prepareFlux3MaxTariffs, applyFlux3MaxTariffs, FLUX_3_MAX_TARIFF_POLICY } = await import('@/server/pricing/flux-3-max-tariffs');
  const identity = { actorId, candidateCommit, databaseIdentity: target.databaseIdentity };
  const reviewSource = mode === 'apply' ? await readFile(resolve(reviewFile), 'utf8') : undefined;
  const reviewed: unknown = reviewSource ? JSON.parse(reviewSource) : undefined;
  if (mode === 'apply') {
    assertFlux3MaxReleaseReview(reviewed, identity);
    if (reviewed.fingerprint !== approval) throw new Error('The approved fingerprint must match the reviewed tariff candidate.');
  }
  const result = await withPricingCutoverTransaction(env, 'production', async executor => {
    if (mode === 'preview') {
      await executor.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const admins = await executor.query<{ user_id: string }>("SELECT user_id FROM user_roles WHERE role='admin'");
      const authorized = admins.length ? admins.some(row => row.user_id === actorId) : (await executor.query('SELECT user_id FROM app_admins WHERE user_id=$1::uuid', [actorId])).length === 1;
      if (!authorized) throw new Error('Release actor must be an existing administrator.');
    } else await lockPricingCutoverAdministrator(executor, actorId);
    const prepared = await prepareFlux3MaxTariffs({ state: await loadEffectiveCustomerTariffState(executor), actorId, candidateCommit });
    const receipt = mode === 'preview' ? { ...identity, policy: prepared.policy, fingerprint: prepared.fingerprint,
      sourceRevision: prepared.sourceRevision, insertedCells: prepared.cells.length, scope: prepared.scope,
      basis: prepared.basis, existingPricesChanged: false,
      cells: prepared.cells.map(({ selector, currency, price }) => ({ selector, currency, price })) }
      : await applyFlux3MaxTariffs(executor, { actorId, candidateCommit, authorizedActorId: actorId,
        authorizedCandidateCommit: candidateCommit, policy: FLUX_3_MAX_TARIFF_POLICY,
        fingerprint: (reviewed as Flux3MaxReleaseReview).fingerprint, sourceRevision: (reviewed as Flux3MaxReleaseReview).sourceRevision });
    assertGit();
    if (await readFile(resolve(envFile), 'utf8') !== source || (reviewSource && await readFile(resolve(reviewFile), 'utf8') !== reviewSource)) throw new Error('Release inputs changed before commit.');
    return receipt;
  });
  if (mode === 'preview') await writeFile(resolve(reviewFile), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ operation: mode, ...result }));
}
void main().catch(() => {
  console.error('FLUX 3 Max tariff initialization did not report completion. Inspect its immutable pricing event before retrying; credentials are omitted.');
  process.exitCode = 1;
});
