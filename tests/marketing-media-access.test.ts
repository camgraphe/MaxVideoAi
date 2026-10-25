import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadMarketingFile } from '../frontend/server/marketing-media/access';
import type { QueryExecutor } from '../frontend/src/lib/db';

test('only exact files from ready publications grant marketing reference access', async () => {
  const rows: { visibility: string }[] = [];
  let queries = 0;
  const db: QueryExecutor = {
    query: async (sql, params) => {
      queries++;
      assert.match(sql, /state='ready'/);
      assert.match(sql, /files @>/);
      assert.deepEqual(JSON.parse(String(params?.[0])), [
        { url: 'https://media.example/marketing-media/copy/ref.mp4' },
      ]);
      return rows as any;
    },
  };
  const url = 'https://media.example/marketing-media/copy/ref.mp4';
  const deps = { db, enabled: true, isAdmin: async (id: string) => id === 'admin' };
  assert.equal(await canReadMarketingFile(url, 'viewer', { ...deps, enabled: false }), false);
  assert.equal(queries, 0);
  assert.equal(await canReadMarketingFile(url, 'viewer', deps), false);
  rows.push({ visibility: 'private' });
  assert.equal(await canReadMarketingFile(url, 'viewer', deps), false);
  assert.equal(await canReadMarketingFile(url, 'admin', deps), true);
  rows[0].visibility = 'public';
  assert.equal(await canReadMarketingFile(url, 'viewer', deps), true);
});
