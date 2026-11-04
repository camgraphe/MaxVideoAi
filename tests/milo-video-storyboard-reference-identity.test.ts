import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';
import { mountStoryboard } from './helpers/storyboard-workspace-fixture';
import { buildPromptAssistanceContext } from '../frontend/src/server/prompt-assistance/context';
import { resolveStudioMedia } from '../frontend/src/server/studio/media-resolver';
import { createAgentModelCatalogDeps } from '../frontend/src/server/agent-api/model-catalog';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { hasResolvingAssistanceReferences } from '../frontend/src/lib/prompt-assistance/client-context';

const jobId = 'storyboard_11111111-1111-4111-8111-111111111111';
const firstFrameJobId = 'storyboard_kling_first_frame_22222222-2222-4222-8222-222222222222';
const ref = { type: 'job-output', jobId, outputId: 'owned-board-output', kind: 'image' };
const firstFrameRef = { type: 'job-output', jobId: firstFrameJobId, outputId: 'owned-first-frame-output', kind: 'image' };
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const source = `
import {useWorkspaceReferenceAssets} from './app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets';
import {buildComposerAttachments} from './app/(core)/(workspace)/app/_lib/workspace-assets';
import {buildWorkspacePreflightInputs} from './app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import {buildWorkspaceStoryboardHandoffState} from './app/(core)/(workspace)/app/_lib/workspace-storyboard-handoff';
import {serializeWorkspaceReferenceAsset} from './app/(core)/(workspace)/app/_lib/workspace-model-setups';
import {buildStoryboardGeneratorHandoff,parseStoryboardGeneratorHandoff} from './lib/storyboard-generator-handoff';
import {composerAssistanceReferences} from './src/lib/prompt-assistance/client-context';
import {listFalEngines} from './src/config/falEngines';
const engines=listFalEngines().map(x=>x.engine),engine=engines.find(x=>x.id==='seedance-2-0');
const fields=[{field:engine.inputSchema.optional.find(x=>x.id==='image_urls'),role:'reference'}];
function Content(){
 const [assets,setAssets]=useState(()=>window.initial ?? buildWorkspaceStoryboardHandoffState(parseStoryboardGeneratorHandoff(JSON.stringify(buildStoryboardGeneratorHandoff(window.handoff))),engines,null).inputAssets);
 const owner=window.owner;
 const actions=useWorkspaceReferenceAssets({accountScope:owner,engineId:engine.id,engine,preferredMode:'v2v',inputAssets:assets,setInputAssets:setAssets,commitInputAssetMutation:fn=>{const result=fn(assets);setAssets(result.state);return result;},workflowCopy:{clearReferencesToUseStartEnd:'clear',clearStartEndToUseReferences:'clear'},showNotice:noop,assetLibrarySource:'all',resetAssetLibraryForSource:noop,setAssetPickerTarget:noop,setAssetLibrary:noop});
 const attachments=buildComposerAttachments(assets);
 window.probe={...actions,assets,attachments,setAssets,preflightInputs:buildWorkspacePreflightInputs(assets),references:composerAssistanceReferences(engine,fields,attachments,'v2v'),save:()=>Object.fromEntries(Object.entries(assets).map(([field,entries])=>[field,entries.map(asset=>serializeWorkspaceReferenceAsset(asset,field).asset)]))};
 return <output>{JSON.stringify(window.probe.references)}</output>;
}
function App(){return window.strict?<React.StrictMode><Content/></React.StrictMode>:<Content/>;}`;
const stubs = { '@/lib/supabaseClient': `export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:window.sessionOwner??window.owner},access_token:'synthetic'}},error:null})}};` };
async function mount(options: { initial?: unknown; handoff?: Record<string, unknown>; strict?: boolean } = {}) {
  return mountToolFixture(source, stubs, w => {
    w.owner = 'owner'; w.sessionStorage.setItem('last-known:user-id', 'owner'); w.fetch = w.fixtureFetch;
    const setTimer = w.setTimeout.bind(w);
    w.setTimeout = (callback: () => void, ms: number, ...args: unknown[]) => ms === 15_000
      ? (w.expireIdentity = callback, setTimer(callback, ms, ...args)) : setTimer(callback, ms, ...args);
    w.initial = options.initial;
    w.strict = options.strict;
    w.handoff = { targetModel: 'seedance', imageUrl: 'https://original.invalid/board.png', thumbUrl: 'https://preview.invalid/board.webp', jobId, durationSec: 10, frameCount: 6, orientation: 'landscape', ...options.handoff };
  });
}
const output = (identity = ref) => ({ id: identity.outputId, jobId: identity.jobId, ref: identity, kind: 'image', status: 'ready', url: 'https://owned.invalid/original.png', thumbUrl: 'https://owned.invalid/thumbnail.webp' });
const response = (outputs = [output()]) => ({ ok: true, outputs, hasMore: false, nextCursor: null });
const catalog = { ...createAgentModelCatalogDeps(), listEngines: async () => getBaseEngines(), isModeExecutable: () => true, isEngineExecutable: () => true };

