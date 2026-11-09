import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

async function mount(workflow = false) {
  const bundle=await bundleClientFlow(`
    import React,{act} from 'react';import {createRoot} from 'react-dom/client';
    import {WorkspaceRecentRoleDialog} from './app/(core)/(workspace)/app/_components/WorkspaceRecentRoleDialog.client';
    import {resolveWorkspaceWorkflow} from './app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
    import {listFalEngines} from './src/config/falEngines';
    const engine=listFalEngines().find(entry=>entry.id==='kling-o3-pro').engine;
    function App(){const workflow=window.workflow?resolveWorkspaceWorkflow({engine,form:window.form,inputAssets:window.inputAssets??{},klingElements:[]}):null;window.workflowState=workflow;return window.visible?<WorkspaceRecentRoleDialog userId={window.owner} asset={window.asset} fields={[{field:{id:window.workflow?'video_url':'image_url',type:window.asset.kind,label:'Source',maxCount:window.workflow?2:1},required:false}]} inputAssets={window.inputAssets??{}} mode={workflow?.submissionMode??'i2v'} workflowIntent={workflow?.activeManualMode} locale={window.locale} onClose={()=>window.closed++} onInsert={()=>{window.inserted++;return window.insert();}}/>:null}
    const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
    window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};
  `,{'@/lib/i18n/I18nProvider':'export const useI18n=()=>({locale:"en",t:(_key,fallback)=>fallback});'});
  const dom=createClientFlowDom('/app'),w=dom.window as any;
  Object.assign(w,{owner:'owner-a',visible:true,closed:0,inserted:0,locale:'en',asset:{id:'row',url:'https://private.invalid/original.png',kind:'image',name:'source.png',width:1024,height:1024}});
  if(workflow){w.workflow=true;w.form={engineId:'kling-o3-pro',mode:'t2v',durationSec:5,resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:true,extraInputValues:{}};w.asset={...w.asset,kind:'video',name:'source.mp4',mime:'video/mp4',durationSec:5};}
  w.insert=async()=>undefined;w.eval(bundle);await w.fx.act(async()=>w.fx.render());
  return {w,render:()=>w.fx.act(async()=>w.fx.render()),click:()=>w.fx.act(async()=>w.document.querySelector('.app-recent-insert').click()),close:async()=>{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}};
}
for(const result of ['capacity changed',false,'reject'] as const)test(`recent insertion ${String(result)} remains open, explains failure and allows retry`,async()=>{
  const f=await mount();try{
    f.w.insert=async()=>{if(result==='reject')throw Error('private server details');return result;};await f.click();
    assert.equal(f.w.inserted,1);assert.equal(f.w.closed,0);
    const alert=f.w.document.querySelector('[role=alert]');assert.ok(alert);assert.ok(alert.textContent.trim());
    if(result==='capacity changed')assert.equal(alert.textContent,result);else assert.doesNotMatch(alert.textContent,/private server details/);
    assert.equal(f.w.document.querySelector('.app-recent-insert').disabled,false);
    f.w.insert=async()=>undefined;await f.click();assert.equal(f.w.closed,1);assert.equal(f.w.inserted,2);
  }finally{await f.close();}
});
test('successful insertion is submitted once while pending and closes once',async()=>{
  const f=await mount();try{let resolve!:()=>void;f.w.insert=()=>new Promise<void>(done=>{resolve=done;});await f.click();assert.equal(f.w.document.querySelector('.app-recent-insert').disabled,true);await f.click();assert.equal(f.w.inserted,1);await f.w.fx.act(async()=>resolve());assert.equal(f.w.closed,1);}finally{await f.close();}
});
for(const context of ['owner','source','unmount'] as const)test(`late insertion completion after ${context} change cannot close a newer dialog`,async()=>{
  const f=await mount();try{
    let resolve!:(value?:unknown)=>void;f.w.insert=()=>new Promise(done=>{resolve=done;});await f.click();
    if(context==='owner')f.w.owner='owner-b';
    if(context==='source')f.w.asset={...f.w.asset,url:'https://private.invalid/new.png'};
    if(context==='unmount'){f.w.visible=false;await f.render();f.w.visible=true;}
    await f.render();assert.equal(f.w.document.querySelector('.app-recent-insert').disabled,false,'new context is usable');
    await f.w.fx.act(async()=>resolve());assert.equal(f.w.closed,0);assert.equal(f.w.document.querySelector('[role=alert]'),null);
    f.w.insert=async()=>undefined;await f.click();assert.equal(f.w.closed,1);
  }finally{await f.close();}
});

// Updating the receiving field is the successful insertion's side effect, not a new source context.
test('accepted insertion still closes when its receiving field updates before completion',async()=>{
 const f=await mount();try{let resolve!:()=>void;f.w.insert=()=>new Promise<void>(done=>{resolve=done;});await f.click();
 f.w.inputAssets={image_url:[{id:'attached',url:f.w.asset.url,kind:'image',name:'source.png',status:'ready'}]};await f.render();
 await f.w.fx.act(async()=>resolve());assert.equal(f.w.closed,1);
 }finally{await f.close();}
});

for(const explicitChange of [false,true]) test(`accepted first video ${explicitChange?'retires on explicit Modify intent':'closes after its own inferred mode changes'}`,async()=>{
 const f=await mount(true);try{
  assert.equal(f.w.workflowState.submissionMode,'t2v');assert.equal(f.w.workflowState.activeManualMode,null);
  let resolve!:()=>void;f.w.insert=()=>new Promise<void>(done=>{resolve=done;});await f.click();assert.equal(f.w.inserted,1);
  f.w.inputAssets={video_url:[{...f.w.asset,id:'reservation',fieldId:'video_url',status:'uploading'}]};await f.render();
  assert.equal(f.w.workflowState.submissionMode,'v2v');assert.equal(f.w.workflowState.activeManualMode,null);
  // Mirror the live implicit-mode synchronization, which is not a user workflow change.
  f.w.form={...f.w.form,mode:'v2v',operation:'kling-reference'};await f.render();
  assert.equal(f.w.workflowState.submissionMode,'v2v');assert.equal(f.w.workflowState.activeManualMode,null);
  if(explicitChange){f.w.form={...f.w.form,operation:'kling-edit'};await f.render();assert.equal(f.w.workflowState.submissionMode,'v2v');assert.equal(f.w.workflowState.activeManualMode,'v2v');}
  await f.w.fx.act(async()=>resolve());assert.equal(f.w.closed,explicitChange?0:1);
 }finally{await f.close();}
});
