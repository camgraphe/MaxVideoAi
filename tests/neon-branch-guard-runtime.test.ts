import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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

for (const scenario of ['abandoned', 'reopened', 'changed-head', 'newly-observed', 'over-limit'] as const) {
  test(`abandoned cleanup protects current work: ${scenario}`, async t => {
    const requests: string[] = [];
    const main = { id: 'main', name: 'main', primary: true, default: true, current_state: 'ready' };
    const preview = { id: 'preview', name: 'preview/codex/abandoned', parent_id: 'main', creation_source: 'vercel', current_state: 'ready', created_at: '2026-01-01T00:00:00Z' };
    let present = true;
    let inventories = 0;
    const server = createServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost');
      requests.push(`${req.method} ${url.pathname}`);
      res.setHeader('content-type', 'application/json');
      if (url.pathname.endsWith('/branches/preview') && req.method === 'DELETE') {
        present = false;
        return res.end('{}');
      }
      if (url.pathname.endsWith('/branches')) {
        inventories++;
        return res.end(JSON.stringify({ branches: present ? [main, preview] : [main] }));
      }
      if (url.pathname.endsWith('/endpoints')) return res.end(JSON.stringify({ endpoints: [{ branch_id: 'preview', current_state: 'idle', last_active: '2026-01-01T00:00:00Z' }] }));
      if (url.pathname.includes('/git/ref/')) return res.end(JSON.stringify({ object: { sha: scenario === 'changed-head' && inventories >= 2 ? 'another-old-sha' : 'old-sha' } }));
      if (url.pathname.includes('/git/commits/')) return res.end(JSON.stringify({ sha: url.pathname.split('/').at(-1), committer: { date: '2026-01-01T00:00:00Z' } }));
      if (url.pathname.endsWith('/pulls')) return res.end(JSON.stringify(scenario === 'reopened' && inventories >= 2 ? [{ state: 'open' }] : []));
      res.statusCode = 404;
      res.end('{}');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => server.close());
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const directory = await mkdtemp(join(tmpdir(), 'neon-cleanup-test-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const preload = join(directory, 'github-fetch.mjs');
    const observationsFile = join(directory, 'observations.json');
    const now = Date.now();
    const newlyObserved = scenario === 'newly-observed' || scenario === 'over-limit';
    if (!newlyObserved) await writeFile(observationsFile, JSON.stringify({ version: 1, projectId: 'test-project', repository: 'owner/repo', heads: { preview: { gitBranch: 'codex/abandoned', head: 'old-sha', firstSeenAt: new Date(now - 25 * 3600000).toISOString(), lastSeenAt: new Date(now - 3600000).toISOString() } } }));
    await writeFile(preload, `const original = globalThis.fetch; globalThis.fetch = (input, init) => { const url = new URL(input); return original(url.hostname === 'api.github.com' ? ${JSON.stringify(base)} + url.pathname + url.search : input, init); };`);
    const child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, 'scripts/neon-branch-guard.mjs', '--delete-abandoned'], {
      env: { ...process.env, NEON_API_KEY: 'test-neon', NEON_API_BASE_URL: `${base}/api/v2`, GITHUB_TOKEN: 'test-github', GITHUB_REPOSITORY: 'owner/repo', NEON_BRANCH_GUARD_PROJECT_ID: 'test-project', NEON_BRANCH_OBSERVATIONS_FILE: observationsFile, NEON_BRANCH_LIMIT: scenario === 'over-limit' ? '1' : '8', NEON_BRANCH_DELETE_ABANDONED: '0', NEON_BRANCH_DELETE_MERGED: '0', NEON_BRANCH_DELETE_ARCHIVED: '0' },
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const [code] = await once(child, 'close');
    assert.equal(code, scenario === 'over-limit' ? 1 : 0, output);
    if (!newlyObserved) assert.ok(inventories >= 2, 'inventory must be checked again before deletion');
    assert.equal(requests.filter(request => request.startsWith('DELETE ')).length, scenario === 'abandoned' ? 1 : 0, output);
    assert.equal(present, scenario !== 'abandoned');
    assert.match(output, scenario === 'abandoned' ? /after prune:.*total=1/ : newlyObserved ? /eligible for deletion=0/ : /preserved changed branch/);
    if (newlyObserved) {
      const state = JSON.parse(await readFile(observationsFile, 'utf8'));
      assert.equal(state.heads.preview.head, 'old-sha');
      assert.ok(Date.parse(state.heads.preview.firstSeenAt) >= now, 'an old commit must start a fresh observation window');
    }
  });
}
