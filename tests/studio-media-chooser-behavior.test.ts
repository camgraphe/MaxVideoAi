import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import type {ImageLibraryAsset} from '../frontend/src/lib/studio/image-library';

const require = createRequire(import.meta.url);
require.extensions['.css'] = module => {module.exports = new Proxy({}, {get: (_target, property) => property === '__esModule' ? false : String(property)});};
const image = {assetId: 'ma_'+'a'.repeat(32),url: 'https://media.test/original.webp',thumbUrl: 'https://media.test/thumb.webp',name: 'Watch study',kind: 'image'} as const;
const video = {assetId: 'ma_'+'b'.repeat(32),url: 'https://media.test/original.mp4',name: 'Film study',kind: 'video'} as const;
const output = {id: 'out-1',jobId: 'job-1',url: image.url,thumbUrl: image.thumbUrl,status: 'ready'};
const response = (payload: unknown, ok = true) => ({ok,json: async () => payload}) as Response;

async function mountChooser(request: typeof fetch, options: {purpose?: 'reference'|'timeline';locale?: 'en'|'fr'|'es'} = {}) {
  const dom = new JSDOM('<button id="opener">Open</button><div id="root"></div>', {url: 'https://maxvideoai.test/app/studio'});
  dom.window.HTMLDialogElement.prototype.showModal = function() {this.setAttribute('open','');};
  const previous = new Map<string,PropertyDescriptor|undefined>();
  for (const [key,value] of Object.entries({window: dom.window,HTMLElement: dom.window.HTMLElement,document: dom.window.document,React,fetch: request,FormData: dom.window.FormData,IS_REACT_ACT_ENVIRONMENT: true})) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable: true,writable: true,value});
  }
  const {ImageReferenceLibrary} = await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ImageReferenceLibrary.client');
  const selected: ImageLibraryAsset[] = [];
  const root = createRoot(dom.window.document.getElementById('root')!);
  await React.act(async () => root.render(React.createElement(ImageReferenceLibrary,{onClose: () => {},onSelect: asset => selected.push(asset),mediaEnabled: true,...options})));
  const settle = () => React.act(async () => {await new Promise(resolve => setTimeout(resolve,230));});
  const button = (label: string) => [...dom.window.document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label') === label || item.textContent?.trim() === label);
  await settle();
  return {dom,selected,button,settle,
    async click(label: string) {const target = button(label);assert.ok(target,'button '+label+' exists');await React.act(async () => target.click());},
    async dispose() {await React.act(async () => root.unmount());dom.window.close();for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}},
  };
}

test('library choice is staged, thumbnail fallback preserves the original and Add attaches the exact asset', async () => {
  const fixture = await mountChooser((async () => response({ok: true,assets: [image]})) as typeof fetch);
  try {
    const add = fixture.button('Add to conversation');
    assert.ok(add);
    assert.equal(add.disabled,true);
    await fixture.click('Choose Watch study');
    assert.equal(fixture.selected.length,0,'browsing a tile does not attach media');
    assert.equal(fixture.button('Choose Watch study')!.getAttribute('aria-pressed'),'true');
    const thumbnail = fixture.dom.window.document.querySelector('img')!;
    assert.equal(thumbnail.getAttribute('src'),image.thumbUrl);
    await React.act(async () => thumbnail.dispatchEvent(new fixture.dom.window.Event('error')));
    assert.equal(thumbnail.getAttribute('src'),image.url);
    await fixture.click('Add to conversation');
    assert.deepEqual(fixture.selected,[image]);
  } finally {await fixture.dispose();}
});

test('recent creation is promoted only on Add and a media filter clears a staged selection', async () => {
  const writes: unknown[] = [];
  const fixture = await mountChooser((async (url,init) => {
    if (init?.method === 'POST') {writes.push(JSON.parse(init.body as string));return response({ok: true,asset: {url: image.url}});}
    return response(String(url).includes('recent-outputs') ? {ok: true,outputs: [output]} : {ok: true,assets: [String(url).includes('kind=video') ? video : image]});
  }) as typeof fetch,{purpose: 'timeline'});
  try {
    await fixture.click('Recent creations');await fixture.settle();
    const card = fixture.dom.window.document.querySelector<HTMLButtonElement>('[data-media-choice]')!;
    assert.ok(card);
    await React.act(async () => card.click());
    assert.deepEqual(writes,[],'merely selecting a recent output is read-only');
    assert.equal(fixture.button('Add to timeline')!.disabled,false);
    await fixture.click('Videos');
    assert.equal(fixture.button('Add to timeline')!.disabled,true,'changed kind cannot reuse an image selection');
    await fixture.settle();
    await fixture.click('Images');await fixture.settle();
    await React.act(async () => fixture.dom.window.document.querySelector<HTMLButtonElement>('[data-media-choice]')!.click());
    await fixture.click('Add to timeline');
    assert.deepEqual(writes,[{jobId: 'job-1',outputId: 'out-1'}]);
    assert.deepEqual(fixture.selected,[image]);
  } finally {await fixture.dispose();}
});

