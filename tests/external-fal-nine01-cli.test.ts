import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { nine01Fixture } from './helpers/nine01-native-evidence-fixture';

function run(args: string[]) {
  return spawnSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), '--tsconfig', 'frontend/tsconfig.json',
    'frontend/scripts/import-external-fal-results.ts', ...args], { encoding: 'utf8', timeout: 30_000 });
}

test('native offline inventory stays unverified and does not require or load storage credentials', async () => {
  const f = await nine01Fixture();
  try {
    const manifest = path.join(f.dir, 'import.json');
    await writeFile(manifest, JSON.stringify(f.input), { mode: 0o600 });
    const result = run(['--mode', 'plan', '--manifest', manifest]);
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(result.stdout);
    assert.equal(plan.verified, false); assert.equal(plan.financialWrites, 0);
    assert.equal(plan.visibility, 'private'); assert.equal(plan.indexable, false);
  } finally { await f.cleanup(); }
});

test('native live verification requires its explicit source config before any database or provider access', async () => {
  const f = await nine01Fixture();
  try {
    const manifest = path.join(f.dir, 'import.json'), journal = path.join(f.dir, 'bundle.json'), env = path.join(f.dir, 'target.env');
    await writeFile(manifest, JSON.stringify(f.input), { mode: 0o600 });
    await writeFile(journal, f.bundleBytes, { mode: 0o600 });
    await writeFile(env, ['DATABASE_URL=postgresql://test:test@127.0.0.1:1/test', 'S3_BUCKET=unrelated-owned-bucket',
      'S3_REGION=auto', 'S3_ACCESS_KEY_ID=test-only-key', 'S3_SECRET_ACCESS_KEY=test-only-secret',
      'S3_PUBLIC_BASE_URL=https://media.maxvideoai.com', 'FAL_KEY=test-only-fal-key'].join('\n'), { mode: 0o600 });
    const result = run(['--mode', 'dry-run', '--manifest', manifest, '--journal', journal, '--env-file', env, '--actor-user-id', f.owner]);
    assert.notEqual(result.status, 0);
    assert.equal(result.stderr.trim(), 'REQUIRED_NATIVE_SOURCE_CONFIG');
    assert.equal(result.stdout, '');
  } finally { await f.cleanup(); }
});
