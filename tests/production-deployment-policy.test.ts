import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { checkProductionGit, PRODUCTION_PROJECT_ID, STAGING_PROJECT_ID } from '../scripts/check-production-git.mjs';
import { checkAncestry, deploymentRevision, assertPreviewModelAdmissionParity, previewDeploymentRevision, readPreviewAdmissionCatalogues } from '../scripts/check-production-alignment.mjs';

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

test('alignment recognizes the current Vercel redeploy source while retaining original deployment and Git identity checks', () => {
  const redeployment = { ...deployment, source: 'redeploy', meta: {
    ...deployment.meta, originalDeploymentId: 'dpl_original',
  } };
  assert.equal(deploymentRevision(redeployment), sha);
  for (const originalDeploymentId of ['', 'unknown', 'dpl_', 'dpl_invalid/id']) {
    assert.throws(() => deploymentRevision({ ...redeployment, meta: { ...redeployment.meta, originalDeploymentId } }), /no verified/);
  }
  for (const patch of [{ projectId: STAGING_PROJECT_ID }, { readyState: 'ERROR' }, { target: 'preview' }, { meta: {} }]) {
    assert.throws(() => deploymentRevision({ ...redeployment, ...patch }), /no verified/);
  }
  assert.throws(() => deploymentRevision({ ...redeployment, meta: { ...redeployment.meta, githubCommitRef: 'feature' } }), /no verified/);
  assert.throws(() => deploymentRevision({ ...redeployment, source: 'cli' }), /no verified/, 'Raw CLI uploads still require the identified redeploy action');
});

test('alignment blocks missing production commits and branches based on stale main', () => {
  const ancestor = (a: string, b: string) => a === b || (a === 'prod' && b === 'main') || (a === 'main' && b === 'candidate');
  assert.doesNotThrow(() => checkAncestry('prod', 'main', 'candidate', ancestor));
  assert.doesNotThrow(() => checkAncestry('main', 'main', 'main', ancestor));
  assert.throws(() => checkAncestry('unpublished', 'main', 'candidate', ancestor), /missing from GitHub main/);
  assert.throws(() => checkAncestry('prod', 'main', 'stale', ancestor), /does not include current GitHub main/);
});

const admissionCatalog = (available = true) => ({ ok: true, engines: [{ id: 'seedance-2-5',
  modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'], modeAvailability: Object.fromEntries(
    ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'].map(mode => [mode, { available, reason: available ? 'available' : 'provider_disabled' }])) }] });

test('preview parity checks the real Seedance admissions in both directions, including closed modes', () => {
  const production = admissionCatalog(), preview = admissionCatalog();
  assert.equal(assertPreviewModelAdmissionParity(production, preview).modes.length, 5);
  production.engines[0].modeAvailability.v2v.available = false;
  assert.throws(() => assertPreviewModelAdmissionParity(production, preview), /admission differs.*v2v/);
  preview.engines[0].modeAvailability.v2v.available = false;
  assert.doesNotThrow(() => assertPreviewModelAdmissionParity(production, preview));
  assert.throws(() => assertPreviewModelAdmissionParity(admissionCatalog(), admissionCatalog(false)), /admission differs.*t2v/);
});

test('preview parity refuses degraded, missing or incomplete readiness instead of inferring availability', () => {
  for (const invalid of [{ ...admissionCatalog(), degraded: true }, { ok: false, engines: [] },
    { ok: true, engines: [] }, { ok: true, engines: [{ id: 'seedance-2-5', modes: ['t2v'] }] }]) {
    assert.throws(() => assertPreviewModelAdmissionParity(admissionCatalog(), invalid), /catalogue|readiness|modes/);
    assert.throws(() => assertPreviewModelAdmissionParity(invalid, admissionCatalog()), /catalogue|readiness|modes/);
  }
  const preview = admissionCatalog(); preview.engines[0].modes.pop();
  assert.throws(() => assertPreviewModelAdmissionParity(admissionCatalog(), preview), /modes differ/);
});

test('preview readiness belongs to the exact READY Git candidate and project, never an older or production deployment', () => {
  const preview = { ...deployment, target: null, meta: { ...deployment.meta, githubCommitRef: 'codex/model-picker' } };
  assert.equal(previewDeploymentRevision(preview, sha), sha);
  for (const patch of [{ projectId: STAGING_PROJECT_ID }, { readyState: 'BUILDING' },
    { target: 'production' }, { source: 'cli' }, { meta: {} },
    { meta: { ...preview.meta, githubCommitSha: 'b'.repeat(40) } }]) {
    assert.throws(() => previewDeploymentRevision({ ...preview, ...patch }, sha), /exact READY Git Preview/);
  }
});

test('preview parity uses an existing OIDC token only for the verified Preview origin and refuses redirects', async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const catalogs = await readPreviewAdmissionCatalogues('https://exact.vercel.app', 'short-lived-oidc', async (url: string, options: RequestInit) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(admissionCatalog()), { status: 200 });
  });
  assert.doesNotThrow(() => assertPreviewModelAdmissionParity(catalogs.production, catalogs.preview));
  assert.equal(calls[0].url, 'https://maxvideoai.com/api/engines');
  assert.equal(calls[1].url, 'https://exact.vercel.app/api/engines');
  assert.equal(new Headers(calls[0].options.headers).get('x-vercel-trusted-oidc-idp-token'), null);
  assert.equal(new Headers(calls[1].options.headers).get('x-vercel-trusted-oidc-idp-token'), 'short-lived-oidc');
  assert.ok(calls.every(call => call.options.redirect === 'error' && call.options.cache === 'no-store'));
});

test('preview parity fails before HTTP without existing access or with an unsafe target', async () => {
  let calls = 0;
  const request = async () => { calls++; return new Response('{}'); };
  await assert.rejects(readPreviewAdmissionCatalogues('https://exact.vercel.app', '', request), /existing OIDC token/);
  const expired = `header.${Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url')}.signature`;
  await assert.rejects(readPreviewAdmissionCatalogues('https://exact.vercel.app', expired, request), /expired.*refresh/);
  for (const url of ['http://exact.vercel.app', 'https://foreign.example', 'https://secret@exact.vercel.app', 'https://exact.vercel.app/private']) {
    await assert.rejects(readPreviewAdmissionCatalogues(url, 'short-lived-oidc', request), /Preview must be/);
  }
  assert.equal(calls, 0);
});

test('failed Preview access never creates a bypass or exposes credential-bearing errors', async () => {
  const request = async (url: string) => new Response(JSON.stringify(admissionCatalog()), { status: url.includes('vercel.app') ? 403 : 200 });
  await assert.rejects(readPreviewAdmissionCatalogues('https://exact.vercel.app', 'short-lived-oidc', request), /Preview catalogue HTTP 403/);
  const sensitiveFailure = async () => { throw new Error('internal short-lived-oidc'); };
  await assert.rejects(readPreviewAdmissionCatalogues('https://exact.vercel.app', 'short-lived-oidc', sensitiveFailure), error => {
    assert.ok(error instanceof Error); assert.doesNotMatch(error.message, /short-lived-oidc/);
    assert.match(error.message, /read-only access/); return true;
  });
});
