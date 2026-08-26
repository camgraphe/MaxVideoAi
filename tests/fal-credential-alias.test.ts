import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const envSource = readFileSync('frontend/src/lib/env.ts', 'utf8');
const clientSource = readFileSync('frontend/src/lib/fal-client.ts', 'utf8');
const proxySource = readFileSync('frontend/app/api/fal/proxy/route.ts', 'utf8');
const healthSource = readFileSync('frontend/app/api/health/fal/route.ts', 'utf8');

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