test('only active ready reference fields can delay sending to Milo', () => {
  const field = { id: 'image_urls', type: 'image' as const, label: 'References', modes: ['v2v' as const] };
  const asset = { kind: 'image' as const, name: 'Board', size: 0, type: 'image/png', previewUrl: '', status: 'ready' as const, identityResolving: true };
  const assets = { image_urls: [asset] };
  assert.equal(hasResolvingAssistanceReferences([{ field }], assets, 'v2v'), true);
  assert.equal(hasResolvingAssistanceReferences([{ field, disabled: true }], assets, 'v2v'), false);
  assert.equal(hasResolvingAssistanceReferences([{ field }], assets, 't2v'), false);
  assert.equal(hasResolvingAssistanceReferences([], assets, 'v2v'), false);
  assert.equal(hasResolvingAssistanceReferences([{ field }], { image_urls: [{ ...asset, status: 'error' }] }, 'v2v'), false);
});
async function resolve(references: any[], owner = 'owner', hidden = false) {
  return buildPromptAssistanceContext(owner, { sessionId: randomUUID(), requestId: randomUUID(), draftRevision: 0, locale: 'en', message: 'Improve this storyboard sequence', draft: { surface: 'video', engineId: 'seedance-2-0', workflow: 'modify', mode: 'v2v', target: 'prompt', text: '', settings: {}, references } }, {
    catalog,
    resolveMedia: (user, identity) => resolveStudioMedia(user, identity, async (sql, values) => {
      assert.equal(identity.type, 'job-output');
      assert.match(sql, /o.job_id = \$2 AND o.id = \$3/);
      assert.deepEqual(values, [owner, jobId, 'owned-board-output', 'image']);
      return [{ id: 'owned-board-output', job_id: jobId, job_user_id: 'owner', user_id: 'owner', hidden, kind: 'image', status: 'ready', mime_type: 'image/png', url: 'https://media.maxvideoai.com/a.png', width: 800, height: 600 }];
    }),
  });
}

