import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import test from 'node:test';
import { promisify } from 'node:util';
import { startDisposablePostgres } from './helpers/disposable-postgres';

const runCommand = promisify(execFile);

test('the frozen CWV fixture supports the public engine catalog required by watch pages with read-only connections', async () => {
  const db = await startDisposablePostgres('gallery-cwv-fixture');
  const url = new URL(db.databaseUrl);
  url.searchParams.set('options', '-c default_transaction_read_only=on');
  process.env.DATABASE_URL = url.toString();
  process.env.EXAMPLES_PLAYLIST_SLUG = 'examples';
  const { getDb } = await import('../frontend/src/lib/db');
  try {
    const result = await runCommand('pnpm', ['exec', 'tsx', '--tsconfig', 'frontend/tsconfig.json',
      'performance/gallery-final/seed-fixture.ts'], {
      env: { ...process.env, FIXTURE_DATABASE_URL: db.databaseUrl }, timeout: 30000,
    });
    assert.equal(JSON.parse(result.stdout.trim()).cards, 316);
    assert.equal((await getDb().query('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only, 'on');
    const { getPublicConfiguredEnginesByCategory } = await import('../frontend/src/server/engines');
    const engines = await getPublicConfiguredEnginesByCategory('video');
    assert.ok(engines.length > 0, 'the measured watch reader can load comparison engines');
    assert.ok(engines.some(engine => engine.id === 'wan-3-prime'), 'the fixture landscape model remains available');
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
  }
});
