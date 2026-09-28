import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useGalleryReader } from '../frontend/components/examples/useGalleryReader';
import type { ExampleGalleryVideo } from '../frontend/components/examples/examples-gallery-types';
const cards=(offset:number,count=24)=>Array.from({length:count},(_,n)=>({id:`v${offset+n}`,href:`/video/v${offset+n}`,aspectRatio:'16:9'}) as ExampleGalleryVideo);
test('reader crosses a page in both directions, uses watch URLs with gallery history and cancels a closed request',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/examples/wan?page=2'});
 const saved=new Map<string,PropertyDescriptor|undefined>(),calls:string[]=[];
 let resolveFetch!:(value:Response)=>void;
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true,fetch:(url:string)=>{calls.push(url);return new Promise<Response>(resolve=>{resolveFetch=resolve;});}})){
  saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 }
 const videos=cards(24);let observed!:ReturnType<typeof useGalleryReader>;
 function Fixture(){observed=useGalleryReader(videos,24,'playlist','wan','fr');return null;}
 const root=createRoot(dom.window.document.getElementById('root')!);
 try{
  await act(async()=>root.render(React.createElement(Fixture)));
  await act(async()=>observed.open(videos[0]));assert.equal(observed.selected,'v24');assert.equal(dom.window.location.pathname,'/video/v24');
  let pending!:Promise<void>;await act(async()=>{pending=observed.step(-1);});
  assert.equal(observed.busy,true);assert.ok(calls[0].includes('offset=0'));assert.ok(calls[0].includes('engine=wan'));assert.ok(calls[0].includes('limit=24'));
  await act(async()=>{resolveFetch(new Response(JSON.stringify({cards:cards(0),hasMore:true})));await pending;});
  assert.equal(observed.selected,'v23');assert.equal(dom.window.location.pathname,'/video/v23');
  await act(async()=>{pending=observed.step(1);});
  await act(async()=>{resolveFetch(new Response(JSON.stringify({cards:cards(24),hasMore:true})));await pending;});
  assert.equal(observed.selected,'v24');
  // Back closes without leaving the page; Forward reopens the last selected video.
  const readerState=dom.window.history.state,readerUrl=dom.window.location.href;
  await act(async()=>{dom.window.history.replaceState(null,'','/examples/wan?page=2');dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));});assert.equal(observed.selected,null);
  await act(async()=>{dom.window.history.replaceState(readerState,'',readerUrl);dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate'));});assert.equal(observed.selected,'v24');
  await act(async()=>{pending=observed.step(-1);});
  await act(async()=>observed.close());
  await act(async()=>{resolveFetch(new Response(JSON.stringify({cards:cards(0),hasMore:true})));await pending;});
  assert.equal(observed.selected,null);assert.equal(observed.busy,false);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
});
