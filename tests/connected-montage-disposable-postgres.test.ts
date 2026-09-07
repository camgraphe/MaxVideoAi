import assert from 'node:assert/strict';
import test from 'node:test';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('Connected montage verification uses a newly created socket-only disposable database', async () => {
  assert.equal(missingDisposablePostgresCommand(), null, 'Expose local PostgreSQL binaries on PATH; no inherited DATABASE_URL fallback is allowed.');
  // macOS sockaddr_un paths are short: the unique temporary directory still
  // identifies this disposable cluster, while the prefix leaves room for its socket.
  const database = await startDisposablePostgres('stpg');
  try {
    const connection = new URL(database.databaseUrl);
    const socket = connection.searchParams.get('host');
    assert.ok(socket?.includes('/stpg-'));
    assert.ok(socket?.endsWith('/socket'));
    const settings = await database.pool.query("SELECT current_setting('listen_addresses') AS listeners, current_database() AS database");
    assert.equal(settings.rows[0].listeners, '');
    assert.equal(settings.rows[0].database, 'postgres');
    await database.pool.query('CREATE TABLE studio_disposable_probe (id integer PRIMARY KEY)');
    await database.pool.query('INSERT INTO studio_disposable_probe VALUES (1)');
    const result = await database.pool.query('SELECT count(*)::int AS count FROM studio_disposable_probe');
    assert.equal(result.rows[0].count, 1);
  } finally {
    await database.cleanup();
  }
});
