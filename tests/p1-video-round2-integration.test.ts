import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { createEnginesGetHandler } from '../frontend/app/api/engines/_lib/engines-get-handler';
import { createPreflightPostHandler } from '../frontend/app/api/preflight/_lib/preflight-handler';
import { resolveGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';
import { submitFalGenerateTask } from '../frontend/app/api/generate/_lib/fal-submission';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { KLING_3_TURBO_PRO_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-pro';
import { KLING_3_TURBO_STANDARD_ENGINE } from '../frontend/src/config/fal-engines/kling-3-turbo-standard';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import { FalGenerationError, type GeneratePayload } from '../frontend/src/lib/fal';
import { computeConfiguredPreflight } from '../frontend/src/server/engines';
import { resolveAgentPrincipal } from '../frontend/src/server/mcp/oauth-adapter';
import { resolveLaunchCanaryRequestContext } from '../frontend/src/server/model-launch-canary-request';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { EngineCaps, PreflightRequest } from '../frontend/types/engines';

const STAGING_URL = 'https://maxvideoai-mcp-staging.vercel.app';
const SESSION_USER_ID = '00000000-0000-4000-8000-000000000111';
const MCP_USER_ID = '00000000-0000-4000-8000-000000000222';
const MCP_CLIENT_ID = '00000000-0000-4000-8000-000000000333';
const FIRST_PARTY_ENV = {
  NODE_ENV: 'production',
  MCP_STAGING_OPERATIONAL_ENABLED: 'true',
  WORKSPACE_STAGING_CANARY_ACCOUNT_IDS: SESSION_USER_ID,
  FAL_API_KEY: 'test-private-provider-key',
} as NodeJS.ProcessEnv;

function supabasePrincipalResolver(input: {
  userId: string;
  clientId?: string | null;
}): (request: Request) => Promise<AgentPrincipal> {
  return (request) => resolveAgentPrincipal(request, {
    async createAuthClient() {
      return {
        async getClaims(accessToken) {
          assert.equal(accessToken, 'test-session-access-token');
          return {
            data: { claims: { sub: input.userId, ...(input.clientId ? { client_id: input.clientId } : {}) } },
            error: null,
          };
        },
        async getUser(accessToken) {
          assert.equal(accessToken, 'test-session-access-token');
          return {
            data: {
              user: {
                id: input.userId,
                email_confirmed_at: '2026-09-03T00:00:00.000Z',
                identities: [{ provider: 'email' }],
              },
            },
            error: null,
          };
        },
      };
    },
  });
}

function bearerRequest(path: string): NextRequest {
  return new NextRequest(`${STAGING_URL}${path}`, {
    headers: { authorization: 'Bearer test-session-access-token' },
  });
}

test('published P1 models are no longer projected through the staging workspace allowlist', async () => {
  const request = bearerRequest('/api/engines');
  const allowed = await resolveLaunchCanaryRequestContext(request, {
    env: FIRST_PARTY_ENV,
    resolvePrincipal: supabasePrincipalResolver({ userId: SESSION_USER_ID, clientId: null }),
  });
  assert.equal(allowed, null);

  for (const deniedEnv of [
    { ...FIRST_PARTY_ENV, WORKSPACE_STAGING_CANARY_ACCOUNT_IDS: undefined },
    { ...FIRST_PARTY_ENV, WORKSPACE_STAGING_CANARY_ACCOUNT_IDS: '00000000-0000-4000-8000-000000000999' },
  ]) {
    assert.equal(await resolveLaunchCanaryRequestContext(request, {
      env: deniedEnv,
      resolvePrincipal: supabasePrincipalResolver({ userId: SESSION_USER_ID, clientId: null }),
    }), null);
  }
});

test('workspace engine bootstrap returns public P1 engines without hidden lookups or allowlists', async () => {
  let hiddenLookups = 0;
  const handler = createEnginesGetHandler({
    getPublicConfiguredEnginesByCategory: async () => [...PRIVATE_ENGINES.values()],
    getConfiguredEngineIncludingHidden: async (engineId) => {
      hiddenLookups += 1;
      return PRIVATE_ENGINES.get(engineId);
    },
    resolveLaunchCanaryRequestContext: (request) => resolveLaunchCanaryRequestContext(request, {
      env: FIRST_PARTY_ENV,
      resolvePrincipal: supabasePrincipalResolver({ userId: SESSION_USER_ID, clientId: null }),
    }),
    fetchEngineAverageDurations: async () => [],
    loadAppEngineScoreMap: async () => ({}),
  });
  const allowed = await handler(bearerRequest('/api/engines'));
  const allowedBody = await allowed.json() as { engines: EngineCaps[] };
  assert.deepEqual(
    allowedBody.engines.map(({ id }) => id).sort(),
    [...PRIVATE_ENGINES.keys()].sort(),
  );
  assert.equal(hiddenLookups, 0);

  hiddenLookups = 0;
  const deniedHandler = createEnginesGetHandler({
    getPublicConfiguredEnginesByCategory: async () => [...PRIVATE_ENGINES.values()],
    getConfiguredEngineIncludingHidden: async (engineId) => {
      hiddenLookups += 1;
      return PRIVATE_ENGINES.get(engineId);
    },
    resolveLaunchCanaryRequestContext: (request) => resolveLaunchCanaryRequestContext(request, {
      env: FIRST_PARTY_ENV,
      resolvePrincipal: supabasePrincipalResolver({
        userId: '00000000-0000-4000-8000-000000000999',
        clientId: null,
      }),
    }),
    fetchEngineAverageDurations: async () => [],
    loadAppEngineScoreMap: async () => ({}),
  });
  const denied = await deniedHandler(bearerRequest('/api/engines'));
  assert.deepEqual(
    (await denied.json() as { engines: EngineCaps[] }).engines.map(({ id }) => id).sort(),
    [...PRIVATE_ENGINES.keys()].sort(),
  );
  assert.equal(hiddenLookups, 0);
});

test('published P1 models leave no MCP prelaunch access set for any client claim', async () => {
  const env = {
    NODE_ENV: 'production',
    MCP_STAGING_OPERATIONAL_ENABLED: 'true',
    WORKSPACE_STAGING_CANARY_ACCOUNT_IDS: MCP_USER_ID,
    MCP_STAGING_CANARY_ACCOUNT_IDS: MCP_USER_ID,
    MCP_STAGING_CANARY_CLIENT_IDS: MCP_CLIENT_ID,
  } as NodeJS.ProcessEnv;
  const request = bearerRequest('/api/engines');

  const allowed = await resolveLaunchCanaryRequestContext(request, {
    env,
    resolvePrincipal: supabasePrincipalResolver({ userId: MCP_USER_ID, clientId: MCP_CLIENT_ID }),
  });
  assert.equal(allowed, null);

  const denied = await resolveLaunchCanaryRequestContext(request, {
    env,
    resolvePrincipal: supabasePrincipalResolver({
      userId: MCP_USER_ID,
      clientId: '00000000-0000-4000-8000-000000000444',
    }),
  });
  assert.equal(denied, null);
});

test('a normal first-party user reaches public P1 resolution without hidden-engine access', async () => {
  const env = {
    NODE_ENV: 'production',
    MCP_STAGING_OPERATIONAL_ENABLED: 'true',
    WORKSPACE_STAGING_CANARY_ACCOUNT_IDS: SESSION_USER_ID,
  } as NodeJS.ProcessEnv;
  let hiddenLookups = 0;
  let databaseChecks = 0;
  const result = await resolveGenerateRouteContext({
    req: bearerRequest('/api/generate'),
    body: { engineId: 'kling-3-turbo-standard', mode: 't2v' },
    boundaryOverrides: {
      resolveLaunchCanaryRequestContext: (request) => resolveLaunchCanaryRequestContext(request, {
        env,
        resolvePrincipal: supabasePrincipalResolver({
          userId: '00000000-0000-4000-8000-000000000999',
          clientId: null,
        }),
      }),
      getConfiguredEngine: async () => KLING_3_TURBO_STANDARD_ENGINE,
      getConfiguredEngineIncludingHidden: async () => {
        hiddenLookups += 1;
        return KLING_3_TURBO_STANDARD_ENGINE;
      },
      isDatabaseConfigured: () => {
        databaseChecks += 1;
        return false;
      },
    },
  });

  assert.deepEqual(result, {
    ok: false,
    status: 503,
    body: { ok: false, error: 'Database unavailable' },
  });
  assert.equal(hiddenLookups, 0);
  assert.equal(databaseChecks, 1);
});

const PRIVATE_ENGINES = new Map<string, EngineCaps>([
  [KLING_3_TURBO_STANDARD_ENGINE.id, KLING_3_TURBO_STANDARD_ENGINE],
  [KLING_3_TURBO_PRO_ENGINE.id, KLING_3_TURBO_PRO_ENGINE],
  [MINIMAX_H3_MAX_ENGINE.id, MINIMAX_H3_MAX_ENGINE],
]);

const validPrivateRequests: PreflightRequest[] = [
  {
    engine: 'kling-3-turbo-standard', mode: 't2v', durationSec: 5,
    resolution: '720p', aspectRatio: '16:9', fps: 24,
  },
  {
    engine: 'kling-3-turbo-pro', mode: 't2v', durationSec: 5,
    resolution: '1080p', aspectRatio: '9:16', fps: 24,
  },
  {
    engine: 'minimax-h3-max', mode: 't2v', durationSec: 5,
    resolution: '768P', aspectRatio: '21:9', fps: 24,
  },
];

const invalidPrivateRequests: PreflightRequest[] = [
  { ...validPrivateRequests[0]!, durationSec: 2 },
  { ...validPrivateRequests[0]!, resolution: '1080p' },
  { ...validPrivateRequests[0]!, aspectRatio: '21:9' },
  { ...validPrivateRequests[1]!, resolution: '720p' },
  { ...validPrivateRequests[2]!, resolution: '720p' },
];

function createP1PreflightHandler(onPricing: () => void) {
  return createPreflightPostHandler({
    resolveLaunchCanaryRequestContextFn: async () => null,
    mediaAwarePreflightDependencies: {
      getConfiguredEngineFn: async (engineId) => PRIVATE_ENGINES.get(engineId),
      getConfiguredEngineIncludingHiddenFn: async () => undefined,
      computeConfiguredPreflightFn: async (request, options) => {
        onPricing();
        return computeConfiguredPreflight(request, options);
      },
    },
  });
}

function preflightHttpRequest(request: PreflightRequest): NextRequest {
  return new NextRequest(`${STAGING_URL}/api/preflight`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-session-access-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  });
}

test('public P1 preflight rejects explicit settings outside exact engine caps before pricing', async () => {
  let pricingCalls = 0;
  const handler = createP1PreflightHandler(() => { pricingCalls += 1; });

  for (const request of invalidPrivateRequests) {
    const response = await handler(preflightHttpRequest(request));
    assert.equal(response.status, 400, `${request.engine} ${JSON.stringify(request)} must be rejected`);
    const body = await response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, 'ENGINE_CONSTRAINT');
  }
  assert.equal(pricingCalls, 0);
});

