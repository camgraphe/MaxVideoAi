import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { deferred } from './helpers/auth-legal-client-fixture';
const original='https://storage.test/user-assets/A/original.png';
const bundle=bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';
import {LibraryImageThumbnail} from './components/library/LibraryImageThumbnail.client';
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<><LibraryImageThumbnail asset={window.asset}/><LibraryImageThumbnail asset={window.asset}/></>),unmount:()=>root.unmount()};
`,{'@/lib/supabaseClientLoader':'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession(),onAuthStateChange:callback=>{window.authListeners??=new Set();window.authListeners.add(callback);return {data:{subscription:{unsubscribe:()=>window.authListeners.delete(callback)}}}}}});'});
test('two actual thumbnails share one failed-attempt renewal, preserve originals and stop after renewal failure',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;let requests=0;
 w.asset={url:original,kind:'image',accessUrl:original+'?old',thumbnailAccessUrl:original+'?old-thumb',readAccessOwnerId:'A',readAccessRef:{type:'asset',assetId:'ma_a',kind:'image'},readAccessRevision:'ra_'+'a'.repeat(64),readAccessExpiresAt:new Date(Date.now()+300000).toISOString()};
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}},error:null});
 const pending=deferred<any>();w.fetch=()=>{requests++;return pending.promise;};w.eval(await bundle);
 const settle=async(p:()=>boolean)=>{for(let n=0;n<100;n++){if(p())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}assert.fail('renewal settles');};
 try{
 await w.fx.act(async()=>w.fx.render());assert.equal(requests,0);
 await w.fx.act(async()=>{for(const img of w.document.querySelectorAll('img'))img.dispatchEvent(new w.Event('error'));});
 await settle(()=>requests===1);
 await w.fx.act(async()=>pending.resolve({ok:true,json:async()=>({ok:true,access:{...w.asset,accessUrl:original+'?new',thumbnailAccessUrl:original+'?new-thumb'}})}));
 await settle(()=>[...w.document.querySelectorAll('img')].every((i:any)=>i.src.endsWith('?new-thumb')));
 assert.equal(w.asset.url,original);assert.equal(w.asset.accessUrl,original+'?old');
 await w.fx.act(async()=>{for(let n=0;n<5;n++)for(const img of w.document.querySelectorAll('img'))img.dispatchEvent(new w.Event('error'));});
 assert.equal(requests,1,'replacement failure cannot create a retry storm');
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

const hookBundle=bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {useLibraryMediaAccess} from './hooks/useLibraryMediaAccess';
function Reader({index}){const state=useLibraryMediaAccess({userId:window.owner,asset:window.assets[index]});window.probes[index]=state;return <video data-reader={index} src={state.access.accessUrl} onError={()=>void state.refresh()}/>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<React.StrictMode>{window.assets.map((a,index)=><Reader key={index} index={index}/>)}</React.StrictMode>),unmount:()=>root.unmount()};
`,{'@/lib/supabaseClientLoader':'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession(),onAuthStateChange:callback=>{window.authListeners??=new Set();window.authListeners.add(callback);return {data:{subscription:{unsubscribe:()=>window.authListeners.delete(callback)}}}}}});'});
function lease(id:string,owner='A',expires=Date.now()+300000){return {url:original,accessUrl:original+'?'+id,thumbnailAccessUrl:original+'?thumb-'+id,previewAccessUrl:original+'?preview-'+id,playbackAccessUrl:original+'?play-'+id,readAccessOwnerId:owner,readAccessRef:{type:'asset',assetId:'ma_'+id,kind:'video'},readAccessRevision:'ra_'+id.padEnd(64,'a').slice(0,64),readAccessExpiresAt:new Date(expires).toISOString()};}
async function settle(w:any,p:()=>boolean,label:string){for(let i=0;i<100;i++){if(p())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}assert.fail(label);}
test('controlled expiry renews once without resetting valid playback; failed attempts, changed source and account retire work',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;let now=Date.now();w.Date.now=()=>now;Object.assign(w,{owner:'A',assets:[lease('a')],probes:[]});const calls:any[]=[];
 w.getSession=async()=>({data:{session:{user:{id:w.owner},access_token:'token-'+w.owner}},error:null});
 w.fetch=(url:string,init:RequestInit)=>{const d=deferred<any>();calls.push({d,init,input:JSON.parse(init.body as string)});return d.promise};w.eval(await hookBundle);
 try{
 await w.fx.act(async()=>w.fx.render());const decoder=w.document.querySelector('video');assert.equal(calls.length,0);
 await w.fx.act(async()=>{w.assets=[{...w.assets[0],accessUrl:original+'?new-list-grant'}];w.fx.render()});assert.equal(w.document.querySelector('video'),decoder);assert.ok(decoder.src.endsWith('?a'));
 now+=300001;await w.fx.act(async()=>{void w.probes[0].ensureFresh()});await settle(w,()=>calls.length===1,'expired lease refresh');
 await w.fx.act(async()=>calls[0].d.resolve({ok:false,json:async()=>({ok:false,error:'SOURCE_UNAVAILABLE'})}));assert.equal(w.probes[0].error,'READ_ACCESS_FAILED');
 await w.fx.act(async()=>{for(let i=0;i<5;i++)void w.probes[0].refresh()});assert.equal(calls.length,1);
 await w.fx.act(async()=>{w.probes[0].beginAttempt();void w.probes[0].refresh()});await settle(w,()=>calls.length===2,'explicit new attempt');
 await w.fx.act(async()=>{w.assets=[lease('b','A',now+300000)];w.fx.render()});assert.equal(calls[1].init.signal.aborted,true);
 await w.fx.act(async()=>calls[1].d.resolve({ok:true,json:async()=>({ok:true,access:{...lease('a'),accessUrl:original+'?late-A'}})}));assert.ok(w.document.querySelector('video').src.endsWith('?b'));
 await w.fx.act(async()=>{void w.probes[0].refresh()});await settle(w,()=>calls.length===3,'second source attempt');
 await w.fx.act(async()=>{w.owner='B';w.fx.render()});assert.equal(w.probes[0].access.accessUrl,undefined,'retired account grant is not exposed');
 await w.fx.act(async()=>{w.assets=[lease('c','B',now+300000)];w.fx.render()});assert.equal(calls[2].init.signal.aborted,true);
 await w.fx.act(async()=>calls[2].d.resolve({ok:true,json:async()=>({ok:true,access:lease('b')})}));assert.ok(w.document.querySelector('video').src.endsWith('?c'));
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
test('simultaneous expired visible readers bound signing requests and cancel queued source work',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;Object.assign(w,{owner:'A',assets:Array.from({length:12},(_,i)=>lease(i.toString(16),'A',Date.now()-1)),probes:[]});const calls:any[]=[];
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}},error:null});w.fetch=(_url:string,init:RequestInit)=>{const d=deferred<any>();calls.push({d,init});return d.promise};w.eval(await hookBundle);
 try{await w.fx.act(async()=>w.fx.render());await settle(w,()=>calls.length===4,'four concurrent renewals');assert.equal(calls.length,4);
 await w.fx.act(async()=>{w.assets=[];w.fx.render()});assert.ok(calls.every(c=>c.init.signal.aborted));
 await w.fx.act(async()=>{for(const call of calls)call.d.resolve({ok:false,json:async()=>({ok:false})})});await new Promise(r=>setTimeout(r,20));assert.equal(calls.length,4,'retired queued sources never request');
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
const panelBundle=bundleClientFlow(`
import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {MediaActionPanel} from './components/library/MediaActionPanel.client';
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<MediaActionPanel asset={window.asset} locale="en" onClose={()=>{}}/>),unmount:()=>root.unmount()};
`,{'@/lib/supabaseClientLoader':'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession(),onAuthStateChange:callback=>{window.authListeners??=new Set();window.authListeners.add(callback);return {data:{subscription:{unsubscribe:()=>window.authListeners.delete(callback)}}}}}});'});
for(const kind of ['video','audio'])test(`${kind} original reader renews errors and uses authenticated original/download links without async popup`,async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;w.asset={...lease('d'),id:'d',kind,thumbUrl:original+'?thumb',url:original};let count=0;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}},error:null});w.fetch=async()=>{count++;return {ok:true,json:async()=>({ok:true,access:{...w.asset,accessUrl:original+'?renewed',playbackAccessUrl:original+'?renewed-play'}})}};w.eval(await panelBundle);
 try{await w.fx.act(async()=>w.fx.render());
 for(const action of ['original','download']){const link=w.document.querySelector(action==='original'?'a[aria-label="Open original"]':'.app-media-panel-transport a');const url=new URL(link.href);assert.equal(url.pathname,'/api/media-library/read-access');assert.equal(url.searchParams.get('action'),action);assert.equal(url.searchParams.get('revision'),w.asset.readAccessRevision);assert.equal(url.searchParams.has('url'),false);}
 await settle(w,()=>!!w.document.querySelector(kind),'native reader mounted');
 await w.fx.act(async()=>w.document.querySelector(kind).dispatchEvent(new w.Event('error')));await settle(w,()=>count===1,'AV refresh');await settle(w,()=>(w.document.querySelector(kind).src || w.document.querySelector(kind+' source')?.src || '').includes('?renewed'),'renewed AV');assert.equal(w.asset.url,original);
 await w.fx.act(async()=>w.document.querySelector(kind).dispatchEvent(new w.Event('error')));
 assert.equal(count,1,'replacement error must not renew automatically');assert.ok(w.document.querySelector('[role=alert]'),'replacement error surfaces terminal recovery UI');
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('real audio Retry renews and restarts the failed reader',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;w.asset={...lease('e'),id:'e',kind:'audio'};let count=0;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}},error:null});
 w.fetch=async()=>{count++;return count===1?{ok:false,json:async()=>({ok:false})}:{ok:true,json:async()=>({ok:true,access:{...w.asset,accessUrl:original+'?retry'}})}};w.eval(await panelBundle);
 try{await w.fx.act(async()=>w.fx.render());const failed=w.document.querySelector('audio');await w.fx.act(async()=>failed.dispatchEvent(new w.Event('error')));
 await settle(w,()=>!!w.document.querySelector('[role=alert]'),'failed audio alert');
 await w.fx.act(async()=>w.document.querySelector('[role=alert] button').click());await settle(w,()=>count===2,'Retry actually requests access');
 await settle(w,()=>w.document.querySelector('audio').src.endsWith('?retry'),'Retry installs replacement');assert.notEqual(w.document.querySelector('audio'),failed);assert.equal(w.document.querySelector('[role=alert]'),null);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
for(const nextOwner of ['B',null])test(`retained actual panel retires grants, native links and pending renewal on session ${nextOwner}`,async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;w.asset={...lease('f'),id:'f',kind:'video',thumbUrl:original+'?poster'};let owner:string|null='A';const pending=deferred<any>();const calls:any[]=[];
 w.getSession=async()=>({data:{session:owner?{user:{id:owner},access_token:'token-'+owner}:null},error:null});w.fetch=(_url:string,init:RequestInit)=>{calls.push(init);return pending.promise};w.eval(await panelBundle);
 try{await w.fx.act(async()=>w.fx.render());await settle(w,()=>!!w.document.querySelector('video'),'native video mounted');await w.fx.act(async()=>w.document.querySelector('video').dispatchEvent(new w.Event('error')));await settle(w,()=>calls.length===1,'renewal started');
 await w.fx.act(async()=>{owner=nextOwner;for(const callback of w.authListeners??[])callback('SIGNED_OUT',owner?{user:{id:owner}}:null)});
 assert.ok(!w.document.querySelector('video'),'retained source must unmount old decoder');assert.ok(!w.document.querySelector('img'));assert.ok(!w.document.querySelector('.app-media-panel-transport a'),'old native links retire');assert.equal(calls[0].signal.aborted,true);
 await w.fx.act(async()=>pending.resolve({ok:true,json:async()=>({ok:true,access:{...w.asset,accessUrl:original+'?late'}})}));assert.ok(!w.document.querySelector('video'));assert.equal(calls.length,1);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('private thumbnails share one session subscription and retire while a stale initial session is pending; public thumbnails never subscribe',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;const initial=deferred<any>();let sessionReads=0;
 w.asset={url:original,kind:'image'};w.getSession=()=>{sessionReads++;return initial.promise};w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());assert.equal(sessionReads,0);assert.equal(w.authListeners,undefined);
 await w.fx.act(async()=>{w.asset={...lease('a'),kind:'image'};w.fx.render()});assert.equal(sessionReads,1);assert.equal(w.authListeners.size,1);assert.equal(w.document.querySelectorAll('img').length,0,'unconfirmed private owner is hidden');
 await w.fx.act(async()=>{for(const callback of w.authListeners)callback('SIGNED_IN',{user:{id:'B'}});initial.resolve({data:{session:{user:{id:'A'},access_token:'token-A'}}})});assert.equal(w.document.querySelectorAll('img').length,0,'late getSession cannot restore A');
 await w.fx.act(async()=>{for(const callback of w.authListeners)callback('SIGNED_IN',{user:{id:'A'}})});assert.equal(w.document.querySelectorAll('img').length,2);
 await w.fx.act(async()=>{for(const callback of w.authListeners)callback('SIGNED_OUT',null)});assert.equal(w.document.querySelectorAll('img').length,0);
 }finally{await w.fx.act(async()=>w.fx.unmount());assert.equal(w.authListeners.size,0);dom.window.close();}
});
test('a retired subscription cannot restore its pending initial account into a later private mount',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;const old=deferred<any>();let lookups=0;
 w.asset={...lease('a'),kind:'image'};w.getSession=()=>++lookups===1?old.promise:Promise.resolve({data:{session:{user:{id:'B'},access_token:'token-B'}}});w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());assert.equal(lookups,1);
 await w.fx.act(async()=>{w.asset={url:original,kind:'image'};w.fx.render()});assert.equal(w.authListeners.size,0);
 await w.fx.act(async()=>{w.asset={...lease('b','B'),kind:'image'};w.fx.render()});assert.equal(lookups,2);assert.equal(w.authListeners.size,1);assert.equal(w.document.querySelectorAll('img').length,2);
 await w.fx.act(async()=>old.resolve({data:{session:{user:{id:'A'},access_token:'token-A'}}}));assert.equal(w.document.querySelectorAll('img').length,2);assert.ok(w.document.querySelector('img').src.endsWith('?thumb-b'));
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
test('a rejected initial lookup cannot clear a later confirmed auth event',async()=>{
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;const initial=deferred<any>();w.asset={...lease('a'),kind:'image'};w.getSession=()=>initial.promise;w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());await w.fx.act(async()=>{for(const callback of w.authListeners)callback('SIGNED_IN',{user:{id:'A'}})});assert.equal(w.document.querySelectorAll('img').length,2);
 await w.fx.act(async()=>initial.reject(new Error('late lookup failure')));assert.equal(w.document.querySelectorAll('img').length,2,'initial failure must not supersede newer session');
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('qualified private display renews its own grant, falls back to authorized original and retires without canonical fallback', async () => {
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;
 const display='https://storage.test/user-asset-thumbs/A/display.webp';
 const thumb='https://storage.test/user-asset-thumbs/A/thumb.webp';
 w.asset={...lease('9'),id:'private-image',kind:'image',thumbUrl:thumb,thumbnailAccessUrl:thumb+'?signed',previewUrl:display,previewAccessUrl:display+'?old',imageDisplay:{version:1,profile:'image-display-v1',sourceUrl:original,sourceSha256:'a'.repeat(64),url:display,mimeType:'image/webp',width:1920,height:960,sizeBytes:2000}};
 let count=0;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}},error:null});
 w.fetch=async()=>{count++;return {ok:true,json:async()=>({ok:true,access:{...w.asset,previewAccessUrl:display+'?renewed'}})}};
 w.eval(await panelBundle);
 const shown=(url:string)=>[...w.document.querySelectorAll('img')].some((image:any)=>image.src===url);
 try {
  await w.fx.act(async()=>w.fx.render());await settle(w,()=>shown(display+'?old'),'signed display loaded');
  assert.ok(shown(thumb+'?signed'));assert.equal(shown(display),false);assert.equal(shown(original),false);
  await w.fx.act(async()=>w.document.querySelector('.yarl__slide img').dispatchEvent(new w.Event('error')));
  await settle(w,()=>shown(display+'?renewed'),'display grant renewed');assert.equal(count,1);
  await w.fx.act(async()=>w.document.querySelector('.yarl__slide img').dispatchEvent(new w.Event('error')));
  await settle(w,()=>shown(original+'?9'),'exact authorized original fallback');assert.equal(count,1);
  assert.equal(shown(original),false);assert.equal(shown(display),false);
  await w.fx.act(async()=>{for(const callback of w.authListeners)callback('SIGNED_IN',{user:{id:'B'}})});
  assert.equal(w.document.querySelectorAll('img').length,0);assert.equal(w.document.querySelector('.app-media-panel-transport a'),null);
 } finally {await w.fx.act(async()=>w.fx.unmount());w.close();}
});

