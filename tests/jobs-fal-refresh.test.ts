import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'esbuild';
import type { refreshStaleFalJobs } from '../frontend/app/api/jobs/_lib/jobs-fal-refresh';
import type { JobRow } from '../frontend/app/api/jobs/_lib/jobs-route-types';

// Exercise the real manual-refresh owner without importing DB, provider or payment runtimes.
const frontend = resolve('frontend');
const stubs: Record<string, string> = {
  '@fal-ai/client': 'export class ApiError extends Error { constructor(value) { super(value.message); Object.assign(this, value); } }',
  '@/lib/env': 'export const ENV = { FAL_API_KEY: "offline-only" };',
  '@/lib/db': 'export const query = (...args) => fixture.query(...args);',
  '@/lib/fal-catalog': 'export const resolveFalModelId = async () => "fal-ai/synthetic-video";',
  '@/lib/fal-client': 'export const getFalClient = () => ({queue: fixture.queue});',
  '@/server/fal-webhook-handler': 'export const updateJobFromFalWebhook = payload => fixture.update(payload);',
  './jobs-route-types': 'export const APP_JOBS_SELECT = "job_id, status, video_url";',
};
const bundle = build({
  absWorkingDir: frontend,
  entryPoints: ['app/api/jobs/_lib/jobs-fal-refresh.ts'],
  tsconfig: resolve(frontend, 'tsconfig.json'),
  bundle: true, platform: 'node', format: 'cjs', write: false,
  plugins: [{ name: 'synthetic-fal-refresh', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'fixture' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } }],
});

function job(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: 1, job_id: 'synthetic-job', user_id: 'synthetic-owner', status: 'running', progress: 42,
    provider_job_id: 'synthetic-request', provider: 'fal', surface: 'video', billing_product_key: null,
    video_url: null, preview_video_url: null, audio_url: null, thumb_url: '', preview_frame: null,
    engine_id: 'synthetic-engine', engine_label: 'Synthetic video', duration_sec: 5, prompt: 'Synthetic scene',
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:01:00.000Z',
    final_price_cents: 100, pricing_snapshot: null, settings_snapshot: { surface: 'video', mode: 't2v' },
    currency: 'USD', payment_status: 'paid_wallet', vendor_account_id: null,
    stripe_payment_intent_id: null, stripe_charge_id: null, batch_id: null, group_id: null,
    iteration_index: null, iteration_count: null, render_ids: null, hero_render_id: null, local_key: null,
    message: 'Processing', eta_seconds: 60, eta_label: null, aspect_ratio: '16:9',
    has_audio: false, can_upscale: false, visibility: 'private', indexable: false, ...overrides,
  };
}

async function fixture(row = job(), receipt?: unknown) {
  const reads: string[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const calls: Array<{ method: string; model: string; requestId: string }> = [];
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  let stored = structuredClone(row);
  const state = {
    receiptReadError: null as Error | null,
    status: async (): Promise<unknown> => ({ status: 'IN_PROGRESS' }),
    result: async (): Promise<unknown> => ({ data: { video: { url: 'https://example.test/generated.mp4' } } }),
  };
  const boundary = {
    queue: {
      status: async (model: string, { requestId }: { requestId: string }) => {
        calls.push({ method: 'status', model, requestId });
        return state.status();
      },
      result: async (model: string, { requestId }: { requestId: string }) => {
        calls.push({ method: 'result', model, requestId });
        return state.result();
      },
    },
    update: async (payload: Record<string, unknown>) => {
      updates.push(payload);
      stored = { ...stored, status: String(payload.status) };
    },
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("payload->'falQueueReceipt'")) {
        if (state.receiptReadError) throw state.receiptReadError;
        assert.equal(params[0],row.job_id); assert.equal(params[1],row.provider_job_id);
        return receipt === undefined ? [] : [{receipt, receipt_present: true, receipt_required: true, legacy_enqueued: false}];
      }
      assert.match(sql, /^SELECT /, 'manual refresh must not use a failure write fallback');
      assert.equal(params.length, 1);
      assert.equal(JSON.stringify(params[0]), '["synthetic-job"]');
      return [stored];
    },
  };
  const module = { exports: {} as { refreshStaleFalJobs: typeof refreshStaleFalJobs } };
  runInNewContext((await bundle).outputFiles[0].text, {
    module, exports: module.exports, fixture: boundary, URL, AbortSignal,
    fetch: async(url:string,init:RequestInit)=>{
      reads.push(url); assert.equal(init.method,'GET'); assert.equal(init.redirect,'error');
      return new Response(JSON.stringify(url.endsWith('/status') ? await state.status() : (await state.result() as {data:unknown}).data),{status: url.endsWith('/status') ? 202 : 200});
    }, console: { info() {}, warn() {} },
  });
  return {
    state, updates, calls, queries, reads,
    refresh: (rows = [row], enabled = true) => module.exports.refreshStaleFalJobs({
      rows, shouldRefreshStaleFalJobs: enabled, userId: 'synthetic-owner',
    }),
  };
}

