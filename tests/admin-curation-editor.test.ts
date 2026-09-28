import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { validateCurationOpening, type CurationItem } from '../frontend/lib/admin/playlist-curation';

test('opening validation rejects duplicate and unmeasured sources', () => {
  const videos = [
    { id: 'wide-1', outputWidth: 1280, outputHeight: 720 },
    { id: 'portrait', outputWidth: 720, outputHeight: 1280 },
    { id: 'wide-2', outputWidth: 1280, outputHeight: 720 },
    { id: 'wide-3', outputWidth: 1280, outputHeight: 720 },
    { id: 'unknown' },
  ] as CurationItem[];
  const base = { mode: 'manual' as const, orderedIds: [], excludedIds: [] };
  assert.throws(() => validateCurationOpening({ ...base, openingIds: ['wide-1', 'portrait', 'wide-1', 'wide-3'] }, videos), /unique|same video/i);
  assert.throws(() => validateCurationOpening({ ...base, openingIds: ['wide-1', 'unknown', 'wide-2', 'wide-3'] }, videos), /slot 2 requires a 9:16/i);
});

test('retains_draft_after_rejection', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/admin/playlists',
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{
    url: string; init?: RequestInit;
    resolve: (response: Response) => void;
  }> = [];
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    navigator: dom.window.navigator,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, init?: RequestInit) => {
      // The intentionally unavailable tail ID now triggers bounded hydration.
      if (url.includes('/candidates?ids=')) return Promise.resolve(Response.json({ ok: true, items: [], total: 0, nextCursor: null }));
      return new Promise<Response>((resolve) => requests.push({ url, init, resolve }));
    },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const button = (name: string) =>
    [...dom.window.document.querySelectorAll('button')].find((el) => el.textContent === name)!;
  const candidates = ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    engineId: 'wan-3',
    engineLabel: 'Wan 3',
    prompt: id,
    videoUrl: '/v.mp4',
    thumbUrl: null,
    createdAt: '2026-09-22T00:00:00Z',
    outputWidth: id === 'b' ? 480 : 1280, outputHeight: id === 'b' ? 854 : 720,
  }));
  const snapshot = {
    available: true,
    openingAvailable: true,
    supported: true,
    slug: 'examples-wan-3',
    isPublic: true,
    revision: 'r1',
    config: null,
    legacyIds: ['a', 'b'],
  };
  try {
    const { PlacementEditor } = await import('../frontend/components/admin/playlists/PlacementEditor');
    await act(async () => root.render(React.createElement(PlacementEditor, { playlistId: 'p' })));
    await act(async () =>
      requests[0].resolve(
        Response.json({
          ok: true,
          snapshot,
          selectedItems: candidates.slice(0,2), selectedTotal: 3,
          initialIds: ['a', 'b', 'unhydrated-tail'],
        }),
      ),
    );
    assert.equal(requests.length, 1, 'opening the workbench does not fetch the general candidate page');
    await act(async () => button('Add videos').click());
    assert.equal(requests[1]?.url, '/api/admin/playlists/p/curation/candidates?limit=48');
    await act(async () => requests[1].resolve(Response.json({ok:true,items:candidates,nextCursor:null,total:4})));
    await act(async () => button('Close explorer').click());
    assert.equal(
      button('Preview changes').disabled,
      false,
      'initial adoption can preview the existing order without edits',
    );
    const rows = dom.window.document.querySelectorAll('[data-curation-item]');
    for (const [type, target] of [
      ['dragstart', rows[1]],
      ['dragover', rows[0]],
      ['drop', rows[0]],
    ] as const) {
      const event = new dom.window.Event(type, {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'dataTransfer', {
        value: { setData() {}, effectAllowed: '' },
      });
      await act(async () => target.dispatchEvent(event));
    }
    const order = () =>
      [...dom.window.document.querySelectorAll('[data-curation-item]')].map((el) =>
        el.getAttribute('data-curation-item'),
      );
    assert.deepEqual(order(), ['b', 'a']);
    assert.equal(button('Save changes').disabled, true, 'saving requires an explicit preview');
    await act(async () => button('Cancel').click());
    assert.deepEqual(order(), ['a', 'b']);
    await act(async () =>
      (dom.window.document.querySelector('[aria-label="Move item 2 up"]') as HTMLButtonElement).click(),
    );
    await act(async () => button('Preview changes').click());
    assert.deepEqual(JSON.parse(String(requests[2].init?.body)).draft.orderedIds, ['b','a','unhydrated-tail'], 'reordering the loaded window preserves all unhydrated IDs');
    assert.equal(button('Cancel').disabled, true);
    await act(async () =>
      requests[2].resolve(
        Response.json({
          ok: true,
          preview: {
            items: [candidates[1], candidates[0]],
            effective: { total: 2, firstPageIds: ['a','b'], currentTotal: 40, addedCount: 0, removedCount: 38, suppressedSourceSlugs: ['examples-wan-3'], openingFormats: ['16:9','9:16','16:9','16:9'], warnings: ['Review removals before saving.'] },
            token: 't1',
            revision: 'r1',
          },
        }),
      ),
    );
    const preview = dom.window.document.querySelector('[aria-label="Page preview"]')!;
    const selected = dom.window.document.querySelector('[aria-label="Selected media"]')!;
    assert.ok(preview.compareDocumentPosition(selected) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.match(preview.textContent!, /Page preview · 2 videos/);
    assert.match(preview.textContent!, /Currently 40 videos → after saving 2 videos/);
    assert.match(preview.textContent!, /38 removed/);
    assert.match(preview.textContent!, /Suppressed inherited sources: examples-wan-3/);
    assert.deepEqual([...preview.querySelectorAll('li')].map(li=>li.textContent?.trim()), ['1. a','2. b'], 'display the effective page order, not the draft item order');
    assert.equal(dom.window.document.activeElement?.textContent, 'Page preview · 2 videos');
    assert.equal(button('Save changes').disabled, false, 'save is available beside the preview action');
    assert.equal(button('Preview changes').parentElement?.contains(button('Save changes')), true);
    await act(async () => button('Save changes').click());
    assert.equal(JSON.parse(String(requests[3].init?.body)).token, 't1');
    await act(async () =>
      requests[3].resolve(Response.json({ ok: false, error: 'This destination changed. Reload it.' }, { status: 409 })),
    );
    assert.match(dom.window.document.body.textContent!, /destination changed/);
    assert.deepEqual(order(), ['b', 'a'], 'failed save retains draft');
    assert.equal(button('Save changes').disabled, true, 'failed save invalidates preview');
    await act(async () => button('Preview changes').click());
    await act(async () =>
      requests[4].resolve(
        Response.json({
          ok: true,
          preview: {
            items: [candidates[1], candidates[0]],
            token: 't2',
            revision: 'r1',
          },
        }),
      ),
    );
    await act(async () => button('Save changes').click());
    await act(async () =>
      requests[5].resolve(
        Response.json({
          ok: true,
          snapshot: {
            ...snapshot,
            revision: 'r2',
            config: { mode: 'manual', orderedIds: ['b', 'a'], excludedIds: [] },
          },
        }),
      ),
    );
    assert.equal(button('Cancel').disabled, true);
    assert.equal(button('Save changes').disabled, true);
    assert.deepEqual(order(), ['b', 'a']);
    await act(async () => button('Choose opening videos').click());
    assert.equal(button('Preview changes').disabled,true,'all four slots are required before preview');
    const board = dom.window.document.querySelector('[data-opening-board]')!;
    const selectedSection = dom.window.document.querySelector('[aria-label="Selected media"]')!;
    assert.ok(board.compareDocumentPosition(selectedSection) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.deepEqual([...board.querySelectorAll('[data-opening-slot]')].map(el => el.getAttribute('data-required-format')),
      ['16:9', '9:16', '16:9', '16:9']);
    const slot = (n: number) => dom.window.document.querySelector(`[aria-label="Opening slot ${n}"]`) as HTMLSelectElement;
    assert.deepEqual([...slot(2).options].map(option=>option.value),['','b'],'vertical slot filters actual media format');
    assert.ok(![...slot(1).options].some(option=>option.value==='b'),'landscape slot excludes the portrait');
    for (const [index,id] of ['a','b','c','d'].entries()) await act(async () => {
      slot(index+1).value=id;
      slot(index+1).dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    });
    assert.equal(button('Preview changes').disabled,false,'a complete compatible opening can be previewed');
    assert.deepEqual([...board.querySelectorAll('[data-opening-slot]')].map(el => el.getAttribute('data-opening-id')),
      ['a', 'b', 'c', 'd']);
    assert.equal(dom.window.document.querySelector('[aria-label="Selected media"] [data-curation-item="a"]'), null,
      'the opening media is not duplicated in the continuation');
    assert.ok(dom.window.document.querySelector('a[href="/admin/video-seo?video=a"]'));
    await act(async () => button('Mobile preview').click());
    assert.ok(button('Desktop preview'));
    await act(async () => button('Cancel').click());
    assert.ok(button('Choose opening videos'),'cancel restores saved opening configuration');
    await act(async () =>
      root.render(
        React.createElement(PlacementEditor, {
          key: 'legacy',
          playlistId: 'legacy',
          fallback: React.createElement('button', null, 'Legacy ordering'),
        }),
      ),
    );
    await act(async () =>
      requests[6].resolve(
        Response.json({ ok: true, snapshot: { ...snapshot, supported: false }, selectedItems: [], selectedTotal: 0, initialIds: [] }),
      ),
    );
    assert.ok(button('Legacy ordering'), 'unsupported unconfigured destinations preserve their manual editor');
    await act(async () =>
      root.render(
        React.createElement(PlacementEditor, {
          key: 'retired',
          playlistId: 'retired',
          fallback: React.createElement('button', null, 'Legacy ordering'),
        }),
      ),
    );
    await act(async () =>
      requests[7].resolve(
        Response.json({
          ok: true,
          snapshot: { ...snapshot, supported: false, config: { mode: 'manual', orderedIds: [], excludedIds: [] } },
          selectedItems: [], selectedTotal: 0,
          initialIds: [],
        }),
      ),
    );
    assert.equal(
      button('Legacy ordering'),
      undefined,
      'managed retired destinations cannot use ineffective legacy mutations',
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('switching automatic to manual gathers all eligible IDs and retains hybrid on failure', async () => {
  const dom = new JSDOM('<div id="root"></div>', {url:'http://localhost/admin/playlists'});
  const old = new Map<string,PropertyDescriptor | undefined>();
  let fail = true;
  const ids = Array.from({length:501},(_,n)=>`video-${n}`);
  const snapshot={available:true,supported:true,slug:'examples-wan-3',isPublic:true,revision:'r',legacyIds:[],config:{mode:'hybrid',orderedIds:['video-2'],excludedIds:['video-3'],openingIds:null}};
  for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,React,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url:string)=> {
    if(url.includes('idsOnly=true')) {
      if(fail) return Response.json({ok:false,error:'ID read failed'},{status:500});
      const offset=Number(new URL(url,'http://localhost').searchParams.get('offset'));
      return Response.json({ok:true,ids:ids.slice(offset,offset+500),total:501});
    }
    if(url.includes('/candidates'))return Response.json({ok:true,items:[],nextCursor:null,total:501});
    return Response.json({ok:true,snapshot,initialIds:['video-2'],selectedItems:[],selectedTotal:1});
  }})) {old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
  const root=createRoot(dom.window.document.getElementById('root')!);
  try {
    const {usePlacementEditor}=await import('../frontend/components/admin/playlists/usePlacementEditor');
    let state: ReturnType<typeof usePlacementEditor>;
    function Harness(){state=usePlacementEditor('p');return null;}
    await act(async()=>root.render(React.createElement(Harness)));
    await act(async()=>state.changeMode('manual'));
    assert.equal(state!.draft.mode,'hybrid');assert.deepEqual(state!.draft.orderedIds,['video-2']);assert.match(state!.error!,/ID read failed/);
    fail=false;
    await act(async()=>state.changeMode('manual'));
    assert.equal(state!.draft.mode,'manual');assert.equal(state!.draft.orderedIds.length,500);
    assert.equal(state!.draft.orderedIds[0],'video-2');assert.ok(state!.draft.orderedIds.includes('video-500'));
    assert.ok(!state!.draft.orderedIds.includes('video-3'));
  }finally {await act(async()=>root.unmount());dom.window.close();for(const [key,value]of old){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
});

test('candidate explorer ignores a stale filter response', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/playlists' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; resolve: (response: Response) => void }> = [];
  const remembered: string[][] = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string) => new Promise<Response>(resolve => requests.push({ url, resolve })) })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const item = (id: string) => ({ id, engineId: 'wan-3', engineLabel: 'Wan 3', prompt: id,
    videoUrl: '/video.mp4', thumbUrl: null, createdAt: '', outputWidth: 1280, outputHeight: 720 });
  try {
    const { PlacementCandidatePicker } = await import('../frontend/components/admin/playlists/PlacementCandidatePicker');
    const props = { playlistId: 'first', draft: { mode: 'manual' as const, orderedIds: [], excludedIds: [] }, busy: false,
      slot: null, onCancelSlot() {}, onAdd() {}, onExclude() {}, onChooseSlot() {},
      onItems(items: Array<{ id: string }>) { remembered.push(items.map(value => value.id)); } };
    await act(async () => root.render(React.createElement(PlacementCandidatePicker, props)));
    assert.equal(requests[0].url, '/api/admin/playlists/first/curation/candidates?limit=48');
    await act(async () => Simulate.change(dom.window.document.querySelector('[aria-label="Search eligible media"]') as HTMLInputElement,
      { target: { value: 'new' } }));
    assert.match(requests[1].url, /q=new/);
    await act(async () => requests[1].resolve(Response.json({ ok: true, items: [item('new')], total: 1, nextCursor: null })));
    await act(async () => requests[0].resolve(Response.json({ ok: true, items: [item('stale')], total: 1, nextCursor: null })));
    assert.deepEqual(remembered, [['new']]);
    assert.match(dom.window.document.querySelector('[aria-label="Eligible media"]')!.textContent!, /new/);
    assert.ok(!dom.window.document.querySelector('[data-media-id="stale"]'));
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('edits_four_slots_and_paged_tail', async () => {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/admin/playlists'});
  const old=new Map<string,PropertyDescriptor|undefined>();
  const items=Array.from({length:145},(_,n)=>({id:`v${n+1}`,engineId:'wan-3',engineLabel:'Wan 3',prompt:`Video ${n+1}`,videoUrl:'/v.mp4',thumbUrl:n===5?'/portrait.jpg':null,
    outputWidth:n===6?undefined:n===1||n===5?720:1280,outputHeight:n===6?undefined:n===1||n===5?1280:720}));
  let submitted:any;
  let newFamily = false;
  const requests:string[]=[];
  for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,navigator:dom.window.navigator,React,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url:string,init?:RequestInit)=>{
    requests.push(url);const params=new URL(url,'http://localhost').searchParams;
    if(url.includes('/api/admin/video-seo/'))return Response.json({ok:true,status:'not_selected',inVideoSitemap:false});
    if(init?.method==='POST'){submitted=JSON.parse(String(init.body));return Response.json({ok:true,preview:{items:[],token:'t'}});}
    if(url.includes('/candidates')){const ids=params.getAll('ids');const offset=Number(params.get('cursor')??0);return Response.json({ok:true,items:ids.length?items.filter(i=>ids.includes(i.id)):items.slice(offset,offset+48),total:145,nextCursor:offset+48<145?String(offset+48):null});}
    return Response.json({ok:true,snapshot:{available:true,supported:true,openingAvailable:true,slug:'family-wan',isPublic:true,revision:'r',config:newFamily ? null : {mode:'hybrid',openingIds:['v1','v2','v3','v4'],orderedIds:items.slice(4,110).map(i=>i.id),excludedIds:[]}},initialIds:items.slice(4,110).map(i=>i.id),selectedItems:items.slice(4,52),selectedTotal:106});
  }})){old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
  const root=createRoot(dom.window.document.getElementById('root')!);
  const button=(name:string)=>[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent===name)!;
  try{
    const {PlacementEditor}=await import('../frontend/components/admin/playlists/PlacementEditor');
    await act(async()=>root.render(React.createElement(PlacementEditor,{playlistId:'p'})));
    assert.ok(dom.window.document.querySelector('[data-selected-grid]'));
    assert.ok(!requests.some(url => url.includes('/api/admin/video-seo/')));
    await act(async () => button('Inspect video').click());
    assert.ok(requests.some(url => url.includes('/api/admin/video-seo/v5/status')));
    assert.equal(dom.window.document.querySelector('video'), null);
    await act(async () => button('Close details').click());
    assert.match(dom.window.document.querySelector('[data-curation-item="v7"]')!.textContent!, /Unknown format/);
    assert.ok(dom.window.document.querySelector('[data-curation-item="v6"] img')?.className.includes('object-contain'));
    assert.match(dom.window.document.body.textContent!,/eligible new videos appended automatically/);
    await act(async () => button('Add videos').click());
    assert.ok(button('Next candidates'));
    await act(async()=>button('Next candidates').click());await act(async()=>button('Next candidates').click());
    assert.match(dom.window.document.querySelector('[aria-label="Eligible media"]')!.textContent!,/Video 101/);
    assert.equal((dom.window.document.querySelector('[aria-label="Eligible media"] [data-media-id="v101"] button') as HTMLButtonElement).disabled, true,
      'already selected videos cannot be added twice');
    const excludedCard = dom.window.document.querySelector('[aria-label="Eligible media"] [data-media-id="v111"]')!;
    await act(async () => ([...excludedCard.querySelectorAll('button')].find(el => el.textContent === 'Exclude from this page') as HTMLButtonElement).click());
    assert.equal(([...excludedCard.querySelectorAll('button')].find(el => el.textContent === 'Add to selection') as HTMLButtonElement).disabled, true,
      'excluded videos cannot be added');
    await act(async () => Simulate.change(dom.window.document.querySelector('[aria-label="Search eligible media"]') as HTMLInputElement, { target: { value: 'Video 111' } }));
    assert.ok(requests.some(url => url.includes('q=Video+111') && !url.includes('cursor=')), 'a new search restarts cursor paging');
    await act(async () => button('Close explorer').click());
    await act(async () => (dom.window.document.querySelector('[aria-label="Choose opening slot 2, 9:16"]') as HTMLButtonElement).click());
    assert.ok(requests.some(url => url.includes('format=9%3A16')), 'portrait slot fixes the server-side candidate filter');
    await act(async () => button('Close explorer').click());
    await act(async()=>button('Next selected').click());
    const up=dom.window.document.querySelector('[aria-label="Move item 49 up"]') as HTMLButtonElement;
    assert.ok(up);assert.equal(up.disabled,false);
    await act(async()=>up.click());await act(async()=>button('Preview changes').click());
    assert.equal(submitted.draft.orderedIds[47],'v53');assert.equal(submitted.draft.orderedIds.length,106);
    assert.ok(requests.some(url=>url.includes('ids=v53')));
    assert.ok(dom.window.document.querySelector('a[href="/admin/video-seo?video=v2"]'));
    const drop = new dom.window.Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'v54' } });
    await act(async () => button('Previous selected').dispatchEvent(drop));
    await act(async () => button('Preview changes').click());
    assert.equal(submitted.draft.orderedIds[0], 'v54', 'drop on previous page moves across windows');
    const position = dom.window.document.querySelector('[aria-label="Move item 1 to position"]') as HTMLInputElement;
    await act(async () => Simulate.change(position, { target: { value: '100' } }));
    await act(async () => (dom.window.document.querySelector('[aria-label="Apply position for item 1"]') as HTMLButtonElement).click());
    await act(async () => button('Preview changes').click());
    assert.equal(submitted.draft.orderedIds[99], 'v54');
    assert.equal(submitted.draft.orderedIds.length, 106);
    const remove = [...dom.window.document.querySelectorAll('[data-curation-item="v5"] button')].find(el => el.textContent === 'Unfeature') as HTMLButtonElement;
    await act(async () => remove.click());
    await act(async () => button('Preview changes').click());
    assert.ok(!submitted.draft.orderedIds.includes('v5'));
    assert.ok(!submitted.draft.excludedIds.includes('v5'), 'unfeature does not blacklist the public feed');
    const exclude = [...dom.window.document.querySelectorAll('[data-curation-item="v6"] button')].find(el => el.textContent === 'Exclude from this page') as HTMLButtonElement;
    await act(async () => exclude.click());
    await act(async () => button('Preview changes').click());
    assert.ok(submitted.draft.excludedIds.includes('v6'), 'exclude suppresses the video from the page');
    assert.ok(!submitted.draft.orderedIds.includes('v6'));
    newFamily = true;
    await act(async()=>root.render(React.createElement(PlacementEditor,{key:'new-family',playlistId:'new-family'})));
    assert.equal(button('Preview changes').disabled, true, 'new families require all four slots');
  }finally{await act(async()=>root.unmount());dom.window.close();for(const[key,value]of old){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
});