test('fresh Storyboard handoff resolves its exact owned output before Milo can send', async () => {
  const producer = await mountStoryboard();
  let handoff: Record<string, unknown>;
  try {
    await producer.edit('A synthetic scene');
    await producer.w.fx.act(async () => producer.w.builder.submission.onGenerate());
    await producer.respond(producer.w.requests.find((request: any) => request.url === '/api/images/generate'), { ok: true, mode: 'i2i', jobId, images: [{ url: 'https://original.invalid/board.png', thumbUrl: 'https://preview.invalid/board.webp' }] });
    await producer.w.fx.act(async () => producer.w.resultPanel.onApplyToGenerator());
    handoff = JSON.parse(producer.w.sessionStorage.getItem('maxvideoai.storyboard.generatorHandoff.v1:account-A'));
    assert.equal(handoff.jobId, jobId);
  } finally { await producer.close(); }
  const f = await mount({ handoff: handoff! }); try {
    assert.equal(f.w.requests.length, 1);
    assert.match(f.w.requests[0].url, new RegExp('jobId=' + encodeURIComponent(jobId)));
    assert.equal(f.w.probe.attachments.image_urls[0].identityResolving, true);
    assert.equal(f.w.probe.references[0].ref, null, 'the generation ID must never become an asset ref');
    await f.respond(f.w.requests[0], response());
    assert.deepEqual(plain(f.w.probe.references[0].ref), ref);
    assert.equal(f.w.probe.attachments.image_urls[0].identityResolving, false);
    assert.equal(f.w.probe.assets.image_urls[0].url, 'https://original.invalid/board.png');
    assert.deepEqual(plain(f.w.probe.preflightInputs), [{ assetId: jobId, slotId: 'image_urls', kind: 'image', url: 'https://original.invalid/board.png' }], 'the generation contract keeps its existing marker and original; Milo uses its separate typed output identity');
    await resolve(plain(f.w.probe.references));
    await assert.rejects(resolve(plain(f.w.probe.references), 'another-owner'), /MEDIA_NOT_AVAILABLE/);
    await assert.rejects(resolve(plain(f.w.probe.references), 'owner', true), /MEDIA_NOT_AVAILABLE/, 'an explicit identity never authorizes hidden output access');
    const restored = await mount({ initial: plain(f.w.probe.save()) }); try {
      assert.deepEqual(plain(restored.w.probe.references[0].ref), ref);
      assert.equal(restored.w.requests.length, 0);
      await resolve(plain(restored.w.probe.references));
    } finally { await restored.close(); }
  } finally { await f.close(); }
});

test('recent Storyboard and Kling first-frame refs survive the handoff without a lookup', async () => {
  const producer = await mountStoryboard({ holdHistory: true });
  let handoff: Record<string, unknown>;
  try {
    await producer.respond(producer.w.requests.find((request: any) => request.url.includes('recent-outputs')), { ok: true, outputs: [{ ...output(), isSaved: false, storyboard: { targetModel: 'kling' }, klingFirstFrame: { ...output(firstFrameRef), id: firstFrameRef.outputId } }] });
    await producer.w.fx.act(async () => producer.w.resultPanel.onSelectRecentOutput(producer.w.resultPanel.recentOutputs[0]));
    await producer.w.fx.act(async () => producer.w.resultPanel.onApplyToGenerator());
    handoff = JSON.parse(producer.w.sessionStorage.getItem('maxvideoai.storyboard.generatorHandoff.v1:account-A'));
    assert.deepEqual(handoff.imageRef, ref);
    assert.deepEqual(handoff.startFrameRef, firstFrameRef);
  } finally { await producer.close(); }
  const f = await mount({ handoff: handoff! }); try {
    // The fixture renders the Seedance schema; the handoff conversion still builds both explicit slots.
    assert.deepEqual(plain(f.w.probe.assets.image_urls[0].ref), ref);
    assert.deepEqual(plain(f.w.probe.assets.image_url[0].ref), firstFrameRef);
    assert.equal(f.w.requests.length, 0);
  } finally { await f.close(); }
});

test('a hung Storyboard lookup releases the send guard and ignores its late response', async () => {
  const f = await mount({ initial: legacy() }); try {
    assert.equal(f.w.probe.attachments.image_urls[0].identityResolving, true);
    await f.act(() => f.w.expireIdentity());
    assert.equal(f.w.probe.attachments.image_urls[0].identityResolving, false);
    assert.equal(f.w.probe.references[0].ref, null);
    await f.respond(f.w.requests[0], response());
    assert.equal(f.w.probe.references[0].ref, null);
  } finally { await f.close(); }
});

