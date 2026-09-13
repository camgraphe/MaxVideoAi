import assert from 'node:assert/strict';
import test from 'node:test';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { createTimelineExportJob, readTimelineExportJobByIdempotencyKey } from '../frontend/src/server/timeline-exports/repository';

test('export repository isolates keys and accounts, replays jobs and finds historical IDs in PostgreSQL', {
  skip: missingDisposablePostgresCommand() ? 'Local PostgreSQL binaries required' : false,
}, async () => {
  const database = await startDisposablePostgres('studio-export-composition');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = database.databaseUrl;
  try {
    const create = (userId: string, idempotencyKey: string, id?: string) => createTimelineExportJob({
      userId, idempotencyKey, id, projectName: 'Local identity proof', durationSec: 5,
      resolution: '1440p', fps: 30, qualityPreset: 'standard', amountCents: 0, currency: 'USD',
      billingKind: 'free', billingStatus: 'free_reserved', renderManifest: {}, exportSettings: {},
    });
    const a = await create('account-a', 'request:a');
    const b = await create('account-a', 'requesta');
    const c = await create('account-b', 'request:a');
    assert.equal(new Set([a.id, b.id, c.id]).size, 3);
    assert.equal((await create('account-a', 'request:a')).id, a.id);
    assert.equal((await create('account-b', 'request:a')).id, c.id);
    const old = await create('account-a', 'historical:key', 'tlx_historicalkey');
    assert.equal((await readTimelineExportJobByIdempotencyKey({ userId: 'account-a', idempotencyKey: 'historical:key' }))?.id, old.id);
    assert.equal((await create('account-a', 'historical:key')).id, 'tlx_historicalkey');
    assert.equal(await readTimelineExportJobByIdempotencyKey({ userId: 'account-b', idempotencyKey: 'historical:key' }), null);
    assert.equal((await database.pool.query('SELECT COUNT(*)::int AS count FROM app_timeline_exports')).rows[0].count, 4);
  } finally {
    await getDb().end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await database.cleanup();
  }
});
