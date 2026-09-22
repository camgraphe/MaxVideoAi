import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { checkProductionGit, PRODUCTION_PROJECT_ID, STAGING_PROJECT_ID } from '../scripts/check-production-git.mjs';
import { checkAncestry, deploymentRevision } from '../scripts/check-production-alignment.mjs';

const sha = 'a'.repeat(40);
const productionEnv = {
  VERCEL_ENV: 'production', VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID,
  VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_REPO_OWNER: 'camgraphe',
  VERCEL_GIT_REPO_SLUG: 'MaxVideoAi', VERCEL_GIT_COMMIT_REF: 'main', VERCEL_GIT_COMMIT_SHA: sha,
};
const deployment = {
  source: 'git', projectId: PRODUCTION_PROJECT_ID, readyState: 'READY', target: 'production',
  meta: { githubCommitOrg: 'camgraphe', githubCommitRepo: 'MaxVideoAi', githubCommitRef: 'main', githubCommitSha: sha },
};

test('production build accepts the configured GitHub main and rejects each absent or foreign identity field', () => {
  assert.match(checkProductionGit(productionEnv), /provenance OK/);
  for (const key of Object.keys(productionEnv).filter((key) => key !== 'VERCEL_ENV')) {
    assert.throws(() => checkProductionGit({ ...productionEnv, [key]: '' }), /Production build refused/);
    assert.throws(() => checkProductionGit({ ...productionEnv, [key]: 'foreign' }), /Production build refused/);
  }
  assert.throws(() => checkProductionGit({ VERCEL_ENV: 'production' }), /Production build refused/);
});

test('local, preview and dedicated MCP staging retain their separate build paths', () => {
  assert.doesNotThrow(() => checkProductionGit({}));
  assert.doesNotThrow(() => checkProductionGit({ VERCEL_ENV: 'preview' }));
  assert.match(checkProductionGit({ VERCEL_ENV: 'production', VERCEL_PROJECT_ID: STAGING_PROJECT_ID }), /staging release policy/);
});

test('an uploaded production copy fails the executable prebuild gate with a nonzero exit', () => {
  const result = spawnSync(process.execPath, ['scripts/check-production-git.mjs'], {
    encoding: 'utf8', env: { VERCEL_ENV: 'production', VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /do not upload a local copy/);
  const { scripts } = JSON.parse(readFileSync('frontend/package.json', 'utf8'));
  assert.match(scripts.prebuild, /&& node \.\.\/scripts\/check-production-git\.mjs &&/);
});

test('alignment accepts Git builds and identified Git redeploys, rejects raw CLI uploads even with a claimed SHA', () => {
  assert.equal(deploymentRevision(deployment), sha);
  assert.equal(deploymentRevision({ ...deployment, source: 'cli', meta: {
    ...deployment.meta, action: 'redeploy', originalDeploymentId: 'dpl_original',
  } }), sha);
  assert.throws(() => deploymentRevision({ ...deployment, source: 'cli' }), /no verified/);
  for (const patch of [{ projectId: STAGING_PROJECT_ID }, { readyState: 'ERROR' }, { target: 'preview' }, { meta: {} }]) {
    assert.throws(() => deploymentRevision({ ...deployment, ...patch }), /no verified/);
  }
  assert.throws(() => deploymentRevision({ ...deployment, meta: { ...deployment.meta, githubCommitRef: 'feature' } }), /no verified/);
});

test('alignment blocks missing production commits and branches based on stale main', () => {
  const ancestor = (a: string, b: string) => a === b || (a === 'prod' && b === 'main') || (a === 'main' && b === 'candidate');
  assert.doesNotThrow(() => checkAncestry('prod', 'main', 'candidate', ancestor));
  assert.doesNotThrow(() => checkAncestry('main', 'main', 'main', ancestor));
  assert.throws(() => checkAncestry('unpublished', 'main', 'candidate', ancestor), /missing from GitHub main/);
  assert.throws(() => checkAncestry('prod', 'main', 'stale', ancestor), /does not include current GitHub main/);
});
