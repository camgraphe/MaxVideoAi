import { MODIFY_TARIFF_POLICY, MODIFY_TARIFF_SCOPE } from '@/server/pricing/modify-tariff-policy';

export type ModifyReleaseIdentity = { actorId: string; candidateCommit: string; databaseIdentity: string; releaseBranch: string };
export type ModifyReleaseReview = ModifyReleaseIdentity & {
  policy: string; fingerprint: string; sourceRevision: number; insertedCells: number;
  scope: typeof MODIFY_TARIFF_SCOPE; existingPricesChanged: false;
};
export function assertModifyReleaseReview(value: unknown, identity: ModifyReleaseIdentity,
  currentProposal?: unknown): asserts value is ModifyReleaseReview {
  const review = value as Partial<ModifyReleaseReview> | null;
  if (!review || review.actorId !== identity.actorId || review.candidateCommit !== identity.candidateCommit
    || review.databaseIdentity !== identity.databaseIdentity || review.releaseBranch !== identity.releaseBranch
    || review.policy !== MODIFY_TARIFF_POLICY
    || !/^[0-9a-f]{64}$/.test(review.fingerprint ?? '') || !Number.isSafeInteger(review.sourceRevision)
    || review.sourceRevision! < 0 || review.insertedCells !== 49 || review.existingPricesChanged !== false
    || JSON.stringify(review.scope) !== JSON.stringify(MODIFY_TARIFF_SCOPE)
    || (currentProposal !== undefined && JSON.stringify(value) !== JSON.stringify(currentProposal))) {
    throw new Error('The reviewed Modify release identity or scope does not match.');
  }
}

type GitIdentity = Pick<ModifyReleaseIdentity, 'candidateCommit' | 'releaseBranch'>;
type GitReader = (arguments_: string[]) => string;

/** A detached maintenance checkout is valid only for this exact clean, published candidate. */
export function assertModifyReleaseGit(identity: GitIdentity, git: GitReader): void {
  if (!/^[0-9a-f]{40}$/.test(identity.candidateCommit) || !identity.releaseBranch.startsWith('codex/')) {
    throw new Error('An explicit committed candidate and codex release branch are required.');
  }
  git(['check-ref-format', `refs/heads/${identity.releaseBranch}`]);
  if (git(['status', '--porcelain']) || git(['rev-parse', 'HEAD']) !== identity.candidateCommit) {
    throw new Error('A clean exact committed candidate is required.');
  }
  if (!['https://github.com/camgraphe/MaxVideoAi', 'https://github.com/camgraphe/MaxVideoAi.git',
    'git@github.com:camgraphe/MaxVideoAi.git'].includes(git(['remote', 'get-url', 'origin']))) {
    throw new Error('Unexpected release repository.');
  }
  const checkedOutBranch = git(['branch', '--show-current']);
  if (checkedOutBranch && checkedOutBranch !== identity.releaseBranch) {
    throw new Error('The checkout must be detached or use the explicitly selected release branch.');
  }
  const remoteHead = (branch: string) => {
    const ref = `refs/heads/${branch}`;
    const parts = git(['ls-remote', 'origin', ref]).split(/\s+/);
    if (parts.length !== 2 || !/^[0-9a-f]{40}$/.test(parts[0] ?? '') || parts[1] !== ref) {
      throw new Error('The exact remote release reference is unavailable.');
    }
    return parts[0]!;
  };
  if (remoteHead(identity.releaseBranch) !== identity.candidateCommit) {
    throw new Error('The exact candidate must be published on its selected release branch.');
  }
  const currentMain = remoteHead('main');
  if (git(['rev-parse', 'refs/remotes/origin/main']) !== currentMain) {
    throw new Error('Fetch current origin/main before reviewing this release.');
  }
  git(['merge-base', '--is-ancestor', currentMain, identity.candidateCommit]);
}

export function modifyReleasePullRequestArguments(pr: string): string[] {
  if (!/^[1-9]\d*$/.test(pr)) throw new Error('An explicit repository pull request number is required.');
  return ['pr', 'view', pr, '--repo', 'camgraphe/MaxVideoAi', '--json', 'state,headRefName,headRefOid,statusCheckRollup'];
}

export function assertModifyReleasePullRequest(value: unknown, identity: GitIdentity): void {
  const pr = value as { state?: unknown; headRefName?: unknown; headRefOid?: unknown; statusCheckRollup?: unknown } | null;
  const checks = Array.isArray(pr?.statusCheckRollup) ? pr.statusCheckRollup.filter((check: unknown) =>
    check && typeof check === 'object' && (check as { name?: unknown }).name === 'Quality CI') : [];
  if (pr?.state !== 'OPEN' || pr.headRefName !== identity.releaseBranch || pr.headRefOid !== identity.candidateCommit
    || !checks.length || checks.some(check => check.status !== 'COMPLETED' || check.conclusion !== 'SUCCESS')) {
    throw new Error('An open matching release PR with successful Quality CI on the exact candidate is required.');
  }
}
