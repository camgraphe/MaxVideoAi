import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { reportTestPostgres, resolveTestPostgres } from './_lib/test-postgres-toolchain.mjs';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

// pnpm may preserve its passthrough separator before the runner's options.
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const options = {};
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (!['--suite', '--shard', '--plan'].includes(argument)) fail(`Unknown validation argument: ${argument}`);
  if (Object.hasOwn(options, argument)) fail(`Duplicate validation argument: ${argument}`);
  if (argument === '--plan') {
    options[argument] = true;
  } else {
    const value = args[++index];
    if (!value || value.startsWith('--')) fail(`Missing value for validation argument: ${argument}`);
    options[argument] = value;
  }
}
const suite = options['--suite'] ?? 'all';
const shard = options['--shard'] ?? null;
if (!['all', 'fast', 'integration', 'tariffs', 'studio', 'browser'].includes(suite)) {
  fail(`Unknown validation suite: ${suite}`);
}
if (shard !== null && (suite !== 'browser' || !['1/2', '2/2'].includes(shard))) {
  fail('Validation --shard requires --suite browser and exactly 1/2 or 2/2.');
}

const studioIntegration = [
  'tests/connected-studio-mcp-route-integration.test.ts',
  'tests/connected-studio-montage-browser-integration.test.ts',
  'tests/connected-studio-montage-http-integration.test.ts',
  'tests/connected-studio-route-integration.test.ts',
];

const allTests = readdirSync('tests', { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map((entry) => `tests/${entry.name}`)
  .sort();
const allTestSet = new Set(allTests);
for (const file of studioIntegration) {
  if (!allTestSet.has(file)) throw new Error(`Missing Studio integration test: ${file}`);
}
const isolatedSet = new Set(studioIntegration);
const standard = allTests.filter((file) => !isolatedSet.has(file));
const tariffs = [
  'tests/customer-tariff-initial-cutover-postgres.test.ts',
  'tests/local-customer-tariff-activation-postgres.test.ts',
];
for (const file of tariffs) {
  if (!allTestSet.has(file)) throw new Error(`Missing exhaustive tariff test: ${file}`);
}
const tariffSet = new Set(tariffs);
const browser = [
  'tests/connected-studio-montage-browser-integration.test.ts',
  // Shared fixtures also cover tests choosing a browser type before .launch().
  ...standard.filter(file => /\b(?:chromium|firefox|webkit)\s*\.\s*(?:launch|launchPersistentContext|executablePath)\s*\(|\bfrom\s*['"][^'"]*(?:studio-connected-browser-fixture|workspace-reference-browser-fixture|image-rail-browser-fixture)/.test(readFileSync(file, 'utf8'))),
];
const browserSet = new Set(browser);
// Named exceptions use executable version doubles or temporary APT text fixtures;
// neither regression installs validation tools or starts a real database/media tool.
const toolsFree = new Set(['tests/test-postgres-toolchain.test.ts', 'tests/ci-ubuntu-mirror.test.ts']);
// Include tests with older names that start PostgreSQL or encode/probe real media.
// New *-postgres tests are automatically excluded from the tools-free lane.
const integration = standard.filter(file => !toolsFree.has(file) && !tariffSet.has(file) && !browserSet.has(file) && (
  file.endsWith('-postgres.test.ts')
  || /\bfrom\s*['"][^'"]*(?:disposable-postgres|studio-integration-runtime|[\w-]+-postgres-fixture|external-fal-import\/evidence)|\binitdb\b|ffmpeg/.test(readFileSync(file, 'utf8'))
));
const integrationSet = new Set(integration);
const fast = standard.filter(file => !tariffSet.has(file) && !integrationSet.has(file) && !browserSet.has(file));
const studio = studioIntegration.filter(file => !browser.includes(file));
const suites = { fast, integration, tariffs, studio, browser };
const browserShards = {
  '1/2': browser.filter((_, index) => index % 2 === 0),
  '2/2': browser.filter((_, index) => index % 2 === 1),
};
const selectedFiles = suite === 'all' ? [...standard, ...studioIntegration] : shard ? browserShards[shard] : suites[suite];
// An empty explicit file list would make Node discover unrelated tests by default.
if (selectedFiles.length === 0) fail(`Empty validation selection: ${suite}${shard ? ` ${shard}` : ''}.`);

if (options['--plan']) {
  // The manifest exceeds a pipe's buffer; finish the write before exiting.
  writeFileSync(1, `${JSON.stringify({ standard, studioIntegration, ...suites, browserShards, selection: { suite, shard, files: selectedFiles } })}\n`);
  process.exit(0);
}

let testEnvironment = process.env;
if (suite !== 'fast') {
  try {
    const toolchain = resolveTestPostgres();
    testEnvironment = toolchain.env;
    reportTestPostgres(toolchain);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

function runTests(label, files, extraArgs = []) {
  process.stdout.write(`\n[validate] ${label} (${files.length} files)\n`);
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(command, [
    'exec',
    'tsx',
    '--tsconfig',
    'frontend/tsconfig.json',
    '--test',
    ...extraArgs,
    ...files,
  ], { stdio: 'inherit', env: testEnvironment });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (suite === 'all') {
  // Preserve complete local/premerge coverage and the original isolation order.
  runTests('standard suite', standard);
  runTests('isolated Studio integrations', studioIntegration, ['--test-concurrency=1']);
} else {
  runTests(`${suite} suite${shard ? ` ${shard}` : ''}`, selectedFiles, ['studio', 'browser'].includes(suite) ? ['--test-concurrency=1'] : []);
}
