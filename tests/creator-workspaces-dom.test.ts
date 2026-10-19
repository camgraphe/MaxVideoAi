import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';
const opId='12345678-1234-4234-8234-123456789abc';
const price={price:{amountCents:125,currency:'USD'},expiresAt:'2099-01-01T00:00:00Z'};
const source=(kind='video')=>({ref:{type:'asset',assetId:`ma_${'1'.repeat(32)}`,kind},url:`https://private.invalid/original.${kind==='audio'?'mp3':kind==='image'?'png':'mp4'}`,name:'Original',durationSec:8});
const document={version:1,id:'captions-1',revision:1,source:{ref:source().ref,fingerprint:'a'.repeat(64),durationMs:8000},language:'en',words:[{id:'word-1',text:'Hello',startMs:0,endMs:1000}],segments:[{id:'segment-1',text:'Hello',startMs:0,endMs:1000,wordIds:['word-1'],alignment:'aligned'}],style:{preset:'active-word',position:'bottom',fontSizePercent:5,textColor:'#FFFFFF',accentColor:'#FDE047'}};
const stubs={
  './creator-workspace.module.css':'export default {};', './tool-workbench.module.css':'export default {};',
  './ToolboxScene':'export const ToolboxScene=()=>null;',
  '@/lib/authFetch':'export const authFetch=(url,init)=>window.fixtureFetch(url,init);',
  '@/hooks/useRequireAuth':'export const useRequireAuth=()=>window.auth;',
  '@/lib/i18n/I18nProvider':"export const useI18n=()=>({locale:'en'});",
  '@/components/HeaderBar':'export const HeaderBar=()=>null;', '@/components/AppSidebar':'export const AppSidebar=()=>null;',
  'next/link':"import React from 'react';export default p=>React.createElement('a',{href:p.href},p.children);",
  '@/components/library/MediaDestinationActions.client':'export const MediaDestinationActions=()=>null;',
  '@/components/library/ToolMediaHandoff.client':'export const ToolMediaHandoff=p=>{window.handoff=p;return null};',
  './CreatorSourcePicker.client':'export const CreatorSourcePicker=p=>{window.pickers[p.kind]=p;return null};',
};
const buttons=(w:any,text:string)=>Array.from(w.document.querySelectorAll('button')).filter((node:any)=>node.textContent===text) as any[];
async function click(f:any,text:string) {const button=buttons(f.w,text)[0];assert.ok(button,`Missing button ${text}`);assert.equal(button.disabled,false);await f.act(async()=>button.click());}
async function edit(f:any,label:string,value:string,tag='textarea') {const node=f.w.document.querySelector(`${tag}[aria-label="${label}"]`);assert.ok(node);await f.act(async()=>{Object.getOwnPropertyDescriptor(tag==='textarea'?f.w.HTMLTextAreaElement.prototype:f.w.HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new f.w.Event('input',{bubbles:true}));});}
async function mount(toolId='subtitles') {
  return mountToolFixture(toolId==='subtitles'?"import App from './src/components/tools/creator/SubtitleWorkspace.client';":`import Workspace from './src/components/tools/creator/CreatorWorkspace.client';function App(){return <Workspace toolId="${toolId}"/>}`,stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
}
async function openDocument(f:any) {
  await f.act(async()=>f.w.pickers.video.onChange(source()));await click(f,'Get an exact quote');
  await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,state:'prepared',quote:price});await click(f,'Confirm and create');
  await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,state:'queued'});
  await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,state:'completed',result:{documentId:'captions-1',revision:1}});
  assert.match(f.w.requests.at(-1).url,/documents\/captions-1\?revision=1$/);
  await f.respond(f.w.requests.at(-1),{ok:true,document});
}
test('Lip Sync prepares distinct Photo and audio refs; uploads and account changes remove obsolete quotes',async()=>{
  const f=await mount('lip-sync');try {
    await f.act(async()=>{f.w.pickers.image.onChange(source('image'));f.w.pickers.audio.onChange(source('audio'));});
    await click(f,'Get an exact quote');const request=f.w.requests.at(-1),body=JSON.parse(request.init.body);
    assert.equal(body.settings.mode,'photo');assert.deepEqual(body.inputs.map((input:any)=>[input.role,input.source.kind]),[['source','image'],['audio','audio']]);
    await f.respond(request,{ok:true,operationId:opId,quote:price});assert.equal(buttons(f.w,'Confirm and create').length,1);
    await f.act(async()=>f.w.pickers.image.onBusyChange(true));assert.equal(buttons(f.w,'Confirm and create').length,0);assert.equal(buttons(f.w,'Get an exact quote')[0].disabled,true);
    await f.act(async()=>f.w.pickers.image.onBusyChange(false));await click(f,'Get an exact quote');const late=f.w.requests.at(-1);
    f.w.auth={user:{id:'B'},loading:false};await f.render();await f.respond(late,{ok:true,operationId:opId,quote:price});
    assert.equal(buttons(f.w,'Confirm and create').length,0);assert.equal(f.w.pickers.image.source,null);
  } finally {await f.close();}
});
test('Video Lip Sync clearly stays closed and Motion handoff assigns the performance input',async()=>{
  const f=await mount('lip-sync');try {await click(f,'Video');assert.match(f.w.document.body.textContent,/Video Lip Sync is not available at the moment/);assert.equal(buttons(f.w,'Get an exact quote')[0].disabled,true);}finally{await f.close();}
  const m=await mount('motion-transfer');try {await m.act(async()=>m.w.handoff.onSelect({id:`ma_${'2'.repeat(32)}`,kind:'video',url:'https://private.invalid/performance.mp4'}));assert.equal(m.w.pickers.video.source.url,'https://private.invalid/performance.mp4');assert.equal(m.w.pickers.image.source,null);}finally{await m.close();}
});
test('subtitle drafts invalidate export quotes, reject invalid timings and preserve text on revision conflict',async()=>{
  const f=await mount();try {
    await openDocument(f);await click(f,'Export captioned MP4');
    assert.deepEqual(JSON.parse(f.w.requests.at(-1).init.body),{documentId:'captions-1',revision:1});
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:'22345678-1234-4234-8234-123456789abc',quote:price,state:'prepared'});
    await edit(f,'Caption 1','Edited line');assert.equal(buttons(f.w,'Confirm and create').length,0);assert.equal(buttons(f.w,'Download SRT')[0].disabled,true);
    await edit(f,'End (seconds) — 1','9','input');const count=f.w.requests.length;await click(f,'Save changes');assert.equal(f.w.requests.length,count);assert.match(f.w.document.body.textContent,/must not overlap/);
    await edit(f,'End (seconds) — 1','1','input');await click(f,'Save changes');const patch=f.w.requests.at(-1),payload=JSON.parse(patch.init.body);
    assert.equal(payload.expectedRevision,1);assert.match(payload.requestId,/^[0-9a-f-]{36}$/);assert.equal(payload.change.segments[0].alignment,'edited');
    await f.respond(patch,{ok:false,error:{code:'SUBTITLE_REVISION_CONFLICT'}},409);
    assert.equal(f.w.document.querySelector('textarea[aria-label="Caption 1"]').value,'Edited line');assert.match(f.w.document.body.textContent,/Your draft is kept/);
    await click(f,'Open latest saved version');assert.equal(f.w.requests.at(-1).url,'/api/tools/subtitles/documents/captions-1');
    await f.respond(f.w.requests.at(-1),{ok:true,document:{...document,revision:2}});assert.equal(f.w.document.querySelector('textarea[aria-label="Caption 1"]').value,'Hello');
    await click(f,'Download SRT');assert.equal(f.w.requests.at(-1).url,'/api/tools/subtitles/documents/captions-1/download?format=srt&revision=2');
  } finally {await f.close();}
});
test('opening a document link reads its pinned revision and owned playback URL without preparing a paid operation',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/SubtitleWorkspace.client';function App(){return <Workspace initialDocument={{id:'captions-1',revision:3}}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    assert.equal(f.w.requests[0].url,'/api/tools/subtitles/documents/captions-1?revision=3');
    await f.respond(f.w.requests[0],{ok:true,document:{...document,revision:3},sourceMedia:{url:'https://private.invalid/refresh.mp4?signature=owned',thumbnailUrl:null}});
    assert.equal(f.w.document.querySelector('video').src,'https://private.invalid/refresh.mp4?signature=owned');
    assert.equal(f.w.requests.length,1);assert.match(f.w.document.body.textContent,/Saved revision 3/);
  }finally{await f.close();}
});
test('a lost save response retries the same document revision and idempotency key',async()=>{
  const f=await mount();try{
    await openDocument(f);await edit(f,'Caption 1','A corrected caption');await click(f,'Save changes');const first=f.w.requests.at(-1);
    await f.act(async()=>first.reject(Error('Lost response')));await click(f,'Save changes');const retry=f.w.requests.at(-1);
    assert.equal(retry.init.body,first.init.body);
    await f.respond(retry,{ok:true,document:{...document,revision:2,segments:[{...document.segments[0],text:'A corrected caption',alignment:'edited'}]}});
    assert.equal(buttons(f.w,'Download SRT')[0].disabled,false);assert.match(f.w.document.body.textContent,/Saved revision 2/);
  }finally{await f.close();}
});
test('an unavailable signed read URL never falls back to a private canonical result URL',async()=>{
  const f=await mount('lip-sync');try{
    await f.act(async()=>{f.w.pickers.image.onChange(source('image'));f.w.pickers.audio.onChange(source('audio'));});
    await click(f,'Get an exact quote');await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,quote:price});await click(f,'Confirm and create');
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'running'});
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'completed',result:{toolId:'lip-sync',jobId:'job-1',version:1,sourceAssets:[],outputs:[{asset:{type:'asset',assetId:`ma_${'2'.repeat(32)}`,kind:'video'},originalUrl:'https://private.invalid/canonical.mp4',kind:'video',readUrl:null,thumbnailReadUrl:null}]}});
    assert.equal(f.w.document.querySelector('video'),null);assert.equal(buttons(f.w,'Download')[0].disabled,true);
  }finally{await f.close();}
});
test('a disabled execution gate keeps document edits available and export preparation disabled',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/SubtitleWorkspace.client';function App(){return <Workspace executionEnabled={false} initialDocument={{id:'captions-1',revision:1}}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    await f.respond(f.w.requests[0],{ok:true,document});assert.equal(buttons(f.w,'Export captioned MP4')[0].disabled,true);
    await edit(f,'Caption 1','Read and edit remains available');assert.equal(buttons(f.w,'Save changes')[0].disabled,false);
    assert.equal(f.w.requests.length,1);
  }finally{await f.close();}
});
test('a captioned MP4 recovery link restores the paid output while new execution is disabled',async()=>{
  const f=await mountToolFixture(`import Workspace from './src/components/tools/creator/SubtitleWorkspace.client';function App(){return <Workspace executionEnabled={false} initialOperationId="${opId}"/>}`,stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    await f.respond(f.w.requests[0],{ok:true,operationId:opId,state:'completed',result:{documentId:'captions-1',revision:1,assetId:`ma_${'3'.repeat(32)}`,originalUrl:'https://private.invalid/canonical.mp4',readUrl:'https://private.invalid/signed.mp4?signature=exact',thumbnailReadUrl:null}});
    await f.respond(f.w.requests.at(-1),{ok:true,document});
    assert.equal(f.w.document.querySelector('video').src,'https://private.invalid/signed.mp4?signature=exact');assert.equal(buttons(f.w,'Download')[0].disabled,false);
    assert.ok(f.w.requests.every((request:any)=>!request.init?.method || request.init.method==='GET'));
  }finally{await f.close();}
});
