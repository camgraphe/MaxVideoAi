import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {STUDIO_ASSISTANCE_TARIFF,type StudioAssistanceStatus} from '../frontend/src/lib/studio/assistance-contract';
const status:StudioAssistanceStatus={enabled:true,policyVersion:'test',revision:3,selectedModel:'gpt-6.1-sol',mode:'included_sol',tariff:STUDIO_ASSISTANCE_TARIFF,includedSol:{remainingPercent:0,renewal:'one_time'},sponsoredLuna:{remainingPercent:100,renewal:'one_time'},paid:{enabled:true,authorizedCents:300,spentCents:100,reservedCents:50,remainingCents:150,maxAdditionalBudgetCents:1800},unresolvedCalls:0,canContinue:false,blockedReason:'included_exhausted'};
test('assistance choice requires a click, preserves tariff revision, and restores focus without sending a message',async()=>{
 const require=createRequire(import.meta.url),oldCss=require.extensions['.css'];require.extensions['.css']=module=>{module.exports={};};
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/studio',pretendToBeVisual:true});
 Object.assign(dom.window.HTMLDialogElement.prototype,{showModal(){this.open=true;},close(){this.open=false;}});
 const globals={window:dom.window,self:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,React,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const root=createRoot(dom.window.document.getElementById('root')!),choices:unknown[]=[];let changed=0;
 try{
   const {StudioAssistance}=await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/StudioAssistance.client');
   const render=async(value=status)=>act(async()=>root.render(React.createElement(StudioAssistance,{status:value,locale:'en',busy:false,error:null,conversationBusy:false,choose:async choice=>{choices.push(choice);return true;},refresh:async()=>{},onChoice:()=>changed++})));
   const button=(name:string)=>Array.from(dom.window.document.querySelectorAll('button')).find(el=>(el.getAttribute('aria-label')??el.textContent??'').trim()===name)!;
   await render();assert.deepEqual(choices,[]);
   await act(async()=>button('Studio assistance and budget').click());assert.deepEqual(choices,[]);
   assert.equal(button('$20.00'),undefined);
   await act(async()=>button('Authorize $5.00 more').click());
   assert.deepEqual(choices,[{action:'authorize_paid',budgetCents:800,tariffVersion:status.tariff.version,expectedRevision:3}]);
   assert.equal(changed,1);assert.equal(dom.window.document.activeElement,button('Studio assistance and budget'));
   await act(async()=>button('Studio assistance and budget').click());
   const luna=Array.from(dom.window.document.querySelectorAll('button')).find(el=>el.textContent?.startsWith('Continue with Luna'))!;
   await act(async()=>luna.click());assert.deepEqual(choices[1],{action:'select_luna',expectedRevision:3});
   await render({...status,unresolvedCalls:1});await act(async()=>button('Studio assistance and budget').click());assert.equal(button('Authorize $5.00 more').disabled,true);
   await render({...status,enabled:false});assert.equal(dom.window.document.querySelector('button'),null);
 }finally{await act(async()=>root.unmount());dom.window.close();for(const[key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}if(oldCss)require.extensions['.css']=oldCss;else delete require.extensions['.css'];}
});
