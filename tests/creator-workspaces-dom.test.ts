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
  await f.act(async()=>f.w.pickers.video.onChange(source()));await click(f,'See price');
  await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,state:'prepared',quote:price});await click(f,'Confirm price and create');
  await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,state:'queued'});
  await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,state:'completed',result:{documentId:'captions-1',revision:1}});
  assert.match(f.w.requests.at(-1).url,/documents\/captions-1\?revision=1$/);
  await f.respond(f.w.requests.at(-1),{ok:true,document});
}
test('Lip Sync prepares distinct Photo and audio refs; uploads and account changes remove obsolete quotes',async()=>{
  const f=await mount('lip-sync');try {
    await f.act(async()=>{f.w.pickers.image.onChange(source('image'));f.w.pickers.audio.onChange(source('audio'));});
    await click(f,'See price');const request=f.w.requests.at(-1),body=JSON.parse(request.init.body);
    assert.equal(body.settings.mode,'photo');assert.deepEqual(body.inputs.map((input:any)=>[input.role,input.source.kind]),[['source','image'],['audio','audio']]);
    await f.respond(request,{ok:true,operationId:opId,quote:price});assert.equal(buttons(f.w,'Confirm price and create').length,1);
    await f.act(async()=>f.w.pickers.image.onBusyChange(true));assert.equal(buttons(f.w,'Confirm price and create').length,0);assert.equal(buttons(f.w,'See price')[0].disabled,true);
    await f.act(async()=>f.w.pickers.image.onBusyChange(false));await click(f,'See price');const late=f.w.requests.at(-1);
    f.w.auth={user:{id:'B'},loading:false};await f.render();await f.respond(late,{ok:true,operationId:opId,quote:price});
    assert.equal(buttons(f.w,'Confirm price and create').length,0);assert.equal(f.w.pickers.image.source,null);
  } finally {await f.close();}
});
test('Video Lip Sync clearly stays closed and Motion handoff assigns the performance input',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/CreatorWorkspace.client';function App(){return <Workspace toolId=\"lip-sync\" lipVideoEnabled={false}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});try {await click(f,'Video');assert.match(f.w.document.body.textContent,/Video Lip Sync is not available at the moment/);assert.equal(buttons(f.w,'See price')[0].disabled,true);}finally{await f.close();}
  const m=await mount('motion-transfer');try {await m.act(async()=>m.w.handoff.onSelect({id:`ma_${'2'.repeat(32)}`,kind:'video',url:'https://private.invalid/performance.mp4'}));assert.equal(m.w.pickers.video.source.url,'https://private.invalid/performance.mp4');assert.equal(m.w.pickers.image.source,null);}finally{await m.close();}
});
test('subtitle drafts invalidate export quotes, reject invalid timings and preserve text on revision conflict',async()=>{
  const f=await mount();try {
    await openDocument(f);await click(f,'Prepare MP4 export');
    assert.deepEqual(JSON.parse(f.w.requests.at(-1).init.body),{documentId:'captions-1',revision:1});
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:'22345678-1234-4234-8234-123456789abc',quote:price,state:'prepared'});
    await edit(f,'Caption 1','Edited line');assert.equal(buttons(f.w,'Confirm price and create').length,0);assert.equal(buttons(f.w,'Download SRT')[0].disabled,true);
    await edit(f,'End (seconds) — 1','9','input');const count=f.w.requests.length;await click(f,'Save changes');assert.equal(f.w.requests.length,count);assert.match(f.w.document.body.textContent,/do not overlap/);
    await edit(f,'End (seconds) — 1','1','input');await click(f,'Save changes');const patch=f.w.requests.at(-1),payload=JSON.parse(patch.init.body);
    assert.equal(payload.expectedRevision,1);assert.match(payload.requestId,/^[0-9a-f-]{36}$/);assert.equal(payload.change.segments[0].alignment,'edited');
    await f.respond(patch,{ok:false,error:{code:'SUBTITLE_REVISION_CONFLICT'}},409);
    assert.equal(f.w.document.querySelector('textarea[aria-label="Caption 1"]').value,'Edited line');assert.match(f.w.document.body.textContent,/Your draft is safe/);
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
    assert.equal(f.w.requests.length,1);assert.match(f.w.document.body.textContent,/Saved version 3/);
  }finally{await f.close();}
});
test('a lost save response retries the same document revision and idempotency key',async()=>{
  const f=await mount();try{
    await openDocument(f);await edit(f,'Caption 1','A corrected caption');await click(f,'Save changes');const first=f.w.requests.at(-1);
    await f.act(async()=>first.reject(Error('Lost response')));await click(f,'Save changes');const retry=f.w.requests.at(-1);
    assert.equal(retry.init.body,first.init.body);
    await f.respond(retry,{ok:true,document:{...document,revision:2,segments:[{...document.segments[0],text:'A corrected caption',alignment:'edited'}]}});
    assert.equal(buttons(f.w,'Download SRT')[0].disabled,false);assert.match(f.w.document.body.textContent,/Saved version 2/);
  }finally{await f.close();}
});
test('an unavailable signed read URL never falls back to a private canonical result URL',async()=>{
  const f=await mount('lip-sync');try{
    await f.act(async()=>{f.w.pickers.image.onChange(source('image'));f.w.pickers.audio.onChange(source('audio'));});
    await click(f,'See price');await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,quote:price});await click(f,'Confirm price and create');
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'running'});
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'completed',result:{toolId:'lip-sync',jobId:'job-1',version:1,sourceAssets:[],outputs:[{asset:{type:'asset',assetId:`ma_${'2'.repeat(32)}`,kind:'video'},originalUrl:'https://private.invalid/canonical.mp4',kind:'video',readUrl:null,thumbnailReadUrl:null}]}});
    assert.equal(f.w.document.querySelector('video'),null);assert.equal(buttons(f.w,'Download')[0].disabled,true);
  }finally{await f.close();}
});
test('a disabled execution gate keeps document edits available and export preparation disabled',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/SubtitleWorkspace.client';function App(){return <Workspace executionEnabled={false} initialDocument={{id:'captions-1',revision:1}}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    await f.respond(f.w.requests[0],{ok:true,document});assert.equal(buttons(f.w,'Prepare MP4 export')[0].disabled,true);
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
    assert.ok(f.w.document.querySelector('a[href="/app/library?view=saved&kind=video"]'));
    assert.ok(f.w.requests.every((request:any)=>!request.init?.method || request.init.method==='GET'));
  }finally{await f.close();}
});
test('Studio subtitles prepare the pinned sequence mix with an itemized quote and no misleading upload picker',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/SubtitleWorkspace.client';function App(){return <Workspace studioSource={{projectId:'project-1',sequenceId:'sequence-2',expectedRevision:7}}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    assert.deepEqual(Object.keys(f.w.pickers),[]);assert.match(f.w.document.body.textContent,/Sequence version 7/);assert.match(f.w.document.body.textContent,/audio will appear here after preparation/);assert.equal(f.w.requests.length,0);
    await click(f,'See price');const request=f.w.requests.at(-1);assert.equal(request.url,'/api/tools/subtitles/prepare-studio');assert.deepEqual(JSON.parse(request.init.body),{projectId:'project-1',sequenceId:'sequence-2',expectedRevision:7,keyterms:[]});
    await f.respond(request,{ok:true,operationId:opId,kind:'mix-transcribe',state:'prepared',sourceSummary:{kind:'sequence',name:'Opening sequence',revision:7},quote:{...price,breakdown:{transcription:{amountCents:100,currency:'USD'},mixPreparation:{amountCents:25,currency:'USD'}}}});
    assert.match(f.w.document.body.textContent,/Opening sequence/);assert.match(f.w.document.body.textContent,/Prepare sequence audio\$0.25/);assert.match(f.w.document.body.textContent,/Transcription\$1.00/);
    await click(f,'Confirm price and create');assert.deepEqual(JSON.parse(f.w.requests.at(-1).init.body),{operationId:opId,confirmed:true});
  }finally{await f.close();}
});
test('Motion Control and reference guidance send distinct explicit profiles and invalidate quotes when switching',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/CreatorWorkspace.client';function App(){return <Workspace toolId=\"motion-transfer\" motionControlEnabled={true}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    await f.act(async()=>{f.w.pickers.image.onChange(source('image'));f.w.pickers.video.onChange(source('video'));});await click(f,'See price');
    assert.equal(JSON.parse(f.w.requests.at(-1).init.body).profileId,'motion-kling-v3-v1');assert.match(f.w.document.body.textContent,/2–30 seconds/);
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,quote:price});
    const method=Array.from(f.w.document.querySelectorAll('select')).find((node:any)=>node.value==='motion-kling-v3-v1') as any;
    await f.act(async()=>{method.value='motion-wan-reference-v1';method.dispatchEvent(new f.w.Event('change',{bubbles:true}));});
    assert.equal(buttons(f.w,'Confirm price and create').length,0);assert.match(f.w.document.body.textContent,/2–15 seconds, with whole-second/);
    await click(f,'See price');assert.equal(JSON.parse(f.w.requests.at(-1).init.body).profileId,'motion-wan-reference-v1');
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,quote:price});
    const resolution=Array.from(f.w.document.querySelectorAll('select')).find((node:any)=>node.value==='720p') as any;
    await f.act(async()=>{resolution.value='1080p';resolution.dispatchEvent(new f.w.Event('change',{bubbles:true}));method.value='motion-kling-v3-v1';method.dispatchEvent(new f.w.Event('change',{bubbles:true}));});
    await click(f,'See price');assert.equal(JSON.parse(f.w.requests.at(-1).init.body).settings.resolution,'720p');
  }finally{await f.close();}
});
test('video lip-sync clears the photo instruction before preparing its prompt-free profile',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/CreatorWorkspace.client';function App(){return <Workspace toolId=\"lip-sync\" lipVideoEnabled={true}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    const instruction=f.w.document.querySelector('textarea');await f.act(async()=>{Object.getOwnPropertyDescriptor(f.w.HTMLTextAreaElement.prototype,'value')!.set!.call(instruction,'Smile and move the camera');instruction.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
    await click(f,'Video');assert.equal(f.w.document.querySelector('textarea'),null);
    await f.act(async()=>{f.w.pickers.video.onChange(source('video'));f.w.pickers.audio.onChange(source('audio'));});await click(f,'See price');
    const input=JSON.parse(f.w.requests.at(-1).init.body);assert.equal(input.profileId,'lip-video-wan-v1');assert.equal(input.settings.instruction,'');
  }finally{await f.close();}
});

