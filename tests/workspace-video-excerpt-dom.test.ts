import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

const bundle = bundleClientFlow(
  `
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import {useWorkspaceVideoExcerpt} from './app/(core)/(workspace)/app/_hooks/useWorkspaceVideoExcerpt';
import {getBaseEngineIncludingHidden} from './src/lib/engines';
import {resolveVideoOperationEngine} from './lib/video-operation';
import {getVideoExcerptLimits} from './lib/video-excerpt';
import {getVideoWorkflowSourceState} from './lib/video-source-workflow';
import {useWorkspacePricingGate} from './app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate';
import {resolveWorkspaceWorkflow,resolveWorkspaceComposerFacts} from './app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import {buildComposerAttachments} from './app/(core)/(workspace)/app/_lib/workspace-assets';
function Main(){const state=useWorkspaceAssetState(window.owner);const engine=resolveVideoOperationEngine(getBaseEngineIncludingHidden(window.engineId),window.mode,window.operation);
const actions=useWorkspaceVideoExcerpt({accountScope:window.owner,engine,mode:window.mode,inputAssets:state.inputAssets,commitInputAssetMutation:state.commitInputAssetMutation});
const form={engineId:window.engineId,mode:window.mode,operation:window.operation,durationSec:15,resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:false,extraInputValues:{}};
const workflow=resolveWorkspaceWorkflow({engine,form,inputAssets:state.inputAssets,klingElements:[]});
const facts=resolveWorkspaceComposerFacts({engine,form,workflow:{...workflow,submissionMode:window.mode},prompt:'edit',multiPromptEnabled:false,multiPromptScenes:[],voiceIdsInput:''});
const pricing=useWorkspacePricingGate({accessToken:'token-'+window.owner,locale:'en',topUpCopy:{},form,selectedEngine:engine,authChecked:!!window.pricingEnabled,memberTier:'Member',setMemberTier:()=>{},supportsAudioToggle:false,effectiveDurationSec:facts.effectiveDurationSec,voiceControlEnabled:false,submissionMode:window.mode,inputAssets:state.inputAssets});
window.probe={...state,...actions,pricing,facts,form,sourceState:getVideoWorkflowSourceState(engine.inputSchema,state.inputAssets,window.mode,getVideoExcerptLimits(engine,window.mode)),attachments:buildComposerAttachments(state.inputAssets)};return null;}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<Main/>),unmount:()=>root.unmount()};`,
  {
    '@/lib/supabaseClient': 'export const supabase={auth:{getSession:()=>window.getSession()}};',
  }
);
const source = {
  id: 'selection',
  assetId: 'owned-source',
  ref: { type: 'asset', assetId: 'owned-source', kind: 'video' },
  fieldId: 'video_url',
  kind: 'video',
  name: 'source.mp4',
  type: 'video/mp4',
  size: 1,
  previewUrl: 'https://example.invalid/signed-original',
  thumbnailUrl: 'https://example.invalid/signed-original-thumb.jpg',
  url: 'https://example.invalid/original',
  durationSec: 60,
  status: 'ready',
};
const prepared = {
  id: 'prepared',
  assetId: 'owned-prepared',
  ref: { type: 'asset', assetId: 'owned-prepared', kind: 'video' },
  url: 'https://example.invalid/prepared',
  previewUrl: 'https://example.invalid/signed-prepared',
  thumbUrl: 'https://example.invalid/signed-prepared-thumb.jpg',
  durationSec: 17.985,
  width: 100,
  height: 200,
  size: 2,
  mime: 'video/mp4',
};
const field = { id: 'video_url', type: 'video', maxCount: 1 };
async function mount(durationSec = 60) {
  const dom = createClientFlowDom('/app');
  const w = dom.window as any;
  w.owner = 'A';
  w.engineId = 'luma-ray-3-2';
  w.mode = 'v2v';
  w.sessionStorage.setItem('last-known:user-id', 'A');
  w.getSession = async () => ({
    data: { session: { user: { id: w.owner }, access_token: 'token-' + w.owner } },
    error: null,
  });
  const requests: any[] = [];
  w.quotes = [];
  w.sourceReads = [];
  w.fetch = (url: string, init: RequestInit) => {
    if(url === '/api/uploads/video/excerpt/source') {
      w.sourceReads.push({url,init});
      return w.holdSourceRead ? w.holdSourceRead.promise : Promise.resolve({ok:true,json:async()=>({ok:true,previewUrl:'https://example.invalid/signed-full-original'})});
    }
    if (url === '/api/preflight') {
      w.quotes.push(JSON.parse(String(init.body)));
      return Promise.resolve({ ok: true, json: async () => ({ ok: true, total: 125 }) });
    }
    const response = deferred<any>();
    requests.push({ url, init, response });
    return response.promise;
  };
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  await w.fx.act(async () => w.probe.setInputAssets({ video_url: [{ ...source, durationSec }] }));
  return {
    w,
    requests,
    async open() {
      await w.fx.act(async () => w.probe.handleVideoExcerptEditorChange(field, 0, true));
    },
    async cancel() {
      await w.fx.act(async () => w.probe.handleVideoExcerptEditorChange(field, 0, false));
    },
    async apply(range = { startSec: 20, endSec: 38 }) {
      let result!: Promise<void>;
      await w.fx.act(async () => {
        result = w.probe.handlePrepareVideoExcerpt(field, 0, range);
        result.catch(() => {});
      });
      return { result };
    },
    async respond(index = 0) {
      await w.fx.act(async () =>
        requests[index].response.resolve({
          ok: true,
          json: async () => ({
            ok: true,
            asset: w.prepared ?? prepared,
            original: source.ref,
            range: { startSec: 20, endSec: 38 },
          }),
        })
      );
    },
    async dispose() {
      await w.fx.act(async () => w.fx.unmount());
      dom.window.close();
    },
  };
}
test('long source remains selectable but cannot become generation-ready; projection preserves canonical identity', async () => {
  const f = await mount();
  try {
    assert.equal(f.w.probe.sourceState, 'error');
    assert.equal(f.w.probe.attachments.video_url[0].assetId, 'owned-source');
    assert.equal(f.w.probe.attachments.video_url[0].url, source.url);
    assert.equal(f.w.probe.attachments.video_url[0].durationSec, 60);
  } finally {
    await f.dispose();
  }
});
test('opening and full fractional range apply preserve original without a preparation request', async () => {
  const f = await mount(5.558333);
  try {
    await f.open();
    assert.equal(f.w.probe.sourceState, 'uploading');
    assert.equal(f.requests.length, 0);
    await f.w.fx.act(async () =>
      f.w.probe.handlePrepareVideoExcerpt(field, 0, { startSec: 0, endSec: 5.558333 })
    );
    assert.equal(f.requests.length, 0);
    assert.equal(f.w.probe.inputAssets.video_url[0].url, source.url);
    assert.equal(f.w.probe.sourceState, 'ready');
  } finally {
    await f.dispose();
  }
});
for (const previewUrl of [source.previewUrl, 'blob:original'])
  test(`excerpt to full original restores exact facts and requotes without preparation (${previewUrl})`, async () => {
    const f = await mount(5.558333);
    try {
      const revoked: string[] = [];
      f.w.URL.revokeObjectURL = (url: string) => revoked.push(url);
      const original = { ...source, name: 'original.MOV', type: 'video/quicktime', size: 26852432,
        durationSec: 5.558333, width: 2160, height: 3840, previewUrl };
      await f.w.fx.act(async () => {
        f.w.probe.setInputAssets({ video_url: [original] });
        f.w.pricingEnabled = true;
        f.w.fx.render();
      });
      const tick = () => f.w.fx.act(async () => new Promise((r) => setTimeout(r, 240)));
      await tick();
      assert.equal(f.w.probe.pricing.price, 1.25);
      await f.open();
      assert.equal(f.w.probe.pricing.price, null);
      f.w.prepared = { ...prepared, durationSec: 4, name: 'excerpt.mp4' };
      const first = await f.apply({ startSec: 1, endSec: 5 });
      await f.respond();
      await first.result;
      await tick();
      assert.equal(f.w.probe.pricing.price, 1.25);
      assert.equal(f.w.quotes.at(-1).inputs.find((input: any) => input.slotId === 'video_url').url, prepared.url);
      assert.equal(f.w.probe.inputAssets.video_url[0].thumbnailUrl, prepared.thumbUrl);
      // Re-applying the prepared range is still a no-op.
      await f.open();
      await f.w.fx.act(async () => f.w.probe.handlePrepareVideoExcerpt(field, 0, { startSec: 1, endSec: 5 }));
      assert.equal(f.requests.length, 1);
      assert.equal(f.w.probe.inputAssets.video_url[0].url, prepared.url);
      await f.open();
      assert.equal(f.w.probe.pricing.price, null);
      const restored = await f.apply({ startSec: 0, endSec: 5.558333 });
      assert.equal(f.requests.length, 1, 'full original must not prepare a second derivative');
      await restored.result;
      const selected = f.w.probe.inputAssets.video_url[0];
      for (const key of ['id', 'assetId', 'ref', 'url', 'previewUrl', 'thumbnailUrl', 'name', 'type', 'size', 'durationSec', 'width', 'height'])
        assert.deepEqual(selected[key], original[key as keyof typeof original], `original ${key}`);
      assert.equal(selected.excerptSource, undefined);
      assert.equal(selected.excerptRange, undefined);
      assert.equal(selected.excerptEditing, undefined);
      assert.equal(f.w.probe.sourceState, 'ready');
      assert.equal(f.w.probe.pricing.price, null);
      await tick();
      assert.equal(f.w.probe.pricing.price, 1.25);
      const quote = f.w.quotes.at(-1);
      assert.equal(quote.inputs.find((input: any) => input.slotId === 'video_url').url, source.url);
      assert.equal(quote.durationSec, 6);
      assert.equal(f.w.probe.form.durationSec, 15);
      assert.deepEqual(revoked, [], 'restored original still owns the blob');
      await f.w.fx.act(async () => f.w.probe.setInputAssets({}));
      assert.deepEqual(revoked, previewUrl.startsWith('blob:') ? ['blob:original'] : []);
    } finally { await f.dispose(); }
  });

