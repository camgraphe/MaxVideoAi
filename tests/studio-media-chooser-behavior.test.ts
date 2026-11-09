import {mediaGridGlobals} from './helpers/media-grid-dom';
import './helpers/uppy-node-fixture';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import type {ImageLibraryAsset} from '../frontend/src/lib/studio/image-library';
import {chunkedVideoUploadFixture} from './helpers/chunked-video-upload-fixture';
import {uploadSessionFixture} from './helpers/upload-session-fixture';

const require = createRequire(import.meta.url);
require.extensions['.css'] = module => {module.exports = new Proxy({}, {get: (_target, property) => property === '__esModule' ? false : String(property)});};
const image = {assetId: 'ma_'+'a'.repeat(32),url: 'https://media.test/original.webp',thumbUrl: 'https://media.test/thumb.webp',name: 'Watch study',kind: 'image'} as const;
const video = {assetId: 'ma_'+'b'.repeat(32),url: 'https://media.test/original.mp4',name: 'Film study',kind: 'video'} as const;
const output = {id: 'out-1',jobId: 'job-1',url: image.url,thumbUrl: image.thumbUrl,status: 'ready'};
const response = (payload: unknown, ok = true) => ({ok,json: async () => payload}) as Response;

async function mountChooser(rawRequest: typeof fetch, options: {purpose?: 'reference'|'timeline';locale?: 'en'|'fr'|'es';characterProjectId?:string} = {}, strict = false, explicitOpener = false) {
  const request: typeof fetch = async (url,init) => String(url).includes('/selection/validate') ? response({ok:true,results:JSON.parse(String(init?.body)).candidates.map((candidate:any)=>({reference:candidate.reference}))}) : String(url).endsWith('/organization') ? response({ok:true,succeededCount:1,failedCount:0,results:[{status:'succeeded',state:{favorite:false,trashedAt:null,collectionIds:[]}}]}) : rawRequest(url,init);
  const dom = new JSDOM('<button id="opener">Open</button><textarea id="composer"></textarea><div id="root"></div>', {url: 'https://maxvideoai.test/app/studio'});
  if (strict) {
    // JSDOM lacks modal inertness. Native dialogs reject outside focus while open,
    // including React's simulated Strict Mode cleanup before the real unmount.
    const nativeFocus = dom.window.HTMLElement.prototype.focus;
    dom.window.HTMLElement.prototype.focus = function() {
      const modal = dom.window.document.querySelector('dialog[open]');
      if (!modal || modal.contains(this)) nativeFocus.call(this);
    };
  }
  let focusBeforeModal: string | null = null;
  dom.window.HTMLDialogElement.prototype.showModal = function() {if(!this.hasAttribute('open'))focusBeforeModal=dom.window.document.activeElement?.id??null;this.setAttribute('open','');this.querySelector('button')?.focus();};
  const previous = new Map<string,PropertyDescriptor|undefined>();
  for (const [key,value] of Object.entries({...mediaGridGlobals(dom.window),window: dom.window,HTMLElement: dom.window.HTMLElement,document: dom.window.document,React,fetch: request,FormData: dom.window.FormData,IS_REACT_ACT_ENVIRONMENT: true})) {
    previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{configurable: true,writable: true,value});
  }
  const {ImageReferenceLibrary} = await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ImageReferenceLibrary.client');
  const session=await uploadSessionFixture();
  const selected: ImageLibraryAsset[] = [];
  const originalTrigger = dom.window.document.getElementById('opener')!;
  dom.window.document.getElementById(explicitOpener ? 'composer' : 'opener')!.focus();
  const root = createRoot(dom.window.document.getElementById('root')!);
  let mounted = true;
  const unmount = async () => {if(mounted){await React.act(async () => root.unmount());mounted=false;}};
  const element = React.createElement(ImageReferenceLibrary,{accountKey:'account-A',onClose: () => {},onSelect: asset => selected.push(asset),mediaEnabled: true,...options,...(explicitOpener ? {returnFocusTo: originalTrigger} : {})});
  await React.act(async () => root.render(strict ? React.createElement(React.StrictMode,null,element) : element));
  const settle = () => React.act(async () => {await new Promise(resolve => setTimeout(resolve,230));});
  const button = (label: string) => label.startsWith('Choose ')&&!label.startsWith('Choose ·') ? [...dom.window.document.querySelectorAll<HTMLInputElement>('.compact-media-check input')].find(item=>item.getAttribute('aria-label')==='Select '+label.slice(7)) : [...dom.window.document.querySelectorAll<HTMLButtonElement>('button')].find(item => item.getAttribute('aria-label')?.replace(' · ', ' ').replace(/^Selected /,'Choose ') === label || item.textContent?.trim() === label);
  await settle();
  return {dom,selected,button,settle,unmount,focusBeforeModal,session,
    async click(label: string) {const value=({'Recent creations':'recent','Library':'all','Videos':'video','Images':'image'} as Record<string,string>)[label];if(value){const select=[...dom.window.document.querySelectorAll('select')].find(select=>[...select.options].some(option=>option.value===value))!;assert.ok(select,'filter '+label);await React.act(async()=>{select.value=value;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});return;} const target = button(label);assert.ok(target,'button '+label+' exists');await React.act(async () => target.click());},
    async dispose() {await unmount();session.restore();dom.window.close();for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}},
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
    assert.equal(fixture.button('Choose Watch study')!.checked,true);
    const thumbnail = fixture.dom.window.document.querySelector('img')!;
    assert.equal(thumbnail.getAttribute('src'),image.thumbUrl);
    await React.act(async () => thumbnail.dispatchEvent(new fixture.dom.window.Event('error')));
    assert.notEqual(fixture.dom.window.document.querySelector('img')?.getAttribute('src'),image.url,'failed poster must not fetch the original into the grid');
    await fixture.click('Add to conversation');
    assert.equal(fixture.selected.length,1); assert.equal(fixture.selected[0].assetId,image.assetId); assert.equal(fixture.selected[0].url,image.url);
  } finally {await fixture.dispose();}
});

