import assert from 'node:assert/strict';
import test from 'node:test';
import {bundleClientFlow,createClientFlowDom} from './helpers/client-flow-dom';
const asset=(kind:string)=>({id:'row',assetId:'ma_'+'a'.repeat(32),ref:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind},kind,url:'https://storage.test/private.'+kind,thumbUrl:'https://storage.test/thumb.webp',name:'Source',readAccessOwnerId:'A',readAccessRef:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind},readAccessRevision:'ra_'+'a'.repeat(64),readAccessExpiresAt:new Date(Date.now()+300000).toISOString(),accessUrl:'https://storage.test/private.'+kind+'?grant=original',thumbnailAccessUrl:'https://storage.test/thumb.webp?grant=thumb'});
const bundle=bundleClientFlow(`
import React,{act}from'react';import{createRoot}from'react-dom/client';
import{selectCreatorSource}from'./src/components/tools/creator/creator-source-selection';
import{CreatorMediaPreview}from'./src/components/tools/creator/CreatorMediaPreview';import{CreatorVideoComparison}from'./src/components/tools/creator/CreatorVideoComparison.client';import{CreatorSourcePicker}from'./src/components/tools/creator/CreatorSourcePicker.client';import{SubtitlePreview}from'./src/components/tools/creator/SubtitleDocumentEditor';
import{AudioSourceVideoSection}from'./app/(core)/(workspace)/app/audio/_components/audio-source-video-section';import{DEFAULT_AUDIO_WORKSPACE_COPY}from'./app/(core)/(workspace)/app/audio/copy';
import{AudioCreationEditor}from'./app/(core)/(workspace)/app/audio/_components/AudioCreationEditor';import{newAudioDraft}from'./src/lib/audio-creation';import{audioCreationCopy}from'./app/(core)/(workspace)/app/audio/_lib/audio-creation-copy';
function App(){const a=window.asset,s=window.public?{...a,thumbnailUrl:a.thumbUrl}:selectCreatorSource(a,a.kind);window.selected=s;const type=window.case;
if(type==='picker')return <CreatorSourcePicker userId={window.owner??'A'} locale='en' label='Source' kind={a.kind} source={s} onChange={()=>{}}/>;
if(type==='compare')return <CreatorVideoComparison locale='en' sourceMedia={s} sourceUrl={s.url} sourcePoster={s.thumbnailUrl} resultUrl='https://public.test/result.mp4'/>;
if(type==='subtitle')return <SubtitlePreview locale='en' source={s} document={window.subtitleDocument??null}/>;
if(type==='audio-video')return <AudioSourceVideoSection sourceVideo={{...a,label:'Video'}} copy={DEFAULT_AUDIO_WORKSPACE_COPY} inputRef={{current:null}} isUploading={false} onClear={()=>{}} onFileSelect={()=>{}} onOpenGeneratedPicker={()=>{}} required/>;
if(type==='voice')return <AudioCreationEditor intent='voice' draft={{...newAudioDraft(),reference:{...a,name:'Ref'}}} copy={audioCreationCopy('en')} onChange={()=>{}} onFile={()=>{}} onLibrary={()=>{}} uploading={false}/>;
return <CreatorMediaPreview locale='en' source={s} url={s.url} poster={s.thumbnailUrl} kind={a.kind}/>;}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(window.strict?<React.StrictMode><App/></React.StrictMode>:<App/>),unmount:()=>root.unmount()};
`,{'@/lib/supabaseClientLoader':'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession(),onAuthStateChange:callback=>{window.authCallback=callback;return{data:{subscription:{unsubscribe(){}}}}}}});'});
async function settle(w:any,p:()=>boolean,label:string){for(let i=0;i<80;i++){if(p())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}assert.fail(label);}
for(const [surface,kind]of [['reader','image'],['reader','video'],['reader','audio'],['compare','video'],['subtitle','video'],['subtitle','audio'],['picker','image'],['voice','audio'],['audio-video','video']])test(surface+' '+kind+' uses private leases and retires owner without canonical fallback',async()=>{
const dom=createClientFlowDom('/app/tools'),w=dom.window as any;w.case=surface;w.asset=asset(kind);let calls=0;
w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}}});w.HTMLMediaElement.prototype.pause=()=>{};
w.fetch=async()=>{calls++;return{ok:true,json:async()=>({ok:true,access:{...w.asset,accessUrl:w.asset.accessUrl+'&renewed=1',thumbnailAccessUrl:w.asset.thumbnailAccessUrl+'&renewed=1'}})}};w.eval(await bundle);
try{await w.fx.act(async()=>w.fx.render());const tag=surface==='picker'?'img':kind==='image'?'img':kind;const expected=surface==='picker'?w.asset.thumbnailAccessUrl:w.asset.accessUrl;
await settle(w,()=>w.document.querySelector(tag)?.src===expected,'granted source renders');assert.equal(w.selected.url,w.asset.url,'canonical source retained');
assert.ok(![...w.document.querySelectorAll('[src],[poster]')].some((n:any)=>n.getAttribute('src')===w.asset.url||n.getAttribute('poster')===w.asset.thumbUrl));
await w.fx.act(async()=>w.document.querySelector(tag).dispatchEvent(new w.Event('error')));await settle(w,()=>w.document.querySelector(tag)?.src.includes('renewed=1'),'renewal');assert.equal(calls,1);
await w.fx.act(async()=>{if(surface==='picker'){w.owner='B';w.fx.render();}else w.authCallback('SIGNED_IN',{user:{id:'B'}});});assert.ok(![...w.document.querySelectorAll('[src],[poster]')].some((n:any)=>(n.getAttribute('src')??'').includes('storage.test')||(n.getAttribute('poster')??'').includes('storage.test')),'retired grants/canonical sources never render');
}finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

