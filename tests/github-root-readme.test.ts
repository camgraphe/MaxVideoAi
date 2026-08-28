import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

function headingOffset(readme: string, heading: string) {
  return readme.indexOf(`## ${heading}`);
}

test('the flagship README opens with the product outcome, three destinations, and current proof', () => {
  const readme = read('README.md');
  const opening = readme.split(/\r?\n/).slice(0, 60).join('\n');
  const manifest = JSON.parse(read('docs/marketing/github-asset-manifest.json')) as {
    assets: Array<{ path: string; kind: string; state: string; placements: string[] }>;
  };
  const openingImages = [...opening.matchAll(/!\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  const approvedProductProof = openingImages.some((imagePath) => {
    const record = manifest.assets.find((asset) => asset.path === imagePath);
    return record?.kind === 'product_proof'
      && record.state === 'publishable_proof'
      && record.placements.includes('root_readme');
  });

  assert.match(readme, /^# MaxVideoAI\s*$/m);
  assert.doesNotMatch(opening, /Generate Page Mock & Frontend/i);
  assert.match(opening, /multi-model AI video production/i);
  const trackedDestinations = [
    '[Plan a video with MaxVideoAI](https://maxvideoai.com/mcp?utm_source=github&utm_medium=repository&utm_campaign=maxvideoai_product&utm_content=hero_try)',
    '[Compare current models](https://maxvideoai.com/models?utm_source=github&utm_medium=repository&utm_campaign=maxvideoai_product&utm_content=models)',
    '[Use MaxVideoAI from Claude, ChatGPT or Codex](https://maxvideoai.com/mcp?utm_source=github&utm_medium=repository&utm_campaign=maxvideoai_product&utm_content=plugin_callout)',
  ];
  let previousDestination = -1;
  for (const destination of trackedDestinations) {
    const currentDestination = opening.indexOf(destination);
    assert.ok(currentDestination > previousDestination, `${destination} must appear in the reviewed opening order`);
    previousDestination = currentDestination;
  }
  assert.doesNotMatch(opening, /\[Try MaxVideoAI\]\(https:\/\/maxvideoai\.com\/app\)/);
  assert.doesNotMatch(opening, /\[Explore models\]\(https:\/\/maxvideoai\.com\/models\)/);
  assert.match(opening, /\[Plugin repository\]\(https:\/\/github\.com\/camgraphe\/maxvideoai-plugin\)/);
  assert.match(opening, /\[Latest public release: v0\.3\.1\]\(https:\/\/github\.com\/camgraphe\/maxvideoai-plugin\/releases\/tag\/v0\.3\.1\)/);
  assert.doesNotMatch(opening, /\[Use[^\]]*ChatGPT[^\]]*\]\(https:\/\/github\.com\/camgraphe\/maxvideoai-plugin\)/i);
  assert.doesNotMatch(opening, /release pending/i);
  assert.match(opening, /<img src="plugins\/maxvideoai\/assets\/logo-mark\.svg"[^>]+>/);
  assert.doesNotMatch(opening, /logo-wordmark\.svg/);
  assert.ok(approvedProductProof, 'the first 60 lines must include manifest-approved current product proof');
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

test('every root README image is approved for root placement', () => {
  const readme = read('README.md');
  const manifest = JSON.parse(read('docs/marketing/github-asset-manifest.json')) as {
    assets: Array<{ path: string; state: string; placements: string[] }>;
  };
  const htmlSources = [...readme.matchAll(/<(?:img|source)\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const imagePaths = [
    ...[...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]),
    ...htmlSources,
  ].filter((destination) => !/^(?:[a-z]+:|#)/i.test(destination));
  for (const imagePath of imagePaths) {
    const record = manifest.assets.find((asset) => asset.path === imagePath);
    assert.equal(record?.state, 'publishable_proof', `README image must be publishable: ${imagePath}`);
    assert.ok(record?.placements.includes('root_readme'), `README image must approve root_readme placement: ${imagePath}`);
  }
});

test('the flagship README tells the commercial story before contributor setup', () => {
  const readme = read('README.md');
  const orderedSections = [
    'What does the MaxVideoAI workspace bring together?',
    'What can you make with MaxVideoAI?',
    'How do you compare current AI video models?',
    'How do project pricing and approval work?',
    'How do references and continuity work?',
    'Can Claude, ChatGPT or Codex use MaxVideoAI?',
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

  assert.match(readme, /Sora[\s\S]*Veo[\s\S]*Kling[\s\S]*Seedance[\s\S]*LTX/i);
  assert.match(readme, /current availability and pricing/i);
  assert.match(readme, /three equal entry points[\s\S]*Claude connector or plugin[\s\S]*ChatGPT app\/plugin[\s\S]*Codex plugin/i);
  assert.match(readme, /current public plugin releases[\s\S]*v0\.3\.0[\s\S]*v0\.3\.1/i);
  assert.match(readme, /0\.3\.2 package remains the next source candidate until its release gates are complete/i);
  assert.doesNotMatch(readme, /first release lands|bootstrap-only|no tagged release/i);
  assert.doesNotMatch(readme, /\b\d+\s+(?:current\s+)?(?:AI\s+)?video models\b/i);
  assert.doesNotMatch(readme, /\b(?:camgraphe@|gmail\.com)\b/i);
});

test('the flagship README keeps a varied product story before the engineering depth', () => {
  const readme = read('README.md');
  const expectedVisuals = [
    'maxvideoai-github-hero-v2.webp',
    'maxvideoai-workspace-live.webp',
    'maxvideoai-examples-gallery-live.webp',
    'maxvideoai-engine-scoreboard-live.webp',
    'maxvideoai-model-directory-live.webp',
    'maxvideoai-pricing-comparison-live.webp',
    'maxvideoai-library-continuity-production.jpg',
    'maxvideoai-assistant-workflow-live.webp',
  ];
  const positions = expectedVisuals.map((visual) => {
    const position = readme.indexOf(visual);
    assert.ok(position >= 0, `${visual} must appear in the flagship README`);
    return position;
  });
  assert.equal(new Set(expectedVisuals).size, expectedVisuals.length);
  assert.deepEqual([...positions].sort((left, right) => left - right), positions, 'visuals must follow the reviewed product journey');

  for (const technicalSignal of [
    'Next.js App Router',
    'React',
    'TypeScript',
    'Tailwind CSS',
    'Supabase Auth',
    'Neon Postgres',
    'Amazon S3',
    'Stripe',
    'Remote Streamable HTTP MCP',
    'Playwright browser checks',
  ]) {
    assert.match(readme, new RegExp(technicalSignal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.ok(headingOffset(readme, 'How is MaxVideoAI built?') > headingOffset(readme, 'Can Claude, ChatGPT or Codex use MaxVideoAI?'));
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
