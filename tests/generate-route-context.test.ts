import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { ENV } from '../frontend/src/lib/env';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import {
  resolveGenerateRouteContext,
  resolveTrustedPaidGenerateRouteContext,
} from '../frontend/app/api/generate/_lib/route-context';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/route-context.ts');
const sourceVideoContextPath = join(root, 'frontend/app/api/generate/_lib/source-video-context.ts');
const attachmentProcessingPath = join(root, 'frontend/app/api/generate/_lib/generation-attachment-processing.ts');

const routeSource = readFileSync(routePath, 'utf8');
const serviceSource = readFileSync(join(root, 'frontend/src/server/video-generation/execute-video-generation.ts'), 'utf8');
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
      routeSource.indexOf('const result = await executeVideoGeneration'),
    'BytePlus profile preflight in route context must happen before billing'
  );
  assert.match(serviceSource, /resolveGenerateBillingPreflight\(\{/);
});

test('registered non-Seedance BytePlus engines keep the controlled unknown-engine response', async () => {
  const result = await resolveGenerateRouteContext({
    body: { engineId: 'seedream', mode: 't2v' },
    req: new NextRequest('http://localhost/api/generate', { method: 'POST' }),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    body: {
      ok: false,
      error: 'Unknown engine',
    },
  });
});

