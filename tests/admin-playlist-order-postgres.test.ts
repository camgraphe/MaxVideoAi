import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('playlist reorder is atomic and preserves the previous order when insertion fails', async () => {
  const database = await startDisposablePostgres('adminorder');
  process.env.DATABASE_URL = database.databaseUrl;
  const { reorderPlaylistItems, deletePlaylist, updatePlaylist, appendPlaylistItem, removePlaylistItem } = await import('../frontend/server/playlists/mutations');
  const { getDb } = await import('../frontend/src/lib/db');
  try {
    await database.pool
      .query(`CREATE TABLE playlists(id text PRIMARY KEY, slug text); INSERT INTO playlists VALUES ('p','custom'),('other','other'),('historical',' WELCOME '); CREATE TABLE playlist_items (playlist_id text, video_id text, order_index integer, pinned boolean, PRIMARY KEY (playlist_id, video_id));
      INSERT INTO playlist_items VALUES ('p', 'a', 0, false), ('p', 'b', 1, true), ('other', 'z', 0, false);`);
    process.env.STARTER_PLAYLIST_SLUG = 'starter';
    await test('rejects_historical_core_writes', async () => {
      for (const action of [
        () => reorderPlaylistItems('historical', []),
        () => deletePlaylist('historical'),
        () => updatePlaylist('historical', { slug: 'renamed' }),
        () => appendPlaylistItem('historical', 'a'),
        () => removePlaylistItem('historical', 'a'),
      ]) await assert.rejects(action(), /historical|locked|configuration/i);
    });
    const { CurationError } = await import('../frontend/server/playlists/curation-store');
    await assert.rejects(reorderPlaylistItems('historical', []), error => error instanceof CurationError && error.status === 409);
    process.env.STARTER_PLAYLIST_SLUG = 'welcome';
    await assert.rejects(reorderPlaylistItems('historical', [{ videoId: 'a' }]), /historical|configuration/i);
    process.env.STARTER_PLAYLIST_SLUG = ' WELCOME ';
    await assert.rejects(reorderPlaylistItems('historical', [{ videoId: 'a' }]), /historical|configuration/i);
    // Reconciliation changes the stored source to the exact slug selected by readers.
    await database.pool.query("UPDATE playlists SET slug='WELCOME' WHERE id='historical'");
    await reorderPlaylistItems('historical', [{ videoId: 'a' }]);
    await assert.rejects(deletePlaylist('historical'), /locked/i);
    process.env.STARTER_PLAYLIST_SLUG = 'starter';
    await assert.rejects(reorderPlaylistItems('missing', []), /not found/i);
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
