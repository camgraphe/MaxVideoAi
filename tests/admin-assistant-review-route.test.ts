import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { AdminAuthError } from '../frontend/src/server/admin';
const scope = { source: 'composer', userId: 'owner', scopeId: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534', requestId: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534' };
const request = (body: unknown, origin = 'https://app.test') => new NextRequest('https://app.test/api/admin/assistants/review', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
test('shared review rejects non-admin, CSRF and oversized content for both reveal and annotation', async () => {
  const api = await import('../frontend/server/admin-assistant-review/http').catch(() => null);
  assert.ok(api?.handleAssistantReviewRequest, 'A restricted review HTTP boundary is required');
  const never = async () => { throw new Error('Must not read or write content'); };
  const deps = { authorize: async () => 'reviewer', reveal: never, annotate: never };
  assert.equal((await api.handleAssistantReviewRequest(request({ action: 'reveal', ...scope }), { ...deps, authorize: async () => { throw new AdminAuthError('Denied', 401); } })).status, 401);
  for (const action of ['reveal', 'annotate']) assert.equal((await api.handleAssistantReviewRequest(request({ action, ...scope }, 'https://attacker.test'), deps)).status, 403);
  assert.equal((await api.handleAssistantReviewRequest(request({ action: 'reveal', ...scope, scopeId: '../private' }), deps)).status, 400);
  assert.equal((await api.handleAssistantReviewRequest(request({ action: 'reveal', ...scope, extra: 'x'.repeat(20000) }), deps)).status, 413);
  const response = await api.handleAssistantReviewRequest(request({ action: 'reveal', ...scope }), { ...deps, reveal: async (actor, received) => { assert.equal(actor, 'reviewer'); assert.deepEqual(received, scope); return { accessId: 'audit-id' } as never; } });
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /private, no-store/);
});

test('review stops reading an oversized stream without trusting Content-Length', async () => {
  const { handleAssistantReviewRequest } = await import('../frontend/server/admin-assistant-review/http');
  let pulled = 0, cancelled = false;
  const stream = new ReadableStream({ pull(controller) { pulled++; controller.enqueue(new Uint8Array(8192)); if(pulled>100)controller.close(); }, cancel() { cancelled = true; } });
  const req = new NextRequest('https://app.test/api/admin/assistants/review', { method:'POST', headers:{origin:'https://app.test','content-type':'application/json','content-length':'10'}, body:stream, duplex:'half' } as RequestInit & { duplex:string });
  const never = async () => { throw new Error('No evidence access'); };
  assert.equal((await handleAssistantReviewRequest(req,{authorize:async()=>'reviewer',reveal:never,annotate:never})).status,413);
  assert.equal(cancelled,true); assert.ok(pulled<10);
});
