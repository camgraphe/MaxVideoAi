import assert from 'node:assert/strict';
import test from 'node:test';
import {mountToolFixture} from './helpers/tool-selection-fixture';
const assetId=`ma_${'1'.repeat(32)}`;
const stubs={'@/lib/authFetch':'export const authFetch=(url,init)=>window.fixtureFetch(url,init);','next/link':"import React from 'react';export default p=>React.createElement('a',{href:p.href},p.children);"};
async function mount(){return mountToolFixture(`import {StudioMediaAction} from './components/library/StudioMediaAction.client';function App(){return <StudioMediaAction locale="en" reference={{type:'asset',assetId:'${assetId}',kind:'video'}}/>}`,stubs);}
async function click(f:any,text:string){const button=Array.from(f.w.document.querySelectorAll('button')).find((value:any)=>value.textContent===text) as any;assert.ok(button,text);assert.equal(button.disabled,false);await f.act(async()=>button.click());}
async function select(f:any,index:number,value:string){const input=f.w.document.querySelectorAll('select')[index];await f.act(async()=>{input.value=value;input.dispatchEvent(new f.w.Event('change',{bubbles:true}));});}
async function open(f:any){assert.equal(f.w.requests.length,0);await f.act(async()=>{f.w.document.querySelector('details').open=true;await new Promise(resolve=>setTimeout(resolve,0));});
 await f.respond(f.w.requests[0],{ok:true,projects:[{id:'film',name:'Film'}]});await f.respond(f.w.requests[1],{ok:true,assets:[{mediaFacts:{source:'probe',durationSec:8}}]});
 await select(f,0,'film');await f.respond(f.w.requests[2],{ok:true,result:{data:{sequenceId:'sequence',revision:4},settings:{fps:24},items:[{id:'clip',title:'Original',mediaKind:'video',startSec:0,durationSec:5}]}});
}
test('Studio continuation only reads before explicit apply and retries the identical revisioned edit after a lost response',async()=>{
 const f=await mount();try{await open(f);assert.equal(f.w.requests.length,3);assert.match(f.w.document.body.textContent,/Inserted duration: 8.00 seconds/);
  await click(f,'Apply to film');const request=f.w.requests.at(-1),body=JSON.parse(request.init.body);assert.equal(body.expectedRevision,4);assert.equal(body.edit.kind,'insert');assert.equal(body.edit.startFrame,120);assert.equal(body.edit.durationFrames,192);assert.deepEqual(body.edit.ref,{type:'asset',assetId,kind:'video'});
  await f.act(async()=>request.reject(Error('lost')));assert.equal(f.w.document.querySelector('select').disabled,true);await click(f,'Retry the same edit');assert.equal(f.w.requests.at(-1).init.body,request.init.body);
  await f.respond(f.w.requests.at(-1),{ok:true,result:{revision:5}});assert.match(f.w.document.body.textContent,/Saved in the film/);assert.equal(f.w.document.querySelector('a').getAttribute('href'),'/app/studio/conversation/film');
 }finally{await f.close();}
});
test('Studio replacement requires a chosen compatible clip and revision conflict requires a fresh selection',async()=>{
 const f=await mount();try{await open(f);await click(f,'Replace a clip');const apply=Array.from(f.w.document.querySelectorAll('button')).find((button:any)=>button.textContent==='Apply to film') as any;assert.equal(apply.disabled,true);
  await select(f,1,'clip');await click(f,'Apply to film');const request=f.w.requests.at(-1);assert.deepEqual(JSON.parse(request.init.body).edit,{kind:'replace',clipId:'clip',ref:{type:'asset',assetId,kind:'video'},sourceInFrame:0});
  await f.respond(request,{ok:false,error:'STUDIO_REVISION_CONFLICT'},409);assert.equal(f.w.document.querySelector('select').value,'');assert.match(f.w.document.body.textContent,/film changed/);assert.equal(f.w.requests.length,4);
 }finally{await f.close();}
});
