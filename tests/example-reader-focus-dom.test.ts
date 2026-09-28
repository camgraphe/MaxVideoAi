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
