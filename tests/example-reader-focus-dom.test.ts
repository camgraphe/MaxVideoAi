import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import type {ExampleWatchDetail} from '../frontend/lib/example-watch-detail';

test('actual reader navigation and retry retain focus, Tab containment and Escape while loading',async()=>{
 const dom=new JSDOM('<a id="background" href="/examples">Background</a><div id="root"></div>',{url:'http://localhost/examples',pretendToBeVisual:true});
 const pending:Array<(response:Response)=>void>=[];
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,React,IS_REACT_ACT_ENVIRONMENT:true,fetch:()=>new Promise<Response>(resolve=>pending.push(resolve))};
 const saved=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 dom.window.HTMLElement.prototype.getClientRects=function(){return [{width:44,height:44}] as unknown as DOMRectList;};
 dom.window.HTMLMediaElement.prototype.pause=()=>{};
 const require=createRequire(import.meta.url),css=require.extensions['.css'];require.extensions['.css']=()=>{};
 const root=createRoot(dom.window.document.getElementById('root')!);let closed=0;
 const detail={id:'one',title:'First video',prompt:'Full prompt',videoUrl:'https://media.maxvideoai.com/one.mp4',posterUrl:null,engineLabel:'Example',watchHref:'/video/one',modelHref:null,recreateHref:null,aspectRatio:'16:9',durationSec:5,hasAudio:false,historicalCost:null,scenario:null,quotes:[],references:[],context:{intro:'Description',visualContext:null,negativePrompt:null,createdAt:'',details:[],controls:[],highlights:[],notes:[],engineDescription:'',engineBadges:[],compareLinks:[],keyframes:null}} as ExampleWatchDetail;
 try{
  const {default:Reader}=await import('../frontend/components/examples/ExampleReader.client');
  function Fixture(){const[id,setId]=React.useState('one');return React.createElement(Reader,{id,locale:'en',onClose:()=>closed++,navigationError:false,navigation:{previous:()=>setId('one'),next:()=>setId('two'),canPrevious:id!=='one',canNext:id==='one',busy:false}});}
  await act(async()=>root.render(React.createElement(Fixture)));
  await act(async()=>{pending.shift()!(new Response(JSON.stringify({detail})));});
  const doc=dom.window.document,button=doc.querySelector<HTMLButtonElement>('[aria-label="Next video"]')!;
  button.focus();await act(async()=>button.click());
  assert.ok(doc.querySelector('[role="dialog"]')?.contains(doc.activeElement),'navigation must retain focus inside the dialog during loading');
  const key=async(key:string)=>act(async()=>{doc.activeElement?.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));});
  await key('Escape');assert.equal(closed,1,'Escape works before the next fetch completes');
  await key('Tab');assert.notEqual(doc.activeElement?.id,'background');
  await act(async()=>{pending.shift()!(new Response(null,{status:503}));});
  const retry=[...doc.querySelectorAll('button')].find(button=>button.textContent==='Try again')!;
  assert.ok(retry);retry.focus();await act(async()=>retry.click());
  assert.ok(doc.querySelector('[role="dialog"]')?.contains(doc.activeElement),'retry must retain focus while its button is removed');
  await key('Escape');assert.equal(closed,2);
 }finally{
  await act(async()=>root.unmount());dom.window.close();if(css)require.extensions['.css']=css;else delete require.extensions['.css'];
  for(const[key,value]of saved){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}
 }
});

