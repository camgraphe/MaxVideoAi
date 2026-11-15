import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { checkProductionGit, PRODUCTION_PROJECT_ID } from '../scripts/check-production-git.mjs';
import { shouldIgnoreOpenaiReviewBuild } from '../scripts/ignore-openai-review-build.mjs';

// Independently authored expected resources: a wrong config edit must not silently
// update both the guard and the expected destination in these tests.
const env = {
  VERCEL_PROJECT_ID: 'prj_UCIR8ODoPEK3bLF30ID94gvyDs5C', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production',
  VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_REPO_OWNER: 'camgraphe', VERCEL_GIT_REPO_SLUG: 'MaxVideoAi',
  VERCEL_GIT_COMMIT_REF: 'codex/openai-directory-20261111', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: 'dedicated-qualification',
  MCP_API_HOST: 'openai-review.maxvideoai.com', MCP_RESOURCE_URL: 'https://openai-review.maxvideoai.com/mcp',
  NEXT_PUBLIC_SITE_URL: 'https://openai-review.maxvideoai.com', SUPABASE_SITE_URL: 'https://openai-review.maxvideoai.com',
  NEXT_PUBLIC_SUPABASE_URL: 'https://ajwofjldwawdwtioekuc.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-publishable-key', SUPABASE_SERVICE_ROLE_KEY: 'test-secret-key',
  DATABASE_URL: 'postgresql://test:test@ep-orange-lake-b2yfb7ss.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  S3_BUCKET: 'maxvideoai-openai-review-20261008-5c187a87', S3_REGION: 'eu-central-1',
  S3_ACCESS_KEY_ID: 'test-access-key', S3_SECRET_ACCESS_KEY: 'test-storage-secret',
  OPENAI_ADS_CONVERSIONS_DISABLED: '1',
};

test('dedicated build accepts only its complete Git and resource configuration, with direct or pooled Neon', () => {
  assert.match(checkProductionGit(env), /OpenAI review Git\/runtime configuration OK/);
  assert.doesNotThrow(() => checkProductionGit({ ...env, DATABASE_URL: env.DATABASE_URL.replace('b2yfb7ss.', 'b2yfb7ss-pooler.') }));
  assert.doesNotThrow(() => checkProductionGit({ ...env, STRIPE_SECRET_KEY: 'sk_test_fixture', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture' }));
  for (const key of Object.keys(env)) {
    assert.throws(() => checkProductionGit({ ...env, [key]: '' }), /refused/, key);
  }
});

test('wrong project, normal resource, shared cookie domain and live integrations cannot pass the dedicated build', () => {
  const patches = [
    { VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID }, { VERCEL_ENV: 'preview' }, { VERCEL_TARGET_ENV: 'preview' },
    { VERCEL_GIT_COMMIT_REF: 'main' }, { VERCEL_GIT_REPO_SLUG: 'foreign' },
    { MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: 'shared-production' },
    { MCP_RESOURCE_URL: 'https://api.maxvideoai.com/mcp' }, { MCP_API_HOST: 'api.maxvideoai.com' },
    { NEXT_PUBLIC_SITE_URL: 'https://maxvideoai.com' }, { SUPABASE_SITE_URL: 'https://maxvideoai.com' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://normal.supabase.co' },
    { S3_BUCKET: 'normal-media' }, { S3_REGION: 'us-east-1' }, { S3_PUBLIC_BASE_URL: 'https://media.maxvideoai.com' },
    { COOKIE_DOMAIN: '.maxvideoai.com' }, { NEXT_PUBLIC_COOKIE_DOMAIN: '.maxvideoai.com' },
    { STRIPE_SECRET_KEY: 'sk_live_fixture' }, { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_fixture' },
    { STRIPE_WEBHOOK_SECRET: 'whsec_without_test_mode' }, { SLACK_WEBHOOK_URL: 'https://example.test' },
    { GA4_API_SECRET: 'test-secret' }, { BREVO_SMTP_PASSWORD: 'test-password' },
    { OPENAI_ADS_CONVERSIONS_DISABLED: '0' },
    { OPENAI_ADS_PIXEL_ID: 'normal-pixel' }, { OPENAI_ADS_CONVERSIONS_KEY: 'test-ads-key' },
  ];
  for (const patch of patches) assert.throws(() => checkProductionGit({ ...env, ...patch }), /OpenAI review build refused/, JSON.stringify(Object.keys(patch)));
  // If Vercel bypasses the ignored-build step, prebuild still rejects this branch
  // on the usual Preview project, even without the dedicated profile variable.
  assert.throws(() => checkProductionGit({
    VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID, VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: env.VERCEL_GIT_COMMIT_REF,
  }), /OpenAI review build refused/);
});

test('database identity and TLS cannot be overridden through URL authority or query parameters; diagnostics omit secrets', () => {
  const invalidUrls = [
    env.DATABASE_URL.replace('ep-orange-lake-b2yfb7ss.', 'normal.'),
    env.DATABASE_URL.replace('.neon.tech', '.neon.tech.attacker.test'),
    env.DATABASE_URL.replace('sslmode=require', 'sslmode=disable'),
    `${env.DATABASE_URL}&sslmode=disable`, `${env.DATABASE_URL}&host=normal.example`,
    `${env.DATABASE_URL}&hostaddr=127.0.0.1`, `${env.DATABASE_URL}#fragment`,
    'postgresql://sensitive-password@normal.example/db?sslmode=require',
  ];
  for (const DATABASE_URL of invalidUrls) {
    assert.throws(() => checkProductionGit({ ...env, DATABASE_URL }), error => {
      assert.ok(error instanceof Error); assert.match(error.message, /DATABASE_URL/);
      assert.doesNotMatch(error.message, /sensitive-password|postgresql:|normal\.example/); return true;
    });
  }
});

test('review branch is ignored on every other project; unrelated branch builds retain their existing path', () => {
  assert.equal(shouldIgnoreOpenaiReviewBuild(env), false);
  for (const VERCEL_PROJECT_ID of [PRODUCTION_PROJECT_ID, '', 'unknown-project']) {
    assert.equal(shouldIgnoreOpenaiReviewBuild({ ...env, VERCEL_PROJECT_ID }), true);
  }
  assert.equal(shouldIgnoreOpenaiReviewBuild({ ...env, VERCEL_GIT_COMMIT_REF: 'main' }), true);
  assert.equal(shouldIgnoreOpenaiReviewBuild({ ...env, VERCEL_GIT_REPO_SLUG: 'foreign' }), true);
  assert.equal(shouldIgnoreOpenaiReviewBuild({ VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID, VERCEL_GIT_COMMIT_REF: 'main' }), false);
  assert.equal(shouldIgnoreOpenaiReviewBuild({ VERCEL_PROJECT_ID: PRODUCTION_PROJECT_ID, VERCEL_GIT_COMMIT_REF: 'codex/unrelated' }), false);
});

test('Vercel executes the ignore command with the correct inverted exit convention', () => {
  const config = JSON.parse(readFileSync('frontend/vercel.json', 'utf8'));
  assert.equal(config.ignoreCommand, 'node ../scripts/ignore-openai-review-build.mjs');
  for (const [VERCEL_PROJECT_ID, expectedStatus] of [[PRODUCTION_PROJECT_ID, 0], [env.VERCEL_PROJECT_ID, 1]] as const) {
    const result = spawnSync(process.execPath, ['../scripts/ignore-openai-review-build.mjs'], {
      cwd: 'frontend', env: { ...env, VERCEL_PROJECT_ID }, encoding: 'utf8',
    });
    assert.equal(result.status, expectedStatus, result.stderr);
  }
});