test('a failed upload clears the file input for retry and late upload results cannot attach after a filter change', async () => {
  let finish!: (value: Response) => void;
  let uploads = 0;
  const fixture = await mountChooser((async (_url,init) => {
    if (init?.method === 'POST') {uploads++;if(uploads===1)return response({ok:false},false);return new Promise<Response>(resolve=>{finish=resolve;});}
    return response({ok: true,assets: []});
  }) as typeof fetch);
  try {
    const input = fixture.dom.window.document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new fixture.dom.window.File(['image'],'study.webp',{type:'image/webp'});
    Object.defineProperty(input,'files',{configurable:true,value:[file]});
    Object.defineProperty(input,'value',{configurable:true,writable:true,value:'study.webp'});
    await React.act(async () => input.dispatchEvent(new fixture.dom.window.Event('change',{bubbles:true})));
    assert.equal(input.value,'','the same file can be selected after failure');
    assert.ok(fixture.dom.window.document.querySelector('[role="alert"]'));
    await React.act(async () => input.dispatchEvent(new fixture.dom.window.Event('change',{bubbles:true})));
    await fixture.click('Videos');
    await React.act(async () => finish(response({ok:true,asset:image})));
    assert.deepEqual(fixture.selected,[],'a replaced upload intent must not attach to the current filter');
  } finally {await fixture.dispose();}
});

for (const [locale,add,upload] of [['fr','Ajouter à la conversation','Importer depuis cet appareil'],['es','Añadir a la conversación','Subir desde este dispositivo']] as const) {
  test('chooser provides '+locale+' action labels',async()=>{
    const fixture = await mountChooser((async()=>response({ok:true,assets:[]})) as typeof fetch,{locale});
    try {assert.ok(fixture.button(add));assert.ok(fixture.button(upload));} finally {await fixture.dispose();}
  });
}

test('a late recent promotion is cancelled when the selection intent changes', async () => {
  let finish!: (value: Response) => void;
  let promotionSignal: AbortSignal | undefined;
  const fixture = await mountChooser((async (url,init) => {
    if(init?.method==='POST'){promotionSignal=init.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}
    return response(String(url).includes('recent-outputs') ? {ok:true,outputs:[output]} : {ok:true,assets:[image]});
  }) as typeof fetch);
  try {
    await fixture.click('Recent creations');await fixture.settle();
    await React.act(async()=>fixture.dom.window.document.querySelector<HTMLButtonElement>('[data-media-choice]')!.click());
    await fixture.click('Add to conversation');
    await fixture.click('Library');
    assert.equal(promotionSignal?.aborted,true);
    await React.act(async()=>finish(response({ok:true,asset:{url:image.url}})));
    assert.deepEqual(fixture.selected,[]);
  } finally {await fixture.dispose();}
});

test('a late pagination response cannot replace another media kind and video originals stay out of image elements', async () => {
  let finish!: (value: Response) => void;
  let pageSignal: AbortSignal | undefined;
  const fixture = await mountChooser((async(url,init)=>{
    if(String(url).includes('cursor=')){pageSignal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}
    return response({ok:true,assets:[String(url).includes('kind=video') ? video : image],nextCursor:'next-page'});
  }) as typeof fetch);
  try {
    await fixture.click('Load more');
    await fixture.click('Videos');
    assert.equal(pageSignal?.aborted,true);
    await React.act(async()=>finish(response({ok:true,assets:[image]})));
    await fixture.settle();
    assert.ok(fixture.button('Choose Film study'));
    assert.equal(fixture.button('Choose Watch study'),undefined);
    assert.equal(fixture.dom.window.document.querySelectorAll('img').length,0,'video original is never treated as a thumbnail');
    await fixture.click('Choose Film study');await fixture.click('Add to conversation');
    assert.deepEqual(fixture.selected,[video]);
  } finally {await fixture.dispose();}
});