test('central Play retains reader focus through playback and rejection so Escape restores the opener', async () => {
 const dom = new JSDOM('<button id="opener">Open video</button><div id="root"></div>', { url: 'http://localhost/examples', pretendToBeVisual: true });
 let settlePlay: { resolve: () => void; reject: (error: Error) => void } | null = null;
 let paused = true;
 dom.window.HTMLMediaElement.prototype.play = function () {
  paused = false;
  this.dispatchEvent(new dom.window.Event('play'));
  return new Promise<void>((resolve, reject) => { settlePlay = { resolve, reject }; });
 };
 dom.window.HTMLMediaElement.prototype.pause = function () {
  paused = true;
  this.dispatchEvent(new dom.window.Event('pause'));
 };
 Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'paused', { get: () => paused });
 dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 44, height: 44 }] as unknown as DOMRectList; };
 const detail: ExampleWatchDetail = {
  id: 'one', title: 'First video', prompt: 'Full prompt', videoUrl: 'https://media.maxvideoai.com/one.mp4', posterUrl: null,
  engineLabel: 'Example', watchHref: '/video/one', modelHref: null, recreateHref: null, aspectRatio: '16:9', durationSec: 5,
  hasAudio: false, historicalCost: null, scenario: null, quotes: [], references: [],
  context: { intro: 'Description', visualContext: null, negativePrompt: null, createdAt: '', details: [], controls: [], highlights: [],
   notes: [], engineDescription: '', engineBadges: [], compareLinks: [], keyframes: null },
 };
 const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement,
  React, IS_REACT_ACT_ENVIRONMENT: true, fetch: async () => new Response(JSON.stringify({ detail })) };
 const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
 for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
 const root = createRoot(dom.window.document.getElementById('root')!);
 const doc = dom.window.document, opener = doc.getElementById('opener')!;
 let closed = 0;
 try {
  const { default: Reader } = await import('../frontend/components/examples/ExampleReader.client');
  function Fixture() {
   const [open, setOpen] = React.useState(true);
   return open ? React.createElement(Reader, { id: detail.id, locale: 'en', onClose: () => { closed++; setOpen(false); }, navigationError: false,
    navigation: { previous() {}, next() {}, canPrevious: false, canNext: false, busy: false } }) : null;
  }
  for (const outcome of ['playing', 'rejected', 'unfocused activation', 'native playback'] as const) {
   opener.focus();
   await act(async () => root.render(React.createElement(Fixture, { key: outcome })));
   await act(async () => { await new Promise(resolve => dom.window.setTimeout(resolve, 0)); });
   const dialog = doc.querySelector('[role="dialog"]')!;
   const center = dialog.querySelector<HTMLButtonElement>('.video-reader-centerPlay')!;
   const toolbar = dialog.querySelector<HTMLButtonElement>('.video-reader-controlRow button')!;
   const close = dialog.querySelector<HTMLButtonElement>('[aria-label="Close video player"]')!;
   if (outcome === 'unfocused activation' || outcome === 'native playback') close.focus(); else center.focus();
   await act(async () => {
    if (outcome === 'native playback') void dialog.querySelector('video')!.play(); else center.click();
   });
   assert.equal(dialog.querySelector('.video-reader-centerPlay'), null, `${outcome}: central Play is removed during startup`);
   assert.equal(toolbar.getAttribute('aria-label'), 'Pause');
   if (outcome === 'unfocused activation' || outcome === 'native playback') {
    assert.ok(doc.activeElement === close, `${outcome}: playback must not take another control's focus`);
   } else {
    assert.ok(doc.activeElement === toolbar, `${outcome}: focused central Play transfers focus to the persistent playback control (active: ${doc.activeElement?.tagName})`);
    assert.ok(dialog.contains(doc.activeElement), 'Escape must still target the dialog after central Play disappears');
   }
   if (outcome === 'rejected') {
    await act(async () => settlePlay!.reject(new Error('Playback denied')));
    assert.equal(toolbar.getAttribute('aria-label'), 'Play video');
    assert.ok(dialog.querySelector('.video-reader-centerPlay'), 'rejected playback remains retryable');
    assert.ok(doc.activeElement === toolbar, 'the focused playback control survives rejection');
    await act(async () => toolbar.click());
    assert.equal(toolbar.getAttribute('aria-label'), 'Pause', 'the retained control can retry playback');
   }
   await act(async () => {
    settlePlay!.resolve();
    dialog.querySelector('video')!.dispatchEvent(new dom.window.Event('playing'));
   });
   assert.ok(doc.activeElement === (outcome === 'unfocused activation' || outcome === 'native playback' ? close : toolbar));
   await act(async () => { doc.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
   assert.equal(doc.querySelector('[role="dialog"]'), null, `${outcome}: Escape closes the actual reader`);
   assert.ok(doc.activeElement === opener, `${outcome}: closing restores the gallery opener`);
   assert.equal(doc.body.style.overflow, '');
  }
  assert.equal(closed, 4);
 } finally {
  await act(async () => root.unmount()); dom.window.close();
  for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
 }
});
