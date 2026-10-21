import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { selectValidationLanes } from '../scripts/_lib/ci-validation-policy.mjs';

test('validation runner isolates Next-backed Studio integrations from the standard test process', () => {
  const result = spawnSync(process.execPath, ['scripts/run-validation-tests.mjs', '--plan'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const plan = JSON.parse(result.stdout) as { standard: string[]; studioIntegration: string[] };
  assert.deepEqual(plan.studioIntegration, [
    'tests/connected-studio-mcp-route-integration.test.ts',
    'tests/connected-studio-montage-browser-integration.test.ts',
    'tests/connected-studio-montage-http-integration.test.ts',
    'tests/connected-studio-route-integration.test.ts',
  ]);
  assert.ok(plan.standard.includes('tests/mcp-oauth-principal.test.ts'));
  assert.ok(plan.standard.includes('tests/validation-test-runner.test.ts'));
  assert.ok(plan.standard.every((file) => !plan.studioIntegration.includes(file)));
});

test('CI suites partition every validation file without losing expensive financial or real media coverage', () => {
  const result = spawnSync(process.execPath, ['scripts/run-validation-tests.mjs', '--plan'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.ok(plan.fast?.includes('tests/mcp-oauth-principal.test.ts'), 'fast suite must exist');
  for (const file of [
    'tests/pricing-canonical-kernel.test.ts',
    'tests/pricing-definition.test.ts',
    'tests/pricing-policy.test.ts',
    'tests/pricing-billing-authority.test.ts',
    'tests/wallet-direct-pricing.test.ts',
  ]) {
    assert.ok(plan.fast.includes(file), `${file} must run even when exhaustive cutovers are not selected`);
  }
  assert.deepEqual(plan.tariffs, [
    'tests/customer-tariff-initial-cutover-postgres.test.ts',
    'tests/local-customer-tariff-activation-postgres.test.ts',
  ]);
  for (const file of plan.tariffs) {
    assert.equal(selectValidationLanes([file]).tariffs, true, `${file} must select its exhaustive suite when changed`);
  }
  assert.ok(plan.integration.includes('tests/mcp-confirm-generation-concurrency.test.ts'));
  assert.ok(plan.integration.includes('tests/generation-initial-job-transaction.test.ts'));
  assert.ok(plan.integration.includes('tests/public-video-renditions-real-media.test.ts'));
  assert.ok(plan.integration.includes('tests/admin-customer-tariff-service-postgres.test.ts'));
  assert.ok(plan.integration.includes('tests/preflight-media-pricing.test.ts'), 'LAS preflight uses a real PostgreSQL fixture');
  assert.equal(plan.fast.includes('tests/preflight-media-pricing.test.ts'), false);
  assert.ok(plan.fast.includes('tests/seedance-2-pricing.test.ts'), 'Pure literal tariff fixtures require no PostgreSQL');
  assert.equal(plan.fast.includes('tests/customer-tariff-initial-cutover-postgres.test.ts'), false);
  for (const file of [
    'tests/connected-studio-montage-browser-integration.test.ts',
    'tests/connected-studio-conversation-render-integration.test.ts',
    'tests/editorial-reader-media.test.ts',
    'tests/sora-prompting-tabs-behavior.test.ts',
    'tests/studio-connected-browser-fixture.test.ts',
  ]) {
    assert.ok(plan.browser.includes(file), file);
    assert.equal(plan.fast.includes(file), false);
    assert.equal(plan.integration.includes(file), false);
  }
  const files = [...plan.fast, ...plan.integration, ...plan.tariffs, ...plan.studio, ...plan.browser];
  const expected = readdirSync('tests').filter(file => file.endsWith('.test.ts')).map(file => `tests/${file}`).sort();
  assert.deepEqual(files.sort(), expected);
  assert.equal(new Set(files).size, files.length);
});

test('the real composition test fails promptly when its installed browser is missing', () => {
  const browserDirectory = mkdtempSync(join(tmpdir(), 'studio-missing-browser-'));
  try {
    // Run node:test directly in one child so a failure cannot hide behind a
    // worker that remains alive with a Remotion HTTP server.
    const result = spawnSync(process.execPath, [
      '--import', 'tsx', 'tests/connected-studio-conversation-render-integration.test.ts',
    ], {
      encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', detached: process.platform !== 'win32',
      env: { ...process.env, TSX_TSCONFIG_PATH: resolve('frontend/tsconfig.json'), PLAYWRIGHT_BROWSERS_PATH: browserDirectory },
    });
    if (result.error && result.pid > 0 && process.platform !== 'win32') {
      try { process.kill(-result.pid, 'SIGKILL'); } catch { /* The owned process group already exited. */ }
    }
    assert.equal(result.error, undefined, 'Missing browser must fail without leaving a render server alive.');
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /installed Playwright Chromium/i);
  } finally {
    rmSync(browserDirectory, { recursive: true, force: true });
  }
});

test('a misspelled suite refuses to run instead of silently omitting validations', () => {
  const result = spawnSync(process.execPath, ['scripts/run-validation-tests.mjs', '--suite', 'tarif', '--plan'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown validation suite/);
});