test('recent creation is promoted only on Add and a media filter retains the captured original', async () => {
  const writes: unknown[] = [];
  const fixture = await mountChooser((async (url,init) => {
    if (init?.method === 'POST') {writes.push(JSON.parse(init.body as string));return response({ok: true,asset: {url: image.url}});}
    return response(String(url).includes('recent-outputs') ? {ok: true,outputs: [output]} : {ok: true,assets: [String(url).includes('kind=video') ? video : image]});
  }) as typeof fetch,{purpose: 'timeline'});
  try {
    await fixture.click('Recent creations');await fixture.settle();
    const card = fixture.dom.window.document.querySelector<HTMLButtonElement>('.compact-media-check input')!;
    assert.ok(card);
    await React.act(async () => card.click());
    assert.deepEqual(writes,[],'merely selecting a recent output is read-only');
    assert.equal(fixture.button('Add to timeline')!.disabled,false);
    await fixture.click('Videos');
    assert.equal(fixture.button('Add to timeline')!.disabled,false,'kind is a browse filter, not the timeline intent');
    await fixture.settle();
    await fixture.click('Images');await fixture.settle();
    assert.equal(fixture.dom.window.document.querySelector<HTMLInputElement>('.compact-media-check input')!.checked,true);
    await fixture.click('Add to timeline');
    assert.deepEqual(writes,[{jobId: 'job-1',outputId: 'out-1'}]);
    assert.equal(fixture.selected.length,1); assert.equal(fixture.selected[0].assetId,image.assetId); assert.equal(fixture.selected[0].url,image.url);
  } finally {await fixture.dispose();}
});