test('full-original restoration cannot overwrite a same-slot source replacement before React effects flush', async () => {
  const f = await mount(5.558333);
  try {
    await f.open();
    f.w.prepared = { ...prepared, durationSec: 4 };
    const first = await f.apply({ startSec: 1, endSec: 5 });
    await f.respond();
    await first.result;
    await f.open();
    const replacement = { ...f.w.probe.inputAssets.video_url[0], url: 'https://example.invalid/replacement' };
    await f.w.fx.act(async () => {
      f.w.probe.setInputAssets({ video_url: [replacement] });
      await f.w.probe.handlePrepareVideoExcerpt(field, 0, { startSec: 0, endSec: 5.558333 });
    });
    assert.equal(f.w.probe.inputAssets.video_url[0].url, replacement.url);
    assert.equal(f.requests.length, 1);
  } finally { await f.dispose(); }
});

test('full-original restoration still enforces current model source limits', async () => {
  const f = await mount();
  try {
    await f.open();
    const first = await f.apply();
    await f.respond();
    await first.result;
    await f.open();
    const full = await f.apply({ startSec: 0, endSec: 60 });
    await assert.rejects(full.result);
    assert.equal(f.requests.length, 1);
    assert.equal(f.w.probe.inputAssets.video_url[0].url, prepared.url);
    await f.cancel();
    assert.equal(f.w.probe.sourceState, 'ready');
  } finally { await f.dispose(); }
});