for (const currentStatus of ['queued', 'running', 'processing', 'completed']) {
  for (const unavailable of ['transport', 'null', 'undefined', 'empty', 'no-state-error']) {
    test(`manual Fal refresh preserves ${currentStatus} on ${unavailable} status reads and permits retry`, async () => {
      const row = job({ status: currentStatus });
      const before = structuredClone(row);
      const f = await fixture(row);
      f.state.status = async () => {
        if (unavailable === 'transport') throw new Error('Synthetic transport failure');
        if (unavailable === 'null') return null;
        if (unavailable === 'undefined') return undefined;
        if (unavailable === 'no-state-error') return { error: 'Temporarily unavailable' };
        return {};
      };
      const rows = [row];
      assert.equal(await f.refresh(rows), rows, 'keep the original response when no refresh was confirmed');
      assert.deepEqual(row, before, 'preserve identity, status, progress, timestamps and financial fields');
      assert.equal(f.updates.length, 0, 'a read failure cannot establish a failed render');
      assert.equal(f.queries.length, 0, 'do not write or reload an unconfirmed change');
      assert.deepEqual(f.calls, [{ method: 'status', model: 'fal-ai/synthetic-video', requestId: 'synthetic-request' }]);

      f.state.status = async () => ({ status: 'COMPLETED' });
      const retried = await f.refresh(rows);
      assert.equal(retried[0].status, currentStatus === 'completed' ? 'completed' : 'COMPLETED');
      assert.equal(f.updates.length, 1, 'a later refresh must still finalize the same accepted request');
      assert.equal(f.updates[0].request_id, 'synthetic-request');
      assert.equal(f.calls[2].method, 'result');
      assert.equal(f.calls[2].requestId, 'synthetic-request');
    });
  }
}

for (const state of ['QUEUED', 'IN_QUEUE', 'IN_PROGRESS', 'PROCESSING', 'PENDING', 'UNRECOGNIZED']) {
  test(`manual Fal refresh keeps ${state} pending without result fetch or settlement`, async () => {
    const f = await fixture();
    f.state.status = async () => ({ status: state });
    const rows = [job()];
    assert.equal(await f.refresh(rows), rows);
    assert.equal(f.updates.length, 0);
    assert.equal(f.queries.length, 0);
    assert.equal(f.calls.length, 1);
  });
}

for (const state of ['FAILED', 'FAIL', 'ERROR', 'ERRORED', 'CANCELLED', 'CANCELED', 'NOT_FOUND', 'MISSING', 'UNKNOWN']) {
  test(`manual Fal refresh retains explicit ${state} terminal handling and refund eligibility`, async () => {
    const f = await fixture();
    f.state.status = async () => ({ state: state.toLowerCase(), error_message: 'Synthetic terminal failure' });
    assert.equal((await f.refresh())[0].status, 'failed');
    assert.equal(f.updates.length, 1);
    assert.equal(JSON.stringify(f.updates[0]), JSON.stringify({
      request_id: 'synthetic-request', status: 'failed',
      response: { error: 'Synthetic terminal failure', status: 'failed' },
      result: { error: 'Synthetic terminal failure', status: 'failed' },
      auto_refund_eligible: true, failure_origin: 'provider_terminal',
    }));
    assert.equal(f.calls.length, 1, 'terminal responses must not fetch results');
    assert.equal(f.queries.length, 1);
  });
}

for (const state of ['COMPLETED', 'FINISHED', 'SUCCESS', 'SUCCEEDED']) {
  test(`manual Fal refresh retains ${state} success payload and accepted identity`, async () => {
    const f = await fixture();
    f.state.status = async () => ({ status: state });
    assert.equal((await f.refresh())[0].status, state);
    assert.equal(JSON.stringify(f.updates), JSON.stringify([{
      request_id: 'synthetic-request', status: state,
      result: { data: { video: { url: 'https://example.test/generated.mp4' } } },
    }]));
    assert.deepEqual(f.calls, [
      { method: 'status', model: 'fal-ai/synthetic-video', requestId: 'synthetic-request' },
      { method: 'result', model: 'fal-ai/synthetic-video', requestId: 'synthetic-request' },
    ]);
  });
}

test('manual Fal refresh only contacts eligible Fal video jobs when explicitly requested', async () => {
  const f = await fixture();
  const rows = [job()];
  assert.equal(await f.refresh(rows, false), rows);
  for (const overrides of [
    { provider: 'luma' }, { surface: 'image' }, { provider_job_id: null },
    { status: 'failed' }, { status: 'completed', video_url: 'https://example.test/existing.mp4' },
  ]) {
    await f.refresh([job(overrides)]);
  }
  assert.equal(f.calls.length, 0);
  assert.equal(f.updates.length, 0);
  assert.equal(f.queries.length, 0);
});


test('manual recovery follows persisted V4 receipt through 202, completion and result without SDK reconstruction',async()=>{
  const base='https://queue.fal.run/kling/v4/reference-to-video/requests/synthetic-request';
  const receipt={requestId:'synthetic-request',endpoint:'kling/v4/reference-to-video',metadataState:'verified',statusUrl:base+'/status',responseUrl:base,cancelUrl:base+'/cancel'};
  const row=job({engine_id:'kling-v4'});
  const f=await fixture(row,receipt);
  assert.equal((await f.refresh())[0].status,'running'); assert.equal(f.updates.length,0);
  f.state.status=async()=>({status:'COMPLETED',request_id:'synthetic-request'});
  const completed=await f.refresh();
  assert.equal(completed[0].status,'COMPLETED');
  assert.equal(f.updates.length,1); assert.equal(f.updates[0].request_id,'synthetic-request');
  assert.equal((f.updates[0].result as {data:{video:{url:string}}}).data.video.url,'https://example.test/generated.mp4');
  assert.deepEqual(f.reads,[base+'/status',base+'/status',base]);
  assert.equal(f.calls.length,0);
  assert.equal(row.final_price_cents,100); assert.equal(row.payment_status,'paid_wallet');
});

test('receipt-store read failure preserves the accepted job and never falls back to an SDK request',async()=>{
  const row=job({engine_id:'kling-v4'});
  const f=await fixture(row);
  f.state.receiptReadError=new Error('Temporary receipt store read failure');
  const recovered=await f.refresh();
  assert.equal(recovered[0].status,'running');
  assert.equal(f.updates.length,0); assert.equal(f.calls.length,0); assert.equal(f.reads.length,0);
});