test('a failed import clears the input and retry keeps imported media staged until confirmation', async () => {
  let uploads=0;
  const fixture=await mountChooser((async(url,init)=>{if(init?.method==='POST'){uploads++;return response({ok:uploads>1,asset:{...image,id:image.assetId}},uploads>1);}return response({ok:true,assets:[]});}) as typeof fetch);
  try {
    const input=fixture.dom.window.document.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input,'files',{configurable:true,value:[new fixture.dom.window.File(['image'],'study.webp',{type:'image/webp'})]});
    await React.act(async()=>input.dispatchEvent(new fixture.dom.window.Event('change',{bubbles:true})));
    assert.equal(input.value,'');assert.equal(uploads,0);await React.act(async()=>fixture.dom.window.document.querySelector<HTMLButtonElement>('.app-library-import button')!.click());
    assert.match(fixture.dom.window.document.querySelector('.app-library-import')!.textContent!,/Failed/);assert.deepEqual(fixture.selected,[]);
    await fixture.click('Retry');assert.equal(uploads,2);assert.deepEqual(fixture.selected,[]);
    await fixture.click('Choose · study.webp');await fixture.click('Add to conversation');assert.equal(fixture.selected[0].url,image.url);
  }finally{await fixture.dispose();}
});

for (const purpose of ['reference','timeline'] as const) {
  test('Studio '+purpose+' library imports a MOV larger than the function body limit',async()=>{
    const upload=chunkedVideoUploadFixture();
    const fixture=await mountChooser(upload.request,{purpose});
    try {
      await fixture.click('Videos');await fixture.settle();
      const input=fixture.dom.window.document.querySelector<HTMLInputElement>('input[type="file"]')!;
      const file=new fixture.dom.window.File([new Uint8Array(5*1024*1024)],'reference.mov',{type:'video/quicktime'});
      Object.defineProperty(input,'files',{configurable:true,value:[file]});
      await React.act(async()=>input.dispatchEvent(new fixture.dom.window.Event('change',{bubbles:true})));
      assert.equal(fixture.dom.window.document.querySelector('[role="alert"]')===null,true,'the video import must succeed');
      assert.equal(upload.completed,false); await React.act(async()=>fixture.dom.window.document.querySelector<HTMLButtonElement>('.app-library-import button')!.click()); assert.equal(upload.completed,true); assert.equal(fixture.selected.length,0); await fixture.click('Choose · reference.mov');await fixture.click(purpose==='reference'?'Add to conversation':'Add to timeline');
      assert.equal(fixture.selected.length,1);
      assert.equal(fixture.selected[0].assetId,upload.asset.assetId);
      assert.equal(fixture.selected[0].kind,'video');
      assert.equal(fixture.selected[0].name,'reference.mov');
      assert.deepEqual(fixture.selected[0].mediaFacts,upload.asset.mediaFacts);
    }finally{await fixture.dispose();}
  });
}

for(const change of ['filter','account'] as const)test('chunked import keeps browse-filter intent and rejects account retirement: '+change,async()=>{
  let release!:()=>void;
  const part=new Promise<void>(resolve=>{release=resolve;});
  const upload=chunkedVideoUploadFixture(()=>part);
  const fixture=await mountChooser(upload.request);
  try {
    await fixture.click('Videos');await fixture.settle();
    const input=fixture.dom.window.document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file=new fixture.dom.window.File([new Uint8Array(5*1024*1024)],'reference.mov',{type:'video/quicktime'});
    Object.defineProperty(input,'files',{configurable:true,value:[file]});
    await React.act(async()=>input.dispatchEvent(new fixture.dom.window.Event('change',{bubbles:true})));
    await React.act(async()=>fixture.dom.window.document.querySelector<HTMLButtonElement>('.app-library-import button')!.click()); assert.match(fixture.dom.window.document.querySelector('.app-library-import')!.textContent!,/Importing/);
    if(change==='filter')await fixture.click('Images');else fixture.session.switchTo('account-B');
    await React.act(async()=>{release();await part;});
    assert.equal(upload.completed,change==='filter');
    assert.deepEqual(fixture.selected,[],'uploads never attach without confirmation');
    if(change==='filter')assert.equal(fixture.dom.window.document.querySelector('[role="alert"]')===null,true);
  }finally{release();await fixture.dispose();}
});

