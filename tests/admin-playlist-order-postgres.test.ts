import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('playlist reorder is atomic and preserves the previous order when insertion fails', async () => {
  const database = await startDisposablePostgres('adminorder');
  process.env.DATABASE_URL = database.databaseUrl;
  const { reorderPlaylistItems } = await import('../frontend/server/playlists/mutations');
  const { getDb } = await import('../frontend/src/lib/db');
  try {
    await database.pool
      .query(`CREATE TABLE playlist_items (playlist_id text, video_id text, order_index integer, pinned boolean, PRIMARY KEY (playlist_id, video_id));
      INSERT INTO playlist_items VALUES ('p', 'a', 0, false), ('p', 'b', 1, true), ('other', 'z', 0, false);`);
    await assert.rejects(reorderPlaylistItems('p', [{ videoId: 'c' }, { videoId: 'c' }]));
    const unchanged = (
      await database.pool.query(
        `SELECT video_id, order_index, pinned FROM playlist_items WHERE playlist_id = 'p' ORDER BY order_index`
      )
    ).rows;
    assert.deepEqual(unchanged, [
      { video_id: 'a', order_index: 0, pinned: false },
      { video_id: 'b', order_index: 1, pinned: true },
    ]);
    await reorderPlaylistItems('p', [{ videoId: 'b', pinned: true }, { videoId: 'a' }]);
    assert.deepEqual(
      (
        await database.pool.query(`SELECT video_id FROM playlist_items WHERE playlist_id = 'p' ORDER BY order_index`)
      ).rows.map((row) => row.video_id),
      ['b', 'a']
    );
    assert.equal(
      (await database.pool.query(`SELECT COUNT(*)::int AS n FROM playlist_items WHERE playlist_id = 'other'`)).rows[0]
        .n,
      1
    );
  } finally {
    await getDb().end();
    await database.cleanup();
  }
});
