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
