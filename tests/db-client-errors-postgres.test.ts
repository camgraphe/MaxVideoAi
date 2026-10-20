import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('a fatal error on a checked-out database client cannot crash the server or commit interrupted work', async (t) => {
  const db = await startDisposablePostgres('db-client-error');
  const dir = mkdtempSync(join(tmpdir(), 'db-client-error-fixture-'));
  try {
    await db.pool.query('CREATE TABLE interrupted_writes (value integer NOT NULL)');
    const fixture = join(dir, 'client.cjs');
    await build({ stdin: { resolveDir: process.cwd(), contents: `
      import assert from 'node:assert/strict';
      import { getDb, query, withDbTransaction } from './frontend/src/lib/db';
      // An invalid frame makes the disposable server send a real FATAL 08P01
      // between queries, when pg emits a client error instead of rejecting SQL.
      function disconnect(client) {
        const ended = new Promise(resolve => client.once('end', resolve));
        client.connection.stream.write(Buffer.from([0, 0, 0, 0, 4]));
        return ended;
      }
      async function main() {
        const pool = getDb();
        try {
          if (process.env.FAULT_CASE === 'checked-out') {
            const client = await pool.connect();
            await client.query('SELECT 1');
            await disconnect(client);
            client.release();
          } else {
            let attempts = 0;
            await assert.rejects(withDbTransaction(async (executor, client) => {
              attempts++;
              await executor.query('INSERT INTO interrupted_writes VALUES (1)');
              await disconnect(client);
              return 'must never report a commit';
            }), /connection|not queryable|terminated/i);
            assert.equal(attempts, 1);
          }
          const [row] = await query('SELECT count(*)::int AS writes FROM interrupted_writes');
          assert.equal(row.writes, 0);
          console.log('SERVER_SURVIVED_WITH_NO_REPLAY');
        } finally { await pool.end(); }
      }
      main().catch(error => { console.error(error); process.exitCode = 1; });
    ` }, outfile: fixture, bundle: true, platform: 'node', format: 'cjs', packages: 'external' });
    for (const mode of ['checked-out', 'transaction']) {
      await t.test(mode, async () => {
        const result = await new Promise<{ code: number | null; output: string }>((settle, reject) => {
          const child = spawn(process.execPath, [fixture], { env: { ...process.env,
            DATABASE_URL: db.databaseUrl, FAULT_CASE: mode,
            NODE_PATH: [resolve('node_modules'), resolve('frontend/node_modules')].join(delimiter),
          }, stdio: ['ignore', 'pipe', 'pipe'] });
          let output = '';
          const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('database error fixture timed out')); }, 10_000);
          child.stdout.on('data', chunk => { output += chunk; });
          child.stderr.on('data', chunk => { output += chunk; });
          child.once('error', error => { clearTimeout(timer); reject(error); });
          child.once('close', code => { clearTimeout(timer); settle({ code, output }); });
        });
        assert.equal(result.code, 0, result.output);
        assert.match(result.output, /08P01/);
        assert.match(result.output, /SERVER_SURVIVED_WITH_NO_REPLAY/);
        assert.doesNotMatch(result.output, /Unhandled 'error' event/);
      });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    await db.cleanup();
  }
});
