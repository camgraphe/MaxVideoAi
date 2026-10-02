import assert from 'node:assert/strict';
import test from 'node:test';
import * as status from '../frontend/lib/seedance-workflow-status';
import type { SeedanceWorkflowView } from '../frontend/lib/seedance-workflow-contract';

test('workflow tracking polls both owned tasks and refreshes final completion with the confirmed account', async () => {
  const calls: string[] = [];
  const view: SeedanceWorkflowView = { draft: { jobId: 'draft', status: 'completed', amountCents: 129, currency: 'USD', paymentStatus: 'paid_wallet', videoUrl: '/draft', thumbUrl: null },
    final: { jobId: 'final', status: 'running', amountCents: 651, currency: 'USD', paymentStatus: 'paid_wallet', videoUrl: null, thumbUrl: null },
    settings: { durationSec: 5, aspectRatio: '16:9', audio: false, resolution: '480p' }, expiresAt: null, eligibility: 'finalizing' };
  let reads = 0;
  const fetch = async (url: string, init: RequestInit) => {
    calls.push(url); assert.equal(new Headers(init.headers).get('authorization'), 'Bearer confirmed');
    if (url.endsWith('/seedance-workflow')) return new Response(JSON.stringify(++reads === 1 ? view : { ...view, eligibility: 'finalized', final: { ...view.final, status: 'completed', videoUrl: '/final' } }));
    return new Response('{}');
  };
  assert.equal(typeof status.readSeedanceWorkflowStatus, 'function');
  const result = await status.readSeedanceWorkflowStatus('draft', 'confirmed', fetch);
  assert.deepEqual(calls, ['/api/jobs/draft', '/api/jobs/draft/seedance-workflow', '/api/jobs/final', '/api/jobs/draft/seedance-workflow']);
  assert.equal(result?.eligibility, 'finalized');
  assert.equal(result?.draft.videoUrl, '/draft');
  assert.equal(result?.final?.videoUrl, '/final');
});

test('foreign or unavailable workflow reads never start final tracking', async () => {
  const calls: string[] = [];
  assert.equal(await status.readSeedanceWorkflowStatus('foreign', 'confirmed', async (url: string) => { calls.push(url); return new Response('{}', { status: 404 }); }), null);
  assert.deepEqual(calls, ['/api/jobs/foreign']);
  await assert.rejects(status.readSeedanceWorkflowStatus('draft', 'confirmed', async () => new Response('{}', { status: 503 })), /unavailable/i);
});