test('Product Video opens its real signed output beside the original for manual synchronized comparison',async()=>{
  const f=await mount('product-video-editor');try{
    await f.act(async()=>f.w.pickers.video.onChange(source('video')));await click(f,'See price');await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,quote:price});await click(f,'Confirm price and create');
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'running'});
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'completed',result:{toolId:'product-video-editor',jobId:'job-1',version:1,sourceAssets:[],outputs:[{asset:{type:'asset',assetId:`ma_${'2'.repeat(32)}`,kind:'video'},originalUrl:'https://private.invalid/canonical.mp4',kind:'video',readUrl:'https://private.invalid/result.mp4?signature=exact',thumbnailReadUrl:null}]}});
    const videos=f.w.document.querySelectorAll('video');assert.equal(videos.length,2);assert.equal(videos[0].src,source('video').url);assert.equal(videos[1].src,'https://private.invalid/result.mp4?signature=exact');
    assert.equal(buttons(f.w,'Compare')[0].getAttribute('aria-pressed'),'true');assert.equal(buttons(f.w,'Play both').length,1);assert.ok(Array.from(videos).every((node:any)=>node.preload==='none'&&!node.autoplay));
    await click(f,'Result');assert.equal(f.w.document.querySelectorAll('video').length,1);
  }finally{await f.close();}
});

