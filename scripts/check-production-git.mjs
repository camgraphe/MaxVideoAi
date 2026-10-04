import { pathToFileURL } from 'node:url';

export const PRODUCTION_PROJECT_ID = 'prj_CA8KpDAwYzihVJZyDNnEUrDszaMu';
export const STAGING_PROJECT_ID = 'prj_OsS8N2tQBAvjxnPO2rGDWbLJeReJ';

export function checkProductionGit(env) {
  if (env.VERCEL_ENV !== 'production') return 'Local/preview build: production Git gate not applicable.';
  // This separate, non-public project has its own immutable-HEAD deployment script.
  if (env.VERCEL_PROJECT_ID === STAGING_PROJECT_ID) return 'Dedicated MCP staging project: staging release policy applies.';
  const expected = {
    VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID,
    VERCEL_GIT_PROVIDER: 'github',
    VERCEL_GIT_REPO_OWNER: 'camgraphe',
    VERCEL_GIT_REPO_SLUG: 'MaxVideoAi',
    VERCEL_GIT_COMMIT_REF: 'main',
  };
  const invalid = Object.keys(expected).filter((key) => env[key] !== expected[key]);
  if (!/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '')) invalid.push('VERCEL_GIT_COMMIT_SHA');
  if (invalid.length) {
    throw new Error(`Production build refused: missing or unexpected Git provenance (${invalid.join(', ')}). Merge a validated GitHub PR to main; do not upload a local copy. See docs/deployment/github-vercel.md.`);
  }
  return `Production Git provenance OK: camgraphe/MaxVideoAi main ${env.VERCEL_GIT_COMMIT_SHA}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(checkProductionGit(process.env));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
