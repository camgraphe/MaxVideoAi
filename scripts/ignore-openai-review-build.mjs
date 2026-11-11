import { pathToFileURL } from 'node:url';
import { OPENAI_REVIEW } from './lib/openai-review-environment.mjs';

export function shouldIgnoreOpenaiReviewBuild(env) {
  const dedicatedProject = env.VERCEL_PROJECT_ID === OPENAI_REVIEW.projectId;
  const dedicatedBranch = env.VERCEL_GIT_COMMIT_REF === OPENAI_REVIEW.gitBranch;
  if (!dedicatedProject && !dedicatedBranch) return false;
  return !(dedicatedProject && dedicatedBranch
    && env.VERCEL_GIT_PROVIDER === 'github'
    && env.VERCEL_GIT_REPO_OWNER === OPENAI_REVIEW.gitOwner
    && env.VERCEL_GIT_REPO_SLUG === OPENAI_REVIEW.gitRepository);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ignore = shouldIgnoreOpenaiReviewBuild(process.env);
  console.log(ignore ? 'Ignore: this branch belongs only to its dedicated OpenAI review project.' : 'Continue build.');
  // Vercel's ignoreCommand convention is intentionally inverse to a test exit.
  process.exitCode = ignore ? 0 : 1;
}
