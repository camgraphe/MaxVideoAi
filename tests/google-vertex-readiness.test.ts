import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { runGoogleVertexReadinessProbe } from '../frontend/server/google-vertex-readiness';

const secretAccessToken = 'google-access-token-must-never-appear';

const env = {
  GOOGLE_VERTEX_PROJECT_ID: 'maxvideoai-mcp-staging-260827',
  GOOGLE_VERTEX_LOCATION: 'global',
  GOOGLE_VERTEX_OMNI_LOCATION: 'global',
  GOOGLE_VERTEX_API_BASE_URL: 'https://aiplatform.googleapis.com',
  GOOGLE_VERTEX_INPUT_GCS_URI: 'gs://maxvideoai-mcp-staging-inputs-260827/mcp-inputs',
  GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'maxvideoai-mcp-staging@example.iam.gserviceaccount.com',
    private_key: 'unused-test-private-key',
    project_id: 'maxvideoai-mcp-staging-260827',
  }),
} as NodeJS.ProcessEnv;

test('Google Vertex readiness verifies OAuth, private GCS round-trip, and all eight execution routes without generation', async () => {
  const calls: Array<{ url: string; method: string; body: BodyInit | null | undefined }> = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body });

    if (url.includes('/upload/storage/v1/')) {
      return new Response(JSON.stringify({ generation: '7' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('storage.googleapis.com/storage/v1/') && method === 'GET') {
      return new Response('maxvideoai-vertex-readiness-v1', { status: 200 });
    }
    if (url.includes('storage.googleapis.com/storage/v1/') && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (url.includes('/v1/publishers/google/models/') && method === 'GET') {
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.endsWith(':generateContent') || url.endsWith(':predictLongRunning') || url.endsWith('/interactions')) {
      return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 });
    }
    if (url.endsWith(':fetchPredictOperation') || url.includes('/interactions/maxvideoai-readiness-does-not-exist')) {
      return new Response(JSON.stringify({ error: { status: 'NOT_FOUND' } }), { status: 404 });
    }
    throw new Error(`Unexpected readiness URL: ${url}`);
  };

  const result = await runGoogleVertexReadinessProbe({
    env,
    fetchFn,
    getAccessTokenFn: async () => secretAccessToken,
    randomIdFn: () => 'probe-123',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.checks.oauth, { ok: true });
  assert.deepEqual(result.checks.gcs, { upload: true, read: true, delete: true });
  assert.equal(result.checks.models.length, 8);
  assert.equal(result.checks.models.every((model) => model.ok && model.submitStatus === 400), true);
  assert.deepEqual(
    result.checks.models.map((model) => model.engineId),
    [
      'nano-banana',
      'nano-banana-lite',
      'nano-banana-2',
      'nano-banana-pro',
      'veo-3-1-lite',
      'veo-3-1-fast',
      'veo-3-1',
      'gemini-omni-flash',
    ],
  );
  assert.equal(calls.filter((call) => call.url.includes('/v1/publishers/google/models/')).length, 5);
  assert.equal(calls.filter((call) => call.url.endsWith(':generateContent')).length, 4);
  assert.equal(calls.filter((call) => call.url.endsWith(':predictLongRunning')).length, 3);
  assert.equal(calls.filter((call) => call.url.endsWith(':fetchPredictOperation')).length, 3);
  assert.equal(calls.filter((call) => call.url.endsWith('/interactions') && call.method === 'POST').length, 1);
  assert.equal(calls.filter((call) => call.url.includes('/interactions/maxvideoai-readiness-does-not-exist')).length, 1);
  assert.equal(calls.some((call) => call.url.endsWith(':getIamPolicy')), false);
  assert.equal(calls.some((call) => call.url.includes('cloudresourcemanager.googleapis.com')), false);
  assert.equal(
    calls
      .filter((call) => call.url.endsWith(':generateContent') || call.url.endsWith(':predictLongRunning') || call.url.endsWith('/interactions'))
      .every((call) => call.body === '{}'),
    true,
  );
  assert.equal(calls.some((call) => call.method === 'POST' && call.url.includes('/upload/storage/v1/')), true);
  assert.equal(calls.some((call) => call.method === 'GET' && call.url.includes('generation=7')), true);
  assert.equal(calls.some((call) => call.method === 'DELETE' && call.url.includes('generation=7')), true);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(secretAccessToken));
});

test('Google Vertex readiness cleans up its probe object when one model is unavailable', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    if (url.includes('/upload/storage/v1/')) {
      return new Response(JSON.stringify({ generation: '8' }), { status: 200 });
    }
    if (url.includes('storage.googleapis.com/storage/v1/') && method === 'GET') {
      return new Response('maxvideoai-vertex-readiness-v1', { status: 200 });
    }
    if (url.includes('storage.googleapis.com/storage/v1/') && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (url.includes('/v1/publishers/google/models/') && method === 'GET') {
      return new Response('{}', { status: 200 });
    }
    if (url.includes('veo-3.1-lite-generate-001') && url.endsWith(':predictLongRunning')) {
      return new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED' } }), { status: 403 });
    }
    if (url.endsWith(':generateContent') || url.endsWith(':predictLongRunning') || url.endsWith('/interactions')) {
      return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 });
    }
    if (url.endsWith(':fetchPredictOperation') || url.includes('/interactions/maxvideoai-readiness-does-not-exist')) {
      return new Response('{}', { status: 404 });
    }
    throw new Error(`Unexpected readiness URL: ${url}`);
  };

  const result = await runGoogleVertexReadinessProbe({
    env,
    fetchFn,
    getAccessTokenFn: async () => secretAccessToken,
    randomIdFn: () => 'probe-404',
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.checks.gcs, { upload: true, read: true, delete: true });
  assert.deepEqual(
    result.checks.models.find((model) => model.engineId === 'veo-3-1-lite'),
    {
      engineId: 'veo-3-1-lite',
      providerModel: 'veo-3.1-lite-generate-001',
      kind: 'veo',
      ok: false,
      metadataStatus: null,
      submitStatus: 403,
      pollStatus: null,
    },
  );
  assert.equal(calls.some((call) => call.method === 'DELETE'), true);
});

