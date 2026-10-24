import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, dirname, basename, relative, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'dotenv';
import { pricingCutoverTarget } from '@/server/pricing/cutover-target';
import { LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS } from '@/server/pricing/cutover-factual-environment';
import { assertVideoOperationReleaseReview, assertModifyReleaseGit, assertModifyReleasePullRequest,
  modifyReleasePullRequestArguments, type VideoOperationReleaseReview } from './_lib/video-operation-release-input';

/** Explicit maintenance entry point. No route, build or deployment invokes this writer. */
async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => args[args.indexOf(name) + 1];
  const mode = args[0], envFile = option('--environment'), actorId = option('--actor'), candidateCommit = option('--candidate');
  const reviewFile = option('--review'), pr = args.includes('--pr') ? option('--pr') : undefined;
  const releaseBranch = option('--release-branch');
  const approval = args.includes('--approve-fingerprint') ? option('--approve-fingerprint') : undefined;
  if (!['preview', 'apply'].includes(mode) || !args.includes('--environment') || !args.includes('--actor')
    || !args.includes('--candidate') || !args.includes('--review') || !args.includes('--release-branch')
    || !releaseBranch?.startsWith('codex/') || !/^[0-9a-f]{40}$/.test(candidateCommit ?? '')
    || !/^[0-9a-f-]{36}$/.test(actorId ?? '') || (mode === 'apply' && (!pr || !/^[0-9a-f]{64}$/.test(approval ?? '')))) {
    throw new Error('Explicit release inputs are required.');
  }
  const git = (arguments_: string[]) => execFileSync('git', arguments_, { encoding: 'utf8' }).trim();
  const assertRelease = () => {
    const identity = { candidateCommit, releaseBranch };
    assertModifyReleaseGit(identity, git);
    if (mode === 'apply') {
      const pullRequest = JSON.parse(execFileSync('gh', modifyReleasePullRequestArguments(pr!), { encoding: 'utf8' }));
      assertModifyReleasePullRequest(pullRequest, identity);
    }
  };
  assertRelease();
  const root = await realpath(git(['rev-parse','--show-toplevel']));
  for (const path of [await realpath(resolve(envFile)), mode === 'apply' ? await realpath(resolve(reviewFile))
    : resolve(await realpath(dirname(resolve(reviewFile))), basename(reviewFile))]) {
    const location = relative(root,path);
    if (!location || (!location.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(location))) {
      throw new Error('Environment and reviewed receipt must remain outside the release checkout.');
    }
  }
  const source = await readFile(resolve(envFile), 'utf8'), env = parse(source);
  const target = pricingCutoverTarget(env);
  if (target.config.host.startsWith('/')) throw new Error('This operation requires the explicitly selected production target.');
  for (const key of Object.keys(process.env)) if (key.startsWith('PG')) delete process.env[key];
  for (const key of LOCAL_TARIFF_FACTUAL_ENVIRONMENT_KEYS) { if (env[key]?.trim()) process.env[key] = env[key]; else delete process.env[key]; }
  Object.assign(process.env, { DATABASE_URL: env.DATABASE_URL_UNPOOLED?.trim() || env.DATABASE_URL, NODE_ENV: 'production', PRICING_SANDBOX: '0' });
  const { withPricingCutoverTransaction, lockPricingCutoverAdministrator } = await import('@/server/pricing/customer-tariff-cutover');
  const { loadEffectiveCustomerTariffState } = await import('@/server/pricing/customer-tariff-store');
  const { loadPricingPolicyOverridesWithExecutor } = await import('@/lib/pricing-rule-store');
  const { prepareVideoOperationTariffs, applyVideoOperationTariffs, VIDEO_OPERATION_TARIFF_POLICY } = await import('@/server/pricing/video-operation-tariffs');
  const identity = { actorId, candidateCommit, releaseBranch, databaseIdentity: target.databaseIdentity };
  const reviewSource = mode === 'apply' ? await readFile(resolve(reviewFile), 'utf8') : undefined;
  const reviewed: unknown = reviewSource ? JSON.parse(reviewSource) : undefined;
  if (mode === 'apply') {
    assertVideoOperationReleaseReview(reviewed, identity);
    if (reviewed.fingerprint !== approval) throw new Error('The approved fingerprint must match the reviewed tariff candidate.');
  }
  const result = await withPricingCutoverTransaction(env, 'production', async executor => {
    if (mode === 'preview') {
      await executor.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const admins = await executor.query<{ user_id: string }>("SELECT user_id FROM user_roles WHERE role='admin'");
      const authorized = admins.length ? admins.some(row => row.user_id === actorId) : (await executor.query('SELECT user_id FROM app_admins WHERE user_id=$1::uuid', [actorId])).length === 1;
      if (!authorized) throw new Error('Release actor must be an existing administrator.');
    } else await lockPricingCutoverAdministrator(executor, actorId);
    const prepared = await prepareVideoOperationTariffs({ state: await loadEffectiveCustomerTariffState(executor),
      policy: await loadPricingPolicyOverridesWithExecutor(executor), actorId, candidateCommit });
    const proposal = { ...identity, policy: prepared.policy, fingerprint: prepared.fingerprint,
      sourceRevision: prepared.sourceRevision, insertedCells: prepared.cells.length, scope: prepared.scope,
      approved: false, activationReady: false, basis: prepared.basis, sourceStateHash: prepared.sourceStateHash, existingPricesChanged: false,
      cells: prepared.cells.map(({ id, selector, currency, price }) => ({ id, selector, currency, price })) };
    if (mode === 'apply') assertVideoOperationReleaseReview(reviewed, identity, proposal);
    const receipt = mode === 'preview' ? proposal : await applyVideoOperationTariffs(executor, { actorId, candidateCommit, authorizedActorId: actorId,
        authorizedCandidateCommit: candidateCommit, policy: VIDEO_OPERATION_TARIFF_POLICY,
        fingerprint: (reviewed as VideoOperationReleaseReview).fingerprint, sourceRevision: (reviewed as VideoOperationReleaseReview).sourceRevision });
    assertRelease();
    if (await readFile(resolve(envFile), 'utf8') !== source || (reviewSource && await readFile(resolve(reviewFile), 'utf8') !== reviewSource)) throw new Error('Release inputs changed before commit.');
    return receipt;
  });
  if (mode === 'preview') await writeFile(resolve(reviewFile), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ operation: mode, ...result }));
}
void main().catch(() => {
  console.error('Video operation tariff initialization did not report completion. Inspect its pricing event before retrying; credentials are omitted.');
  process.exitCode = 1;
});