for (const [surface,kind] of [['reader','image'],['reader','audio'],['compare','video'],['subtitle','video'],['subtitle','audio'],['picker','image'],['voice','audio'],['audio-video','video']]) test(surface+' '+kind+' expired descriptor never mounts raw canonical media',async()=>{
 const dom=createClientFlowDom('/app/tools'),w=dom.window as any;w.case=surface;const fresh=asset(kind);w.asset={...fresh,accessUrl:undefined,thumbnailAccessUrl:undefined,readAccessExpiresAt:new Date(0).toISOString()};let release:any,calls=0;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}}});w.HTMLMediaElement.prototype.pause=()=>{};
 w.fetch=async()=>{calls++;await new Promise(r=>release=r);return{ok:true,json:async()=>({ok:true,access:fresh})}};w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());await settle(w,()=>calls===1,'fresh grant requested');
 assert.ok(![...w.document.querySelectorAll('[src],[poster]')].some((n:any)=>(n.getAttribute('src')??'').includes('storage.test')||(n.getAttribute('poster')??'').includes('storage.test')));
 await w.fx.act(async()=>release());const tag=surface==='picker'?'img':kind==='image'?'img':kind;await settle(w,()=>w.document.querySelector(tag)?.src===(surface==='picker'?fresh.thumbnailAccessUrl:fresh.accessUrl),'fresh media renders');assert.equal(w.selected.url,fresh.url);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
const draftBundle=bundleClientFlow(`import React,{act}from'react';import{createRoot}from'react-dom/client';import{useAudioCreationDraft}from'./app/(core)/(workspace)/app/audio/_hooks/useAudioCreationDraft';function App(){window.draftOwner=useAudioCreationDraft('A','voice');return null;}const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};`,{});
test('Audio real account draft keeps canonical reference and drops all transient grant fields',async()=>{
 const dom=createClientFlowDom('/app/audio'),w=dom.window as any;w.eval(await draftBundle);
 try{await w.fx.act(async()=>w.fx.render());const a=asset('audio');await w.fx.act(async()=>w.draftOwner.update({reference:a}));const stored=w.localStorage.getItem('maxvideoai.audio.creation.v1:A'),r=JSON.parse(stored).drafts.voice.reference;
 assert.equal(r.url,a.url);assert.deepEqual(r.ref,a.ref);assert.deepEqual(r.readAccessRef,a.readAccessRef);assert.equal(r.readAccessOwnerId,'A');assert.ok(!stored.includes('?grant='));assert.equal(r.readAccessExpiresAt,undefined);
 const other=createClientFlowDom('/app/audio'),v=other.window as any;v.localStorage.setItem('maxvideoai.audio.creation.v1:A',stored);v.eval(await draftBundle);try{await v.fx.act(async()=>v.fx.render());assert.equal(v.draftOwner.draft.reference.url,a.url);assert.ok(Date.parse(v.draftOwner.draft.reference.readAccessExpiresAt)<Date.now());}finally{await v.fx.act(async()=>v.fx.unmount());other.window.close();}
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

for(const [surface,kind]of [['reader','image'],['reader','audio'],['compare','video'],['subtitle','video'],['voice','audio'],['audio-video','video']])test(surface+' '+kind+' preserves public/blob display and manual media through Strict Mode',async()=>{
 const dom=createClientFlowDom('/app/tools'),w=dom.window as any;w.case=surface;w.public=true;w.strict=true;w.asset={id:'public',url:'blob:local-preview',name:'Local',kind,ref:{type:'asset',assetId:'ma_'+'b'.repeat(32),kind}};w.HTMLMediaElement.prototype.pause=()=>{};w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());const tag=kind==='image'?'img':kind;const node=w.document.querySelector(tag);assert.equal(node?.getAttribute('src'),'blob:local-preview');if(kind!=='image'){assert.equal(node.preload,'none');assert.equal(node.autoplay,false);}}
 finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

function observeSubtitleFrames(w: any) {
 const observers: Array<{target: Element | null; disconnected: boolean; notify(width: number,height: number): void}> = [];
 w.ResizeObserver = class {
  state: typeof observers[number];
  constructor(callback: ResizeObserverCallback) {
   this.state = {target:null,disconnected:false,notify(width,height) {
    if (!this.disconnected && this.target) callback([{target:this.target,contentRect:{width,height}} as ResizeObserverEntry], {} as ResizeObserver);
   }};
   observers.push(this.state);
  }
  observe(target: Element) {this.state.target=target;}
  disconnect() {this.state.disconnected=true;}
 };
 w.subtitleDocument = {version:1,id:'captions',revision:1,language:'en',source:{ref:asset('video').ref,fingerprint:'a'.repeat(64),durationMs:5000},words:[],
  segments:[{id:'segment-1',startMs:0,endMs:5000,text:'Portrait caption',wordIds:[],alignment:'edited'}],
  style:{preset:'clean',position:'bottom',fontSizePercent:7,textColor:'#FFFFFF',accentColor:'#FDE047'}};
 return observers;
}

async function assertSubtitleGeometry(w: any, observers: ReturnType<typeof observeSubtitleFrames>, width: number,height: number) {
 const frame=w.document.querySelector('video')?.parentElement;
 const active=observers.filter(observer=>!observer.disconnected && observer.target===frame);
 assert.equal(active.length,1,'the mounted subtitle frame has one active ResizeObserver');
 await w.fx.act(async()=>active[0].notify(width,height));
 const overlay=w.document.querySelector('[data-subtitle-overlay]');
 assert.equal(overlay?.textContent,'Portrait caption');
 assert.equal(overlay.style.width,`${Math.round(width*.86)}px`);
 assert.equal(overlay.style.top,`${Math.round(height*.82)}px`);
 assert.ok(Math.abs(Number.parseFloat(overlay.style.fontSize)-Math.min(width,height)*.07)<0.0001,'caption font size follows the observed frame');
}

test('Subtitle geometry observes a frame mounted after delayed private lease acquisition',async()=>{
 const dom=createClientFlowDom('/app/tools'),w=dom.window as any;w.case='subtitle';const fresh=asset('video');
 w.asset={...fresh,accessUrl:undefined,readAccessExpiresAt:new Date(0).toISOString()};
 const observers=observeSubtitleFrames(w);let release:any,calls=0;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}}});w.HTMLMediaElement.prototype.pause=()=>{};
 w.fetch=async()=>{calls++;await new Promise(r=>release=r);return{ok:true,json:async()=>({ok:true,access:fresh})}};w.eval(await bundle);
 try {
  await w.fx.act(async()=>w.fx.render());await settle(w,()=>calls===1,'lease request starts');
  assert.equal(w.document.querySelector('video'),null);assert.equal(observers.length,0);
  await w.fx.act(async()=>release());await settle(w,()=>Boolean(w.document.querySelector('video')),'leased video mounts');
  assert.equal(w.selected.url,fresh.url);
  await assertSubtitleGeometry(w,observers,270,480);
  await assertSubtitleGeometry(w,observers,360,640);
 } finally {await w.fx.act(async()=>w.fx.unmount());assert.ok(observers.every(observer=>observer.disconnected),'unmount disconnects geometry observation');dom.window.close();}
});

