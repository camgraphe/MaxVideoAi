import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { AdminAuthError } from '../frontend/src/server/admin';

const scope = { userId: 'owner', projectId: 'film', requestId: 'a1bd8c76-7171-4f53-92f7-b0d7e418f534' };
const request = (body: unknown = scope, origin: string | null = 'https://maxvideoai.test') => new NextRequest('https://maxvideoai.test/api/admin/studio/review', { method:'POST', headers: { 'content-type':'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });

test('Studio review rejects non-admin, cross-origin and unbounded requests before reading content', async () => {
  const module = await import('../frontend/server/admin-studio-review/http').catch(() => null);
  assert.ok(module?.handleStudioReviewRequest, 'Detail reveal needs an authenticated request boundary');
  const reveal = async () => { throw new Error('Content must not be read'); };
  for (const status of [401,403]) {
    const response = await module.handleStudioReviewRequest(request(), { authorize: async () => { throw new AdminAuthError('Denied', status); }, reveal });
    assert.equal(response.status,status);
  }
  const dependencies = { authorize: async () => 'admin', reveal };
  for (const origin of [null,'https://attacker.test']) assert.equal((await module.handleStudioReviewRequest(request(scope,origin),dependencies)).status,403);
  assert.equal((await module.handleStudioReviewRequest(request({...scope,projectId:'../film'}),dependencies)).status,400);
  assert.equal((await module.handleStudioReviewRequest(request({...scope,extra:'x'.repeat(5000)}),dependencies)).status,413);
});

test('successful review responses are private and never cache content', async () => {
  const { handleStudioReviewRequest } = await import('../frontend/server/admin-studio-review/http');
  const result = await handleStudioReviewRequest(request(), {
    authorize: async () => 'reviewer',
    reveal: async (actor, received) => { assert.equal(actor,'reviewer'); assert.deepEqual(received,scope); return {accessId:'audit-record',coverage:'partial'} as never; },
  });
  assert.equal(result.status,200);
  assert.match(result.headers.get('cache-control')!, /private, no-store/);
  assert.deepEqual(await result.json(), {detail:{accessId:'audit-record',coverage:'partial'}});
});
