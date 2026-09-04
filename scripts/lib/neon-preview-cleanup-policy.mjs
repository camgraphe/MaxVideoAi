const GRACE_MS = 24 * 60 * 60 * 1000;

export async function findCompletedPreviewCandidates({ branches, endpoints, lookupGitBranch, now = Date.now(), archivedOnly = false }) {
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
    const created = Date.parse(branch.created_at);
    if (!Number.isFinite(created) || created > now - GRACE_MS) continue;
    const computes = endpoints.filter(endpoint => endpoint.branch_id === branch.id);
    if (computes.some(endpoint => endpoint.current_state !== 'idle' || !Number.isFinite(Date.parse(endpoint.last_active)) || Date.parse(endpoint.last_active) > now - GRACE_MS)) continue;

    const gitBranch = branch.name.slice('preview/'.length);
    const { head, pulls } = await lookupGitBranch(gitBranch);
    if (pulls.some(pull => pull.state === 'open')) continue;
    const merged = pulls.some(pull => {
      const mergedAt = Date.parse(pull.merged_at);
      return pull.state === 'closed' && pull.base?.ref === 'main' &&
        Number.isFinite(mergedAt) && mergedAt >= created && mergedAt <= now - GRACE_MS &&
        typeof pull.head?.sha === 'string' && (head === null || head === pull.head.sha);
    });
    if (merged) candidates.push(branch);
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
    const pulls = [];
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ state: 'all', head: `${owner}:${gitBranch}`, per_page: '100', page: String(page) });
      const rows = await get(`pulls?${params}`);
      if (!Array.isArray(rows)) throw new Error('GitHub did not return a pull request list.');
      pulls.push(...rows);
      if (rows.length < 100) break;
    }
    return { head: ref?.object.sha ?? null, pulls };
  };
}
