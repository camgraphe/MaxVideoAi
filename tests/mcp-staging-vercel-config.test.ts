import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('MCP staging Vercel config has no crons and blocks indexing', () => {
  const path = join(process.cwd(), 'frontend/vercel.mcp-staging.json');
  assert.equal(existsSync(path), true);
  const config = JSON.parse(readFileSync(path, 'utf8')) as {
    crons?: unknown[];
    headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };
  assert.equal(config.crons, undefined);
  assert.deepEqual(config.headers, [
    {
      source: '/(.*)',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
    },
  ]);
});
