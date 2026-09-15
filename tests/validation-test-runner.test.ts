import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

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
