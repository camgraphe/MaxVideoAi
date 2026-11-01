import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitBranchLookup, findCompletedPreviewCandidates, observeGitHead } from '../scripts/lib/neon-preview-cleanup-policy.mjs';

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

test('abandoned previews require explicit opt-in and 24 hours since PR closure', async () => {
  const git = { head: 'approved-sha', headCommittedAt: '2026-09-02T00:00:00Z', pulls: [{ ...pull, merged_at: null, closed_at: '2026-09-03T00:00:00Z' }] };
  assert.equal((await candidates({ lookupGitBranch: async () => git })).length, 0);
  assert.equal((await candidates({ includeAbandoned: true, lookupGitBranch: async () => git })).length, 1);
  for (const closed_at of [undefined, 'invalid', '2026-08-31T00:00:00Z', '2026-09-04T12:00:01Z']) {
    assert.equal((await candidates({ includeAbandoned: true, lookupGitBranch: async () => ({ ...git, pulls: [{ ...git.pulls[0], closed_at }] }) })).length, 0);
  }
  assert.equal((await candidates({ includeAbandoned: true, lookupGitBranch: async () => ({ ...git, pulls: [{ ...git.pulls[0], closed_at: '2026-09-04T12:00:00Z' }] }) })).length, 1);
});

test('abandoned cleanup preserves reopened PRs, new commits, recent closes and reused names', async () => {
  const abandoned = { ...pull, merged_at: null, closed_at: '2026-09-03T00:00:00Z' };
  for (const git of [
    { head: 'new-sha', headCommittedAt: '2026-09-02T00:00:00Z', pulls: [abandoned] },
    { head: 'approved-sha', headCommittedAt: '2026-09-05T11:00:00Z', pulls: [abandoned] },
    { head: 'approved-sha', headCommittedAt: null, pulls: [abandoned] },
    { head: 'approved-sha', headCommittedAt: '2026-09-02T00:00:00Z', pulls: [abandoned, { ...abandoned, state: 'open' }] },
    { head: 'approved-sha', headCommittedAt: '2026-09-02T00:00:00Z', pulls: [abandoned, { ...abandoned, closed_at: '2026-09-05T11:00:00Z' }] },
    { head: 'approved-sha', headCommittedAt: '2026-09-02T00:00:00Z', pulls: [{ ...abandoned, base: { ref: 'develop' } }] },
  ]) assert.equal((await candidates({ includeAbandoned: true, lookupGitBranch: async () => git })).length, 0);
});

test('previews without a PR expire only after branch, compute and last commit inactivity', async () => {
  const git = { head: 'approved-sha', headCommittedAt: '2026-09-04T12:00:00Z', headUnchangedSince: '2026-09-04T12:00:00Z', pulls: [] };
  assert.equal((await candidates({ includeAbandoned: true, lookupGitBranch: async () => git })).length, 1);
  for (const change of [{ headCommittedAt: '2026-09-04T12:00:01Z' }, { headCommittedAt: null }, { headCommittedAt: 'invalid' }, { head: null }, { headUnchangedSince: null }, { headUnchangedSince: '2026-09-04T12:00:01Z' }]) {
    assert.equal((await candidates({ includeAbandoned: true, lookupGitBranch: async () => ({ ...git, ...change }) })).length, 0);
  }
  assert.equal((await candidates({ includeAbandoned: true, branches: [main, { ...preview, created_at: '2026-09-05T00:00:00Z' }], lookupGitBranch: async () => git })).length, 0);
  assert.equal((await candidates({ includeAbandoned: true, endpoints: [{ ...endpoint, last_active: '2026-09-05T00:00:00Z' }], lookupGitBranch: async () => git })).length, 0);
});

test('a deleted Git ref can be cleaned after an old PR closure but requires PR evidence', async () => {
  const git = { head: null, headCommittedAt: null, pulls: [{ ...pull, merged_at: null, closed_at: '2026-09-03T00:00:00Z' }] };
  assert.equal((await candidates({ includeAbandoned: true, lookupGitBranch: async () => git })).length, 1);
  assert.equal((await candidates({ includeAbandoned: true, lookupGitBranch: async () => ({ ...git, pulls: [] }) })).length, 0);
});