const recoveredVideoInput={version:1,toolId:'product-video-editor',profileId:'product-video-wan-v1',inputs:[{role:'source',source:source('video').ref,segment:{startSec:2,endSec:6}}],settings:{action:'lighting',instruction:'Warm light',audioPolicy:'preserve',resolution:'720p'}};
const recoveredVideo={ok:true,operationId:opId,status:'completed',input:recoveredVideoInput,sourceMedia:[{role:'source',ref:source('video').ref,segment:{startSec:2,endSec:6},readUrl:'https://private.invalid/fresh-source.mp4?signature=A',name:'Owned original'}],result:{toolId:'product-video-editor',jobId:'job-1',version:1,sourceAssets:[],outputs:[{asset:{type:'asset',assetId:`ma_${'2'.repeat(32)}`,kind:'video'},originalUrl:'https://private.invalid/canonical.mp4',kind:'video',readUrl:'https://private.invalid/fresh-result.mp4?signature=A'}]}};
async function recoverProductVideo(){return mountToolFixture(`import Workspace from './src/components/tools/creator/CreatorWorkspace.client';function App(){return <Workspace toolId="product-video-editor" executionEnabled={false} initialOperationId="${opId}"/>}`,stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});}
test('operation recovery restores owned sources, settings and segment for comparison; removed source drops its stale URL',async()=>{
  const f=await recoverProductVideo();try{
    await f.respond(f.w.requests[0],recoveredVideo);
    let videos=f.w.document.querySelectorAll('video');assert.equal(videos.length,2);assert.equal(videos[0].src,recoveredVideo.sourceMedia[0].readUrl);assert.equal(f.w.document.querySelector('textarea').value,'Warm light');
    assert.equal(f.w.pickers.video.source.name,'Owned original');assert.equal(buttons(f.w,'See price')[0].disabled,true);
    await f.act(async()=>videos[1].dispatchEvent(new f.w.Event('error')));await click(f,'Try again');
    await f.respond(f.w.requests.at(-1),{...recoveredVideo,sourceMedia:[{...recoveredVideo.sourceMedia[0],readUrl:null}]});
    videos=f.w.document.querySelectorAll('video');assert.equal(videos.length,1);assert.equal(videos[0].src,recoveredVideo.result.outputs[0].readUrl);assert.equal(f.w.pickers.video.source,null);assert.match(f.w.document.body.textContent,/file is unavailable/);
  }finally{await f.close();}
});
test('a comparison refresh finishing after an account change cannot restore the previous account media',async()=>{
  const f=await recoverProductVideo();try{
    await f.respond(f.w.requests[0],recoveredVideo);await f.act(async()=>f.w.document.querySelectorAll('video')[1].dispatchEvent(new f.w.Event('error')));await click(f,'Try again');const late=f.w.requests.at(-1);
    f.w.auth={user:{id:'B'},loading:false};await f.render();await f.respond(late,recoveredVideo);assert.equal(f.w.document.querySelectorAll('video').length,0);assert.equal(f.w.pickers.video.source,null);
    assert.ok(late.init.signal.aborted);await f.respond(f.w.requests.at(-1),{ok:false,error:{code:'OPERATION_UNAVAILABLE'}},404);assert.equal(f.w.document.querySelectorAll('video').length,0);
  }finally{await f.close();}
});

