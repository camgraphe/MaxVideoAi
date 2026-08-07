import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { ENV } from '../frontend/src/lib/env';
import { resolveGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/route-context.ts');
const sourceVideoContextPath = join(root, 'frontend/app/api/generate/_lib/source-video-context.ts');

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
  assert.match(helperSource, /isBytePlusSeedanceAdminOnly/);
  assert.match(helperSource, /resolveBytePlusSeedanceRouteProfile/);
  assert.match(
    helperSource,
    /isBytePlusV1a\s*&&\s*!getBytePlusSeedanceAllowedModes\(engine\.id\)\.includes\(mode\)/
  );
  assert.doesNotMatch(helperSource, /const bytePlusModeAllowed\s*=\s*getBytePlusSeedanceAllowedModes/);
  assert.doesNotMatch(helperSource, /isPublicSeedanceStandardBytePlus/);
  assert.doesNotMatch(helperSource, /isPublicSeedanceFastBytePlus/);
  assert.doesNotMatch(helperSource, /isPublicSeedanceMiniBytePlus/);

  const directProviderAdminGuard = helperSource.match(/if \(\s*!\s*isBytePlusV1a[\s\S]*?\)\s*\{/)?.[0] ?? '';
  assert.match(directProviderAdminGuard, /isGoogleVertexOmniEngine\(engine\.id\)/);
  assert.match(helperSource, /providerRoutingPlan\.kind === 'google_vertex_unavailable'/);
  assert.doesNotMatch(helperSource, /GOOGLE_VERTEX_OMNI_FALLBACK_TO_FAL_ENABLED/);
});

test('generate route resolves context before billing preflight', () => {
  assert.ok(
    routeSource.indexOf('const routeContext = await resolveGenerateRouteContext') <
      routeSource.indexOf('const billingPreflight = await resolveGenerateBillingPreflight'),
    'BytePlus profile preflight in route context must happen before billing'
  );
});

test('generate route delegates source-video duration and input context', () => {
  assert.ok(existsSync(sourceVideoContextPath), 'source-video context should live in the generate route _lib folder');
  const sourceVideoContextSource = readFileSync(sourceVideoContextPath, 'utf8');

  assert.match(routeSource, /from '\.\/_lib\/source-video-context'/);
  assert.match(routeSource, /resolveGenerateSourceVideoContext\(\{/);
  assert.doesNotMatch(routeSource, /resolveSourceVideoDurationSec/);
  assert.doesNotMatch(routeSource, /SOURCE_VIDEO_DURATION_UNSUPPORTED/);
  assert.match(sourceVideoContextSource, /export function resolveGenerateSourceVideoContext/);
  assert.match(sourceVideoContextSource, /resolveSourceVideoDurationSec/);
});

test('Seedance 2.5 hard-disable and routing gates run before database and billing', { concurrency: false }, async () => {
  const original = {
    databaseUrl: process.env.DATABASE_URL,
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    modelId: ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
  };
  delete process.env.DATABASE_URL;
  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID = 'dreamina-seedance-2-5-260628';

  try {
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false';
    ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
    const disabled = await resolveGenerateRouteContext({
      body: { engineId: 'seedance-2-5', mode: 't2v' },
      req: new NextRequest('http://localhost/api/generate', { method: 'POST' }),
    });
    assert.deepEqual(disabled, {
      ok: false,
      status: 404,
      body: { ok: false, error: 'Engine unavailable' },
    });

    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
    ENV.SEEDANCE_2_5_PROVIDER = 'disabled';
    const unrouted = await resolveGenerateRouteContext({
      body: { engineId: 'seedance-2-5', mode: 't2v' },
      req: new NextRequest('http://localhost/api/generate', { method: 'POST' }),
    });
    assert.deepEqual(unrouted, {
      ok: false,
      status: 404,
      body: { ok: false, error: 'Engine unavailable' },
    });

    ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
    const enabled = await resolveGenerateRouteContext({
      body: { engineId: 'seedance-2-5', mode: 't2v' },
      req: new NextRequest('http://localhost/api/generate', { method: 'POST' }),
    });
    assert.deepEqual(enabled, {
      ok: false,
      status: 503,
      body: { ok: false, error: 'Database unavailable' },
    });
  } finally {
    if (original.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original.databaseUrl;
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID = original.modelId;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
  }
});

test('disabled Seedance 2.5 does not reach the configured-engine database boundary', { concurrency: false }, async () => {
  let databaseConnections = 0;
  const databaseBoundary = createServer((socket) => {
    databaseConnections += 1;
    socket.destroy();
  });
  await new Promise<void>((resolve) => databaseBoundary.listen(0, '127.0.0.1', resolve));
  const address = databaseBoundary.address();
  assert.ok(address && typeof address !== 'string');

  const original = {
    databaseUrl: process.env.DATABASE_URL,
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
  };
  process.env.DATABASE_URL = `postgres://test:test@127.0.0.1:${address.port}/maxvideoai`;
  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'false';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';

  try {
    const result = await resolveGenerateRouteContext({
      body: { engineId: 'seedance-2-5', mode: 't2v' },
      req: new NextRequest('http://localhost/api/generate', { method: 'POST' }),
    });
    assert.deepEqual(result, {
      ok: false,
      status: 404,
      body: { ok: false, error: 'Engine unavailable' },
    });
    assert.equal(databaseConnections, 0);
  } finally {
    if (original.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original.databaseUrl;
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
    await new Promise<void>((resolve, reject) =>
      databaseBoundary.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
