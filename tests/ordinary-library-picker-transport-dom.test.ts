import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { installMediaGridGeometry } from './helpers/media-grid-dom';

const bundle = bundleClientFlow(`
  import React,{act,useState} from 'react';
  import {createRoot} from 'react-dom/client';
  import {SWRProvider} from './components/swr/SWRProvider';
  import {AssetLibraryModal} from './components/library/AssetLibraryModal';
  import {useWorkspaceAssetState} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
  import {useWorkspaceAssets} from './app/(core)/(workspace)/app/_hooks/useWorkspaceAssets';
  import {ImageLibraryModal} from './app/(core)/(workspace)/app/image/_components/ImageLibraryModal';
  import {useImageReferenceSlotLifecycle} from './app/(core)/(workspace)/app/image/_hooks/useImageReferenceSlotLifecycle';
  import {useImageLibrarySelection} from './app/(core)/(workspace)/app/image/_hooks/useImageLibrarySelection';
  import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
  const field={id:'image_urls',type:window.kind??'image',label:'References',maxCount:4};
  const schema={required:[],optional:[field]};
  const noop=()=>{};
  function Workspace(){
    const state=useWorkspaceAssetState(window.owner);
    const [elements,setElements]=useState([]);
    const library=useWorkspaceAssets({accountScope:window.owner,userId:window.owner,...state,
      engineId:'test-image-reference',preferredMode:'ref2v',inputSchema:schema,
      workflowCopy:{clearReferencesToUseStartEnd:'clear',clearStartEndToUseReferences:'clear'},
      showNotice:message=>window.notices.push(message),klingElements:elements,setKlingElements:setElements});
    window.workspace={...state,...library};
    if(!library.assetPickerTarget)return <button onClick={()=>library.handleOpenAssetLibrary(field)}>Open references</button>;
    return <AssetLibraryModal ownerId={window.owner} fieldLabel="References" assetType={library.assetLibraryKind}
      target={{scope:'workspace:references',capacity:4}}
      assets={library.visibleAssetLibrary} isLoading={library.isAssetLibraryLoading} error={library.assetLibraryError}
      source={library.assetLibrarySource} onSourceChange={library.handleAssetLibrarySourceChange}
      onRefresh={library.fetchAssetLibrary} onLoadMore={library.loadMoreAssetLibrary} hasMore={library.assetLibraryHasMore}
      isLoadingMore={library.isAssetLibraryLoadingMore} onClose={library.closeAssetLibrary}
      onSelect={asset=>{window.confirmed.push(asset);return library.handleSelectLibraryAsset(field,asset)}}
      onSelectMany={(assets,acceptance)=>library.handleSelectLibraryAssets(field,assets,acceptance)}
      onDelete={library.handleDeleteLibraryAsset} deletingAssetId={null}/>;
  }
  function Image(){
    const [open,setOpen]=useState(true),[characters,setCharacters]=useState([]);
    const state=useImageReferenceSlotLifecycle(window.owner);
    const receiver=useImageLibrarySelection({intent:window.owner+':image:references',limit:4,slotIndex:null,
      supported:()=>true,unsupported:noop,setSlots:state.setReferenceSlots,close:()=>setOpen(false)});
    window.image=state;
    return <ImageLibraryModal open={open} target={{scope:'image:references',capacity:4}}
      onClose={()=>setOpen(false)} onSelect={asset=>{window.confirmed.push(asset);return receiver.handleLibrarySelect(asset)}}
      onSelectMany={receiver.handleLibrarySelectMany}
      onToggleCharacter={reference=>{window.toggled.push(reference);setCharacters(previous=>[...previous,reference])}}
      selectedCharacterReferences={characters} characterSelectionLimit={2}
      copy={DEFAULT_COPY.library} characterCopy={DEFAULT_COPY.characterPicker}
      selectionMode={window.characterMode?'character':'reference'} initialSource={window.initialSource??'all'}
      supportedFormats={['png']} supportedFormatsLabel="PNG" toolsEnabled={true}/>;
  }
  const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
  window.fx={act,render:()=>root.render(<SWRProvider>{window.host==='workspace'?<Workspace/>:<Image/>}</SWRProvider>),unmount:()=>root.unmount()};
`, {
  'next/navigation': "export const usePathname=()=>'/app/image';export const useRouter=()=>({push(){}});",
  'next/dynamic': 'import React,{lazy,Suspense} from "react";export default load=>{const Component=lazy(()=>load().then(value=>({default:value})));return props=>React.createElement(Suspense,{fallback:null},React.createElement(Component,props));};',
  '@/hooks/useRequireAuth': 'export const useRequireAuth=()=>({user:{id:window.owner},loading:false});',
  '@/lib/i18n/I18nProvider': 'export const useI18n=()=>({locale:"en",t:(_key,fallback)=>fallback});',
  '@/lib/supabaseClientLoader': 'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});',
  '@/lib/supabaseClient': 'export const supabase={auth:{getSession:()=>window.getSession()}};',
});

