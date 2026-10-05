import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {STUDIO_ASSISTANCE_CREDIT_TARIFF,type StudioAssistanceStatus} from '../frontend/src/lib/studio/assistance-contract';

test('the product dialog reviews cumulative packs before purchase and preserves server revision and focus',async()=>{
  const require=createRequire(import.meta.url),oldCss=require.extensions['.css'];require.extensions['.css']=module=>{module.exports={};};
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/studio',pretendToBeVisual:true});
  Object.assign(dom.window.HTMLDialogElement.prototype,{showModal(){this.open=true;},close(){this.open=false;}});
  const globals={window:dom.window,self:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,React,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const root=createRoot(dom.window.document.getElementById('root')!),choices:unknown[]=[];let changed=0;
  const status:StudioAssistanceStatus={enabled:true,policyVersion:'test',revision:3,selectedModel:'gpt-6.1-sol',mode:'paid_sol',tariff:STUDIO_ASSISTANCE_CREDIT_TARIFF,includedSol:{remainingPercent:72,renewal:'monthly'},sponsoredLuna:{remainingPercent:100,renewal:'unlimited'},paid:{enabled:true,authorizedCents:200,spentCents:72,reservedCents:0,remainingCents:128,maxAdditionalBudgetCents:1000},unresolvedCalls:0,canContinue:true,blockedReason:null,credits:{creditsPerDollar:1000,included:{total:500,remaining:360,reserved:0,period:'2026-10-01',renewsAt:'2026-11-01T00:00:00Z'},purchased:{total:2000,remaining:1280,reserved:0,packs:[{id:'first',amountCents:200,total:2000,remaining:1280,reserved:0,purchasedAt:'2026-10-05T00:00:00Z'}]}}};
  try{
    const {StudioAssistance}=await import('../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/StudioAssistance.client');
    const render=async(value=status,error:string|null=null,locale:'en'|'fr'='en')=>act(async()=>root.render(React.createElement(StudioAssistance,{status:value,locale,busy:false,error,conversationBusy:false,choose:async choice=>{choices.push(choice);return true;},refresh:async()=>{},onChoice:()=>changed++})));
    const button=(label:string)=>Array.from(dom.window.document.querySelectorAll('button')).find(el=>(el.getAttribute('aria-label')??el.textContent??'').trim()===label)!;
    await render();await act(async()=>button('Studio assistance and budget').click());
    assert.match(dom.window.document.body.textContent??'',/360/);
    assert.match(dom.window.document.body.textContent??'',/500 credits/);
    assert.match(dom.window.document.body.textContent??'',/1,280/);
    await act(async()=>button('$10 10,000 credits').click());
    await act(async()=>button('Buy $10 Sol pack').click());
    assert.deepEqual(choices,[],'Opening review must not charge or change models');
    assert.match(dom.window.document.body.textContent??'',/11,280/);
    assert.match(dom.window.document.body.textContent??'',/MaxVideoAI balance/);
    await act(async()=>button('Confirm purchase · $10').click());
    assert.equal(choices.length,1);
    assert.deepEqual({...choices[0] as object,purchaseKey:undefined},{action:'purchase_pack',amountCents:1000,expectedRevision:3,tariffVersion:status.tariff.version,purchaseKey:undefined});
    assert.match((choices[0] as {purchaseKey:string}).purchaseKey,/^[0-9a-f-]{36}$/);
    assert.equal(changed,1);assert.equal(dom.window.document.activeElement,button('Studio assistance and budget'));
    await act(async()=>button('Studio assistance and budget').click());
    const links=Array.from(dom.window.document.querySelectorAll('a')).filter(link=>link.href.includes('/integrations/'));
    assert.equal(links.length,3);for(const link of links){assert.equal(link.target,'_blank');assert.match(link.href,/#setup$/);}
    await render({...status,unresolvedCalls:1});assert.equal(button('Buy $2 Sol pack').disabled,true);
    await act(async()=>button('Pause purchased Sol usage').click());
    assert.deepEqual(choices[1],{action:'disable_paid',expectedRevision:3},'Customers can revoke paid usage while an old cost is unresolved');
    await act(async()=>button('Studio assistance and budget').click());
    await render(status,'STALE');assert.equal(button('Buy $2 Sol pack').disabled,true);
    await act(async()=>button('Close assistance').click());
    const paused={...status,selectedModel:'gpt-6-luna' as const,mode:'sponsored_luna' as const,paid:{...status.paid,enabled:false}};
    await render(paused);assert.match(button('Studio assistance and budget').textContent??'',/No monthly quota/);await act(async()=>button('Studio assistance and budget').click());
    await act(async()=>(dom.window.document.querySelector('[aria-label="Assistant model"] button') as HTMLButtonElement).click());
    await act(async()=>button('Continue with GPT‑6.1 Sol').click());
    assert.deepEqual(choices[2],{action:'select_sol',expectedRevision:3},'Changing models must preserve a purchased-credit pause');
    await render({...paused,selectedModel:'gpt-6.1-sol',mode:'included_sol'});await act(async()=>button('Studio assistance and budget').click());
    await act(async()=>button('Resume purchased Sol usage').click());
    assert.deepEqual(choices[3],{action:'resume_paid',expectedRevision:3,tariffVersion:status.tariff.version});
    await render({...status,sponsoredAvailable:false,canContinue:false,blockedReason:'campaign_exhausted',credits:{...status.credits!,included:{...status.credits!.included,priorReserved:100}}});
    await act(async()=>button('Studio assistance and budget').click());
    assert.equal(button('Buy $2 Sol pack').disabled,true,'Buying cannot unblock a free-first sponsored outage');
    assert.match(dom.window.document.body.textContent??'',/Buying a pack will not restore free assistance/);
    assert.match(dom.window.document.body.textContent??'',/100 credits from earlier months remain reserved/);
    await render(status,null,'fr');
    for(const link of Array.from(dom.window.document.querySelectorAll('a')).filter(link=>link.href.includes('/integrations/'))){assert.match(new URL(link.href).pathname,/^\/fr\/integrations\//);assert.equal(new URL(link.href).searchParams.get('lang'),'fr');}
  }finally{await act(async()=>root.unmount());dom.window.close();for(const[key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}if(oldCss)require.extensions['.css']=oldCss;else delete require.extensions['.css'];}
});