test('explicit apply reserves once and inserts measured canonical derivative with original lineage', async () => {
  const f = await mount();
  try {
    await f.open();
    const { result } = await f.apply();
    const duplicate = await f.apply();
    await assert.rejects(duplicate.result, /progress/i);
    assert.equal(f.requests.length, 1);
    assert.equal(f.w.probe.sourceState, 'uploading');
    assert.deepEqual(JSON.parse(f.requests[0].init.body), {
      source: source.ref,
      engineId: 'luma-ray-3-2',
      mode: 'v2v',
      fieldId: 'video_url',
      range: { startSec: 20, endSec: 38 },
    });
    assert.equal(new Headers(f.requests[0].init.headers).get('Authorization'), 'Bearer token-A');
    assert.equal(f.requests[0].init.credentials, 'omit');
    await f.respond();
    await result;
    const asset = f.w.probe.inputAssets.video_url[0];
    assert.equal(asset.url, prepared.url);
    assert.equal(asset.previewUrl, prepared.previewUrl);
    assert.equal(asset.durationSec, 17.985);
    assert.equal(asset.excerptSource.url, source.url);
    assert.equal(f.w.probe.sourceState, 'ready');
  } finally {
    await f.dispose();
  }
});
for (const change of ['cancel', 'model', 'mode', 'source', 'account'] as const)
  test(`pending preparation ignores late success after ${change}`, async () => {
    const f = await mount();
    try {
      await f.open();
      const { result } = await f.apply();
      if (change === 'cancel') await f.cancel();
      else
        await f.w.fx.act(async () => {
          if (change === 'model') f.w.engineId = 'wan-3';
          if (change === 'mode') f.w.mode = 'reframe';
          if (change === 'account') {
            f.w.owner = 'B';
            f.w.sessionStorage.setItem('last-known:user-id', 'B');
          }
          if (change === 'source')
            f.w.probe.setInputAssets({
              video_url: [{ ...source, id: 'replacement', url: 'https://example.invalid/replacement' }],
            });
          f.w.fx.render();
        });
      assert.equal(f.requests[0].init.signal.aborted, true);
      await f.respond();
      await result.catch(() => {});
      const asset = f.w.probe.inputAssets.video_url?.[0];
      assert.notEqual(asset?.url, prepared.url);
      if (change === 'source') assert.equal(asset?.id, 'replacement');
      if (change === 'cancel' || change === 'model' || change === 'mode') {
        assert.equal(asset?.url, source.url);
        assert.equal(asset?.status, 'ready');
        assert.equal(asset?.excerptEditing, undefined);
      }
    } finally {
      await f.dispose();
    }
  });
