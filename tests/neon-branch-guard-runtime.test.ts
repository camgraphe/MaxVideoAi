import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('guard dry run consumes every branch page without issuing deletions', async t => {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const url = new URL(req.url!, 'http://localhost');
    assert.equal(req.method, 'GET');
    res.setHeader('content-type', 'application/json');
    if (url.pathname.endsWith('/endpoints')) return res.end(JSON.stringify({ endpoints: [] }));
    const next = url.searchParams.get('cursor');
    res.end(JSON.stringify(next ? {
      branches: [{ id: 'backup', name: 'backup/pre-migration', current_state: 'ready' }],
    } : {
      branches: [{ id: 'main', name: 'main', primary: true, default: true, current_state: 'ready' }, { id: 'staging', name: 'preview/mcp-staging', current_state: 'archived' }],
      pagination: { next: 'second-page' },
    }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const child = spawn(process.execPath, ['scripts/neon-branch-guard.mjs', '--delete-merged', '--dry-run'], {
    env: { ...process.env, NEON_API_KEY: 'test-neon', NEON_API_BASE_URL: `http://127.0.0.1:${address.port}/api/v2`, GITHUB_TOKEN: 'test-github', GITHUB_REPOSITORY: 'owner/repo', NEON_BRANCH_LIMIT: '8' },
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await once(child, 'close');
  assert.equal(code, 0, output);
  assert.match(output, /total=3/);
  assert.match(output, /eligible for deletion=0 dry_run=true/);
  assert.ok(requests.some(request => request.includes('cursor=second-page')));
  assert.ok(requests.every(request => request.startsWith('GET ')));
});