const recent = (suffix = 'one') => ({
  id: 'output:recent-' + suffix,
  name: 'Portrait ' + suffix + '.png',
  url: 'https://private.invalid/original-' + suffix + '.png?sig=Exact',
  thumbUrl: 'https://private.invalid/thumb-' + suffix + '.webp?sig=Thumb',
  kind: 'image', mime: 'image/png', source: 'saved_job_output',
  jobId: 'job-recent', sourceOutputId: 'recent-' + suffix,
  ref: { type: 'job-output', jobId: 'job-recent', outputId: 'recent-' + suffix, kind: 'image' },
  libraryRef: { type: 'job-output', jobId: 'job-recent', outputId: 'recent-' + suffix, kind: 'image' },
  sourceRevision: 'sr_fixture-' + suffix,
  organization: { key: 'lo_fixture-' + suffix, favorite: false, trashedAt: null, collectionIds: [] },
  isSaved: false,
});

async function mount(host: 'workspace' | 'image', options: { characterMode?: boolean; initialSource?: string; includeIncompatible?: boolean; kind?: 'video' | 'audio' } = {}) {
  const dom = createClientFlowDom(host === 'workspace' ? '/app' : '/app/image');
  const w = dom.window as any;
  Object.assign(w, { owner: 'A', host, confirmed: [], notices: [], toggled: [], ...options });
  installMediaGridGeometry(w);
  w.sessionStorage.setItem('last-known:user-id', 'A');
  w.getSession = async () => ({ data: { session: { user: { id: 'A' }, access_token: 'fixture-A' } }, error: null });
  const reads: string[] = [], validations: any[] = [];
  w.fetch = async (url: string, init: RequestInit = {}) => {
    if (url.includes('/selection/validate')) {
      const candidates = JSON.parse(init.body as string).candidates;
      validations.push(candidates);
      return { ok: true, json: async () => ({ ok: true, results: candidates.map((candidate: any) => ({ reference: candidate.reference })) }) };
    }
    reads.push(url);
    const request = new URL(url, 'https://example.invalid');
    const next = request.searchParams.has('cursor');
    const assets = request.searchParams.has('q') && !next ? [] : [recent(next ? 'two' : 'one'),
      ...(w.includeIncompatible ? [{ ...recent('gif'), mime: 'image/gif', url: 'https://private.invalid/source.gif' }] : [])];
    return { ok: true, json: async () => ({ ok: true, assets,
      characters: [{ id: 'character-one', imageUrl: 'https://private.invalid/identity.png', thumbUrl: 'https://private.invalid/identity-thumb.webp', createdAt: '2026-01-01' }],
      nextCursor: request.searchParams.has('q') && !next ? 'next-fixture' : null,
      hasMore: request.searchParams.has('q') && !next, totalCount: assets.length || 1 }) };
  };
  w.eval(await bundle);
  const render = () => w.fx.act(async () => w.fx.render());
  const settle = async (predicate: () => boolean, label: string) => {
    for (let n = 0; n < 150; n++) {
      if (predicate()) return;
      await w.fx.act(async () => new Promise(resolve => setTimeout(resolve, 5)));
    }
    assert.fail(label);
  };
  await render();
  if (host === 'workspace') await w.fx.act(async () => w.document.querySelector('button').click());
  return { w, reads, validations, settle,
    close: async () => { await w.fx.act(async () => w.fx.unmount()); dom.window.close(); } };
}

for (const host of ['workspace', 'image'] as const) {
  test(`${host} ordinary picker includes an unsaved image output and retains its typed original on confirmation`, async () => {
    const f = await mount(host);
    try {
      await f.settle(() => f.reads.some(url => url.includes('/browse?')), 'ordinary host must opt into common browse');
      const request = new URL(f.reads.find(url => url.includes('/browse?'))!, 'https://example.invalid');
      assert.equal(request.searchParams.get('view'), 'all');
      assert.equal(request.searchParams.get('kind'), 'image');
      assert.equal(f.reads.some(url => /\/(assets|recent-outputs)\?/.test(url)), false, 'ordinary picker must not also load a legacy listing');
      await f.settle(() => !!f.w.document.querySelector('.compact-media-check input'), 'recent output visible');
      await f.w.fx.act(async () => f.w.document.querySelector('.compact-media-check input').click());
      await f.w.fx.act(async () => f.w.document.querySelector('.app-picker-use').click());
      await f.settle(() => f.w.document.querySelector('[role=dialog]') === null, 'real receiving owner accepts the common DTO and closes');
      const slot = host === 'image' ? f.w.image.referenceSlots[0] : f.w.workspace.inputAssets.image_urls[0];
      assert.equal(slot.url, 'https://private.invalid/original-one.png?sig=Exact');
      assert.deepEqual(JSON.parse(JSON.stringify(slot.ref)), { type: 'job-output', jobId: 'job-recent', outputId: 'recent-one', kind: 'image' });
      assert.equal(f.validations[0][0].originalUrl, slot.url);
      assert.equal(f.validations[0][0].reference.outputId, 'recent-one');
    } finally { await f.close(); }
  });

  test(`${host} ordinary picker searches the server and paginates an empty matching first page`, async () => {
    const f = await mount(host);
    try {
      await f.settle(() => f.reads.some(url => url.includes('/browse?')), 'common first page');
      await f.w.fx.act(async () => {
        const input = f.w.document.querySelector('input[type=search]');
        Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value')!.set!.call(input, 'cobalt scout');
        input.dispatchEvent(new f.w.Event('input', { bubbles: true }));
      });
      await f.settle(() => f.reads.some(url => new URL(url, 'https://example.invalid').searchParams.get('q') === 'cobalt scout'), 'search text reaches server');
      const loadMore = () => [...f.w.document.querySelectorAll('button')].find((button: any) => button.textContent === 'Load more') as any;
      await f.settle(() => !!f.w.document.querySelector('.app-picker-empty') && !!loadMore(), 'empty first page retains load more');
      await f.w.fx.act(async () => loadMore().click());
      await f.settle(() => f.reads.some(url => new URL(url, 'https://example.invalid').searchParams.get('cursor') === 'next-fixture'), 'next cursor is requested');
      await f.settle(() => !!f.w.document.querySelector('.compact-media-check input'), 'server prompt match is not discarded by local display-name filtering');
      assert.match(f.w.document.body.textContent, /Portrait two/);
    } finally { await f.close(); }
  });
}