test('failed prepare restores ready original and permits retry', async () => {
  const f = await mount();
  try {
    await f.open();
    const { result } = await f.apply();
    await f.w.fx.act(async () =>
      f.requests[0].response.resolve({
        ok: false,
        json: async () => ({
          ok: false,
          error: { code: 'PREPARATION_FAILED', message: 'Raw server detail' },
        }),
      })
    );
    await assert.rejects(result, (error: any) => error.code === 'PREPARATION_FAILED');
    assert.equal(f.w.probe.inputAssets.video_url[0].url, source.url);
    assert.equal(f.w.probe.inputAssets.video_url[0].status, 'ready');
    await f.cancel();
    assert.equal(f.w.probe.inputAssets.video_url[0].excerptEditing, undefined);
  } finally {
    await f.dispose();
  }
});

for (const [engineId, range, measured, expected] of [
  ['luma-ray-3-2', { startSec: 20, endSec: 38 }, 17.985, 18],
  ['kling-o3-standard', { startSec: 20, endSec: 28 }, 8.033, 15],
] as const)
  test(`${engineId}: real quote gate masks editor and uses measured excerpt with preserved output settings`, async () => {
    const f = await mount(5.558333);
    try {
      await f.w.fx.act(async () => {
        f.w.engineId = engineId;
        f.w.pricingEnabled = true;
        f.w.fx.render();
      });
      const tick = () => f.w.fx.act(async () => new Promise((r) => setTimeout(r, 240)));
      await tick();
      assert.equal(f.w.probe.pricing.price, 1.25);
      assert.equal(f.w.probe.form.durationSec, 15);
      await f.open();
      assert.equal(f.w.probe.pricing.price, null);
      assert.equal(f.w.probe.pricing.preflight, null);
      await f.cancel();
      await tick();
      assert.equal(f.w.probe.pricing.price, 1.25);
      await f.w.fx.act(async () => f.w.probe.setInputAssets({ video_url: [source] }));
      assert.equal(f.w.probe.pricing.price, null);
      await f.open();
      f.w.prepared = { ...prepared, durationSec: measured };
      const { result } = await f.apply(range);
      assert.equal(f.w.probe.pricing.price, null);
      await f.respond();
      await result;
      assert.equal(f.w.probe.pricing.price, null);
      await tick();
      assert.equal(f.w.probe.pricing.price, 1.25);
      const quote = f.w.quotes.at(-1);
      assert.equal(quote.durationSec, expected);
      assert.equal(quote.inputs.find((input: any) => input.slotId === 'video_url').url, prepared.url);
      assert.equal(f.w.probe.form.durationSec, 15);
      await f.open();
      await f.cancel();
      assert.equal(f.w.probe.inputAssets.video_url[0].excerptEditing, undefined);
    } finally {
      await f.dispose();
    }
  });
