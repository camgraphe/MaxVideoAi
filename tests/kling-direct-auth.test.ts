import assert from 'node:assert/strict';
import test from 'node:test';
import { KlingDirectClient } from '../frontend/src/server/video-providers/kling-direct/client';

test('direct client supports the documented API key while preserving legacy JWT authentication', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; authorization: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), authorization: new Headers(init?.headers).get('Authorization') });
    assert.equal(init?.method, 'GET');
    return new Response(JSON.stringify({ code: 0, data: { task_id: 'synthetic-task', task_status: 'processing' } }), { status: 200 });
  };
  try {
    const apiKeyClient = new KlingDirectClient({ apiKey: 'test-api-key', baseUrl: 'https://api-singapore.klingai.com' });
    await apiKeyClient.retrieveTask({ pollPathPrefix: '/v1/videos/text2video', providerJobId: 'synthetic-task' });
    assert.equal(requests[0].authorization, 'Bearer test-api-key');
    const legacyClient = new KlingDirectClient({ accessKey: 'test-access-key', secretKey: 'test-secret-key', baseUrl: 'https://api-singapore.klingai.com' });
    await legacyClient.retrieveTask({ pollPathPrefix: '/v1/videos/text2video', providerJobId: 'synthetic-task' });
    const token = requests[1].authorization!.slice(7);
    assert.equal(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).iss, 'test-access-key');
    assert.equal(requests[0].url, 'https://api-singapore.klingai.com/v1/videos/text2video/synthetic-task');
    assert.throws(() => new KlingDirectClient({ baseUrl: 'https://api-singapore.klingai.com' }), /not configured/);
  } finally { globalThis.fetch = originalFetch; }
});
