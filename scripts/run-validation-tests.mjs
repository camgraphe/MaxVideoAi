import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

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

if (process.argv.includes('--plan')) {
  process.stdout.write(`${JSON.stringify({ standard, studioIntegration })}\n`);
  process.exit(0);
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
  ], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runTests('standard suite', standard);
runTests('isolated Studio integrations', studioIntegration, ['--test-concurrency=1']);