for (const [locale,add,upload] of [['fr','Ajouter à la conversation','Importer'],['es','Añadir a la conversación','Importar']] as const) {
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
    await React.act(async()=>fixture.dom.window.document.querySelector<HTMLButtonElement>('.compact-media-check input')!.click());
    await fixture.click('Add to conversation');
    await fixture.unmount();
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
    assert.equal(fixture.selected[0].url,video.url); assert.equal(fixture.selected[0].assetId,video.assetId);
  } finally {await fixture.dispose();}
});


test('closing the chooser returns focus to its original trigger', async () => {
  const fixture = await mountChooser((async()=>response({ok:true,assets:[]})) as typeof fetch);
  try {
    await fixture.unmount();
    assert.equal(fixture.dom.window.document.activeElement?.id,'opener');
  } finally {await fixture.dispose();}
});


test('Strict Mode effect probing preserves the original opener while native modal inertness blocks outside focus', async () => {
  const fixture = await mountChooser((async()=>response({ok:true,assets:[]})) as typeof fetch,{},true);
  try {
    assert.equal(fixture.dom.window.document.activeElement?.getAttribute('aria-label'),'Close library');
    await fixture.unmount();
    assert.equal(fixture.dom.window.document.activeElement?.id,'opener');
  } finally {await fixture.dispose();}
});


test('an explicit clicked trigger receives focus when Safari leaves the active element in the composer', async () => {
  const fixture = await mountChooser((async()=>response({ok:true,assets:[]})) as typeof fetch,{},true,true);
  try {
    assert.equal(fixture.focusBeforeModal,'composer','the chooser opens while the text box retains focus');
    await fixture.unmount();
    assert.equal(fixture.dom.window.document.activeElement?.id,'opener','the actual clicked button takes precedence over activeElement');
  } finally {await fixture.dispose();}
});


test('visiting the specialized saved-character source preserves the ordinary captured basket and modal host',async()=>{
 const fixture=await mountChooser((async()=>response({ok:true,assets:[image],characters:[]})) as typeof fetch,{characterProjectId:'project-A'});
 try{await fixture.click('Choose Watch study');const dialog=fixture.dom.window.document.querySelector('dialog');await fixture.click('Saved characters');await fixture.click('Media');assert.equal(fixture.dom.window.document.querySelector('dialog'),dialog);assert.equal(fixture.dom.window.document.querySelectorAll('[data-basket-item]').length,1);assert.equal(fixture.selected.length,0);await fixture.click('Add to conversation');assert.equal(fixture.selected[0].assetId,image.assetId);}finally{await fixture.dispose();}
});