test('re-edit targets exact original range; source preview lifetime ends when last lineage is removed', async () => {
  const f = await mount();
  try {
    const revoked: string[] = [];
    f.w.URL.revokeObjectURL = (url: string) => revoked.push(url);
    await f.w.fx.act(async () =>
      f.w.probe.setInputAssets({ video_url: [{ ...source, previewUrl: 'blob:original' }] })
    );
    await f.open();
    const first = await f.apply();
    await f.respond();
    await first.result;
    assert.deepEqual(revoked, []);
    await f.open();
    const next = await f.apply({ startSec: 21.125, endSec: 38.125 });
    assert.deepEqual(JSON.parse(f.requests[1].init.body).source, source.ref);
    assert.deepEqual(JSON.parse(f.requests[1].init.body).range, { startSec: 21.125, endSec: 38.125 });
    await f.cancel();
    await f.respond(1);
    await next.result;
    assert.equal(f.w.probe.inputAssets.video_url[0].excerptEditing, undefined);
    await f.w.fx.act(async () => f.w.probe.setInputAssets({}));
    assert.deepEqual(revoked, ['blob:original']);
  } finally {
    await f.dispose();
  }
});
test('A to B to A and unmount retire the original preparation generation', async () => {
  for (const change of ['aba', 'unmount']) {
    const f = await mount();
    let disposed = false;
    try {
      await f.open();
      const { result } = await f.apply();
      if (change === 'unmount') {
        await f.dispose();
        disposed = true;
      } else
        for (const owner of ['B', 'A'])
          await f.w.fx.act(async () => {
            f.w.owner = owner;
            f.w.sessionStorage.setItem('last-known:user-id', owner);
            f.w.fx.render();
          });
      assert.equal(f.requests[0].init.signal.aborted, true);
      if (!disposed) {
        await f.respond();
        await result;
        assert.equal(f.w.probe.inputAssets.video_url, undefined);
      }
    } finally {
      if (!disposed) await f.dispose();
    }
  }
});

test('cleanup from another source slot cannot cancel the active excerpt session', async () => {
  const f = await mount();
  try {
    await f.open();
    const { result } = await f.apply();
    await f.w.fx.act(async () => f.w.probe.handleVideoExcerptEditorChange(field, 1, false));
    assert.equal(f.requests[0].init.signal.aborted, false);
    await f.respond();
    await result;
    assert.equal(f.w.probe.inputAssets.video_url[0].url, prepared.url);
  } finally {
    await f.dispose();
  }
});


