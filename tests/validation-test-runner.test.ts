import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { readdirSync } from 'node:fs';

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
  assert.deepEqual(plan.tariffs, [
    'tests/customer-tariff-initial-cutover-postgres.test.ts',
    'tests/local-customer-tariff-activation-postgres.test.ts',
  ]);
  assert.ok(plan.integration.includes('tests/mcp-confirm-generation-concurrency.test.ts'));
  assert.ok(plan.integration.includes('tests/generation-initial-job-transaction.test.ts'));
  assert.ok(plan.integration.includes('tests/public-video-renditions-real-media.test.ts'));
  assert.ok(plan.integration.includes('tests/admin-customer-tariff-service-postgres.test.ts'));
  assert.equal(plan.fast.includes('tests/customer-tariff-initial-cutover-postgres.test.ts'), false);
  for (const file of [
    'tests/connected-studio-montage-browser-integration.test.ts',
    'tests/editorial-reader-media.test.ts',
    'tests/sora-prompting-tabs-behavior.test.ts',
    'tests/studio-connected-browser-fixture.test.ts',
  ]) {
    assert.ok(plan.browser.includes(file), file);
    assert.equal(plan.fast.includes(file), false);
  }
  const files = [...plan.fast, ...plan.integration, ...plan.tariffs, ...plan.studio, ...plan.browser];
  const expected = readdirSync('tests').filter(file => file.endsWith('.test.ts')).map(file => `tests/${file}`).sort();
  assert.deepEqual(files.sort(), expected);
  assert.equal(new Set(files).size, files.length);
});

test('a misspelled suite refuses to run instead of silently omitting validations', () => {
  const result = spawnSync(process.execPath, ['scripts/run-validation-tests.mjs', '--suite', 'tarif', '--plan'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown validation suite/);
});
