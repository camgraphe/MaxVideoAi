import { readFileSync } from 'node:fs';

export const OPENAI_REVIEW = Object.freeze(JSON.parse(readFileSync(
  new URL('../../frontend/config/openai-review-environment.json', import.meta.url), 'utf8',
)));

// Configuration checks only: no network, database connection, secret retrieval or
// credential verification. Actual permissions and costs need separate evidence.
export function checkOpenaiReviewEnvironment(env) {
  const expected = {
    VERCEL_PROJECT_ID: OPENAI_REVIEW.projectId,
    VERCEL_ENV: 'production',
    VERCEL_TARGET_ENV: 'production',
    VERCEL_GIT_PROVIDER: 'github',
    VERCEL_GIT_REPO_OWNER: OPENAI_REVIEW.gitOwner,
    VERCEL_GIT_REPO_SLUG: OPENAI_REVIEW.gitRepository,
    VERCEL_GIT_COMMIT_REF: OPENAI_REVIEW.gitBranch,
    MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: OPENAI_REVIEW.profile,
    MCP_API_HOST: new URL(OPENAI_REVIEW.primaryOrigin).host,
    MCP_RESOURCE_URL: `${OPENAI_REVIEW.primaryOrigin}/mcp`,
    NEXT_PUBLIC_SITE_URL: OPENAI_REVIEW.primaryOrigin,
    SUPABASE_SITE_URL: OPENAI_REVIEW.primaryOrigin,
    NEXT_PUBLIC_SUPABASE_URL: OPENAI_REVIEW.supabaseUrl,
    S3_BUCKET: OPENAI_REVIEW.storageBucket,
    S3_REGION: OPENAI_REVIEW.storageRegion,
    OPENAI_ADS_CONVERSIONS_DISABLED: '1',
  };
  const invalid = Object.keys(expected).filter(key => env[key] !== expected[key]);
  if (!/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? '')) invalid.push('VERCEL_GIT_COMMIT_SHA');
  for (const key of ['COOKIE_DOMAIN', 'NEXT_PUBLIC_COOKIE_DOMAIN']) {
    if (env[key]) invalid.push(key);
  }
  for (const key of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
    if (!env[key]?.trim()) invalid.push(key);
  }
  try {
    const database = new URL(env.DATABASE_URL ?? '');
    if (!['postgres:', 'postgresql:'].includes(database.protocol)
      || !OPENAI_REVIEW.databaseHosts.includes(database.hostname)
      || (database.port && database.port !== '5432')
      || !database.username || !database.password || database.pathname.length < 2
      || database.hash || database.searchParams.get('sslmode') !== 'require'
      || [...database.searchParams.keys()].some(key =>
        !['sslmode', 'channel_binding', 'application_name', 'connect_timeout'].includes(key)
        || database.searchParams.getAll(key).length !== 1)) {
      invalid.push('DATABASE_URL');
    }
  } catch {
    invalid.push('DATABASE_URL');
  }
  if (env.S3_PUBLIC_BASE_URL) {
    const allowed = [
      `https://${OPENAI_REVIEW.storageBucket}.s3.${OPENAI_REVIEW.storageRegion}.amazonaws.com`,
      `https://${OPENAI_REVIEW.storageBucket}.s3.amazonaws.com`,
    ];
    if (!allowed.includes(env.S3_PUBLIC_BASE_URL.replace(/\/$/, ''))) invalid.push('S3_PUBLIC_BASE_URL');
  }
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith('sk_test_')) invalid.push('STRIPE_SECRET_KEY');
  if (env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && !env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')) {
    invalid.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  }
  if (env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) invalid.push('STRIPE_WEBHOOK_SECRET');
  for (const key of ['SLACK_WEBHOOK_URL', 'GA4_API_SECRET', 'GA4_MEASUREMENT_ID', 'NEXT_PUBLIC_CLARITY_ID',
    'BREVO_SMTP_USERNAME', 'BREVO_SMTP_PASSWORD', 'OPENAI_ADS_PIXEL_ID', 'OPENAI_ADS_CONVERSIONS_KEY']) {
    if (env[key]) invalid.push(key);
  }
  if (invalid.length) {
    // Never include supplied values: connection strings and keys may be secrets.
    throw new Error(`OpenAI review build refused: invalid dedicated bindings (${[...new Set(invalid)].join(', ')}).`);
  }
  return `OpenAI review Git/runtime configuration OK: ${OPENAI_REVIEW.gitBranch} ${env.VERCEL_GIT_COMMIT_SHA}`;
}
