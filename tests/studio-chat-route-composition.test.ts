import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from '../frontend/node_modules/next/server';
import { handleStudioChatPost } from '../frontend/app/api/studio/_lib/studio-chat-handler';

test('authenticated Chat rejects legacy, forged quote and Mock payloads before any provider request', async (context) => {
  const network = context.mock.method(globalThis, 'fetch', async () => { throw new Error('Provider access forbidden'); });
  for (const name of ['OPENAI_API_KEY', 'GEMINI_API_KEY']) {
    const previous = process.env[name];
    process.env[name] = 'composition-test-not-a-real-provider-key';
    context.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
  for (const payload of [
    { provider: 'openai', messages: [{ role: 'user', content: 'Hello' }] },
    { provider: 'gemini', messages: [{ role: 'user', content: 'Hello' }] },
    { provider: 'gemini', messages: [{ role: 'user', content: 'Hello' }], quote: { totalCents: 0 }, estimateToken: 'forged' },
    { provider: 'gemini', messages: [{ role: 'user', content: 'Hello' }], mode: 'mock' },
  ]) {
    const response = await handleStudioChatPost(new NextRequest('http://localhost/api/studio/chat', {
      method: 'POST', body: JSON.stringify(payload),
    }), async () => ({ userId: 'authenticated-owner' }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'STUDIO_CHAT_LIVE_UNAVAILABLE');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal(network.mock.callCount(), 0);
});

test('Chat retains authentication even when Live is unavailable', async () => {
  const response = await handleStudioChatPost(new NextRequest('http://localhost/api/studio/chat', { method: 'POST' }), async () => ({ userId: null }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'UNAUTHORIZED');
});
