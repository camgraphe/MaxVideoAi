import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/engines/route.ts');
const handlerPath = join(root, 'frontend/app/api/engines/_lib/engines-get-handler.ts');

test('the engines route keeps its testable handler factory outside the Next.js route module', () => {
  const routeSource = readFileSync(routePath, 'utf8');

  assert.ok(existsSync(handlerPath), 'expected a dedicated engines handler module');
  assert.match(routeSource, /import \{ createEnginesGetHandler \} from '\.\/_lib\/engines-get-handler';/);
  assert.doesNotMatch(routeSource, /export function createEnginesGetHandler/);
  assert.match(routeSource, /export const GET = createEnginesGetHandler\(\);/);
});
