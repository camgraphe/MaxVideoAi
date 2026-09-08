import assert from 'node:assert/strict';
import test from 'node:test';

import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('Audio job output projection is exact and idempotent on disposable PostgreSQL', { timeout: 30_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const database = await startDisposablePostgres('mcp-audio-output');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  let closeDb: (() => Promise<void>) | null = null;
  t.after(async () => {
    await closeDb?.();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await database.cleanup();
  });

  const [{ upsertJobOutputs }, { getDb }] = await Promise.all([
    import('../frontend/server/media-library/job-outputs'),
    import('../frontend/src/lib/db'),
  ]);
  closeDb = () => getDb().end();
  const output = {
    id: 'audio-job-1:audio:0',
    jobId: 'audio-job-1',
    userId: 'audio-owner',
    kind: 'audio' as const,
    url: 'https://cdn.maxvideoai.com/generated/audio-job-1.flac',
    storageUrl: null,
    thumbUrl: null,
    previewUrl: null,
    mimeType: 'audio/flac',
    width: null,
    height: null,
    durationSec: 13,
    position: 0,
    status: 'ready',
    metadata: { surface: 'audio', measuredDurationSec: 12.375 },
  };

  await upsertJobOutputs([output]);
  await upsertJobOutputs([output]);
  const rows = (await database.pool.query(
    `SELECT id, kind, url, mime_type, duration_sec, metadata
       FROM job_outputs
      WHERE job_id = $1`,
    [output.jobId],
  )).rows;
  assert.deepEqual(rows, [{
    id: output.id,
    kind: 'audio',
    url: output.url,
    mime_type: 'audio/flac',
    duration_sec: 13,
    metadata: { surface: 'audio', measuredDurationSec: 12.375 },
  }]);
});
