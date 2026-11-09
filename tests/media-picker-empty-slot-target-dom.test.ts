import assert from 'node:assert/strict';
import test from 'node:test';
import type { EngineInputField } from '../frontend/types/engines';
import type { AssetPickerTarget, ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import type { useWorkspaceAssetState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import type { useWorkspaceReferenceAssets } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets';
import type { useWorkspaceKlingElementAssets } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceKlingElementAssets';
import type { useImageReferenceSlots } from '../frontend/app/(core)/(workspace)/app/image/_hooks/useImageReferenceSlots';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
  import React,{act,useState} from 'react';
  import {createRoot} from 'react-dom/client';
  import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
  import {useWorkspaceReferenceAssets} from './app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets';
  import {useWorkspaceKlingElementAssets} from './app/(core)/(workspace)/app/_hooks/useWorkspaceKlingElementAssets';
  import {useImageReferenceSlots} from './app/(core)/(workspace)/app/image/_hooks/useImageReferenceSlots';
  import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
  function Video(){
    const state=useWorkspaceAssetState('owner');
    const [target,setTarget]=useState(null),[elements,setElements]=useState([]);
    const actions=useWorkspaceReferenceAssets({accountScope:'owner',engineId:'video-model',engine:null,
      preferredMode:'ref2v',inputSchema:{optional:[window.field]},inputAssets:state.inputAssets,
      setInputAssets:state.setInputAssets,commitInputAssetMutation:state.commitInputAssetMutation,
      assetPickerTarget:target,setAssetPickerTarget:setTarget,assetLibrarySource:'all',
      resetAssetLibraryForSource:()=>{},showNotice:()=>{},
      workflowCopy:{clearReferencesToUseStartEnd:'clear references',clearStartEndToUseReferences:'clear frames'}});
    const kling=useWorkspaceKlingElementAssets({accountScope:'owner',engineId:'video-model',preferredMode:'ref2v',
      klingElements:elements,setKlingElements:setElements,assetLibrarySource:'all',
      resetAssetLibraryForSource:()=>{},setAssetPickerTarget:setTarget,showNotice:()=>{}});
    window.video={...state,...actions,target,openKling:kling.handleOpenKlingAssetLibrary};
    return null;
  }
  function Image(){
    const [,setError]=useState(null);
    window.image=useImageReferenceSlots({accountId:'owner',autoModeFromReferences:false,mode:'i2i',
      selectedEngineCaps:{id:'image-model',inputSchema:{optional:[{id:'image_urls',type:'image',maxCount:window.imageLimit}]}},
      resolvedCopy:DEFAULT_COPY,setError,supportedReferenceFormats:['png'],supportedReferenceFormatsLabel:'PNG',toolsEnabled:true});
    return null;
  }
  const root=createRoot(document.getElementById('root'));
  window.IS_REACT_ACT_ENVIRONMENT=true;
  window.fx={act,render:()=>root.render(<><Video/><Image/></>),unmount:()=>root.unmount()};
`, {});

type VideoProbe = ReturnType<typeof useWorkspaceAssetState> & ReturnType<typeof useWorkspaceReferenceAssets> & {
  target: AssetPickerTarget | null;
  openKling: ReturnType<typeof useWorkspaceKlingElementAssets>['handleOpenKlingAssetLibrary'];
};
type FixtureWindow = ReturnType<typeof createClientFlowDom>['window'] & {
  video: VideoProbe;
  image: ReturnType<typeof useImageReferenceSlots>;
  imageLimit: number;
  field: EngineInputField;
  fx: { act: (work: () => void | Promise<void>) => Promise<void>; render: () => void; unmount: () => void };
};
const field: EngineInputField = { id: 'image_urls', label: 'Images', type: 'image', maxCount: 10 };
const original = (id: string) => `https://example.invalid/${id}.png`;
const libraryAsset = (id: string) => ({ id, name: id, url: original(id), kind: 'image' as const, source: 'upload', mime: 'image/png' });
const reference = (id: string, status: ReferenceAsset['status'] = 'ready'): ReferenceAsset => ({
  ...libraryAsset(id), fieldId: field.id, status, previewUrl: original(id), type: 'image/png', size: 0,
});

async function mount(imageLimit = 3) {
  const dom = createClientFlowDom('/app');
  const w = dom.window as FixtureWindow;
  w.field = field;
  w.imageLimit = imageLimit;
  w.fetch = async () => { throw new Error('Opening or accepting existing image references must not fetch media.'); };
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  return { w, async close() { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); } };
}

test('empty Video collection slot opens append and accepts two references in one draft mutation', async () => {
  const f = await mount();
  try {
    await f.w.fx.act(async () => f.w.video.handleOpenAssetLibrary(field, 0));
    assert.equal(f.w.video.target?.slotIndex, undefined, 'an empty collection slot must not force single-slot replacement');
    await f.w.fx.act(async () => {
      assert.equal(await f.w.video.handleSelectLibraryAssets(field, [libraryAsset('one'), libraryAsset('two')]), true);
    });
    assert.deepEqual(Array.from(f.w.video.inputAssets.image_urls).filter(Boolean).map(asset => asset?.url), [original('one'), original('two')]);
    assert.equal(f.w.video.inputAssetMutationRevision, 1);
    assert.equal(f.w.video.target, null);
  } finally { await f.close(); }
});

test('empty Video slot in a partially filled group preserves existing references and refuses overflow atomically', async () => {
  const f = await mount();
  try {
    const limited = { ...field, maxCount: 3 };
    f.w.field = limited;
    await f.w.fx.act(async () => f.w.video.setInputAssets({ image_urls: [reference('existing'), reference('second'), null] }));
    await f.w.fx.act(async () => f.w.video.handleOpenAssetLibrary(limited, 2));
    assert.equal(f.w.video.target?.slotIndex, undefined);
    const before = JSON.stringify(f.w.video.inputAssets);
    await f.w.fx.act(async () => assert.equal(typeof await f.w.video.handleSelectLibraryAssets(limited, [libraryAsset('one'), libraryAsset('two')]), 'string'));
    assert.equal(JSON.stringify(f.w.video.inputAssets), before);
    assert.equal(f.w.video.inputAssetMutationRevision, 0);
    assert.ok(f.w.video.target, 'refusal keeps the opening available');
  } finally { await f.close(); }
});

test('occupied Video slot remains an exact one-reference replacement', async () => {
  const f = await mount();
  try {
    await f.w.fx.act(async () => f.w.video.setInputAssets({ image_urls: [reference('first'), reference('second')] }));
    await f.w.fx.act(async () => f.w.video.handleOpenAssetLibrary(field, 1));
    assert.equal(f.w.video.target?.slotIndex, 1);
    await f.w.fx.act(async () => f.w.video.handleSelectLibraryAsset(field, libraryAsset('replacement'), 1));
    const slots = Array.from(f.w.video.inputAssets.image_urls);
    assert.deepEqual(slots.slice(0, 2).map(asset => asset?.url), [original('first'), original('replacement')]);
    assert.ok(slots.slice(2).every(asset => asset == null), 'replacement does not fill another slot');
    assert.equal(f.w.video.inputAssetMutationRevision, 1);
  } finally { await f.close(); }
});

for (const status of ['uploading', 'error'] as const) test(`Video ${status} slot keeps its index instead of becoming append`, async () => {
  const f = await mount();
  try {
    await f.w.fx.act(async () => f.w.video.setInputAssets({ image_urls: [reference('pending', status)] }));
    await f.w.fx.act(async () => f.w.video.handleOpenAssetLibrary(field, 0));
    assert.equal(f.w.video.target?.slotIndex, 0);
  } finally { await f.close(); }
});

test('Video single start/end roles and Kling targets keep their indices; invalid collection indices are not promoted', async () => {
  const f = await mount();
  try {
    for (const role of [
      { id: 'image_url', type: 'image' as const },
      { id: 'end_image_url', type: 'image' as const },
      { id: 'video_url', type: 'video' as const },
    ]) {
      await f.w.fx.act(async () => f.w.video.handleOpenAssetLibrary({ ...field, ...role, maxCount: 1 }, 0));
      assert.equal(f.w.video.target?.slotIndex, 0);
    }
    for (const index of [-1, 10, 1.5]) {
      await f.w.fx.act(async () => f.w.video.handleOpenAssetLibrary(field, index));
      assert.equal(f.w.video.target?.slotIndex, index);
    }
    await f.w.fx.act(async () => f.w.video.openKling('element', 'reference', 0));
    assert.equal(f.w.video.target?.kind, 'kling');
    assert.equal(f.w.video.target?.slotIndex, 0);
  } finally { await f.close(); }
});

test('empty Image collection slot opens append and accepts two references together', async () => {
  const f = await mount();
  try {
    await f.w.fx.act(async () => f.w.image.openLibraryForSlot(0));
    assert.equal(f.w.image.libraryModal.slotIndex, null, 'an empty Image slot must expose the append receiver');
    await f.w.fx.act(async () => assert.equal(f.w.image.handleLibrarySelectMany([libraryAsset('one'), libraryAsset('two')]), true));
    assert.deepEqual(Array.from(f.w.image.readyReferenceUrls), [original('one'), original('two')]);
    assert.equal(f.w.image.libraryModal.open, false);
  } finally { await f.close(); }
});

test('empty Image slot after an existing reference appends without replacing it', async () => {
  const f = await mount();
  try {
    await f.w.fx.act(async () => f.w.image.handleLibrarySelect(libraryAsset('existing'), 0));
    await f.w.fx.act(async () => f.w.image.openLibraryForSlot(1));
    assert.equal(f.w.image.libraryModal.slotIndex, null);
    await f.w.fx.act(async () => assert.equal(f.w.image.handleLibrarySelectMany([libraryAsset('one'), libraryAsset('two')]), true));
    assert.deepEqual(Array.from(f.w.image.readyReferenceUrls), [original('existing'), original('one'), original('two')]);
  } finally { await f.close(); }
});

test('occupied Image slot remains an exact one-reference replacement', async () => {
  const f = await mount();
  try {
    await f.w.fx.act(async () => f.w.image.handleLibrarySelectMany([libraryAsset('first'), libraryAsset('second')]));
    await f.w.fx.act(async () => f.w.image.openLibraryForSlot(1));
    assert.equal(f.w.image.libraryModal.slotIndex, 1);
    await f.w.fx.act(async () => assert.equal(f.w.image.handleLibrarySelect(libraryAsset('replacement')), true));
    assert.deepEqual(Array.from(f.w.image.readyReferenceUrls), [original('first'), original('replacement')]);
  } finally { await f.close(); }
});

for (const status of ['uploading', 'error'] as const) test(`Image ${status} slot keeps its index instead of becoming append`, async () => {
  const f = await mount();
  try {
    await f.w.fx.act(async () => f.w.image.setReferenceSlots(previous => {
      const next = previous.slice();
      next[0] = { id: 'pending', url: original('pending'), previewUrl: original('pending'), status, source: 'library' };
      return next;
    }));
    await f.w.fx.act(async () => f.w.image.openLibraryForSlot(0));
    assert.equal(f.w.image.libraryModal.slotIndex, 0);
  } finally { await f.close(); }
});

test('Image capacity-one targets remain single and reject excess references', async () => {
  const f = await mount(1);
  try {
    assert.equal(f.w.image.referenceSlotLimit, 1);
    await f.w.fx.act(async () => f.w.image.openLibraryForSlot(0));
    assert.equal(f.w.image.libraryModal.slotIndex, 0);
    await f.w.fx.act(async () => assert.equal(f.w.image.handleLibrarySelectMany([libraryAsset('one'), libraryAsset('two')]), false));
    assert.deepEqual(Array.from(f.w.image.readyReferenceUrls), []);
  } finally { await f.close(); }
});
