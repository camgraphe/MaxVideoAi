import assert from 'node:assert/strict';
import { canVisitorBrowseWorkspacePath } from '../frontend/lib/visitor-access';
import test from 'node:test';
import { defaultFinishingSettings, FINISHING_TOOL_IDS } from '../frontend/src/lib/toolbox/finishing';
import { validateToolBlock, type ToolResult } from '../frontend/src/lib/toolbox/contract';
import { FINISHING_PROFILES, estimateFinishingVendorBudget, prepareFinishingProvider } from '../frontend/src/server/tools/finishing-providers';
import { isFinishingProfileReleased } from '../frontend/src/server/tools/finishing-release';
import { computeCanonicalFinishingBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { runFinishingTool } from '../frontend/src/server/tools/finishing-run';
import { refreshFinishingTool } from '../frontend/src/server/tools/finishing-status';
import { validateFinishingOutputFacts } from '../frontend/src/server/tools/finishing-output';
import type { PreparedFinishingTool } from '../frontend/src/server/tools/finishing-prepare';
import { buildRecentGenerationSurfaceFilterClause } from '../frontend/src/server/generations/recent-generations';

const facts = { width: 1920, height: 1080, durationSec: 10, fps: 30 };
const source = { type: 'asset', assetId: 'ma_owned', kind: 'video' } as const;
const url = 'https://owned.example/source.mp4';

test('selected tools accept portable settings and reject provider controls, extra sources and image inputs', () => {
  for (const toolId of FINISHING_TOOL_IDS) {
    const block = { toolId, version: 1, inputs: [source], settings: defaultFinishingSettings(toolId) };
    assert.deepEqual(validateToolBlock(block), block);
    assert.throws(() => validateToolBlock({ ...block, settings: { ...block.settings, model: 'chosen-on-client' } }));
    assert.throws(() => validateToolBlock({ ...block, inputs: [source, source] }));
    assert.throws(() => validateToolBlock({ ...block, inputs: [{ ...source, kind: 'image' }] }));
    assert.throws(() => validateToolBlock({ ...block, version: 2 }));
  }
  assert.throws(() => validateToolBlock({ toolId: 'fix-blur', version: 1, inputs: [source], settings: { quality: 'pro' } }));
});

test('provider mappings preserve source size/cadence except the explicit requested change', () => {
  assert.deepEqual(prepareFinishingProvider('denoise', { quality: 'standard', strength: 'auto' }, url, facts).input,
    { video_url: url, H264_output: true, model: 'Nyx Fast', upscale_factor: 1 });
  assert.equal(prepareFinishingProvider('denoise', { quality: 'pro', strength: 'strong' }, url, facts).input.noise, 0.75);
  assert.deepEqual(prepareFinishingProvider('fix-blur', {}, url, facts).input, { video_url: url, H264_output: true });
  const motion = prepareFinishingProvider('smooth-motion', { quality: 'pro', fps: 120 }, url, facts);
  assert.deepEqual(motion.input, { video_url: url, H264_output: true, model: 'Aion', target_fps: 120, slowdown_factor: 1 });
  const restore = prepareFinishingProvider('restore-video', {}, url, { ...facts, fps: 29.97 });
  assert.equal(restore.input.target_fps, 29.97);
  assert.equal(restore.input.enhancement_tier, 'standard');
  assert.equal(restore.input.fidelity, 'high');
  assert.equal(restore.input.bit_depth, 8);
  assert.equal(prepareFinishingProvider('restore-video', { quality: 'pro' }, url, facts).profile.generative, true);
  for (const invalid of [{ ...facts, fps: 0 }, { ...facts, durationSec: 61 }, { ...facts, width: 8000 }, { ...facts, fps: 120 }]) {
    assert.throws(() => prepareFinishingProvider('denoise', {}, url, invalid));
  }
  assert.throws(() => prepareFinishingProvider('smooth-motion', { fps: 60 }, url, { ...facts, fps: 60 }));
});

test('vendor budgets match documented examples without claiming a linear Topaz invoice rate', () => {
  assert.equal(estimateFinishingVendorBudget('denoise', { quality: 'standard', strength: 'auto' }, facts), 0.1);
  assert.equal(estimateFinishingVendorBudget('denoise', { quality: 'pro', strength: 'auto' }, facts), 0.2);
  assert.equal(estimateFinishingVendorBudget('fix-blur', { quality: 'standard' }, facts), 0.1);
  assert.equal(estimateFinishingVendorBudget('fix-blur', { quality: 'standard' }, { ...facts, durationSec: 10.01 }), 0.2);
  assert.equal(estimateFinishingVendorBudget('smooth-motion', { quality: 'standard', fps: 60 }, facts), 0.3);
  assert.equal(estimateFinishingVendorBudget('smooth-motion', { quality: 'pro', fps: 60 }, facts), 0.5);
  assert.equal(estimateFinishingVendorBudget('restore-video', { quality: 'standard', resolution: '1080p' }, facts), 0.072);
  assert.ok(Math.abs(estimateFinishingVendorBudget('restore-video', { quality: 'pro', resolution: '4k' }, facts) - 2.88) < 1e-9);
});

test('customer prices use the canonical 2.5 target, with existing cent rounding', async () => {
  for (const [vendorBudgetUsd, totalCents] of [[0.1, 25], [0.2, 50], [0.3, 75], [0.072, 18]]) {
    const pricing = await computeCanonicalFinishingBillingSnapshot({ toolId: 'denoise', quality: 'standard', vendorBudgetUsd, durationSec: 10, profileId: 'test', pricingSource: 'https://fal.ai' });
    assert.equal(pricing.totalCents, totalCents);
    assert.equal(pricing.currency, 'USD');
  }
});

async function preparedFixture(): Promise<PreparedFinishingTool> {
  const toolId = 'denoise', settings = defaultFinishingSettings(toolId);
  const provider = prepareFinishingProvider(toolId, settings, url, facts);
  const pricing = await computeCanonicalFinishingBillingSnapshot({ toolId, quality: 'standard', vendorBudgetUsd: 0.1, durationSec: 10, profileId: provider.profile.id, pricingSource: provider.profile.pricingSource });
  return { block: validateToolBlock({ toolId, version: 1, inputs: [source], settings }), source: { source, url }, facts, ...provider, pricing, released: false };
}
test('owner-approved profiles are released while unknown profiles remain blocked', async () => {
  const prepared = await preparedFixture();
  for (const candidates of Object.values(FINISHING_PROFILES)) {
    for (const [quality, profile] of Object.entries(candidates)) {
      assert.equal(isFinishingProfileReleased(profile!, quality as 'standard' | 'pro'), true);
    }
  }
  const unapproved = { ...prepared, profile: { ...prepared.profile, id: 'unapproved-test-profile' } };
  let reserved = false;
  const request = { block: prepared.block, requestId: 'f11b7f5c-18a4-4b31-845a-a64eaab89b30', acceptedQuote: { totalCents: 25, currency: 'USD' } };
  await assert.rejects(runFinishingTool(request, 'owner', { prepare: async () => unapproved, reserve: async () => { reserved = true; throw new Error('must not reserve'); } }), /TOOL_QUALIFICATION_REQUIRED/);
  assert.equal(reserved, false);
});

test('stale quotes fail before a debit; duplicate attempts never call the provider twice; failures refund', async () => {
  const prepared = await preparedFixture();
  const calls: string[] = [];
  let existing = false;
  const result: ToolResult = { toolId: 'denoise', version: 1, jobId: 'fixture', sourceAssets: [source], outputs: [{ asset: { type: 'job-output', jobId: 'fixture', outputId: 'exact-output', kind: 'video' }, kind: 'video', originalUrl: 'https://owned.example/result.mp4' }] };
  const dependencies = { prepare: async () => prepared, requireReleased: () => {}, storageReady: () => true,
    reserve: async () => { calls.push('reserve'); if (existing) return { created: false, status: 'completed', result }; existing = true; return { created: true, status: 'pending', result: null }; },
    execute: async () => { calls.push('execute'); return { request_id: 'fal-fixture' } as never; },
    submitted: async () => { calls.push('submitted'); }, fail: async () => { calls.push('refund'); },
  };
  const request = { block: prepared.block, requestId: 'f11b7f5c-18a4-4b31-845a-a64eaab89b30', acceptedQuote: { totalCents: 24, currency: 'USD' } };
  await assert.rejects(runFinishingTool(request, 'owner', dependencies), /QUOTE_CHANGED/);
  assert.deepEqual(calls, []);
  request.acceptedQuote.totalCents = 25;
  const first = await runFinishingTool(request, 'owner', dependencies);
  const repeated = await runFinishingTool(request, 'owner', dependencies);
  assert.equal(first.jobId, repeated.jobId);
  assert.equal(calls.filter(call => call === 'execute').length, 1);
  existing = false;
  await assert.rejects(runFinishingTool(request, 'owner', { ...dependencies, execute: async () => { throw new Error('provider failed'); } }), /provider failed/);
  assert.equal(calls.at(-1), 'refund');
});

test('finishing jobs stay outside video creator feeds', () => {
  const sql = buildRecentGenerationSurfaceFilterClause('video', []);
  assert.match(sql, /'background-removal', 'tool'/);
  assert.equal(buildRecentGenerationSurfaceFilterClause('tool', []), 'surface = $1');
});

test('output validation rejects changed duration, cadence, aspect ratio and unrequested resizing', async () => {
  const prepared = await preparedFixture();
  validateFinishingOutputFacts(prepared, facts);
  assert.throws(() => validateFinishingOutputFacts({...prepared,facts:{...facts,hasAudio:true}},{...facts,hasAudio:false}));
  for (const changed of [{...facts,durationSec:15},{...facts,fps:24},{...facts,width:1280,height:720},{...facts,width:1080,height:1920}]) {
    assert.throws(() => validateFinishingOutputFacts(prepared,changed));
  }
});

test('pending results resume once; network failures never refund and competing polls cannot persist twice', async () => {
  const prepared = await preparedFixture();
  const calls: string[] = [];
  const job = { status:'queued',payment_status:'paid_wallet',provider_job_id:'stored-provider-id',updated_at:new Date().toISOString(),settings_snapshot:{preparedTool:prepared} };
  const result: ToolResult = {toolId:'denoise',version:1,jobId:'job',sourceAssets:[source],outputs:[{asset:{type:'job-output',jobId:'job',outputId:'output',kind:'video'},originalUrl:url,kind:'video'}]};
  const deps = { read:async()=>job,status:async()=>({jobId:'job',status:job.status,result:null,error:null}),
    poll:async()=>({status:'COMPLETED'} as never),result:async()=>({data:{},requestId:'stored-provider-id'}),
    claim:async()=>{if(calls.includes('claim'))return false;calls.push('claim');return true;},
    persist:async()=>{calls.push('persist');return result;},complete:async()=>{calls.push('complete');},fail:async()=>{calls.push('refund');} };
  await refreshFinishingTool('owner','job',{...deps,poll:async()=>{throw new Error('temporary network outage');}});
  assert.deepEqual(calls,[]);
  await Promise.all([refreshFinishingTool('owner','job',deps),refreshFinishingTool('owner','job',deps)]);
  assert.deepEqual(calls,['claim','persist','complete']);
  await refreshFinishingTool('owner','job',{...deps,result:async()=>{throw {status:422};}});
  assert.equal(calls.at(-1),'refund');
});


test('visitors can inspect the four forms, while processing and unknown paths remain private', () => {
  for (const id of FINISHING_TOOL_IDS) assert.equal(canVisitorBrowseWorkspacePath(`/app/tools/${id}`),true);
  assert.equal(canVisitorBrowseWorkspacePath('/api/tools/run'),false);
  assert.equal(canVisitorBrowseWorkspacePath('/app/tools/unknown'),false);
});


test('Restore validates the selected pixel budget for landscape, portrait and rounded aspect outputs', () => {
  for (const resolution of ['1080p', '4k'] as const) {
    const settings = { quality: 'pro' as const, resolution };
    for (const [width, height, sourceWidth, sourceHeight] of resolution === '4k'
      ? [[3840,2160,1280,720],[2160,3840,720,1280],[2880,2880,720,720],[3336,2502,960,720],[4412,1892,1470,630]]
      : [[1920,1080,1280,720],[1080,1920,720,1280],[1440,1440,720,720],[1664,1248,960,720],[2206,946,1470,630]]) {
      const original = { ...facts, width: sourceWidth, height: sourceHeight, hasAudio: true };
      const prepared = { block: validateToolBlock({ toolId:'restore-video',version:1,inputs:[source],settings }), settings, facts:original };
      validateFinishingOutputFacts(prepared, { ...original, width, height });
      assert.throws(() => validateFinishingOutputFacts(prepared, original), /resolution/);
      assert.throws(() => validateFinishingOutputFacts(prepared, { ...original, width, height, hasAudio:false }), /audio/);
      assert.throws(() => validateFinishingOutputFacts(prepared, { ...original, width, height, durationSec: 20 }), /duration/);
      assert.throws(() => validateFinishingOutputFacts(prepared, { ...original, width:NaN, height }), /metadata/);
    }
  }
});

test('a late provider result after the observation deadline never claims or persists a finishing job', async () => {
  const { refreshFinishingTool } = await import('../frontend/src/server/tools/finishing-status');
  const controller = new AbortController();
  let claims = 0;
  let persists = 0;
  let refunds = 0;
  const job = { status: 'queued', payment_status: 'paid_wallet', provider_job_id: 'stored-request', updated_at: new Date().toISOString(),
    settings_snapshot: { preparedTool: { profile: { endpoint: 'topaz/denoise/video' } } as never } };
  const status = { jobId: 'job', status: 'queued', result: null, error: null };
  const result = await refreshFinishingTool('owner', 'job', {
    read: async () => job, status: async () => status,
    poll: async (_endpoint, _id, signal) => { assert.equal(signal, controller.signal); return { status: 'COMPLETED' } as never; },
    result: async (_endpoint, _id, signal) => { assert.equal(signal, controller.signal); controller.abort(); return { data: {} } as never; },
    claim: async () => { claims++; return true; }, persist: async () => { persists++; throw new Error('Unexpected persistence'); },
    fail: async () => { refunds++; },
  }, { signal: controller.signal });
  assert.equal(result, status);
  assert.deepEqual({ claims, persists, refunds }, { claims: 0, persists: 0, refunds: 0 });
});