test('public P1 preflight accepts exact caps for all three runtime engines', async () => {
  let pricingCalls = 0;
  const handler = createP1PreflightHandler(() => { pricingCalls += 1; });

  for (const request of validPrivateRequests) {
    const response = await handler(preflightHttpRequest(request));
    assert.equal(response.status, 200, `${request.engine} exact caps should price`);
    assert.equal((await response.json() as { ok?: boolean }).ok, true);
  }
  assert.equal(pricingCalls, validPrivateRequests.length);
});

test('public P1 generate context applies the same exact setting constraints before database or billing work', async () => {
  for (const request of invalidPrivateRequests) {
    let databaseChecks = 0;
    const result = await resolveGenerateRouteContext({
      req: bearerRequest('/api/generate'),
      body: {
        engineId: request.engine,
        mode: request.mode,
        durationSec: request.durationSec,
        resolution: request.resolution,
        aspectRatio: request.aspectRatio,
        fps: request.fps,
      },
      boundaryOverrides: {
        resolveLaunchCanaryRequestContext: async () => null,
        getConfiguredEngine: async (engineId) => PRIVATE_ENGINES.get(engineId),
        getConfiguredEngineIncludingHidden: async () => undefined,
        isDatabaseConfigured: () => {
          databaseChecks += 1;
          return false;
        },
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.equal(result.body.error, 'ENGINE_CONSTRAINT');
    }
    assert.equal(databaseChecks, 0);
  }
});

test('public P1 generate context accepts exact caps for all three runtime engines', async () => {
  for (const request of validPrivateRequests) {
    let databaseChecks = 0;
    const result = await resolveGenerateRouteContext({
      req: bearerRequest('/api/generate'),
      body: {
        engineId: request.engine,
        mode: request.mode,
        durationSec: request.durationSec,
        resolution: request.resolution,
        aspectRatio: request.aspectRatio,
        fps: request.fps,
      },
      boundaryOverrides: {
        resolveLaunchCanaryRequestContext: async () => null,
        getConfiguredEngine: async (engineId) => PRIVATE_ENGINES.get(engineId),
        getConfiguredEngineIncludingHidden: async () => undefined,
        isDatabaseConfigured: () => {
          databaseChecks += 1;
          return false;
        },
      },
    });
    assert.deepEqual(result, {
      ok: false,
      status: 503,
      body: { ok: false, error: 'Database unavailable' },
    });
    assert.equal(databaseChecks, 1);
  }
});

function providerErrorPolicy(engine: EngineCaps): 'public' | 'opaque' | undefined {
  return engine.providerMeta?.clientErrorPolicy;
}

async function submitRealFalFailure(input: {
  engine: EngineCaps;
  status: number;
  code: string;
}) {
  const payload: GeneratePayload = {
    engineId: input.engine.id,
    prompt: 'A controlled provider-error projection test.',
    mode: 't2v',
  };
  const error = new FalGenerationError('fal.ai endpoint rejected the request', {
    status: input.status,
    body: {
      code: input.code,
      message: 'fal.ai endpoint /queue/submit rejected the request',
    },
  });
  (error as FalGenerationError & { code: string }).code = input.code;
  return withMutedFalLogs(() => submitFalGenerateTask({
    falPayload: payload,
    jobId: `job_${input.engine.id}`,
    engineId: input.engine.id,
    engineLabel: input.engine.label,
    isLumaRay2: false,
    batchId: null,
    durationSec: 5,
    pendingReceipt: null,
    paymentMode: 'platform',
    walletChargeReserved: false,
    getLastProviderJobId: () => null,
    setLastProviderJobId: () => undefined,
    persistProviderJobId: async () => undefined,
    logMetricFn: () => undefined,
    clientErrorPolicy: providerErrorPolicy(input.engine),
    deps: {
      generateVideoFn: async () => { throw error; },
      withFalTimeoutFn: async (promise) => promise,
      queryFn: async () => [],
    },
  }));
}

test('opaque infrastructure policy masks real Fal submission errors for public Kling and H3', async () => {
  const cases = [
    { engine: KLING_3_TURBO_STANDARD_ENGINE, status: 422, code: 'FAL_UNPROCESSABLE_ENTITY' },
    { engine: MINIMAX_H3_MAX_ENGINE, status: 500, code: 'FAL_ENDPOINT_FAILURE' },
  ];
  for (const fixture of cases) {
    const result = await submitRealFalFailure(fixture);
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.body.error, 'PROVIDER_REQUEST_FAILED');
    assert.equal(result.body.providerMessage, null);
    assert.equal(result.body.detail, null);
    assert.doesNotMatch(JSON.stringify(result.body), /\bfal(?:\.ai)?\b|endpoint/iu);
  }
});

test('public Fal engines retain their existing provider error codes', async () => {
  const publicEngine = getFalEngineById('pika-text-to-video')?.engine;
  assert.ok(publicEngine);
  const result = await submitRealFalFailure({
    engine: publicEngine,
    status: 422,
    code: 'FAL_UNPROCESSABLE_ENTITY',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.body.error, 'FAL_UNPROCESSABLE_ENTITY');
});

async function withMutedFalLogs<T>(callback: () => Promise<T>): Promise<T> {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => undefined;
  console.warn = () => undefined;
  try {
    return await callback();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}