for (const kind of ['audio', 'video'] as const) test(`Saved characters retires the active ${kind} reader without losing basket or imports`, async () => {
  const media = {...video, kind, name: 'Film study', url: `https://media.test/original.${kind === 'audio' ? 'mp3' : 'mp4'}`};
  const fixture = await mountChooser((async () => response({ok:true, assets:[media], characters:[]})) as typeof fetch, {characterProjectId:'project-A'});
  try {
    const select = fixture.dom.window.document.querySelector<HTMLSelectElement>('select[aria-label="Media type"]')!;
    await React.act(async () => {select.value=kind;select.dispatchEvent(new fixture.dom.window.Event('change',{bubbles:true}));});
    await fixture.settle();
    await fixture.click('Choose Film study');
    const input=fixture.dom.window.document.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input,'files',{configurable:true,value:[new fixture.dom.window.File(['queued'],'retained.wav',{type:'audio/wav'})]});
    await React.act(async()=>input.dispatchEvent(new fixture.dom.window.Event('change',{bubbles:true})));
    assert.match(fixture.dom.window.document.querySelector('.app-library-import')!.textContent!,/retained.wav/);
    await fixture.click('Back');
    const preview = fixture.dom.window.document.querySelector<HTMLButtonElement>('.compact-media-inspect') ?? [...fixture.dom.window.document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.getAttribute('aria-label')?.includes('Preview'));
    assert.ok(preview, 'preview action exists');
    await React.act(async()=>preview.click());
    await fixture.settle();
    const reader=fixture.dom.window.document.querySelector<HTMLMediaElement>(kind)!;
    assert.ok(reader, 'actual progressive reader mounted');
    const sourceNodes=[reader,...reader.querySelectorAll('source')];
    assert.ok(sourceNodes.some(node=>node.getAttribute('src')===media.url),'active reader uses the exact original');
    let pauses=0;
    Object.defineProperty(reader,'paused',{configurable:true,value:false});
    reader.pause=()=>{pauses++;};
    fixture.button('Saved characters')!.focus();
    await fixture.click('Saved characters');
    assert.ok(fixture.dom.window.document.querySelector(kind) === null,'inactive AV reader must unmount');
    assert.ok(sourceNodes.every(node=>!node.hasAttribute('src')),'all captured original/source attributes released');
    assert.equal(pauses,1,'playing reader paused');
    assert.equal(fixture.dom.window.document.activeElement,fixture.button('Saved characters'),'focus stays on visible tab');
    fixture.button('Media')!.focus();
    await fixture.click('Media');
    assert.equal(fixture.dom.window.document.querySelector(kind),null,'return must not resurrect preview');
    assert.equal(fixture.dom.window.document.querySelectorAll('[data-basket-item]').length,1,'captured basket retained');
    assert.equal(fixture.dom.window.document.activeElement,fixture.button('Media'),'return focus remains valid');
    await fixture.click('1 · Source');
    assert.match(fixture.dom.window.document.querySelector('.app-library-import')!.textContent!,/retained.wav/,'queued import survives surfaces');
    await fixture.click('Back');
    await React.act(async()=>preview.click());
    assert.ok(fixture.dom.window.document.querySelector(kind),'a fresh preview still works');
    await fixture.click('Saved characters');
  } finally {await fixture.dispose();}
});

test('Saved characters retires a pending private preview and its late grant cannot reopen Media',async()=>{
 const media={...video,kind:'audio',name:'Pending audio',readAccessOwnerId:'account-A',readAccessRef:{type:'asset',assetId:video.assetId,kind:'audio'},readAccessRevision:'revision',readAccessExpiresAt:'2000-01-01T00:00:00Z'};
 let finish!:(value:Response)=>void,signal:AbortSignal|undefined;
 const fixture=await mountChooser((async(url,init)=>{
  if(String(url).includes('/read-access')){signal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}
  return response({ok:true,assets:[media],characters:[]});
 }) as typeof fetch,{characterProjectId:'project-A'});
 const client=await (await import('../frontend/src/lib/supabaseClientLoader')).loadSupabaseClient();
 const originalSubscribe=client.auth.onAuthStateChange;
 client.auth.onAuthStateChange=(()=>({data:{subscription:{unsubscribe(){}}}})) as typeof originalSubscribe;
 try{
  const select=fixture.dom.window.document.querySelector<HTMLSelectElement>('select[aria-label="Media type"]')!;
  await React.act(async()=>{select.value='audio';select.dispatchEvent(new fixture.dom.window.Event('change',{bubbles:true}));});await fixture.settle();
  await React.act(async()=>fixture.dom.window.document.querySelector<HTMLButtonElement>('.compact-media-inspect')!.click());
  assert.ok(finish,'real read owner requests a private grant');
  await fixture.click('Saved characters');
  assert.ok(signal,'private read attempt is pending');
  assert.ok(!fixture.dom.window.document.querySelector('audio'),'inactive preview has no decoder');
  await React.act(async()=>finish(response({ok:true,access:{...media,accessUrl:'https://grant.test/late.mp3'}})));
  await fixture.click('Media');
  assert.ok(!fixture.dom.window.document.querySelector('audio'),'late grant never remounts the reader');
 }finally{await fixture.dispose();client.auth.onAuthStateChange=originalSubscribe;}
});
