import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { selectValidationLanes } from '../scripts/_lib/ci-validation-policy.mjs';

type ValidationPlan = {
  standard: string[];
  studioIntegration: string[];
  fast: string[];
  integration: string[];
  tariffs: string[];
  studio: string[];
  browser: string[];
  browserShards: Record<'1/2' | '2/2', string[]>;
  selection: { suite: string; shard: string | null; files: string[] };
};

function validationPlan(args: string[] = []): ValidationPlan {
  const result = spawnSync(process.execPath, ['scripts/run-validation-tests.mjs', ...args, '--plan'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function withRunnerFixture(browserFiles: string[], check: (fixture: {
  run: (args: string[]) => ReturnType<typeof spawnSync>;
  calls: () => unknown[];
}) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'validation-runner-'));
  const callsPath = join(root, 'calls.jsonl');
  try {
    mkdirSync(join(root, 'scripts', '_lib'), { recursive: true });
    mkdirSync(join(root, 'tests'));
    mkdirSync(join(root, 'bin'));
    copyFileSync('scripts/run-validation-tests.mjs', join(root, 'scripts', 'run-validation-tests.mjs'));
    // Replace only the external tool boundary. The runner and its CLI execute unchanged.
    writeFileSync(join(root, 'scripts', '_lib', 'test-postgres-toolchain.mjs'), `
import { appendFileSync } from 'node:fs';
export function resolveTestPostgres() {
  appendFileSync(process.env.VALIDATION_FIXTURE_CALLS, JSON.stringify('tool bootstrap') + '\\n');
  return { env: process.env };
}
export function reportTestPostgres() {}
`);
    writeFileSync(join(root, 'bin', 'pnpm'), `#!${process.execPath}
require('node:fs').appendFileSync(process.env.VALIDATION_FIXTURE_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');
`, { mode: 0o755 });
    for (const file of [
      'connected-studio-mcp-route-integration.test.ts',
      'connected-studio-montage-browser-integration.test.ts',
      'connected-studio-montage-http-integration.test.ts',
      'connected-studio-route-integration.test.ts',
      'customer-tariff-initial-cutover-postgres.test.ts',
      'local-customer-tariff-activation-postgres.test.ts',
    ]) writeFileSync(join(root, 'tests', file), '');
    for (const file of browserFiles) {
      // Only generated fixtures contain the browser signature; this contract stays tools-free.
      writeFileSync(join(root, 'tests', file), `chromium.${'launch'}();`);
    }
    check({
      run: args => spawnSync(process.execPath, ['scripts/run-validation-tests.mjs', ...args], {
        cwd: root, encoding: 'utf8', timeout: 5_000,
        env: { ...process.env, PATH: join(root, 'bin'), VALIDATION_FIXTURE_CALLS: callsPath },
      }),
      calls: () => existsSync(callsPath)
        ? readFileSync(callsPath, 'utf8').trim().split('\n').map(line => JSON.parse(line))
        : [],
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

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
  assert.ok(plan.integration.includes('tests/external-fal-import-evidence.test.ts'), 'Media evidence probes real video bytes with an external media tool');
  assert.equal(plan.fast.includes('tests/external-fal-import-evidence.test.ts'), false);
  assert.ok(plan.fast.includes('tests/ci-ubuntu-mirror.test.ts'), 'Transport fixtures use no real validation tools');
  assert.equal(plan.integration.includes('tests/ci-ubuntu-mirror.test.ts'), false);
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
    'tests/composer-prompt-clear-browser.test.ts',
    'tests/workspace-modify-mobile-browser.test.ts',
    'tests/workspace-operation-refresh-browser.test.ts',
    'tests/reference-picker-portrait-browser.test.ts',
    'tests/post-kling-app-integration-browser.test.ts',
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

test('Browser partitions are deterministic, disjoint and cover the complete original manifest', () => {
  const plan = validationPlan();
  const first = plan.browserShards['1/2'];
  const second = plan.browserShards['2/2'];
  assert.ok(first.length > 0 && second.length > 0);
  assert.ok(Math.abs(first.length - second.length) <= 1);
  assert.equal(new Set([...first, ...second]).size, plan.browser.length);
  assert.deepEqual([...first, ...second].sort(), [...plan.browser].sort());
  assert.deepEqual(validationPlan().browserShards, plan.browserShards);
  assert.deepEqual(plan.selection, { suite: 'all', shard: null, files: [...plan.standard, ...plan.studioIntegration] });
  for (const shard of ['1/2', '2/2'] as const) {
    const selected = validationPlan(['--suite', 'browser', '--shard', shard]);
    for (const key of ['standard', 'studioIntegration', 'fast', 'integration', 'tariffs', 'studio', 'browser', 'browserShards'] as const) {
      assert.deepEqual(selected[key], plan[key], `${key} must not be narrowed by a selection`);
    }
    assert.deepEqual(selected.selection, { suite: 'browser', shard, files: plan.browserShards[shard] });
  }
  assert.deepEqual(validationPlan(['--suite', 'browser']).selection, { suite: 'browser', shard: null, files: plan.browser });
});

test('Browser execution passes only its alternating partition as explicit sequential test files', () => {
  for (const [shard, files] of [
    ['1/2', ['tests/connected-studio-montage-browser-integration.test.ts', 'tests/beta-browser.test.ts']],
    ['2/2', ['tests/alpha-browser.test.ts', 'tests/gamma-browser.test.ts']],
    [null, ['tests/connected-studio-montage-browser-integration.test.ts', 'tests/alpha-browser.test.ts', 'tests/beta-browser.test.ts', 'tests/gamma-browser.test.ts']],
  ] as const) {
    withRunnerFixture(['alpha-browser.test.ts', 'beta-browser.test.ts', 'gamma-browser.test.ts'], fixture => {
      const result = fixture.run(['--', '--suite', 'browser', ...(shard ? ['--shard', shard] : [])]);
      assert.equal(result.status, 0, String(result.stderr));
      assert.deepEqual(fixture.calls(), ['tool bootstrap', [
        'exec', 'tsx', '--tsconfig', 'frontend/tsconfig.json', '--test', '--test-concurrency=1', ...files,
      ]]);
    });
  }
});

test('validation planning never bootstraps tools or starts tests', () => {
  withRunnerFixture(['alpha-browser.test.ts'], fixture => {
    for (const args of [[], ['--suite', 'browser'], ['--suite', 'browser', '--shard', '2/2']]) {
      const result = fixture.run([...args, '--plan']);
      assert.equal(result.status, 0, String(result.stderr));
      assert.doesNotThrow(() => JSON.parse(String(result.stdout)));
    }
    assert.deepEqual(fixture.calls(), []);
  });
});

for (const [label, args] of [
  ['missing shard', ['--suite', 'browser', '--shard']],
  ['option as shard', ['--suite', 'browser', '--shard', '--plan']],
  ['duplicate shard', ['--suite', 'browser', '--shard', '1/2', '--shard', '2/2']],
  ['shard without Browser', ['--shard', '1/2']],
  ['shard in fast suite', ['--suite', 'fast', '--shard', '1/2']],
  ['shard in all suite', ['--suite', 'all', '--shard', '1/2']],
  ['zero index', ['--suite', 'browser', '--shard', '0/2']],
  ['out of range', ['--suite', 'browser', '--shard', '3/2']],
  ['wrong shard total', ['--suite', 'browser', '--shard', '1/3']],
  ['single shard', ['--suite', 'browser', '--shard', '1/1']],
  ['leading zero', ['--suite', 'browser', '--shard', '01/2']],
  ['malformed shard', ['--suite', 'browser', '--shard', 'one/two']],
  ['missing suite', ['--suite']],
  ['duplicate suite', ['--suite', 'browser', '--suite', 'fast']],
  ['unknown argument', ['--unknown']],
] as const) {
  test(`invalid validation CLI rejects ${label} before tool bootstrap or test launch`, () => {
    withRunnerFixture([], fixture => {
      const result = fixture.run([...args]);
      assert.equal(result.status, 1, String(result.stdout) + String(result.stderr));
      assert.match(String(result.stderr), /shard|suite|argument/i);
      assert.deepEqual(fixture.calls(), []);
    });
  });
}

test('an empty Browser partition fails before bootstrap and cannot trigger Node test autodiscovery', () => {
  withRunnerFixture([], fixture => {
    const result = fixture.run(['--suite', 'browser', '--shard', '2/2']);
    assert.equal(result.status, 1, String(result.stdout) + String(result.stderr));
    assert.match(String(result.stderr), /empty.*selection|no.*test files/i);
    assert.deepEqual(fixture.calls(), []);
  });
});
