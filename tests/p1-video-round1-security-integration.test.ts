import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { POST as generatePost } from '../frontend/app/api/generate/route';
import { resolveGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';
import { createPreflightPostHandler } from '../frontend/app/api/preflight/_lib/preflight-handler';
import { createEnginesGetHandler } from '../frontend/app/api/engines/_lib/engines-get-handler';
import { KLING_3_TURBO_STANDARD_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-standard';
import { KLING_3_TURBO_PRO_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-pro';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import type { AgentGenerationExecutabilityEnvironment } from '../frontend/src/server/agent-runtime/model-executability';
import { resolveSelectedWorkspaceEngine } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveLaunchCanaryRequestContext } from '../frontend/src/server/model-launch-canary-request';

const PRIVATE_IDS = [
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
] as const;

const PRIVATE_ENGINES = [
  KLING_3_TURBO_STANDARD_ENGINE,
  KLING_3_TURBO_PRO_ENGINE,
  MINIMAX_H3_MAX_ENGINE,
];

const generationEnvironment: AgentGenerationExecutabilityEnvironment = {
  bytePlusEnabled: false,
  bytePlusApiKey: undefined,
  falApiKey: 'private-canary-fal-key',
  providerEnv: {},
};

const canaryContext = {
  principal: {
    userId: 'workspace-canary-user',
    clientId: 'workspace-canary-client',
    emailVerified: true,
    authMethod: 'oauth' as const,
  },
  access: { allowedModelIds: new Set<string>(PRIVATE_IDS) },
  generationEnvironment,
};

function privateEngine(engineId: string) {
  return PRIVATE_ENGINES.find((engine) => engine.id === engineId);
}

test('the shared request gate requires the exact staging host, server flag, account, and verified OAuth client', async () => {
  const principal = canaryContext.principal;
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
  assert.ok(allowed?.access.allowedModelIds.has('kling-3-turbo-standard'));

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

test('the real website generate route rejects a private P1 id before database, billing, or auth work', async () => {
  const response = await generatePost(new NextRequest('https://maxvideoai.com/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      engineId: 'kling-3-turbo-standard',
      mode: 't2v',
      prompt: 'A private launch request must remain closed.',
    }),
  }));

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: 'Engine unavailable' });
});

test('generate route context resolves a private engine only after exact launch-canary authorization', async () => {
  let hiddenLookups = 0;
  const boundaryBase = {
    getConfiguredEngine: async () => undefined,
    getConfiguredEngineIncludingHidden: async (engineId: string) => {
      hiddenLookups += 1;
      return privateEngine(engineId);
    },
    isDatabaseConfigured: () => true,
    ensureBillingSchema: async () => undefined,
    requireAdmin: async () => ({ id: 'unused-admin' }),
  };
  const request = new NextRequest('https://maxvideoai-mcp-staging.vercel.app/api/generate', {
    method: 'POST',
  });

  const denied = await resolveGenerateRouteContext({
    body: { engineId: 'kling-3-turbo-standard', mode: 't2v' },
    req: request,
    boundaryOverrides: {
      ...boundaryBase,
      resolveLaunchCanaryRequestContext: async () => null,
    },
  });
  assert.deepEqual(denied, {
    ok: false,
    status: 404,
    body: { ok: false, error: 'Engine unavailable' },
  });
  assert.equal(hiddenLookups, 0, 'private engine data must not resolve before the canary gate');

  const allowed = await resolveGenerateRouteContext({
    body: { engineId: 'kling-3-turbo-standard', mode: 't2v' },
    req: request,
    boundaryOverrides: {
      ...boundaryBase,
      resolveLaunchCanaryRequestContext: async () => canaryContext,
    },
  });
  assert.equal(allowed.ok, true);
  if (allowed.ok) assert.equal(allowed.context.engine.id, 'kling-3-turbo-standard');
  assert.equal(hiddenLookups, 1);
});

test('workspace engine bootstrap is principal-scoped and returns only executable private modes', async () => {
  const handler = createEnginesGetHandler({
    getPublicConfiguredEnginesByCategory: async () => [],
    getConfiguredEngineIncludingHidden: async (engineId: string) => privateEngine(engineId),
    resolveLaunchCanaryRequestContext: async () => canaryContext,
    fetchEngineAverageDurations: async () => [],
    loadAppEngineScoreMap: async () => ({}),
  });
  const response = await handler(new NextRequest(
    'https://maxvideoai-mcp-staging.vercel.app/api/engines',
    { headers: { authorization: 'Bearer verified-canary-token' } },
  ));
  assert.equal(response.status, 200);
  const payload = await response.json() as { engines: typeof PRIVATE_ENGINES };
  assert.deepEqual(payload.engines.map(({ id }) => id).sort(), [...PRIVATE_IDS].sort());
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
    getPublicConfiguredEnginesByCategory: async () => [],
    getConfiguredEngineIncludingHidden: async (engineId: string) => privateEngine(engineId),
    resolveLaunchCanaryRequestContext: async () => null,
    fetchEngineAverageDurations: async () => [],
    loadAppEngineScoreMap: async () => ({}),
  });
  const publicPayload = await publicHandler(new NextRequest('https://maxvideoai.com/api/engines'))
    .then((result) => result.json()) as { engines: unknown[] };
  assert.deepEqual(publicPayload.engines, []);
});

test('workspace preflight resolves and prices P1 only inside the same exact canary context', async () => {
  const handler = createPreflightPostHandler({
    resolveLaunchCanaryRequestContextFn: async () => canaryContext,
    mediaAwarePreflightDependencies: {
      getConfiguredEngineFn: async () => undefined,
      getConfiguredEngineIncludingHiddenFn: async (engineId: string) => privateEngine(engineId),
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

  const deniedHandler = createPreflightPostHandler({
    resolveLaunchCanaryRequestContextFn: async () => null,
    mediaAwarePreflightDependencies: {
      getConfiguredEngineFn: async () => undefined,
      getConfiguredEngineIncludingHiddenFn: async (engineId: string) => privateEngine(engineId),
    },
  });
  const denied = await deniedHandler(request());
  assert.equal(denied.status, 400);
  assert.equal((await denied.json() as { error?: { code?: string } }).error?.code, 'ENGINE_NOT_FOUND');
});
