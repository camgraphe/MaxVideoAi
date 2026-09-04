import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitBranchLookup, findCompletedPreviewCandidates } from '../scripts/lib/neon-preview-cleanup-policy.mjs';

const now = Date.parse('2026-09-05T12:00:00Z');
const main = { id: 'br-main', name: 'main', primary: true, default: true };
const preview = { id: 'br-preview', name: 'preview/codex/done', parent_id: 'br-main', creation_source: 'vercel', current_state: 'ready', created_at: '2026-09-01T00:00:00Z' };
const endpoint = { branch_id: 'br-preview', current_state: 'idle', last_active: '2026-09-02T00:00:00Z' };
const pull = { state: 'closed', merged_at: '2026-09-02T12:00:00Z', base: { ref: 'main' }, head: { sha: 'approved-sha' } };

async function candidates(overrides = {}) {
  return findCompletedPreviewCandidates({
    branches: [main, preview], endpoints: [endpoint], now,
    archivedOnly: false,
    lookupGitBranch: async () => ({ head: 'approved-sha', pulls: [pull] }),
    ...overrides,
  });
}

test('completed previews are eligible after merge and inactivity grace', async () => {
  assert.deepEqual((await candidates()).map(b => b.id), ['br-preview']);
  assert.equal((await candidates({ archivedOnly: true })).length, 0);
  assert.equal((await candidates({ branches: [main, { ...preview, current_state: 'archived' }], archivedOnly: true })).length, 1);
});

test('production, default, protected, backup, staging and manual branches are always preserved', async () => {
  for (const change of [{ primary: true }, { default: true }, { protected: true }, { name: 'preview/mcp-staging' }, { name: 'backup/pre-migration' }, { creation_source: 'console' }]) {
    assert.equal((await candidates({ branches: [main, { ...preview, ...change }] })).length, 0, JSON.stringify(change));
  }
  assert.equal((await candidates({ branches: [main, preview, { id: 'br-child', parent_id: preview.id }] })).length, 0);
});

test('active, recently used, unknown-activity and recently merged previews are preserved', async () => {
  for (const change of [{ current_state: 'active' }, { last_active: '2026-09-05T11:00:00Z' }, { last_active: undefined }]) {
    assert.equal((await candidates({ endpoints: [{ ...endpoint, ...change }] })).length, 0);
  }
  assert.equal((await candidates({ lookupGitBranch: async () => ({ head: 'approved-sha', pulls: [{ ...pull, merged_at: '2026-09-05T11:00:00Z' }] }) })).length, 0);
});

test('open, unmerged, changed, reused and other-base Git branches cannot be deleted', async () => {
  for (const git of [
    { head: 'approved-sha', pulls: [pull, { ...pull, state: 'open', merged_at: null }] },
    { head: 'approved-sha', pulls: [{ ...pull, merged_at: null }] },
    { head: 'new-sha', pulls: [pull] },
    { head: 'approved-sha', pulls: [{ ...pull, base: { ref: 'develop' } }] },
    { head: 'approved-sha', pulls: [] },
  ]) assert.equal((await candidates({ lookupGitBranch: async () => git })).length, 0);
  assert.equal((await candidates({ branches: [main, { ...preview, created_at: '2026-09-03T00:00:00Z' }] })).length, 0);
});

test('a deleted Git branch still requires a merged PR and remote failures stop cleanup', async () => {
  assert.equal((await candidates({ lookupGitBranch: async () => ({ head: null, pulls: [pull] }) })).length, 1);
  await assert.rejects(candidates({ lookupGitBranch: async () => { throw new Error('GitHub unavailable'); } }), /GitHub unavailable/);
});

test('GitHub verification checks every PR page so an open PR cannot be hidden', async () => {
  let calls = 0;
  const lookup = createGitBranchLookup({ repository: 'owner/repo', token: 'test-token', fetchFn: async input => {
    calls++;
    const url = new URL(input);
    assert.equal(url.hostname, 'api.github.com');
    if (url.pathname.includes('/git/ref/')) return Response.json({ object: { sha: 'approved-sha' } });
    assert.equal(url.searchParams.get('head'), 'owner:codex/done');
    return Response.json(url.searchParams.get('page') === '1' ? Array.from({ length: 100 }, () => pull) : [{ ...pull, state: 'open', merged_at: null }]);
  } });
  assert.equal((await candidates({ lookupGitBranch: lookup })).length, 0);
  assert.equal(calls, 3);
});

test('GitHub lookup rejects missing configuration and malformed responses', async () => {
  assert.throws(() => createGitBranchLookup({ repository: 'owner/repo', token: '' }));
  for (const response of [Response.json({ message: 'denied' }, { status: 403 }), Response.json({ object: {} })]) {
    const lookup = createGitBranchLookup({ repository: 'owner/repo', token: 'test', fetchFn: async () => response });
    await assert.rejects(lookup('codex/done'));
  }
});
