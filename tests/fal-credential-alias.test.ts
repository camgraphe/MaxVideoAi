import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const envSource = readFileSync('frontend/src/lib/env.ts', 'utf8');
const clientSource = readFileSync('frontend/src/lib/fal-client.ts', 'utf8');
const proxySource = readFileSync('frontend/app/api/fal/proxy/route.ts', 'utf8');
const healthSource = readFileSync('frontend/app/api/health/fal/route.ts', 'utf8');

test('Fal direct takes priority over Marketplace while an explicit override still works', () => {
  const select = (override: string, direct: string) => JSON.parse(execFileSync(process.execPath, [
    '--import', 'tsx', '-e',
    "const { ENV } = require('./frontend/src/lib/env.ts'); process.stdout.write(JSON.stringify([ENV.FAL_API_KEY, ENV.FAL_KEY, ENV.FAL_QUEUE_READ_FALLBACK_KEY]));",
  ], {
    env: { ...process.env, FAL_API_KEY: override, FAL_DIRECT_KEY: direct, FAL_KEY: 'marketplace' },
    encoding: 'utf8',
  }));

  assert.deepEqual(select('', ' direct '), ['direct', 'direct', 'marketplace']);
  assert.deepEqual(select(' marketplace ', 'direct'), ['marketplace', 'marketplace', 'direct']);
  assert.deepEqual(select('preview-override', 'direct'), ['preview-override', 'preview-override', null]);
  assert.deepEqual(select('', ''), ['marketplace', 'marketplace', null]);
});

test('Fal runtime consumers share the normalized FAL_API_KEY/FAL_KEY alias', () => {
  assert.match(envSource, /getOptionalEnv\('FAL_API_KEY'\)[\s\S]*getOptionalEnv\('FAL_KEY'\)/);

  for (const [name, source] of [
    ['Fal client', clientSource],
    ['Fal proxy', proxySource],
    ['Fal health check', healthSource],
  ] as const) {
    assert.match(source, /import \{ ENV \} from ['"]@\/lib\/env['"]/u, `${name} must import the shared alias`);
    assert.match(source, /ENV\.FAL_API_KEY/u, `${name} must use the shared alias`);
    assert.doesNotMatch(source, /process\.env\.FAL_(?:API_)?KEY/u, `${name} must not resolve Fal credentials independently`);
  }
});
