import assert from 'node:assert/strict';
import test from 'node:test';

import { GoogleVertexOmniClient } from '../frontend/src/server/video-providers/google-vertex-omni/client';
import {
  classifyGoogleVertexOmniError,
  GoogleVertexOmniError,
} from '../frontend/src/server/video-providers/google-vertex-omni/errors';

test('Gemini Omni client calls the Vertex Interactions API with bearer auth', async () => {
  const requests: Array<{ url: string; method: string; headers: Headers; body?: unknown }> = [];
  const client = new GoogleVertexOmniClient({
    projectId: 'demo-project',
    location: 'global',
    apiBaseUrl: 'https://aiplatform.googleapis.com',
    serviceAccount: {
      client_email: 'svc@example.com',
      private_key: 'unused-in-test',
      token_uri: 'https://oauth2.googleapis.com/token',
    },
    getAccessTokenFn: async () => 'test-token',
    fetchFn: async (url, init) => {
      requests.push({
        url: String(url),
        method: init?.method ?? 'GET',
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response(JSON.stringify({ name: 'interactions/abc123', status: 'RUNNING' }), { status: 200 });
    },
  });

  const response = await client.createInteraction({
    model: 'gemini-omni-flash-preview',
    input: [{ role: 'user', content: [{ type: 'text', text: 'Generate a cinematic product shot' }] }],
    generation_config: { video_config: { task: 'text_to_video', aspect_ratio: '16:9' } },
    response_format: { type: 'video', aspect_ratio: '16:9' },
    background: true,
    store: true,
  });

  assert.equal(response.name, 'interactions/abc123');
  assert.match(requests[0]?.url ?? '', /\/v1beta1\/projects\/demo-project\/locations\/global\/interactions$/);
  assert.equal(requests[0]?.method, 'POST');
  assert.equal(requests[0]?.headers.get('authorization'), 'Bearer test-token');
  assert.equal((requests[0]?.body as Record<string, unknown>).model, 'gemini-omni-flash-preview');
});

test('Gemini Omni client fetches stored interactions by id', async () => {
  const urls: string[] = [];
  const client = new GoogleVertexOmniClient({
    projectId: 'demo-project',
    location: 'global',
    apiBaseUrl: 'https://aiplatform.googleapis.com/',
    serviceAccount: {
      client_email: 'svc@example.com',
      private_key: 'unused-in-test',
    },
    getAccessTokenFn: async () => 'test-token',
    fetchFn: async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ name: 'interactions/abc123', status: 'SUCCEEDED' }), { status: 200 });
    },
  });

  const response = await client.fetchInteraction('interactions/abc123');

  assert.equal(response.status, 'SUCCEEDED');
  assert.equal(urls[0], 'https://aiplatform.googleapis.com/v1beta1/projects/demo-project/locations/global/interactions/abc123');
});

test('Gemini Omni client preserves HTTP status and payload for fallback classification', async () => {
  const client = new GoogleVertexOmniClient({
    projectId: 'demo-project',
    location: 'global',
    apiBaseUrl: 'https://aiplatform.googleapis.com',
    serviceAccount: {
      client_email: 'svc@example.com',
      private_key: 'unused-in-test',
    },
    getAccessTokenFn: async () => 'test-token',
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          error: {
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
            message: 'Quota exceeded for Gemini Omni Flash.',
          },
        }),
        { status: 429 }
      ),
  });

  await assert.rejects(
    () =>
      client.createInteraction({
        model: 'gemini-omni-flash-preview',
        input: [{ role: 'user', content: [{ type: 'text', text: 'Generate a cinematic product shot' }] }],
        generation_config: { video_config: { task: 'text_to_video' } },
        response_format: { type: 'video', aspect_ratio: '16:9' },
        background: true,
      }),
    (error) => {
      assert.ok(error instanceof GoogleVertexOmniError);
      const normalized = classifyGoogleVertexOmniError(error);
      assert.equal(normalized.status, 429);
      assert.equal(normalized.code, 'RESOURCE_EXHAUSTED');
      assert.equal(normalized.errorClass, 'rate_limited');
      assert.equal(normalized.fallbackEligible, true);
      assert.match(normalized.message, /Quota exceeded/);
      return true;
    }
  );
});
