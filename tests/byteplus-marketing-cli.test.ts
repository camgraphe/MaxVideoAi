import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { byteplusFixture } from './helpers/byteplus-marketing-fixture';

test('operator plan is offline and apply cannot proceed without explicit rights', () => {
  const dir = mkdtempSync(join(tmpdir(), 'byteplus-cli-'));
  try {
    const manifest = join(dir, 'input.json'); writeFileSync(manifest, JSON.stringify(byteplusFixture()));
    const run = (...args: string[]) => spawnSync(process.execPath, ['--import','tsx','frontend/scripts/import-byteplus-marketing.ts',
      '--manifest',manifest,...args], { encoding: 'utf8', env: { ...process.env, TSX_TSCONFIG_PATH: 'frontend/tsconfig.json',
        DATABASE_URL: '', BYTEPLUS_ARK_API_KEY: '' } });
    const planned = run('--mode','plan');
    assert.equal(planned.status, 0, planned.stderr);
    const plan = JSON.parse(planned.stdout);
    assert.equal(plan.verified, false); assert.equal(plan.publication, 'private');
    assert.match(plan.videoId, /^mbp_[a-f0-9]{64}$/);
    assert.equal(plan.engineId, 'seedance-2-5-flash');
    const denied = run('--mode','apply');
    assert.equal(denied.status, 1); assert.match(denied.stderr, /PERMISSION_REQUIRED/);
    const envFile = join(dir, 'review.env');
    writeFileSync(envFile, [
      'DATABASE_URL=postgresql://fixture:fixture@ep-orange-lake-b2yfb7ss.c-6.eu-central-1.aws.neon.tech/neondb',
      'S3_BUCKET=fixture', 'S3_REGION=eu-central-1', 'S3_ACCESS_KEY_ID=fixture', 'S3_SECRET_ACCESS_KEY=fixture',
      'S3_PUBLIC_BASE_URL=https://media.example.com',
    ].join('\n'));
    const review = run('--mode','dry-run','--env-file',envFile);
    assert.equal(review.status, 1); assert.match(review.stderr, /OPENAI_REVIEW_TARGET_FORBIDDEN/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