test('Google Vertex readiness keeps Omni on global when the shared Vertex location is regional', async () => {
  const calls: string[] = [];
  const productionLikeEnv = {
    ...env,
    GOOGLE_VERTEX_LOCATION: 'us-central1',
  } as NodeJS.ProcessEnv;
  delete productionLikeEnv.GOOGLE_VERTEX_OMNI_LOCATION;

  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push(url);
    if (url.includes('/upload/storage/v1/')) {
      return new Response(JSON.stringify({ generation: '9' }), { status: 200 });
    }
    if (url.includes('storage.googleapis.com/storage/v1/') && method === 'GET') {
      return new Response('maxvideoai-vertex-readiness-v1', { status: 200 });
    }
    if (url.includes('storage.googleapis.com/storage/v1/') && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (url.includes('/v1/publishers/google/models/') && method === 'GET') {
      return new Response('{}', { status: 200 });
    }
    if (url.endsWith(':generateContent') || url.endsWith(':predictLongRunning') || url.endsWith('/interactions')) {
      return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 });
    }
    if (url.endsWith(':fetchPredictOperation') || url.includes('/interactions/maxvideoai-readiness-does-not-exist')) {
      return new Response('{}', { status: 404 });
    }
    throw new Error(`Unexpected readiness URL: ${url}`);
  };

  const result = await runGoogleVertexReadinessProbe({
    env: productionLikeEnv,
    fetchFn,
    getAccessTokenFn: async () => secretAccessToken,
    randomIdFn: () => 'probe-regional-shared-location',
  });

  assert.equal(result.ok, true);
  assert.equal(calls.some((url) => url.includes('/locations/global/interactions')), true);
  assert.equal(calls.some((url) => url.includes('/locations/us-central1/interactions')), false);
});

test('Google Vertex readiness rejects an unsupported-location response even when the provider returns 400', async () => {
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/upload/storage/v1/')) {
      return new Response(JSON.stringify({ generation: '10' }), { status: 200 });
    }
    if (url.includes('storage.googleapis.com/storage/v1/') && method === 'GET') {
      return new Response('maxvideoai-vertex-readiness-v1', { status: 200 });
    }
    if (url.includes('storage.googleapis.com/storage/v1/') && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (url.includes('/v1/publishers/google/models/') && method === 'GET') {
      return new Response('{}', { status: 200 });
    }
    if (url.endsWith('/interactions')) {
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            status: 'INVALID_ARGUMENT',
            message: 'Unsupported location: global.',
          },
        }),
        { status: 400 },
      );
    }
    if (url.endsWith(':generateContent') || url.endsWith(':predictLongRunning')) {
      return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 });
    }
    if (url.endsWith(':fetchPredictOperation') || url.includes('/interactions/maxvideoai-readiness-does-not-exist')) {
      return new Response('{}', { status: 404 });
    }
    throw new Error(`Unexpected readiness URL: ${url}`);
  };

  const result = await runGoogleVertexReadinessProbe({
    env,
    fetchFn,
    getAccessTokenFn: async () => secretAccessToken,
    randomIdFn: () => 'probe-unsupported-location',
  });

  const omni = result.checks.models.find((model) => model.engineId === 'gemini-omni-flash');
  assert.equal(result.ok, false);
  assert.deepEqual(omni, {
    engineId: 'gemini-omni-flash',
    providerModel: 'gemini-omni-flash-preview',
    kind: 'omni',
    ok: false,
    metadataStatus: 200,
    submitStatus: 400,
    pollStatus: null,
  });
});

test('Google Vertex readiness rejects an explicitly regional Omni location before probing providers', async () => {
  const invalidEnv = {
    ...env,
    GOOGLE_VERTEX_OMNI_LOCATION: 'us-central1',
  } as NodeJS.ProcessEnv;

  await assert.rejects(
    () =>
      runGoogleVertexReadinessProbe({
        env: invalidEnv,
        fetchFn: async () => {
          throw new Error('Provider calls must not start with an invalid Omni location.');
        },
        getAccessTokenFn: async () => secretAccessToken,
      }),
    /GOOGLE_VERTEX_OMNI_LOCATION must be global/,
  );
});

test('Google Vertex readiness is exposed only through an authenticated unscheduled route', () => {
  const routePath = join(process.cwd(), 'frontend/app/api/cron/google-vertex-readiness/route.ts');
  assert.equal(existsSync(routePath), true);
  const route = readFileSync(routePath, 'utf8');
  assert.match(route, /authorizeCronRequest/);
  assert.match(route, /x-google-vertex-veo-poll-token/);
  assert.match(route, /runGoogleVertexReadinessProbe/);
  assert.doesNotMatch(readFileSync('frontend/vercel.mcp-staging.json', 'utf8'), /google-vertex-readiness/);
});
