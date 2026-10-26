import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {StudioShotPlanEditor} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/StudioShotPlanEditor.client';

test('shot editor submits only a draft for a new quote, preserves exact shots and rejects invalid totals',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
 const previous=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({React,window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){
  previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 }
 const drafts:unknown[]=[];let edits=0;
 const root=createRoot(dom.window.document.getElementById('root')!);
 try{
  await act(async()=>root.render(React.createElement(StudioShotPlanEditor,{engineId:'kling-v4',shots:[{prompt:'Opening',durationSec:15},{prompt:'Closing',durationSec:15}],locale:'en',busy:false,onEditing:()=>edits++,onDraft:(shots)=>drafts.push(shots)})));
  const button=(label:string)=>[...dom.window.document.querySelectorAll('button')].find(node=>node.textContent===label)!;
  await act(async()=>button('Edit shot plan').click());assert.equal(edits,1);
  assert.equal(dom.window.document.querySelectorAll('textarea').length,2);
  await act(async()=>button('Use this plan in a new request').click());
  assert.deepEqual(drafts,[[{prompt:'Opening',durationSec:15},{prompt:'Closing',durationSec:15}]]);
  await act(async()=>button('Add shot').click());
  assert.equal((button('Use this plan in a new request') as HTMLButtonElement).disabled,true);
  assert.match(dom.window.document.body.textContent!,/3–30/);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of previous)descriptor?Object.defineProperty(globalThis,key,descriptor):Reflect.deleteProperty(globalThis,key);}
});
