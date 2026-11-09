import assert from 'node:assert/strict';import test from 'node:test';
import {bundleClientFlow,createClientFlowDom} from './helpers/client-flow-dom';
const bundle=bundleClientFlow(`import React,{act}from'react';import{createRoot}from'react-dom/client';import{useImageReferenceSlotLifecycle}from'./app/(core)/(workspace)/app/image/_hooks/useImageReferenceSlotLifecycle';import{useImageLibrarySelection}from'./app/(core)/(workspace)/app/image/_hooks/useImageLibrarySelection';function App(){const slots=useImageReferenceSlotLifecycle('A');window.state=slots;window.actions=useImageLibrarySelection({intent:window.intent,opening:window.opening,limit:window.limit,slotIndex:window.slot,supported:()=>true,unsupported:()=>{},setSlots:slots.setReferenceSlots,close:()=>window.closes++});return null}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};`,{});
const row=(id:string)=>({id,url:'https://example.invalid/'+id+'.png'});
test('image acceptance uses live capacity, replaces exactly one slot, and retires equal-limit model ABA callbacks',async()=>{
 const dom=createClientFlowDom('/app/image'),w=dom.window as any;Object.assign(w,{intent:'A:model-A:append',opening:{},limit:3,slot:null,closes:0});w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());const initial=w.actions.handleLibrarySelectMany;
 w.limit=1;await w.fx.act(async()=>w.fx.render());await w.fx.act(async()=>assert.equal(initial([row('one'),row('two')]),false));assert.equal(w.state.referenceSlots.filter(Boolean).length,0);
 w.limit=3;await w.fx.act(async()=>w.fx.render());await w.fx.act(async()=>assert.equal(w.actions.handleLibrarySelectMany([row('one'),row('two')]),true));
 await w.fx.act(async()=>assert.equal(w.actions.handleLibrarySelect(row('replacement'),1),true));assert.deepEqual(Array.from(w.state.referenceSlots).filter(Boolean).map((r:any)=>r.id),['one','replacement']);assert.equal(w.closes,2);
 const before=JSON.stringify(w.state.referenceSlots),old=w.actions.handleLibrarySelectMany;for(const intent of ['A:model-B:append','A:model-A:append']){w.intent=intent;await w.fx.act(async()=>w.fx.render());await w.fx.act(async()=>assert.equal(old([row('late')]),false));assert.equal(JSON.stringify(w.state.referenceSlots),before);}
 const beforeReopen=w.actions.handleLibrarySelectMany;w.opening={};await w.fx.act(async()=>w.fx.render());await w.fx.act(async()=>assert.equal(beforeReopen([row('retired-opening')]),false));assert.equal(JSON.stringify(w.state.referenceSlots),before);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
