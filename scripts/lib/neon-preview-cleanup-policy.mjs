const GRACE_MS = 24 * 60 * 60 * 1000;

export function observeGitHead(heads, { branchId, gitBranch, head, now = Date.now() }) {
  if (head === null) {
    delete heads[branchId];
    return null;
  }
  const previous = heads[branchId];
  const first = Date.parse(previous?.firstSeenAt);
  const last = Date.parse(previous?.lastSeenAt);
  const continuous = previous?.gitBranch === gitBranch && previous.head === head &&
    Number.isFinite(first) && Number.isFinite(last) && first <= last && last <= now && now - last <= 4 * 60 * 60 * 1000;
  const firstSeenAt = continuous ? previous.firstSeenAt : new Date(now).toISOString();
  heads[branchId] = { gitBranch, head, firstSeenAt, lastSeenAt: new Date(now).toISOString() };
  return firstSeenAt;
}

export async function findCompletedPreviewCandidates({ branches, endpoints, lookupGitBranch, now = Date.now(), archivedOnly = false, includeAbandoned = false }) {
  const primary = branches.find(branch => branch.default === true);
  if (!primary) throw new Error('Neon default branch could not be identified; refusing cleanup.');
  const parents = new Set(branches.map(branch => branch.parent_id).filter(Boolean));
  const candidates = [];
  for (const branch of branches) {
    if (branch.primary || branch.default || branch.protected || parents.has(branch.id)) continue;
    if (branch.creation_source !== 'vercel' || branch.parent_id !== primary.id) continue;
    if (!branch.name?.startsWith('preview/codex/')) continue;
    if (!['ready', 'archived'].includes(branch.current_state)) continue;
    if (archivedOnly && branch.current_state !== 'archived') continue;
    // Observe even recent/busy previews so the no-PR clock starts at discovery.
    const gitBranch = branch.name.slice('preview/'.length);
    const { head, headCommittedAt, headUnchangedSince, pulls } = await lookupGitBranch(gitBranch, branch);
    if (pulls.some(pull => pull.state === 'open')) continue;
    const created = Date.parse(branch.created_at);
    if (!Number.isFinite(created) || created > now - GRACE_MS) continue;
    const computes = endpoints.filter(endpoint => endpoint.branch_id === branch.id);
    if (computes.some(endpoint => endpoint.current_state !== 'idle' || !Number.isFinite(Date.parse(endpoint.last_active)) || Date.parse(endpoint.last_active) > now - GRACE_MS)) continue;

    const merged = pulls.some(pull => {
      const mergedAt = Date.parse(pull.merged_at);
      return pull.state === 'closed' && pull.base?.ref === 'main' &&
        Number.isFinite(mergedAt) && mergedAt >= created && mergedAt <= now - GRACE_MS &&
        typeof pull.head?.sha === 'string' && (head === null || head === pull.head.sha);
    });
    let abandoned = false;
    const committed = Date.parse(headCommittedAt);
    if (includeAbandoned && (head === null || (Number.isFinite(committed) && committed <= now - GRACE_MS))) {
      // Every PR must be old and closed; a later close or a changed head means ongoing work.
      const unchanged = Date.parse(headUnchangedSince);
      abandoned = pulls.length === 0 ? typeof head === 'string' && head.length > 0 && Number.isFinite(unchanged) && unchanged <= now - GRACE_MS : pulls.every(pull => {
        const closed = Date.parse(pull.closed_at);
        return pull.state === 'closed' && pull.merged_at === null && pull.base?.ref === 'main' &&
          Number.isFinite(closed) && closed >= created && closed <= now - GRACE_MS &&
          typeof pull.head?.sha === 'string' && (head === null || head === pull.head.sha);
      });
    }
    if (merged || abandoned) candidates.push({ ...branch, cleanupGitHead: head });
  }
  return candidates.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function createGitBranchLookup({ repository, token, fetchFn = fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') || !token) {
    throw new Error('Set GITHUB_REPOSITORY and GITHUB_TOKEN before deleting completed previews.');
  }
  const owner = repository.split('/')[0];
  async function get(resource, allowMissing = false) {
    const response = await fetchFn(`https://api.github.com/repos/${repository}/${resource}`, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (response.status === 404 && allowMissing) return null;
    if (!response.ok) throw new Error(`GitHub cleanup verification failed: HTTP ${response.status}`);
    return response.json();
  }
  return async gitBranch => {
    const ref = await get(`git/ref/heads/${encodeURIComponent(gitBranch)}`, true);
    if (ref !== null && typeof ref.object?.sha !== 'string') throw new Error('GitHub returned an invalid branch ref.');
    const head = ref?.object.sha ?? null;
    let headCommittedAt = null;
    if (head !== null) {
      const commit = await get(`git/commits/${encodeURIComponent(head)}`);
      if (commit?.sha !== head || typeof commit.committer?.date !== 'string' || !Number.isFinite(Date.parse(commit.committer.date))) {
        throw new Error('GitHub returned invalid head commit evidence; refusing cleanup.');
      }
      headCommittedAt = commit.committer.date;
    }
    const pulls = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ state: 'all', head: `${owner}:${gitBranch}`, per_page: '100', page: String(page) });
      const rows = await get(`pulls?${params}`);
      if (!Array.isArray(rows)) throw new Error('GitHub did not return a pull request list.');
      pulls.push(...rows);
      if (rows.length < 100) break;
    }
    return { head, headCommittedAt, pulls };
  };
}
