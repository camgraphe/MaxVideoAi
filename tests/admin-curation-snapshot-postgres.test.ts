import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { curationFingerprint, readCurationSnapshot, readCurationSnapshotState, snapshotFromCurationState } from '../frontend/server/playlists/curation-store';

test('curation snapshots retain exact revision bytes with two reads across optional schema versions', async t => {
  const db = await startDisposablePostgres('curation-snapshot');
  const id = '11111111-1111-4111-8111-111111111111';
  const playlist = { slug: 'examples-wan-3', is_public: true, updated_at: new Date('2026-10-20T12:00:00.000Z') };
  const items = [{ video_id: 'z', order_index: 2, pinned: false }, { video_id: 'a', order_index: 1, pinned: true }];
  let queries = 0;
  const executor = { async query<T>(sql: string, params?: readonly unknown[]): Promise<T[]> {
    queries++;
    return (await db.pool.query(sql, params as unknown[])).rows as T[];
  } };
  const check = async (saved: null | { mode: 'manual'; ordered_ids: string[]; excluded_ids: string[]; revision: string; opening_ids: string[] | null }, available: boolean, openingAvailable: boolean) => {
    queries = 0;
    const result = await readCurationSnapshot(id, executor);
    assert.deepEqual(result, {
      available, openingAvailable, supported: true, slug: playlist.slug, isPublic: true,
      config: saved ? { mode: saved.mode, orderedIds: saved.ordered_ids, excludedIds: saved.excluded_ids, openingIds: saved.opening_ids } : null,
      revision: curationFingerprint({ playlist, saved, items, inherited: null }), legacyIds: ['z', 'a'],
    });
    assert.equal(queries, 2, 'the schema flags and snapshot must use only two database round-trips');
    if (available) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('LOCK TABLE playlist_curations IN SHARE MODE NOWAIT');
        let lockedReads = 0;
        const locked = await readCurationSnapshotState(id, { async query<T>(sql: string, params?: readonly unknown[]): Promise<T[]> {
          lockedReads++;
          return (await client.query(sql, params as unknown[])).rows as T[];
        } }, { curationTableLocked: true });
        assert.deepEqual(snapshotFromCurationState(locked), result);
        assert.equal(lockedReads, 1, 'a successfully locked curation table needs no separate existence query');
      } finally { await client.query('ROLLBACK'); client.release(); }
    }
  };
  try {
    await db.pool.query(`CREATE TABLE playlists(id uuid PRIMARY KEY,slug text,is_public boolean,updated_at timestamptz);
      CREATE TABLE playlist_items(playlist_id uuid,video_id text,order_index int,pinned boolean);
      INSERT INTO playlists VALUES ('${id}','examples-wan-3',TRUE,'2026-10-20T12:00:00Z');
      INSERT INTO playlist_items VALUES ('${id}','a',1,TRUE),('${id}','z',2,FALSE);`);
    await t.test('curation table absent', () => check(null, false, false));
    await db.pool.query(readFileSync('neon/migrations/52_playlist_curations.sql', 'utf8'));
    await t.test('curation available but no saved selection', () => check(null, true, false));
    await db.pool.query("INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids,revision) VALUES ($1,'manual',ARRAY['z','a'],ARRAY['excluded'],7)", [id]);
    const saved = { mode: 'manual' as const, ordered_ids: ['z', 'a'], excluded_ids: ['excluded'], revision: '7', opening_ids: null };
    await t.test('saved curation without optional opening column', () => check(saved, true, false));
    await db.pool.query(readFileSync('neon/migrations/53_playlist_opening.sql', 'utf8'));
    const opening_ids = ['open-a', 'open-b', 'open-c', 'open-d'];
    await db.pool.query('UPDATE playlist_curations SET opening_ids=$2 WHERE playlist_id=$1', [id, opening_ids]);
    await t.test('saved curation with optional opening column', () => check({ ...saved, opening_ids }, true, true));
  } finally { await db.cleanup(); }
});
