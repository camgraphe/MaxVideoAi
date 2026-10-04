import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { PRODUCTION_PROJECT_ID } from './check-production-git.mjs';

export function deploymentRevision(deployment) {
  const meta = deployment.meta ?? {};
  // A Vercel redeploy of a Git deployment legitimately has source=cli.
  const gitSource = deployment.source === 'git' ||
    (deployment.source === 'cli' && meta.action === 'redeploy' && /^dpl_/.test(meta.originalDeploymentId ?? ''));
  if (!gitSource || deployment.projectId !== PRODUCTION_PROJECT_ID || deployment.readyState !== 'READY' ||
      deployment.target !== 'production' || meta.githubCommitOrg !== 'camgraphe' ||
      meta.githubCommitRepo !== 'MaxVideoAi' || meta.githubCommitRef !== 'main' ||
      !/^[a-f0-9]{40}$/.test(meta.githubCommitSha ?? '')) {
    throw new Error('Production has no verified GitHub-main deployment provenance; reconcile its exact source before merging or deploying.');
  }
  return meta.githubCommitSha;
}

export function checkAncestry(productionSha, mainSha, candidateSha, isAncestor) {
  if (!isAncestor(productionSha, mainSha)) throw new Error('Production revision is missing from GitHub main.');
  if (!isAncestor(mainSha, candidateSha)) throw new Error('Candidate does not include current GitHub main; update the isolated branch first.');
}

function main() {
  if (process.argv.length > 2) throw new Error('Usage: pnpm deployment:check (checks clean HEAD against both live domains and GitHub main)');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--untracked-files=all')) throw new Error('Use a clean, committed, isolated worktree.');
  const remote = git('remote', 'get-url', 'origin');
  if (!/^(https:\/\/github\.com\/|git@github\.com:)camgraphe\/MaxVideoAi(?:\.git)?$/.test(remote)) {
    throw new Error('Unexpected origin repository.');
  }
  const mainSha = git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0];
  if (!/^[a-f0-9]{40}$/.test(mainSha)) throw new Error('Cannot resolve GitHub main.');
  const candidateSha = git('rev-parse', 'HEAD');
  const api = (endpoint) => JSON.parse(execFileSync('npx', [
    '--yes', 'vercel@55.0.0', 'api', endpoint, '--scope', 'camgraphes-projects', '--raw',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 }));
  const isAncestor = (older, newer) => {
    try { git('merge-base', '--is-ancestor', older, newer); return true; }
    catch { return false; }
  };
  const records = ['maxvideoai.com', 'api.maxvideoai.com'].map((domain) => {
    const alias = api(`/v4/aliases/${domain}`);
    const id = alias.deploymentId ?? alias.deployment?.id;
    if (!/^dpl_[a-zA-Z0-9]+$/.test(id ?? '')) throw new Error(`Cannot resolve deployment for ${domain}.`);
    const deployment = api(`/v13/deployments/${id}`);
    const sha = deploymentRevision(deployment);
    checkAncestry(sha, mainSha, candidateSha, isAncestor);
    return { domain, deploymentId: id, sha, source: deployment.source };
  });
  if (records[0].deploymentId !== records[1].deploymentId) throw new Error('Website and API domains serve different deployments.');
  console.log(JSON.stringify({ status: 'aligned', mainSha, candidateSha, domains: records }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); }
  catch (error) {
    // Do not print CLI responses or environment values on authentication failures.
    console.error(error.status !== undefined ? 'Production alignment check failed while reading Git/Vercel. Check authentication and run git fetch origin main.' : error.message);
    process.exitCode = 1;
  }
}