test('library excerpt preview reads owned full original and preserves short gallery preview and canonical identity',async()=>{
 const f=await mount();
 try{
  let preview:unknown;
  await f.w.fx.act(async()=>{preview=await f.w.probe.handleVideoExcerptEditorChange(field,0,true);});
  assert.equal(preview,'https://example.invalid/signed-full-original');
  assert.equal(f.w.sourceReads.length,1);
  const request=f.w.sourceReads[0];
  assert.deepEqual(JSON.parse(request.init.body),{source:source.ref});
  assert.equal(request.init.credentials,'omit');
  assert.equal(new Headers(request.init.headers).get('authorization'),'Bearer token-A');
  assert.equal(f.w.probe.inputAssets.video_url[0].previewUrl,source.previewUrl);
  assert.equal(f.w.probe.inputAssets.video_url[0].url,source.url);
 }finally{await f.dispose();}
});
for(const change of ['cancel','model','account','source'])test(`late full-timeline access cannot escape ${change} fencing`,async()=>{
 const f=await mount();
 try{
  f.w.holdSourceRead=deferred<any>();
  let pending:Promise<unknown>;
  await f.w.fx.act(async()=>{pending=f.w.probe.handleVideoExcerptEditorChange(field,0,true);pending?.catch(()=>{});});
  assert.equal(f.w.sourceReads.length,1);
  if(change==='cancel')await f.cancel();
  else await f.w.fx.act(async()=>{
   if(change==='model')f.w.engineId='kling-o3-standard';
   if(change==='account'){f.w.owner='B';f.w.sessionStorage.setItem('last-known:user-id','B');}
   if(change==='source')f.w.probe.setInputAssets({video_url:[{...source,id:'other',url:'other'}]});
   f.w.fx.render();
  });
  assert.equal(f.w.sourceReads[0].init.signal.aborted,true);
  f.w.holdSourceRead.resolve({ok:true,json:async()=>({ok:true,previewUrl:'https://example.invalid/stale-private'})});
  await assert.rejects(pending!, (e:any)=>e.name==='AbortError');
 }finally{await f.dispose();}
});

test('whole FAST MOV is always prepared and operation switches discard a pending copy',async()=>{
 const fx=await mount(5.56);
 try{
  await fx.w.fx.act(async()=>{fx.w.engineId='flux-3';fx.w.operation='flux-fast-edit';fx.w.fx.render();});
  await fx.open();const applying=await fx.apply({startSec:0,endSec:5.56});
  assert.equal(fx.requests.length,1,'whole unchanged source still requires MP4 conversion');
  assert.equal(JSON.parse(fx.requests[0].init.body).operation,'flux-fast-edit');
  await fx.w.fx.act(async()=>{fx.w.engineId='minimax-h3-max';fx.w.operation='h3-relight';fx.w.fx.render();});
  await fx.respond();await applying.result;
  assert.equal(fx.w.probe.inputAssets.video_url[0].assetId,'owned-source');
  await fx.open();const relight=await fx.apply({startSec:0,endSec:5.56});
  const request=JSON.parse(fx.requests[1].init.body);assert.equal(request.operation,'h3-relight');assert.equal(request.acceptedCopyDurationSec,124/24);
  await fx.respond(1);await relight.result;
 }finally{await fx.dispose();}
});

for (const previewUrl of [source.previewUrl, 'blob:uploaded-original']) {
  test(`H3 Recast below-minimum source cannot enter a dead-end editor and replacement restores exact quote (${previewUrl})`, async () => {
    const f = await mount(4);
    try {
      await f.w.fx.act(async () => {
        f.w.engineId = 'minimax-h3-max'; f.w.operation = 'h3-recast'; f.w.pricingEnabled = true;
        f.w.probe.setInputAssets({ video_url: [{ ...source, durationSec: 4, previewUrl }] }); f.w.fx.render();
      });
      await f.open();
      assert.equal(f.w.probe.inputAssets.video_url[0].excerptEditing, undefined);
      assert.equal(f.w.sourceReads.length, 0, 'a too-short original cannot produce a valid section');
      assert.equal(f.w.probe.pricing.price, null);
      assert.equal(f.w.quotes.length, 0);
      await f.w.fx.act(async () => f.w.probe.setInputAssets({ video_url: [{ ...source, durationSec: 6, previewUrl }] }));
      await f.w.fx.act(async () => new Promise(resolve => setTimeout(resolve, 240)));
      assert.equal(f.w.probe.pricing.price, 1.25);
      assert.equal(f.w.quotes.at(-1).operation, 'h3-recast');
      assert.equal(f.w.quotes.at(-1).inputs[0].url, source.url);
    } finally { await f.dispose(); }
  });
}
