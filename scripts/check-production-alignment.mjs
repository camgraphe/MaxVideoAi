import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { PRODUCTION_PROJECT_ID } from './check-production-git.mjs';

export function deploymentRevision(deployment) {
  const meta = deployment.meta ?? {};
  // Vercel reports redeploys as source=redeploy, or source=cli with legacy action metadata.
  const identifiedRedeploy = /^dpl_[a-zA-Z0-9]+$/.test(meta.originalDeploymentId ?? '') &&
    (deployment.source === 'redeploy' || (deployment.source === 'cli' && meta.action === 'redeploy'));
  const gitSource = deployment.source === 'git' || identifiedRedeploy;
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

export function previewDeploymentRevision(deployment, candidateSha) {
  const meta = deployment.meta ?? {};
  if (deployment.source !== 'git' || deployment.projectId !== PRODUCTION_PROJECT_ID ||
      deployment.readyState !== 'READY' || deployment.target === 'production' ||
      meta.githubCommitOrg !== 'camgraphe' || meta.githubCommitRepo !== 'MaxVideoAi' ||
      !meta.githubCommitRef || !/^[a-f0-9]{40}$/.test(candidateSha) || meta.githubCommitSha !== candidateSha) {
    throw new Error('Readiness must be checked on the exact READY Git Preview of this candidate.');
  }
  return meta.githubCommitSha;
}

export function assertPreviewModelAdmissionParity(production, preview) {
  const modelId = 'seedance-2-5';
  const read = (catalogue, label) => {
    if (catalogue?.ok !== true || catalogue.degraded || !Array.isArray(catalogue.engines)) {
      throw new Error(`${label} catalogue is unavailable or degraded.`);
    }
    const engine = catalogue.engines.find(entry => entry.id === modelId);
    if (!engine || !Array.isArray(engine.modes) || !engine.modes.length ||
        new Set(engine.modes).size !== engine.modes.length || engine.modes.some(mode =>
          typeof mode !== 'string' || typeof engine.modeAvailability?.[mode]?.available !== 'boolean')) {
      throw new Error(`${label} readiness is incomplete for ${modelId}.`);
    }
    return engine;
  };
  const current = read(production, 'Production'), candidate = read(preview, 'Preview');
  if (current.modes.length !== candidate.modes.length || current.modes.some(mode => !candidate.modes.includes(mode))) {
    throw new Error(`Preview modes differ for ${modelId}.`);
  }
  const modes = current.modes.map(mode => {
    const live = current.modeAvailability[mode], next = candidate.modeAvailability[mode];
    if (live.available !== next.available) throw new Error(`Preview admission differs for ${modelId}/${mode}.`);
    return { mode, available: next.available, productionReason: live.reason, previewReason: next.reason };
  });
  return { modelId, modes };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--preview')) {
    throw new Error('Usage: pnpm deployment:check [--preview https://exact-deployment.vercel.app]');
  }
  const previewUrl = args.length ? new URL(args[1]) : null;
  if (previewUrl && (previewUrl.protocol !== 'https:' || !previewUrl.hostname.endsWith('.vercel.app') ||
      previewUrl.username || previewUrl.password || previewUrl.port || previewUrl.pathname !== '/' || previewUrl.search || previewUrl.hash)) {
    throw new Error('Preview must be an HTTPS Vercel deployment origin without credentials, path or query.');
  }
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
  let preview;
  if (previewUrl) {
    const deployment = api(`/v13/deployments/${previewUrl.hostname}`);
    const sha = previewDeploymentRevision(deployment, candidateSha);
    const readCatalogue = (url) => JSON.parse(execFileSync('npx', [
      '--yes', 'vercel@55.0.0', 'curl', '/api/engines', '--deployment', url,
      '--scope', 'camgraphes-projects', '--', '--silent', '--show-error', '--fail', '--max-time', '20',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024, timeout: 60000 }));
    const parity = assertPreviewModelAdmissionParity(readCatalogue('https://maxvideoai.com'), readCatalogue(previewUrl.origin));
    preview = { url: previewUrl.origin, deploymentId: deployment.id, sha, ...parity };
  }
  console.log(JSON.stringify({ status: 'aligned', mainSha, candidateSha, domains: records, ...(preview ? { preview } : {}) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); }
  catch (error) {
    // Do not print CLI responses or environment values on authentication failures.
    console.error(error.status !== undefined ? 'Production alignment check failed while reading Git/Vercel. Check authentication and run git fetch origin main.' : error.message);
    process.exitCode = 1;
  }
}
