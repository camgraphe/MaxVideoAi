import assert from 'node:assert/strict';
import test from 'node:test';
import { assertModifyReleaseGit, assertModifyReleasePullRequest, modifyReleasePullRequestArguments } from '../frontend/scripts/_lib/modify-release-input';

const identity = { candidateCommit: 'a'.repeat(40), releaseBranch: 'codex/marketing-media' };
const main = 'b'.repeat(40);
function gitFixture(patch: Partial<{ status: string; head: string; origin: string; branch: string;
  remoteRelease: string; remoteMain: string; fetchedMain: string; containsMain: boolean }> = {}) {
  const state = { status: '', head: identity.candidateCommit, origin: 'https://github.com/camgraphe/MaxVideoAi.git',
    branch: '', remoteRelease: `${identity.candidateCommit}\trefs/heads/${identity.releaseBranch}`,
    remoteMain: `${main}\trefs/heads/main`, fetchedMain: main, containsMain: true, ...patch };
  const calls: string[][] = [];
  return { calls, read: (args: string[]) => {
    calls.push(args);
    switch (args.join(' ')) {
      case `check-ref-format refs/heads/${identity.releaseBranch}`: return '';
      case 'status --porcelain': return state.status;
      case 'rev-parse HEAD': return state.head;
      case 'remote get-url origin': return state.origin;
      case 'branch --show-current': return state.branch;
      case `ls-remote origin refs/heads/${identity.releaseBranch}`: return state.remoteRelease;
      case 'ls-remote origin refs/heads/main': return state.remoteMain;
      case 'rev-parse refs/remotes/origin/main': return state.fetchedMain;
      case `merge-base --is-ancestor ${main} ${identity.candidateCommit}`:
        if (!state.containsMain) throw new Error('Current main is not an ancestor');
        return '';
      default: throw new Error(`Unexpected Git command: ${args.join(' ')}`);
    }
  } };
}

test('Modify release accepts a clean detached checkout only for the explicit published branch and current main', () => {
  for (const branch of ['', identity.releaseBranch]) {
    const git = gitFixture({ branch });
    assert.doesNotThrow(() => assertModifyReleaseGit(identity, git.read));
    assert.ok(git.calls.some(args => args.join(' ') === `ls-remote origin refs/heads/${identity.releaseBranch}`));
    assert.ok(git.calls.some(args => args.join(' ') === 'ls-remote origin refs/heads/main'));
    assert.deepEqual(git.calls.at(-1), ['merge-base', '--is-ancestor', main, identity.candidateCommit]);
  }
});

test('Modify release rejects dirty, unpublished, mismatched or stale-main candidates', () => {
  for (const patch of [{ status: '?? unrelated-user-file.txt' }, { status: ' M frontend/file.ts' },
    { head: 'c'.repeat(40) }, { branch: 'codex/other' }, { origin: 'https://github.com/other/repository.git' },
    { remoteRelease: `${'c'.repeat(40)}\trefs/heads/${identity.releaseBranch}` }, { remoteRelease: '' },
    { remoteRelease: `${identity.candidateCommit}\trefs/heads/codex/other` },
    { remoteMain: '' }, { fetchedMain: 'c'.repeat(40) }, { containsMain: false }]) {
    assert.throws(() => assertModifyReleaseGit(identity, gitFixture(patch).read));
  }
  const git = gitFixture();
  assert.throws(() => assertModifyReleaseGit({ ...identity, releaseBranch: 'main' }, git.read), /explicit/i);
  assert.throws(() => assertModifyReleaseGit({ ...identity, releaseBranch: '' }, git.read), /explicit/i);
  assert.throws(() => assertModifyReleaseGit({ ...identity, candidateCommit: 'short' }, git.read), /explicit/i);
  assert.equal(git.calls.length, 0);
});

test('Modify apply binds an open PR in the explicit repository to its named branch, candidate and completed Quality CI', () => {
  const success = { name: 'Quality CI', status: 'COMPLETED', conclusion: 'SUCCESS' };
  const pr = { state: 'OPEN', headRefName: identity.releaseBranch, headRefOid: identity.candidateCommit,
    statusCheckRollup: [success] };
  assert.doesNotThrow(() => assertModifyReleasePullRequest(pr, identity));
  for (const patch of [{ state: 'MERGED' }, { state: 'CLOSED' }, { headRefName: 'codex/other' },
    { headRefOid: 'c'.repeat(40) }, { statusCheckRollup: [] }, { statusCheckRollup: null },
    { statusCheckRollup: [{ ...success, conclusion: 'FAILURE' }] },
    { statusCheckRollup: [{ ...success, status: 'IN_PROGRESS' }] },
    { statusCheckRollup: [success, { ...success, conclusion: 'FAILURE' }] },
    { statusCheckRollup: [{ ...success, name: 'Other check' }] }]) {
    assert.throws(() => assertModifyReleasePullRequest({ ...pr, ...patch }, identity), /open matching release PR/i);
  }
  assert.throws(() => assertModifyReleasePullRequest(null, identity));
  assert.deepEqual(modifyReleasePullRequestArguments('500'), ['pr', 'view', '500', '--repo', 'camgraphe/MaxVideoAi',
    '--json', 'state,headRefName,headRefOid,statusCheckRollup']);
  for (const invalid of ['', '0', '--help', 'https://github.com/other/repository/pull/500']) {
    assert.throws(() => modifyReleasePullRequestArguments(invalid), /pull request number/i);
  }
});
