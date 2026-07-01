import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/route-context.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

test('generate route delegates engine, provider, db, and admin context', () => {
  assert.ok(existsSync(helperPath), 'route context should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/route-context'/);
  assert.match(routeSource, /resolveGenerateRouteContext\(\{ body, req \}\)/);
  assert.doesNotMatch(routeSource, /getConfiguredEngine/);
  assert.doesNotMatch(routeSource, /ensureBillingSchema/);
  assert.doesNotMatch(routeSource, /requireAdmin/);
  assert.doesNotMatch(routeSource, /randomUUID/);

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 700, `/api/generate route should stay below 700 lines after route context extraction, got ${lineCount}`);
});

test('route context helper exposes the expected guard contract', () => {
  assert.match(helperSource, /export async function resolveGenerateRouteContext/);
  assert.match(helperSource, /getConfiguredEngine/);
  assert.match(helperSource, /ensureBillingSchema/);
  assert.match(helperSource, /requireAdmin/);
  assert.match(helperSource, /randomUUID/);
  assert.match(helperSource, /isVideoMode/);
  assert.match(helperSource, /isGoogleVertexOmniEngine/);

  const directProviderAdminGuard = helperSource.match(/if \(\s*!\s*isBytePlusV1a[\s\S]*?\)\s*\{/)?.[0] ?? '';
  assert.match(directProviderAdminGuard, /isGoogleVertexOmniEngine\(engine\.id\)/);
  assert.match(helperSource, /GOOGLE_VERTEX_OMNI_FALLBACK_TO_FAL_ENABLED/);
  assert.match(helperSource, /isGoogleVertexOmniEngine\(engine\.id\)[\s\S]*providerRoutingPlan\.primaryProvider === 'fal'/);
});