test('shared mounted readers can renew successive genuinely expired leases without grant/media retry loops', async () => {
 const dom=createClientFlowDom('/app/library'),w=dom.window as any;
 let now=Date.now(),generation=0;
 w.Date.now=()=>now;
 const initial=lease('successive','A',now+300000);
 Object.assign(w,{owner:'A',assets:[initial,initial],probes:[]});
 const calls:any[]=[];
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}},error:null});
 w.fetch=(_url:string,init:RequestInit)=>{const d=deferred<any>();calls.push({d,init});return d.promise;};
 w.eval(await hookBundle);
 const expireAndRequest=async()=>{
  now+=300001;
  await w.fx.act(async()=>{void w.probes[0].ensureFresh();void w.probes[1].ensureFresh();});
 };
 const resolveFresh=async(index:number)=>{
  generation++;
  await w.fx.act(async()=>calls[index].d.resolve({ok:true,json:async()=>({ok:true,access:{...initial,accessUrl:original+'?lease-'+generation,readAccessExpiresAt:new Date(now+300000).toISOString()}})}));
  await settle(w,()=>[...w.document.querySelectorAll('video')].every((v:any)=>v.src.endsWith('?lease-'+generation)),'both readers share replacement');
 };
 try {
  await w.fx.act(async()=>w.fx.render());assert.equal(calls.length,0);
  const decoder=w.document.querySelector('video');
  await expireAndRequest();await settle(w,()=>calls.length===1,'first expired lease renews');
  await resolveFresh(0);
  now+=275000;
  await w.fx.act(async()=>{void w.probes[0].ensureFresh();void w.probes[1].ensureFresh();});
  assert.equal(calls.length,1,'proactive near-expiry check keeps the still-valid replacement');
  assert.equal(w.probes[0].error,null,'near-expiry mount is not a failed read');
  await w.fx.act(async()=>{for(let i=0;i<4;i++)void w.probes[i%2].refresh();});
  assert.equal(calls.length,1,'a replacement-media failure before its expiry cannot automatically retry');
  await expireAndRequest();
  await settle(w,()=>calls.length===2,'second genuinely expired lease renews while readers remain mounted');
  await resolveFresh(1);
  assert.equal(w.document.querySelector('video'),decoder,'lease renewal does not remount the reader');
  await w.fx.act(async()=>{for(let i=0;i<4;i++)void w.probes[i%2].refresh();});
  assert.equal(calls.length,2,'successive renewal still cannot create grant200/media403 loops');
  await expireAndRequest();await settle(w,()=>calls.length===3,'third expired lease gets one attempt');
  await w.fx.act(async()=>calls[2].d.resolve({ok:false,json:async()=>({ok:false,error:'SOURCE_UNAVAILABLE'})}));
  now+=600000;
  await w.fx.act(async()=>{void w.probes[0].ensureFresh();void w.probes[1].refresh();});
  assert.equal(calls.length,3,'a failed renewal cannot rearm from the old expired lease');
  assert.equal(w.probes[0].error,'READ_ACCESS_FAILED');
 } finally {await w.fx.act(async()=>w.fx.unmount());w.close();}
});
