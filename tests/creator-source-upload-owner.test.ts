import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow,createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';

// Exercise the real auth lookup and upload transports; only session and HTTP are controlled.
const bundle=bundleClientFlow(`
  import React,{act} from 'react';import {createRoot} from 'react-dom/client';
  import {CreatorSourcePicker} from './src/components/tools/creator/CreatorSourcePicker.client';
  const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
  window.fx={act,render:()=>root.render(<CreatorSourcePicker key={window.owner} userId={window.owner} locale="en" label="Source" kind={window.kind} source={null} onChange={v=>window.selected.push(v)}/>),unmount:()=>root.unmount()};
`,{
  '@/lib/supabaseClient':'export const supabase={auth:{getSession:()=>window.getSession()}};',
  '@/components/library/AssetLibraryBrowser':'export const AssetLibraryBrowser=()=>null;',
  './creator-workspace.module.css':'export default {};',
});
const session=(owner:string)=>({data:{session:{user:{id:owner},access_token:`token-${owner}`}},error:null});
async function choose(w:any,kind:string,size=5){
  const input=w.document.querySelector('input[type=file]');
  Object.defineProperty(input,'files',{value:[new w.File([new Uint8Array(size)],`original.${kind}`,{type:`${kind}/${kind==='image'?'png':kind==='video'?'mp4':'wav'}`})],configurable:true});
  await w.fx.act(async()=>input.dispatchEvent(new w.Event('change',{bubbles:true})));
}
for(const kind of ['image','audio','video'])for(const switchAccount of [true,false])test(`${kind} upload ${switchAccount?'cannot dispatch an A file using a refreshed B session':'keeps its originating account'}`,async()=>{
  const dom=createClientFlowDom('/app/tools/lip-sync'),w=dom.window as any;
  const lookup=deferred<any>(),entered=deferred<void>(),requests:any[]=[];
  w.owner='A';w.kind=kind;w.selected=[];w.sessionStorage.setItem('last-known:user-id','A');
  w.getSession=()=>{entered.resolve();return lookup.promise;};
  w.fetch=async(url:string,init:RequestInit)=>{
    requests.push({url,init});return {ok:true,json:async()=>({ok:true,asset:{id:`ma_${'1'.repeat(32)}`,assetId:`ma_${'1'.repeat(32)}`,kind,url:'https://owned.invalid/file'}})};
  };
  w.eval(await bundle);
  try{
    await w.fx.act(async()=>w.fx.render());await choose(w,kind);await entered.promise;
    if(switchAccount)await w.fx.act(async()=>{w.owner='B';w.sessionStorage.setItem('last-known:user-id','B');w.fx.render();});
    await w.fx.act(async()=>lookup.resolve(session(switchAccount?'B':'A')));
    assert.equal(requests.length,switchAccount?0:1);
    if(!switchAccount){assert.equal(new Headers(requests[0].init.headers).get('Authorization'),'Bearer token-A');assert.equal(requests[0].init.credentials,'omit');assert.equal(w.selected.length,1);}
    else {
      assert.equal(w.selected.length,0);
      w.getSession=async()=>session('B');await choose(w,kind);
      assert.equal(requests.length,1,'The new account picker must remain usable after aborting A');
      assert.equal(new Headers(requests[0].init.headers).get('Authorization'),'Bearer token-B');assert.equal(w.selected.length,1);
    }
  }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
test('a multipart video stops at the account boundary and never sends later parts under the new account',async()=>{
  const dom=createClientFlowDom('/app/tools/subtitles'),w=dom.window as any,part=deferred<any>(),requests:any[]=[];
  w.owner='A';w.kind='video';w.selected=[];w.sessionStorage.setItem('last-known:user-id','A');w.getSession=async()=>session(w.owner);
  w.fetch=async(url:string,init:RequestInit)=>{
    requests.push({url,init});
    if(url.endsWith('/start'))return {ok:true,json:async()=>({ok:true,upload:{uploadId:'upload-A',key:'A/video',chunkSizeBytes:3_670_016}})};
    if(url.endsWith('/part'))return part.promise;
    throw Error(`Unexpected request ${url}`);
  };
  w.eval(await bundle);
  try{
    await w.fx.act(async()=>w.fx.render());await choose(w,'video',5*1024*1024);
    assert.equal(requests.length,2);assert.ok(requests[1].url.endsWith('/part'));
    await w.fx.act(async()=>{w.owner='B';w.sessionStorage.setItem('last-known:user-id','B');w.fx.render();});
    await w.fx.act(async()=>part.resolve({ok:true,json:async()=>({ok:true,part:{partNumber:1,etag:'part-1',key:'A/part-1',size:3_670_016}})}));
    assert.equal(requests.length,2,'No later part, completion, or A cleanup may be sent with B credentials');
    assert.ok(requests.every(r=>new Headers(r.init.headers).get('Authorization')==='Bearer token-A'));
    assert.ok(requests[1].init.signal.aborted);assert.equal(w.selected.length,0);
  }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