test('refreshing an unavailable subtitle source removes stale playback while preserving unsaved caption edits',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/SubtitleWorkspace.client';function App(){return <Workspace initialDocument={{id:'captions-1',revision:1}}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    await f.respond(f.w.requests[0],{ok:true,document,sourceMedia:{url:'https://private.invalid/expired-source.mp4',name:'Source'}});await edit(f,'Caption 1','Keep my draft');
    await f.act(async()=>f.w.document.querySelector('video').dispatchEvent(new f.w.Event('error')));await click(f,'Try again');
    await f.respond(f.w.requests.at(-1),{ok:true,document,sourceMedia:null});assert.equal(f.w.document.querySelector('video'),null);assert.equal(f.w.document.querySelector('textarea[aria-label="Caption 1"]').value,'Keep my draft');
    assert.equal(buttons(f.w,'Save changes')[0].disabled,false);
  }finally{await f.close();}
});
test('a subtitle preview refresh cannot restore the old source or draft after an account switch',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/SubtitleWorkspace.client';function App(){return <Workspace initialDocument={{id:'captions-1',revision:1}}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    const payload={ok:true,document,sourceMedia:{url:'https://private.invalid/account-a.mp4',name:'Source A'}};await f.respond(f.w.requests[0],payload);await edit(f,'Caption 1','Private A');
    await f.act(async()=>f.w.document.querySelector('video').dispatchEvent(new f.w.Event('error')));await click(f,'Try again');const late=f.w.requests.at(-1);
    f.w.auth={user:{id:'B'},loading:false};await f.render();await f.respond(late,payload);assert.equal(f.w.document.querySelector('video'),null);assert.equal(f.w.document.querySelector('textarea[aria-label="Caption 1"]'),null);
  }finally{await f.close();}
});


test('missing sources explain the next action beside the disabled price button',async()=>{
  const f=await mount('lip-sync');try{
    assert.equal(buttons(f.w,'See price')[0].disabled,true);assert.match(f.w.document.body.textContent,/Choose your source to see the price/);
    await f.act(async()=>f.w.pickers.image.onChange(source('image')));
    assert.equal(buttons(f.w,'See price')[0].disabled,true);assert.match(f.w.document.body.textContent,/Add a voice recording to continue/);
    await f.act(async()=>f.w.pickers.audio.onChange(source('audio')));
    assert.equal(buttons(f.w,'See price')[0].disabled,false);assert.doesNotMatch(f.w.document.body.textContent,/Add a voice recording to continue/);
    assert.equal(f.w.requests.length,0);
  }finally{await f.close();}
});
test('completion selects the new result after the original was selected and offers the saved-media next step',async()=>{
  const f=await mount('lip-sync');try{
    await f.act(async()=>{f.w.pickers.image.onChange(source('image'));f.w.pickers.audio.onChange(source('audio'));});
    await click(f,'Original');await click(f,'See price');await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,quote:price});await click(f,'Confirm price and create');
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'running'});
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'completed',result:{toolId:'lip-sync',jobId:'job-1',version:1,sourceAssets:[],outputs:[{asset:{type:'asset',assetId:`ma_${'2'.repeat(32)}`,kind:'video'},originalUrl:'https://private.invalid/canonical.mp4',kind:'video',readUrl:'https://private.invalid/completed.mp4'}]}});
    assert.equal(buttons(f.w,'Result')[0].getAttribute('aria-pressed'),'true');assert.equal(f.w.document.querySelector('video').src,'https://private.invalid/completed.mp4');
    assert.match(f.w.document.body.textContent,/Your result is saved in Media/);assert.equal(f.w.document.querySelector('a[href="/app/library?view=saved&kind=video"]').textContent,'Open Media');
    assert.equal(buttons(f.w,'Start a new creation').length,1);
  }finally{await f.close();}
});

