import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { reportTestPostgres, resolveTestPostgres } from './_lib/test-postgres-toolchain.mjs';

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
  ...standard.filter(file => /\b(?:chromium|firefox|webkit)\s*\.\s*(?:launch|launchPersistentContext|executablePath)\s*\(|\bfrom\s*['"][^'"]*studio-connected-browser-fixture/.test(readFileSync(file, 'utf8'))),
];
const browserSet = new Set(browser);
// This regression uses executable version doubles and needs no installed database.
const toolsFree = new Set(['tests/test-postgres-toolchain.test.ts']);
// Include tests with older names that start PostgreSQL or encode real media.
// New *-postgres tests are automatically excluded from the tools-free lane.
const integration = standard.filter(file => !toolsFree.has(file) && !tariffSet.has(file) && !browserSet.has(file) && (
  file.endsWith('-postgres.test.ts')
  || /\bfrom\s*['"][^'"]*(?:disposable-postgres|studio-integration-runtime)|\binitdb\b|ffmpeg/.test(readFileSync(file, 'utf8'))
));
const integrationSet = new Set(integration);
const fast = standard.filter(file => !tariffSet.has(file) && !integrationSet.has(file) && !browserSet.has(file));
const studio = studioIntegration.filter(file => !browser.includes(file));
const suites = { fast, integration, tariffs, studio, browser };
const suiteIndex = process.argv.indexOf('--suite');
const suite = suiteIndex === -1 ? 'all' : process.argv[suiteIndex + 1];
if (suite !== 'all' && !Object.hasOwn(suites, suite)) {
  process.stderr.write(`Unknown validation suite: ${suite}\n`);
  process.exit(1);
}

if (process.argv.includes('--plan')) {
  // The manifest exceeds a pipe's buffer; finish the write before exiting.
  writeFileSync(1, `${JSON.stringify({ standard, studioIntegration, ...suites })}\n`);
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
  runTests(`${suite} suite`, suites[suite], ['studio', 'browser'].includes(suite) ? ['--test-concurrency=1'] : []);
}
