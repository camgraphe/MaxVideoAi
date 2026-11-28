import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateReleaseReadmeAssets } from '../scripts/check-github-assets.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

function headingOffset(readme: string, heading: string) {
  return readme.indexOf(`## ${heading}`);
}

test('the flagship README opens with Create, pricing and a published video', () => {
  const readme = read('README.md');
  const intro = readme.slice(0, headingOffset(readme, 'What does the MaxVideoAI workspace bring together?'));
  assert.match(intro, /^# MaxVideoAI\s*$/m);
  assert.match(intro, /pay-as-you-go, multi-model AI video generator/i);
  const create = intro.indexOf('[Create an AI video](https://maxvideoai.com/app?utm_source=github&utm_medium=repository&utm_campaign=maxvideoai_product&utm_content=hero_try)');
  const pricing = intro.indexOf('[See pricing](https://maxvideoai.com/pricing)');
  const film = intro.indexOf('https://maxvideoai.com/video/kling-4-character-reference-the-next-one');
  const hero = intro.indexOf('<img src="docs/media/campaign/pigment-stage.webp"');
  assert.ok(create >= 0 && create < pricing && pricing < film && film < hero);
  assert.match(intro, /<img src="docs\/media\/campaign\/pigment-stage\.webp"[^>]+data-asset-role="editorial"/);
  assert.match(intro, /\[Watch the 14-second MaxVideoAI walkthrough\]\(docs\/media\/campaign\/create-video-walkthrough\.mp4\)/);
  assert.doesNotMatch(intro, /<video|autoplay|pigment-(?:take|motion)/i);

  const walkthrough = readFileSync(path.join(repositoryRoot, 'docs/media/campaign/create-video-walkthrough.mp4'));
  assert.equal(walkthrough.toString('ascii', 4, 8), 'ftyp');
});

test('every local README destination resolves inside the repository', () => {
  const readme = read('README.md');
  const markdownDestinations = [...readme.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
  const htmlSources = [...readme.matchAll(/<(?:img|source)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const localDestinations = [...markdownDestinations, ...htmlSources]
    .filter((destination) => !/^(?:[a-z]+:|#)/i.test(destination));

  for (const destination of localDestinations) {
    const cleanPath = destination.replace(/[?#].*$/, '');
    assert.ok(existsSync(path.join(repositoryRoot, cleanPath)), `local README destination must exist: ${destination}`);
  }
});

test('every root README image meets the release placement requirements', async () => {
  const manifest = JSON.parse(read('docs/marketing/github-asset-manifest.json'));
  assert.deepEqual(await validateReleaseReadmeAssets(manifest, {
    repositoryRoot,
    readmePaths: [path.join(repositoryRoot, 'README.md')],
  }), []);
});

test('the flagship README tells the commercial story before contributor setup', () => {
  const readme = read('README.md');
  const orderedSections = [
    'What does the MaxVideoAI workspace bring together?',
    'What can you make with MaxVideoAI?',
    'How do you compare current AI video models?',
    'How do project pricing and approval work?',
    'What can you prepare before generation?',
    'How do references and continuity work?',
    'Which assistants, agents and automations can use MaxVideoAI?',
    'How is MaxVideoAI built?',
    'Local development',
    'Contributing, security, and license',
  ];

  let previous = -1;
  for (const section of orderedSections) {
    const current = headingOffset(readme, section);
    assert.ok(current > previous, `${section} must appear after the preceding commercial section`);
    previous = current;
  }

  assert.match(readme, /https:\/\/maxvideoai\.com\/models\?utm_source=github/);
  assert.match(readme, /https:\/\/maxvideoai\.com\/pay-as-you-go-ai-video-generator/);
  assert.match(readme, /https:\/\/maxvideoai\.com\/ai-video-engines\/wan-3-vs-wan-3-prime/);
  assert.match(readme, /https:\/\/chatgpt\.com\/plugins\/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058/);
  for (const host of ['claude', 'openclaw', 'n8n']) {
    assert.ok(readme.includes(`https://maxvideoai.com/integrations/${host}`), host);
  }
  assert.match(readme, /https:\/\/maxvideoai\.com\/mcp\?utm_source=github[^\s)]*plugin_callout/);
  assert.match(readme, /\[Plugin releases\]\(https:\/\/github\.com\/camgraphe\/maxvideoai-plugin\/releases\)/);
  assert.doesNotMatch(readme, /next source candidate|closed candidate/i);
  assert.doesNotMatch(readme, /first release lands|bootstrap-only|no tagged release/i);
  assert.doesNotMatch(readme, /\b\d+\s+(?:current\s+)?(?:AI\s+)?video models\b/i);
  assert.doesNotMatch(readme, /\b(?:camgraphe@|gmail\.com)\b/i);
});

test('the flagship README keeps a varied product story before the engineering depth', () => {
  const readme = read('README.md');
  const hero = readme.indexOf('docs/media/campaign/pigment-stage.webp');
  const proof = headingOffset(readme, 'Watch a video made with MaxVideoAI');
  const edit = headingOffset(readme, 'Turn a city car into a supercar');
  const engineering = headingOffset(readme, 'How is MaxVideoAI built?');
  assert.ok(hero >= 0 && hero < proof && proof < edit && edit < engineering);
  assert.ok(readme.indexOf('docs/media/campaign/city-car.webp', edit) > edit);
  assert.ok(readme.indexOf('docs/media/campaign/supercar.webp', edit) > edit);

  for (const technicalSignal of [
    'Next.js App Router',
    'React',
    'TypeScript',
    'Tailwind CSS',
    'Supabase Auth',
    'Neon Postgres',
    'Amazon S3',
    'Stripe',
    'remote Streamable HTTP MCP',
    'Playwright browser checks',
  ]) {
    assert.match(readme, new RegExp(technicalSignal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.ok(headingOffset(readme, 'How is MaxVideoAI built?') > headingOffset(readme, 'Which assistants, agents and automations can use MaxVideoAI?'));
});

test('developer setup and environment operations live in dedicated engineering guides', () => {
  const readme = read('README.md');
  const localDevelopmentPath = 'docs/engineering/local-development.md';
  const environmentReferencePath = 'docs/engineering/environment-reference.md';

  assert.ok(existsSync(path.join(repositoryRoot, localDevelopmentPath)));
  assert.ok(existsSync(path.join(repositoryRoot, environmentReferencePath)));
  assert.match(readme, new RegExp(localDevelopmentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(readme, new RegExp(environmentReferencePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const localDevelopment = read(localDevelopmentPath);
  for (const preservedInstruction of [
    'Node.js 22',
    'pnpm install',
    'pnpm dev',
    'mock-server.js',
    'http://127.0.0.1:3333',
    'docker compose up --build',
    'pnpm model:setup',
    'provider/execution definition',
    'content/models/{en,fr,es}/{slug}.json',
    'pnpm model:registry:generate',
    'pnpm engine:catalog',
    'pnpm model:generate:write',
    'pnpm model:registry:check',
    'pnpm db:migrate:neon',
    'npm run lint:exposure',
    'frontend/vercel.json',
    '/api/cron/fal-poll',
    'pnpm --dir frontend run sitemap:ping -- --sitemaps',
  ]) {
    assert.match(localDevelopment, new RegExp(preservedInstruction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(localDevelopment, /frontend\/src\/config\/falEngines\.ts|publishedModelSlugs/);
  assert.match(localDevelopment, /generated projections[\s\S]*must not be edited directly/i);

  const environmentReference = read(environmentReferencePath);
  assert.match(environmentReference, /frontend\/\.env\.local\.example/);
  for (const variable of [
    'FAL_KEY',
    'GOOGLE_VERTEX_PROJECT_ID',
    'GOOGLE_VERTEX_LYRIA_ENABLED',
    'NEXT_PUBLIC_SUPABASE_URL',
    'DATABASE_URL',
    'LEGAL_RECONSENT_MODE',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'GA4_MEASUREMENT_ID',
    'SLACK_BOT_TOKEN',
    'NEON_API_KEY',
    'VERCEL_TOKEN',
    'AWS_COST_EXPLORER_ACCESS_KEY_ID',
    'INFRA_COST_MONTHLY_WARNING_USD',
    'HEALTHCHECK_TOKEN',
  ]) {
    assert.match(environmentReference, new RegExp(`\\b${variable}\\b`));
  }
  assert.match(environmentReference, /Supabase is Auth only/i);
  assert.match(environmentReference, /Neon is the application Postgres database/i);
  assert.match(environmentReference, /Amazon S3 stores media bytes/i);
  assert.match(environmentReference, /GET `\/api\/health\/env`/);
});

test('operations documentation matches the current health and Fal cron route contracts', () => {
  const environmentReference = read('docs/engineering/environment-reference.md');
  const localDevelopment = read('docs/engineering/local-development.md');
  const envHealthSource = read('frontend/app/api/health/env/route.ts');
  const falHealthSource = read('frontend/app/api/health/fal/route.ts');
  const falCronSource = read('frontend/app/api/cron/fal-poll/route.ts');
  const opsAuthSource = read('frontend/src/server/ops-auth.ts');

  assert.match(opsAuthSource, /process\.env\.NODE_ENV === 'production' \|\| process\.env\.VERCEL === '1'/);
  assert.match(opsAuthSource, /HEALTHCHECK_TOKEN not configured'[\s\S]*status: 503/);
  assert.match(opsAuthSource, /error: 'UNAUTHORIZED'[\s\S]*status: 401/);
  assert.match(environmentReference, /if `HEALTHCHECK_TOKEN` is not configured[\s\S]*`503`[\s\S]*Once configured[\s\S]*`401`/i);

  assert.match(envHealthSource, /export const runtime = 'nodejs'/);
  for (const requiredKey of [
    'FAL_KEY',
    'FAL_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'DATABASE_URL',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
  ]) {
    assert.match(envHealthSource, new RegExp(`['"]${requiredKey}['"]`));
    assert.match(environmentReference, new RegExp(`\\b${requiredKey}\\b`));
  }
  assert.match(environmentReference, /GET `\/api\/health\/env` — Node\.js runtime[\s\S]*boolean presence map/i);

  assert.match(falHealthSource, /export const runtime = 'nodejs'/);
  assert.match(falHealthSource, /ENV\.FAL_API_KEY/);
  assert.match(falHealthSource, /fal_credentials_missing[\s\S]*status: 503/);
  assert.doesNotMatch(falHealthSource, /fetch\(|OPTIONS/);
  assert.match(environmentReference, /GET `\/api\/health\/fal` — Node\.js runtime[\s\S]*normalized `FAL_KEY` \/ `FAL_API_KEY` alias[\s\S]*`503`[\s\S]*does not call Fal/i);
  assert.doesNotMatch(environmentReference, /Edge runtime|OPTIONS call through the Fal proxy/i);

  assert.match(falCronSource, /export const runtime = 'nodejs'/);
  assert.match(falCronSource, /authorizeCronRequest/);
  assert.match(falCronSource, /return await runFalPoll\(\)/);
  assert.match(falCronSource, /export async function GET/);
  assert.match(falCronSource, /export async function POST/);
  assert.match(localDevelopment, /`\/api\/cron\/fal-poll` is a Node\.js route[\s\S]*GET and POST[\s\S]*calls `runFalPoll` directly/i);
  assert.match(localDevelopment, /Bearer `CRON_SECRET`[\s\S]*`x-vercel-cron`[\s\S]*`vercel-cron\/1\.0`/i);
  assert.match(localDevelopment, /deployment ID mismatch is rejected/i);
  assert.doesNotMatch(localDevelopment, /`\/api\/cron\/fal-poll` forwards|injects `X-Fal-Poll-Token`/i);

  assert.match(localDevelopment, /frontend\/app\/\(core\)\/billing\/_hooks\/useBillingTopupAnalytics\.ts/);
  assert.doesNotMatch(localDevelopment, /frontend\/app\/\(core\)\/billing\/page\.tsx/);
});

test('package scripts expose the production README content check', () => {
  const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

  assert.equal(
    packageJson.scripts?.['github:content:check'],
    'node scripts/check-github-content.mjs README.md plugins/maxvideoai/README.md',
  );
});