test('Lip Sync blocks an overlong recording until an explicit passage is chosen and invalidates its quote on timing edits',async()=>{
  const f=await mount('lip-sync');try{
    await f.act(async()=>{f.w.pickers.image.onChange(source('image'));f.w.pickers.audio.onChange({...source('audio'),durationSec:24.75});});
    assert.equal(buttons(f.w,'See price')[0].disabled,true);
    assert.match(f.w.document.body.textContent,/24.75 seconds/);
    assert.equal(f.w.requests.length,0);
    await click(f,'Select 15 seconds of audio');
    await click(f,'See price');
    assert.deepEqual(JSON.parse(f.w.requests.at(-1).init.body).inputs.find((item:any)=>item.role==='audio').segment,{startSec:0,endSec:15});
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,quote:price});
    await edit(f,'End (seconds) — Voice recording','25','input');
    assert.equal(buttons(f.w,'Confirm price and create').length,0);
    assert.equal(buttons(f.w,'See price')[0].disabled,true);
    assert.match(f.w.document.body.textContent,/past the end/);
    await edit(f,'End (seconds) — Voice recording','10.34449','input');
    await click(f,'See price');
    assert.equal(JSON.parse(f.w.requests.at(-1).init.body).inputs.find((item:any)=>item.role==='audio').segment.endSec,10.34449);
    assert.match(f.w.document.body.textContent,/Wan 3 generation: 11 seconds/);assert.match(f.w.document.body.textContent,/Target final duration: 10.34449 seconds/);
  }finally{await f.close();}
});

test('Video Lip Sync only matches passages on request, preserves starts, and rejects known duration mismatches before pricing',async()=>{
  const f=await mountToolFixture("import Workspace from './src/components/tools/creator/CreatorWorkspace.client';function App(){return <Workspace toolId=\"lip-sync\" lipVideoEnabled={true}/>}",stubs,w=>{w.auth={user:{id:'A'},loading:false};w.pickers={};});
  try{
    await click(f,'Video');
    await f.act(async()=>{f.w.pickers.video.onChange({...source('video'),durationSec:12});f.w.pickers.audio.onChange({...source('audio'),durationSec:10.34449});});
    assert.equal(buttons(f.w,'See price')[0].disabled,true);
    assert.match(f.w.document.body.textContent,/same duration/);
    await f.act(async()=>f.w.document.querySelector('input[type=checkbox]').click());
    await edit(f,'Start (seconds) — Your file','2','input');
    await click(f,'Select 10 seconds for both');
    assert.equal(f.w.requests.length,0);
    await click(f,'See price');
    const input=JSON.parse(f.w.requests.at(-1).init.body);
    assert.deepEqual(input.inputs.find((item:any)=>item.role==='source').segment,{startSec:2,endSec:12});
    assert.deepEqual(input.inputs.find((item:any)=>item.role==='audio').segment,{startSec:0,endSec:10});
  }finally{await f.close();}
});

test('Lip Sync shows the duration failure instead of a generic outage after a rejected provider result',async()=>{
  const f=await mount('lip-sync');try{
    await f.act(async()=>{f.w.pickers.image.onChange(source('image'));f.w.pickers.audio.onChange({...source('audio'),durationSec:10.34449});});
    await click(f,'See price');await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,quote:price});await click(f,'Confirm price and create');
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'running'});
    await f.respond(f.w.requests.at(-1),{ok:true,operationId:opId,status:'failed',error:'Output duration differs from the selected segment. No audio was cut or looped. The charge was refunded.'});
    assert.match(f.w.document.querySelector('[role=alert]').textContent,/generated video.*duration.*selected passage/);
    assert.equal(buttons(f.w,'Download').length,0);
  }finally{await f.close();}
});