for (const scenario of ['freeze-small-hybrid', 'reload-later-window'] as const) {
  test(`hydrates_current_selection_after_${scenario}`, async () => {
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/playlists' });
    const previous = new Map<string, PropertyDescriptor | undefined>();
    const items = Array.from({ length: 160 }, (_, index) => ({
      id: `window-${index + 1}`, engineId: 'wan-3', engineLabel: 'Wan 3',
      prompt: `Selected video ${index + 1}`, videoUrl: '/video.mp4', thumbUrl: null,
      createdAt: '2026-09-28T00:00:00Z', outputWidth: 1280, outputHeight: 720,
    }));
    const initialIds = scenario === 'freeze-small-hybrid' ? ['window-1'] : items.slice(0, 120).map(item => item.id);
    const selectedWindows: string[][] = [];
    const fetch = async (url: string) => {
      const params = new URL(url, 'http://localhost').searchParams;
      if (params.get('idsOnly') === 'true') return Response.json({ ok: true, ids: items.map(item => item.id), total: items.length });
      if (params.has('ids')) {
        const ids = params.getAll('ids'); selectedWindows.push(ids);
        return Response.json({ ok: true, items: items.filter(item => ids.includes(item.id)), total: ids.length, nextCursor: null });
      }
      if (url.includes('/candidates')) return Response.json({ ok: true, items: items.slice(0, 48), total: items.length, nextCursor: 'next' });
      return Response.json({
        ok: true, snapshot: { available: true, supported: true, slug: 'examples-wan-3', isPublic: true, revision: 'r1',
          config: { mode: scenario === 'freeze-small-hybrid' ? 'hybrid' : 'manual', orderedIds: initialIds,
            excludedIds: scenario === 'freeze-small-hybrid' ? ['window-2', 'window-3', 'window-4'] : [] } },
        initialIds, selectedItems: items.filter(item => initialIds.includes(item.id)).slice(0, 48), selectedTotal: initialIds.length,
      });
    };
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true, fetch })) {
      previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    const root = createRoot(dom.window.document.getElementById('root')!);
    const button = (label: string) => [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === label)!;
    const visibleIds = () => [...dom.window.document.querySelectorAll('[data-curation-item]')].map(item => item.getAttribute('data-curation-item'));
    try {
      const { PlacementEditor } = await import('../frontend/components/admin/playlists/PlacementEditor');
      await act(async () => root.render(React.createElement(PlacementEditor, { playlistId: 'window-fixture' })));
      if (scenario === 'freeze-small-hybrid') {
        const policy = dom.window.document.querySelector('[aria-label="Page order"]') as HTMLSelectElement;
        await act(async () => { policy.value = 'manual'; policy.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
        assert.equal(visibleIds().length, 48, 'the complete first window hydrates even though only one ID was originally featured');
        assert.equal(visibleIds()[47], 'window-51', 'excluded early candidates are replaced by later eligible IDs');
        assert.ok(selectedWindows.some(ids => ids.includes('window-51')));
        assert.ok(selectedWindows.every(ids => ids.length <= 48));
        assert.match(dom.window.document.querySelector('[aria-label="Selected media"]')!.textContent!, /Manual selection · 157/);
      } else {
        await act(async () => button('Next selected').click());
        assert.equal(visibleIds()[0], 'window-49');
        assert.equal(visibleIds().length, 48);
        await act(async () => button('Reload').click());
        assert.equal(visibleIds().length, 48, 'reloading must leave a complete visible window');
        assert.equal(visibleIds()[0], 'window-1', 'reload resets the selected page together with its metadata');
        assert.match(dom.window.document.querySelector('[aria-label="Selected media"]')!.textContent!, /Selected page 1 of 3/);
      }
    } finally {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
}