test('Subtitle geometry reattaches after a failed private lease and explicit Retry on the same canonical source',async()=>{
 const dom=createClientFlowDom('/app/tools'),w=dom.window as any;w.case='subtitle';w.asset=asset('video');const observers=observeSubtitleFrames(w);let calls=0;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}}});w.HTMLMediaElement.prototype.pause=()=>{};
 w.fetch=async()=>{calls++;return{ok:calls>1,json:async()=>calls===1?{ok:false}:{ok:true,access:{...w.asset,accessUrl:w.asset.accessUrl+'&retry=1'}}}};w.eval(await bundle);
 try {
  await w.fx.act(async()=>w.fx.render());await settle(w,()=>Boolean(w.document.querySelector('video')),'initial leased video mounts');
  const oldFrame=w.document.querySelector('video').parentElement;
  await assertSubtitleGeometry(w,observers,640,360);
  await w.fx.act(async()=>w.document.querySelector('video').dispatchEvent(new w.Event('error')));
  await settle(w,()=>Boolean(w.document.querySelector('[role=alert]')),'failed renewal removes the frame');
  assert.equal(w.document.querySelector('video'),null);
  assert.ok(observers.filter(observer=>observer.target===oldFrame).every(observer=>observer.disconnected),'failure disconnects the old frame');
  await w.fx.act(async()=>w.document.querySelector('[role=alert] button').click());
  await settle(w,()=>w.document.querySelector('video')?.src.endsWith('retry=1'),'retry remounts leased video');
  assert.equal(calls,2);assert.equal(w.selected.url,w.asset.url);
  assert.ok(w.document.querySelector('video').parentElement!==oldFrame);
  await assertSubtitleGeometry(w,observers,300,534);
  await w.fx.act(async()=>observers.filter(observer=>observer.target===oldFrame).forEach(observer=>observer.notify(640,360)));
  assert.equal(w.document.querySelector('[data-subtitle-overlay]').style.top,`${Math.round(534*.82)}px`,'retired frame notifications cannot replace recovered geometry');
 } finally {await w.fx.act(async()=>w.fx.unmount());assert.ok(observers.every(observer=>observer.disconnected),'unmount disconnects recovered geometry');dom.window.close();}
});
