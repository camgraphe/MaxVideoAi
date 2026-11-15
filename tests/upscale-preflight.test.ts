import assert from 'node:assert/strict';
import test from 'node:test';
import { getUpscaleToolEngine } from '../frontend/src/config/tools-upscale-engines';
import { resolveUpscalePricingContext } from '../frontend/src/server/tools/upscale-pricing-context';
import { runUpscaleToolBase } from '../frontend/src/server/tools/upscale';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';

test('equal and smaller video targets create no job or debit', { timeout: 60_000 }, async t => {
  const database = await startDisposablePostgres('upscale-preflight');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  t.after(async () => { await getDb().end(); if (previous) process.env.DATABASE_URL = previous; else delete process.env.DATABASE_URL; await database.cleanup(); });
  await createPaidGenerationTestSchema(database.pool);
  for (const [width, height, targetResolution] of [[1920, 1080, '1080p'], [1080, 1920, '1080p'], [2560, 1440, '1080p']] as const) {
    const metadata = { width, height, durationSec: 19, fps: 24 };
    const expected = (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'UPSCALE_TARGET_NOT_LARGER');
    await assert.rejects(resolveUpscalePricingContext({
      billingProductKey: 'upscale-video-seedvr', engine: getUpscaleToolEngine('seedvr-video', 'video'),
      input: { mediaType: 'video', mode: 'target' }, targetResolution, upscaleFactor: 2, videoMetadata: metadata,
    }), expected);
    await assert.rejects(runUpscaleToolBase({
      userId: 'owner', requestId: crypto.randomUUID(), engineId: 'seedvr-video', mediaType: 'video',
      mediaUrl: 'https://owned.example/source.mp4', mode: 'target', targetResolution,
      acceptedQuote: { totalCents: 379, currency: 'USD' },
    }, { detectVideoMetadata: async () => metadata }), expected);
  }
  const { rows } = await database.pool.query("SELECT (SELECT count(*) FROM app_jobs) jobs, (SELECT count(*) FROM app_receipts WHERE type='charge') charges");
  assert.deepEqual(rows[0], { jobs: '0', charges: '0' });
});