for (const kind of ['video', 'audio'] as const) {
  test(`workspace ordinary ${kind} picker retains its recent scope on the shared transport`, async () => {
    const f = await mount('workspace', { kind });
    try {
      await f.settle(() => f.reads.some(url => url.includes('/browse?')), 'common first page');
      await f.w.fx.act(async () => {
        const source = f.w.document.querySelector('.app-picker-filters select');
        source.value = 'recent';
        source.dispatchEvent(new f.w.Event('change', { bubbles: true }));
      });
      await f.settle(() => f.reads.some(url => {
        const params = new URL(url, 'https://example.invalid').searchParams;
        return params.get('view') === 'review' && params.get('kind') === kind;
      }), 'recent scope retains actual media kind');
      assert.equal(f.reads.some(url => /\/(assets|recent-outputs)\?/.test(url)), false);
    } finally { await f.close(); }
  });
}

test('image Character media source stays a media filter rather than loading character entities', async () => {
  const f = await mount('image', { initialSource: 'character' });
  try {
    await f.settle(() => f.reads.some(url => {
      const params = new URL(url, 'https://example.invalid').searchParams;
      return url.includes('/browse?') && params.get('source') === 'character' && params.get('view') === 'all';
    }), 'specialized media source reaches the server unchanged');
    assert.equal(f.reads.some(url => url.includes('/character-references?')), false);
  } finally { await f.close(); }
});

test('workspace explicit refresh revalidates shared browse without restoring legacy reads', async () => {
  const f = await mount('workspace');
  try {
    await f.settle(() => f.reads.some(url => url.includes('/browse?')), 'common first page');
    const before = f.reads.filter(url => url.includes('/browse?')).length;
    const refresh = [...f.w.document.querySelectorAll('button')].find((button: any) => button.textContent === 'Refresh') as any;
    assert.ok(refresh);
    await f.w.fx.act(async () => refresh.click());
    await f.settle(() => f.reads.filter(url => url.includes('/browse?')).length > before, 'explicit refresh retires common cache');
    assert.equal(f.reads.some(url => /\/(assets|recent-outputs)\?/.test(url)), false);
  } finally { await f.close(); }
});

test('image ordinary browse keeps unsupported original formats out of compatible choices', async () => {
  const f = await mount('image', { includeIncompatible: true });
  try {
    await f.settle(() => f.reads.some(url => url.includes('/browse?')), 'common image first page');
    await f.settle(() => f.w.document.querySelectorAll('.compact-media-check input').length > 0, 'compatible choices visible');
    assert.equal(f.w.document.querySelectorAll('.compact-media-check input').length, 1);
    assert.doesNotMatch(f.w.document.querySelector('.app-reference-picker').textContent, /Portrait gif/);
  } finally { await f.close(); }
});

test('image character references retain their specialized immediate entity selection', async () => {
  const f = await mount('image', { characterMode: true, initialSource: 'character' });
  try {
    await f.settle(() => f.reads.some(url => url.includes('/character-references?')), 'specialized characters load');
    await f.settle(() => !!f.w.document.querySelector('.app-picker-grid .app-picker-card'), 'immediate character choice visible');
    await f.w.fx.act(async () => f.w.document.querySelector('.app-picker-grid .app-picker-card').click());
    assert.equal(f.w.toggled.length, 1);
    assert.equal(f.w.toggled[0].id, 'character-one');
    assert.equal(f.reads.some(url => url.includes('/browse?')), false);
    assert.equal(f.reads.some(url => url.includes('/assets?')), false);
    assert.equal(f.validations.length, 0, 'entity selection remains distinct from ordinary media confirmation');
  } finally { await f.close(); }
});