function legacy() { return { image_urls: [{ id: jobId, assetId: jobId, fieldId: 'image_urls', kind: 'image', name: 'Storyboard reference', type: 'image/png', size: 0, status: 'ready', url: 'https://original.invalid/board.png', previewUrl: 'https://preview.invalid/board.webp' }] }; }
test('StrictMode replay cancels the retired read and lets the live owner resolve a cached board', async () => {
  const f = await mount({ initial: legacy(), strict: true }); try {
    const active = f.w.requests.filter((request: any) => !request.init.signal.aborted);
    assert.equal(active.length, 1, 'the replay must leave one live account-bound read');
    await f.respond(active[0], response());
    assert.deepEqual(plain(f.w.probe.references[0].ref), ref);
    assert.equal(f.w.probe.attachments.image_urls[0].identityResolving, false);
  } finally { await f.close(); }
});

test('a mismatched job-output ref in an old draft cannot bypass exact board recovery', async () => {
  const initial: any = legacy(); initial.image_urls[0].ref = { ...ref, jobId: 'different-job' };
  const f = await mount({ initial }); try {
    assert.equal(f.w.probe.references[0].ref, null);
    assert.equal(f.w.probe.attachments.image_urls[0].identityResolving, true);
    await f.respond(f.w.requests[0], response());
    assert.deepEqual(plain(f.w.probe.references[0].ref), ref);
  } finally { await f.close(); }
});
test('legacy cached Storyboard generation ID recovers only through its owner-scoped exact-job read', async () => {
  const f = await mount({ initial: legacy() }); try {
    assert.equal(f.w.probe.references[0].ref, null);
    await f.respond(f.w.requests[0], response());
    assert.deepEqual(plain(f.w.probe.references[0].ref), ref);
    await resolve(plain(f.w.probe.references));
  } finally { await f.close(); }
});

for (const variant of ['missing', 'ambiguous', 'wrong-job', 'wrong-kind', 'page', 'failure']) test(`Storyboard lookup keeps an unresolved reference visible (${variant})`, async () => {
  const f = await mount({ initial: legacy() }); try {
    const body = response(variant === 'missing' ? [] : variant === 'ambiguous' ? [output(), output({ ...ref, outputId: 'second-output' })] : [output()]);
    if (variant === 'wrong-job') body.outputs[0].jobId = 'another-job';
    if (variant === 'wrong-kind') body.outputs[0].ref = { ...ref, kind: 'video' } as any;
    if (variant === 'page') body.hasMore = true;
    await f.respond(f.w.requests[0], body, variant === 'failure' ? 503 : 200);
    assert.equal(f.w.probe.references.length, 1);
    assert.equal(f.w.probe.references[0].ref, null);
    assert.equal(f.w.probe.attachments.image_urls[0].identityResolving, false);
    assert.equal(f.w.probe.assets.image_urls[0].url, 'https://original.invalid/board.png');
    await assert.rejects(resolve(plain(f.w.probe.references)), /REFERENCE_REATTACH_REQUIRED/);
    assert.equal(f.w.requests.length, 1, 'failure must settle without a retry loop');
  } finally { await f.close(); }
});

for (const change of ['slot', 'account']) test(`late Storyboard lookup cannot replace a changed ${change}`, async () => {
  const f = await mount({ initial: legacy() }); try {
    const pending = f.w.requests[0];
    if (change === 'slot') await f.act(() => f.w.probe.setAssets({ image_urls: [{ ...legacy().image_urls[0], id: 'replacement', assetId: 'ma_' + 'a'.repeat(32) }] }));
    else { f.w.owner = 'other-owner'; await f.render(); }
    await f.respond(pending, response());
    assert.notDeepEqual(plain(f.w.probe.assets.image_urls[0].ref ?? null), ref);
  } finally { await f.close(); }
});
