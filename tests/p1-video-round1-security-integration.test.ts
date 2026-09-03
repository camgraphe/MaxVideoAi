import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { resolveGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';
import { createPreflightPostHandler } from '../frontend/app/api/preflight/_lib/preflight-handler';
import { createEnginesGetHandler } from '../frontend/app/api/engines/_lib/engines-get-handler';
import { KLING_3_TURBO_STANDARD_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-standard';
import { KLING_3_TURBO_PRO_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-pro';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { resolveSelectedWorkspaceEngine } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveLaunchCanaryRequestContext } from '../frontend/src/server/model-launch-canary-request';

const P1_IDS = [
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
] as const;

const P1_ENGINES = [
  KLING_3_TURBO_STANDARD_ENGINE,
  KLING_3_TURBO_PRO_ENGINE,
  MINIMAX_H3_MAX_ENGINE,
];

function p1Engine(engineId: string) {
  return P1_ENGINES.find((engine) => engine.id === engineId);
}

test('published P1 models no longer consume the staging launch-canary gate', async () => {
  const principal = {
    userId: 'workspace-canary-user',
    clientId: 'workspace-canary-client',
    emailVerified: true,
    authMethod: 'oauth' as const,
  };
  const env = {
    NODE_ENV: 'production',
    MCP_STAGING_OPERATIONAL_ENABLED: 'true',
    MCP_STAGING_CANARY_ACCOUNT_IDS: principal.userId,
    MCP_STAGING_CANARY_CLIENT_IDS: principal.clientId!,
  } as NodeJS.ProcessEnv;
  const allowed = await resolveLaunchCanaryRequestContext(
    new Request('https://maxvideoai-mcp-staging.vercel.app/api/engines', {
      headers: { authorization: 'Bearer verified-canary-token' },
    }),
    { env, resolvePrincipal: async () => principal },
  );
  assert.equal(allowed, null);

  for (const request of [
    new Request('https://maxvideoai.com/api/engines'),
    new Request('https://maxvideoai-mcp-staging.vercel.app.evil.example/api/engines'),
  ]) {
    assert.equal(await resolveLaunchCanaryRequestContext(request, {
      env,
      resolvePrincipal: async () => principal,
    }), null);
  }
  assert.equal(await resolveLaunchCanaryRequestContext(
    new Request('https://maxvideoai-mcp-staging.vercel.app/api/engines'),
    { env, resolvePrincipal: async () => ({ ...principal, clientId: 'wrong-client' }) },
  ), null);
});

test('all three P1 engines are in the public application registry', () => {
  const publicIds = new Set(listFalEngines().map(({ id }) => id));
  for (const id of P1_IDS) assert.equal(publicIds.has(id), true, id);
});

test('generate route context resolves P1 through the public engine boundary', async () => {
  let hiddenLookups = 0;
  const boundaryBase = {
    getConfiguredEngine: async (engineId: string) => p1Engine(engineId),
    getConfiguredEngineIncludingHidden: async (engineId: string) => {
      hiddenLookups += 1;
      return p1Engine(engineId);
    },
    isDatabaseConfigured: () => true,
    ensureBillingSchema: async () => undefined,
    requireAdmin: async () => ({ id: 'unused-admin' }),
  };
  const request = new NextRequest('https://maxvideoai-mcp-staging.vercel.app/api/generate', {
    method: 'POST',
  });

  const resolved = await resolveGenerateRouteContext({
    body: { engineId: 'kling-3-turbo-standard', mode: 't2v' },
    req: request,
    boundaryOverrides: {
      ...boundaryBase,
      resolveLaunchCanaryRequestContext: async () => null,
    },
  });
  assert.equal(resolved.ok, true);
  if (resolved.ok) assert.equal(resolved.context.engine.id, 'kling-3-turbo-standard');
  assert.equal(hiddenLookups, 0);
});

test('workspace engine bootstrap returns executable P1 public modes', async () => {
  const handler = createEnginesGetHandler({
    getPublicConfiguredEnginesByCategory: async () => P1_ENGINES,
    getConfiguredEngineIncludingHidden: async () => undefined,
    resolveLaunchCanaryRequestContext: async () => null,
    fetchEngineAverageDurations: async () => [],
    loadAppEngineScoreMap: async () => ({}),
  });
  const response = await handler(new NextRequest(
    'https://maxvideoai-mcp-staging.vercel.app/api/engines',
    { headers: { authorization: 'Bearer verified-canary-token' } },
  ));
  assert.equal(response.status, 200);
  const payload = await response.json() as { engines: typeof P1_ENGINES };
  assert.deepEqual(payload.engines.map(({ id }) => id).sort(), [...P1_IDS].sort());
  assert.deepEqual(payload.engines.find(({ id }) => id === 'minimax-h3-max')?.modes, ['t2v']);
  assert.deepEqual(payload.engines.find(({ id }) => id === 'kling-3-turbo-standard')?.modes, ['t2v', 'i2v']);
  assert.equal(JSON.stringify(payload).toLowerCase().includes('fal-ai/'), false);

  const selected = resolveSelectedWorkspaceEngine({
    engines: payload.engines,
    form: {
      engineId: 'kling-3-turbo-standard', mode: 't2v', durationSec: 5,
      resolution: '720p', aspectRatio: '16:9', fps: 24, iterations: 1,
      audio: true, extraInputValues: {},
    },
    engineOverride: null,
  });
  assert.equal(selected?.id, 'kling-3-turbo-standard');

  const publicHandler = createEnginesGetHandler({
    getPublicConfiguredEnginesByCategory: async () => P1_ENGINES,
    getConfiguredEngineIncludingHidden: async () => undefined,
    resolveLaunchCanaryRequestContext: async () => null,
    fetchEngineAverageDurations: async () => [],
    loadAppEngineScoreMap: async () => ({}),
  });
  const publicPayload = await publicHandler(new NextRequest('https://maxvideoai.com/api/engines'))
    .then((result) => result.json()) as { engines: typeof P1_ENGINES };
  assert.deepEqual(publicPayload.engines.map(({ id }) => id).sort(), [...P1_IDS].sort());
});

test('workspace preflight resolves and prices P1 through the public engine boundary', async () => {
  const handler = createPreflightPostHandler({
    resolveLaunchCanaryRequestContextFn: async () => null,
    mediaAwarePreflightDependencies: {
      getConfiguredEngineFn: async (engineId: string) => p1Engine(engineId),
      getConfiguredEngineIncludingHiddenFn: async () => undefined,
    },
  });
  const request = () => new NextRequest('https://maxvideoai-mcp-staging.vercel.app/api/preflight', {
    method: 'POST',
    headers: {
      authorization: 'Bearer verified-canary-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      engine: 'kling-3-turbo-standard', mode: 't2v', durationSec: 5,
      resolution: '720p', aspectRatio: '16:9', fps: 24,
      user: { memberTier: 'Member' },
    }),
  });
  const allowed = await handler(request());
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json() as { ok: boolean }).ok, true);
});
