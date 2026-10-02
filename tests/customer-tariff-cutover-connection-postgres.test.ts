import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';

test('an operational transaction uses its explicitly verified pool instead of the application environment connection', async () => {
  const selected = await startDisposablePostgres('pricing-cutover-selected');
  const ambient = await startDisposablePostgres('pricing-cutover-ambient');
  const before = process.env.DATABASE_URL;
  process.env.DATABASE_URL = ambient.databaseUrl;
  try {
    const socket = await withDbTransaction(async executor => {
      const [row] = await executor.query<{ socket: string }>("SELECT current_setting('unix_socket_directories') AS socket");
      return row.socket;
    }, { pool: selected.pool });
    assert.equal(socket, new URL(selected.databaseUrl).searchParams.get('host'));
  } finally {
    await getDb().end().catch(() => undefined);
    await selected.cleanup(); await ambient.cleanup();
    if (before === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = before;
  }
});
