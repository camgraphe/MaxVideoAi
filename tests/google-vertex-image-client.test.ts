import assert from 'node:assert/strict';
import test from 'node:test';

import { GoogleVertexImageClient } from '../frontend/src/server/images/google-vertex-image-client.ts';

test('calls Vertex generateContent with bearer authentication', async () => {
  const requests: Array<{ url: string; authorization: string | null }> = [];
  const client = new GoogleVertexImageClient({
    projectId: 'demo-project',
    location: 'global',
    apiBaseUrl: 'https://aiplatform.googleapis.com',
    serviceAccount: { client_email: 'svc@example.com', private_key: 'unused' },
    getAccessTokenFn: async () => 'vertex-token',
    retryDelayMs: 0,
    fetchFn: async (url, init) => {
      requests.push({ url: String(url), authorization: new Headers(init?.headers).get('authorization') });
      return new Response(JSON.stringify({ candidates: [] }), { status: 200 });
    },
  });

  await client.generateContent('gemini-3.1-flash-image', {
    contents: [{ role: 'user', parts: [{ text: 'test' }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  assert.equal(requests[0]?.authorization, 'Bearer vertex-token');
  assert.equal(
    requests[0]?.url,
    'https://aiplatform.googleapis.com/v1/projects/demo-project/locations/global/publishers/google/models/gemini-3.1-flash-image:generateContent'
  );
});

test('retries one rate-limited Vertex image request and returns the successful response', async () => {
  let requestCount = 0;
  const client = new GoogleVertexImageClient({
    projectId: 'demo-project',
    location: 'global',
    apiBaseUrl: 'https://aiplatform.googleapis.com',
    serviceAccount: { client_email: 'svc@example.com', private_key: 'unused' },
    getAccessTokenFn: async () => 'vertex-token',
    retryDelayMs: 0,
    fetchFn: async () => {
      requestCount += 1;
      if (requestCount === 1) {
        return new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }), { status: 429 });
      }
      return new Response(JSON.stringify({
        responseId: 'vertex-response-2',
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } }] } }],
      }), { status: 200 });
    },
  });

  const response = await client.generateContent('gemini-3.1-flash-image', {
    contents: [{ role: 'user', parts: [{ text: 'test' }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }) as { responseId?: string };

  assert.equal(requestCount, 2);
  assert.equal(response.responseId, 'vertex-response-2');
});

test('retries one empty non-safety Vertex image response', async () => {
  let requestCount = 0;
  const client = new GoogleVertexImageClient({
    projectId: 'demo-project',
    location: 'global',
    apiBaseUrl: 'https://aiplatform.googleapis.com',
    serviceAccount: { client_email: 'svc@example.com', private_key: 'unused' },
    getAccessTokenFn: async () => 'vertex-token',
    retryDelayMs: 0,
    fetchFn: async () => {
      requestCount += 1;
      return new Response(JSON.stringify(
        requestCount === 1
          ? { responseId: 'empty-response', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Done' }] } }] }
          : {
              responseId: 'image-response',
              candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } }] } }],
            }
      ), { status: 200 });
    },
  });

  const response = await client.generateContent('gemini-3.1-flash-image', {
    contents: [{ role: 'user', parts: [{ text: 'test' }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }) as { responseId?: string };

  assert.equal(requestCount, 2);
  assert.equal(response.responseId, 'image-response');
});

test('does not retry Vertex access errors or safety-blocked empty responses', async () => {
  let accessRequests = 0;
  const accessClient = new GoogleVertexImageClient({
    projectId: 'demo-project',
    location: 'global',
    apiBaseUrl: 'https://aiplatform.googleapis.com',
    serviceAccount: { client_email: 'svc@example.com', private_key: 'unused' },
    getAccessTokenFn: async () => 'vertex-token',
    retryDelayMs: 0,
    fetchFn: async () => {
      accessRequests += 1;
      return new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED' } }), { status: 403 });
    },
  });

  await assert.rejects(() => accessClient.generateContent('gemini-3.1-flash-image', {
    contents: [{ role: 'user', parts: [{ text: 'test' }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }));
  assert.equal(accessRequests, 1);

  let safetyRequests = 0;
  const safetyClient = new GoogleVertexImageClient({
    projectId: 'demo-project',
    location: 'global',
    apiBaseUrl: 'https://aiplatform.googleapis.com',
    serviceAccount: { client_email: 'svc@example.com', private_key: 'unused' },
    getAccessTokenFn: async () => 'vertex-token',
    retryDelayMs: 0,
    fetchFn: async () => {
      safetyRequests += 1;
      return new Response(JSON.stringify({
        responseId: 'blocked-response',
        promptFeedback: { blockReason: 'SAFETY' },
        candidates: [],
      }), { status: 200 });
    },
  });

  const safetyResponse = await safetyClient.generateContent('gemini-3.1-flash-image', {
    contents: [{ role: 'user', parts: [{ text: 'test' }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }) as { responseId?: string };
  assert.equal(safetyRequests, 1);
  assert.equal(safetyResponse.responseId, 'blocked-response');
});