test('GitHub lookup fetches and validates the current head commit timestamp', async () => {
  for (const date of ['2026-09-02T00:00:00Z', undefined, 'invalid']) {
    const lookup = createGitBranchLookup({ repository: 'owner/repo', token: 'test', fetchFn: async input => {
      const url = new URL(input);
      if (url.pathname.includes('/git/ref/')) return Response.json({ object: { sha: 'approved-sha' } });
      if (url.pathname.endsWith('/git/commits/approved-sha')) return Response.json({ sha: 'approved-sha', committer: { date } });
      return Response.json([]);
    } });
    if (date === '2026-09-02T00:00:00Z') assert.deepEqual(await lookup('codex/done'), { head: 'approved-sha', headCommittedAt: date, pulls: [] });
    else await assert.rejects(lookup('codex/done'), /commit/);
  }
});

test('GitHub verification checks every PR page so an open PR cannot be hidden', async () => {
  let calls = 0;
  const lookup = createGitBranchLookup({ repository: 'owner/repo', token: 'test-token', fetchFn: async input => {
    calls++;
    const url = new URL(input);
    assert.equal(url.hostname, 'api.github.com');
    if (url.pathname.includes('/git/ref/')) return Response.json({ object: { sha: 'approved-sha' } });
    if (url.pathname.includes('/git/commits/')) return Response.json({ sha: 'approved-sha', committer: { date: '2026-09-02T00:00:00Z' } });
    assert.equal(url.searchParams.get('head'), 'owner:codex/done');
    return Response.json(url.searchParams.get('page') === '1' ? Array.from({ length: 100 }, () => pull) : [{ ...pull, state: 'open', merged_at: null }]);
  } });
  assert.equal((await candidates({ lookupGitBranch: lookup })).length, 0);
  assert.equal(calls, 4);
});

test('GitHub lookup rejects missing configuration and malformed responses', async () => {
  assert.throws(() => createGitBranchLookup({ repository: 'owner/repo', token: '' }));
  for (const response of [Response.json({ message: 'denied' }, { status: 403 }), Response.json({ object: {} })]) {
    const lookup = createGitBranchLookup({ repository: 'owner/repo', token: 'test', fetchFn: async () => response });
    await assert.rejects(lookup('codex/done'));
  }
});

test('unchanged head observations restart for a changed head, reused Neon id, outage or invalid clock', () => {
  for (const change of [{ head: 'new-sha' }, { gitBranch: 'codex/reused' }, { firstSeenAt: 'invalid' }, { lastSeenAt: '2026-09-05T00:00:00Z' }, { lastSeenAt: '2026-09-06T00:00:00Z' }]) {
    const heads = { preview: { gitBranch: 'codex/done', head: 'approved-sha', firstSeenAt: '2026-09-03T00:00:00Z', lastSeenAt: '2026-09-05T11:00:00Z', ...change } };
    assert.equal(observeGitHead(heads, { branchId: 'preview', gitBranch: 'codex/done', head: 'approved-sha', now }), '2026-09-05T12:00:00.000Z');
  }
  const heads = { preview: { gitBranch: 'codex/done', head: 'approved-sha', firstSeenAt: '2026-09-03T00:00:00Z', lastSeenAt: '2026-09-05T11:00:00Z' } };
  assert.equal(observeGitHead(heads, { branchId: 'preview', gitBranch: 'codex/done', head: 'approved-sha', now }), '2026-09-03T00:00:00Z');
  assert.equal(observeGitHead(heads, { branchId: 'replacement', gitBranch: 'codex/done', head: 'approved-sha', now }), '2026-09-05T12:00:00.000Z');
  assert.equal(observeGitHead(heads, { branchId: 'preview', gitBranch: 'codex/done', head: null, now }), null);
  assert.equal(heads.preview, undefined);
});

test('recent previews are observed before the age gate so their safety window can start immediately', async () => {
  const heads = {};
  const git = { head: 'approved-sha', headCommittedAt: '2026-09-02T00:00:00Z', pulls: [] };
  const found = await candidates({ includeAbandoned: true, branches: [main, { ...preview, created_at: '2026-09-05T11:00:00Z' }], lookupGitBranch: async (gitBranch, branch) => ({ ...git, headUnchangedSince: observeGitHead(heads, { branchId: branch.id, gitBranch, head: git.head, now }) }) });
  assert.deepEqual(found, []);
  assert.equal(heads[preview.id].firstSeenAt, '2026-09-05T12:00:00.000Z');
});