test('generate route delegates source-video duration and input context', () => {
  assert.ok(existsSync(sourceVideoContextPath), 'source-video context should live in the generate route _lib folder');
  const sourceVideoContextSource = readFileSync(sourceVideoContextPath, 'utf8');

  assert.match(serviceSource, /generate\/_lib\/source-video-context/);
  assert.match(serviceSource, /resolveGenerateSourceVideoContext\(\{/);
  assert.doesNotMatch(routeSource, /resolveSourceVideoDurationSec/);
  assert.doesNotMatch(routeSource, /SOURCE_VIDEO_DURATION_UNSUPPORTED/);
  assert.match(sourceVideoContextSource, /export function resolveGenerateSourceVideoContext/);
  assert.match(sourceVideoContextSource, /resolveSourceVideoDurationSec/);
});

test('generate route delegates attachment processing and trusted media validation', () => {
  assert.ok(existsSync(attachmentProcessingPath), 'attachment processing should live in the generate route _lib folder');
  const attachmentProcessingSource = readFileSync(attachmentProcessingPath, 'utf8');

  assert.match(serviceSource, /generate\/_lib\/generation-attachment-processing/);
  assert.match(serviceSource, /processAndValidateGenerationAttachments\(\{/);
  assert.doesNotMatch(routeSource, /processGenerationAttachments\(\{/);
  assert.doesNotMatch(routeSource, /deriveGenerationAttachmentReferences\(\{/);
  assert.doesNotMatch(routeSource, /validateGenerationMediaConstraints\(\{/);
  assert.match(attachmentProcessingSource, /processGenerationAttachments\(\{/);
  assert.match(attachmentProcessingSource, /deriveGenerationAttachmentReferences\(\{/);
  assert.match(attachmentProcessingSource, /validateGenerationMediaConstraints\(\{/);
  assert.ok(
    attachmentProcessingSource.indexOf('deriveGenerationAttachmentReferences') <
      attachmentProcessingSource.indexOf('validateGenerationMediaConstraints'),
    'trusted media validation must run after attachment references are derived'
  );
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
      status: 401,
      body: { ok: false, error: 'Unauthorized' },
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

test('Seedance 2.5 accepts proven ModelArk modes with the Ark key but rejects V2V before LAS execution is ready', { concurrency: false }, () => {
  const extendedEnv = ENV as typeof ENV & { SEEDANCE_2_5_LAS_ENABLED?: string };
  const entry = getFalEngineById('seedance-2-5');
  assert.ok(entry);
  const original = {
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    arkApiKey: ENV.BYTEPLUS_ARK_API_KEY,
    lasApiKey: ENV.BYTEPLUS_LAS_API_KEY,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
    seedance25AdminOnly: ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY,
    seedance25Modes: ENV.SEEDANCE_2_5_BYTEPLUS_MODES,
    seedance25LasEnabled: extendedEnv.SEEDANCE_2_5_LAS_ENABLED,
  };

  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.BYTEPLUS_ARK_API_KEY = 'ark-test-key';
  ENV.BYTEPLUS_LAS_API_KEY = '';
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
  ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = 'false';
  ENV.SEEDANCE_2_5_BYTEPLUS_MODES = 't2v,i2v,ref2v,v2v,extend';
  extendedEnv.SEEDANCE_2_5_LAS_ENABLED = 'true';

  try {
    for (const mode of ['t2v', 'i2v', 'ref2v', 'extend'] as const) {
      const result = resolveTrustedPaidGenerateRouteContext({
        body: {},
        engine: entry.engine,
        jobId: `job_${mode}`,
        mode,
      });
      assert.equal(result.ok, true, mode);
    }

    const v2v = resolveTrustedPaidGenerateRouteContext({
      body: {},
      engine: entry.engine,
      jobId: 'job_v2v',
      mode: 'v2v',
    });
    assert.deepEqual(v2v, {
      ok: false,
      status: 503,
      body: {
        ok: false,
        error: 'BYTEPLUS_LAS_API_KEY_MISSING',
      },
    });

    ENV.BYTEPLUS_LAS_API_KEY = 'las-test-key';
    extendedEnv.SEEDANCE_2_5_LAS_ENABLED = 'false';
    const gatedV2v = resolveTrustedPaidGenerateRouteContext({
      body: {},
      engine: entry.engine,
      jobId: 'job_v2v_gated',
      mode: 'v2v',
    });
    assert.deepEqual(gatedV2v, {
      ok: false,
      status: 503,
      body: {
        ok: false,
        error: 'BYTEPLUS_LAS_EXECUTION_DISABLED',
      },
    });
  } finally {
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.BYTEPLUS_ARK_API_KEY = original.arkApiKey;
    ENV.BYTEPLUS_LAS_API_KEY = original.lasApiKey;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = original.seedance25AdminOnly;
    ENV.SEEDANCE_2_5_BYTEPLUS_MODES = original.seedance25Modes;
    extendedEnv.SEEDANCE_2_5_LAS_ENABLED = original.seedance25LasEnabled;
  }
});

test('trusted paid routing honors a principal-scoped Veo environment while public routing stays closed', { concurrency: false }, () => {
  const entry = getFalEngineById('veo-3-1-lite');
  assert.ok(entry);
  const original = {
    enabled: process.env.GOOGLE_VERTEX_VEO_ENABLED,
    publicRouting: process.env.GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED,
    adminOnly: process.env.GOOGLE_VERTEX_VEO_ADMIN_ONLY,
  };
  process.env.GOOGLE_VERTEX_VEO_ENABLED = 'false';
  process.env.GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED = 'false';
  process.env.GOOGLE_VERTEX_VEO_ADMIN_ONLY = 'true';

  try {
    const result = resolveTrustedPaidGenerateRouteContext({
      body: {},
      engine: entry.engine,
      jobId: 'job_private_veo_canary',
      mode: 't2v',
      providerEnv: {
        GOOGLE_VERTEX_VEO_ENABLED: 'true',
        GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED: 'true',
        GOOGLE_VERTEX_VEO_ADMIN_ONLY: 'false',
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.context.providerKey, 'google_vertex_veo_direct');
    assert.deepEqual(result.context.providerRoutingPlan, {
      kind: 'google_vertex_veo_primary',
      primaryProvider: 'google_vertex_veo_direct',
    });
    assert.equal(process.env.GOOGLE_VERTEX_VEO_ENABLED, 'false');
    assert.equal(process.env.GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED, 'false');
    assert.equal(process.env.GOOGLE_VERTEX_VEO_ADMIN_ONLY, 'true');
  } finally {
    if (original.enabled === undefined) delete process.env.GOOGLE_VERTEX_VEO_ENABLED;
    else process.env.GOOGLE_VERTEX_VEO_ENABLED = original.enabled;
    if (original.publicRouting === undefined) delete process.env.GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED;
    else process.env.GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED = original.publicRouting;
    if (original.adminOnly === undefined) delete process.env.GOOGLE_VERTEX_VEO_ADMIN_ONLY;
    else process.env.GOOGLE_VERTEX_VEO_ADMIN_ONLY = original.adminOnly;
  }
});

test('every enabled admin-only Seedance profile rejects a non-admin before every config and billing boundary', { concurrency: false }, async () => {
  const original = {
    bytePlusEnabled: ENV.BYTEPLUS_ARK_ENABLED,
    modelId: ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID,
    standardProvider: ENV.SEEDANCE_2_PROVIDER,
    standardAdminOnly: ENV.SEEDANCE_2_BYTEPLUS_ADMIN_ONLY,
    fastProvider: ENV.SEEDANCE_FAST_PROVIDER,
    fastAdminOnly: ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY,
    miniAdminOnly: ENV.SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY,
    seedance25Enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED,
    seedance25Provider: ENV.SEEDANCE_2_5_PROVIDER,
    seedance25AdminOnly: ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY,
  };
  const boundaryCalls: string[] = [];
  const explode = (boundary: string) => () => {
    boundaryCalls.push(boundary);
    throw new Error(`${boundary} must not run before admin authorization`);
  };

  ENV.BYTEPLUS_ARK_ENABLED = 'true';
  ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID = 'dreamina-seedance-2-5-260628';
  ENV.SEEDANCE_2_PROVIDER = 'byteplus_modelark';
  ENV.SEEDANCE_2_BYTEPLUS_ADMIN_ONLY = 'true';
  ENV.SEEDANCE_FAST_PROVIDER = 'byteplus_modelark';
  ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY = 'true';
  ENV.SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY = 'true';
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true';
  ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
  ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = 'true';

  try {
    for (const engineId of [
      'seedance-2-0',
      'seedance-2-0-fast',
      'seedance-2-0-mini',
      'seedance-2-0-fast-byteplus',
      'seedance-2-5',
    ]) {
      const result = await resolveGenerateRouteContext({
        body: { engineId, mode: 't2v' },
        req: new NextRequest('http://localhost/api/generate', { method: 'POST' }),
        boundaryOverrides: {
          getConfiguredEngine: explode('getConfiguredEngine'),
          getConfiguredEngineIncludingHidden: explode('getConfiguredEngineIncludingHidden'),
          isDatabaseConfigured: explode('isDatabaseConfigured'),
          ensureBillingSchema: explode('ensureBillingSchema'),
        },
      } as Parameters<typeof resolveGenerateRouteContext>[0] & {
        boundaryOverrides: Record<string, () => never>;
      });

      assert.deepEqual(result, {
        ok: false,
        status: 401,
        body: { ok: false, error: 'Unauthorized' },
      });
    }
    assert.deepEqual(boundaryCalls, []);
  } finally {
    ENV.BYTEPLUS_ARK_ENABLED = original.bytePlusEnabled;
    ENV.BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID = original.modelId;
    ENV.SEEDANCE_2_PROVIDER = original.standardProvider;
    ENV.SEEDANCE_2_BYTEPLUS_ADMIN_ONLY = original.standardAdminOnly;
    ENV.SEEDANCE_FAST_PROVIDER = original.fastProvider;
    ENV.SEEDANCE_FAST_BYTEPLUS_ADMIN_ONLY = original.fastAdminOnly;
    ENV.SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY = original.miniAdminOnly;
    ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.seedance25Enabled;
    ENV.SEEDANCE_2_5_PROVIDER = original.seedance25Provider;
    ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = original.seedance25AdminOnly;
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
