import assert from 'node:assert/strict';
import test from 'node:test';
import {bundleClientFlow,createClientFlowDom} from './helpers/client-flow-dom';
const original='https://storage.test/private.png';
const asset={id:'row',assetId:'ma_'+'a'.repeat(32),ref:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'image'},kind:'image',url:original,mediaFacts:{source:'probe',width:1800,height:1000},readAccessOwnerId:'A',readAccessRef:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'image'},readAccessRevision:'ra_'+'a'.repeat(64),readAccessExpiresAt:new Date(Date.now()+300000).toISOString(),accessUrl:original+'?grant=original',previewAccessUrl:'https://storage.test/display.webp?grant=display',thumbnailAccessUrl:'https://storage.test/thumb.webp?grant=thumb'};
const bundle=bundleClientFlow(`
import React,{act,useState}from'react';import{createRoot}from'react-dom/client';
import{useUpscaleSourceMedia}from'./src/components/tools/upscale/_hooks/useUpscaleSourceMedia';
import{useUpscalePreviewState}from'./src/components/tools/upscale/_hooks/useUpscalePreviewState';
import{UpscalePreviewCard}from'./src/components/tools/upscale/_components/UpscalePreviewCard';
function App(){const[source,setSource]=useState(null),[mediaUrl,setMediaUrl]=useState(''),[mediaType,setType]=useState('image'),[previewMode,setPreviewMode]=useState('source');const noop=()=>{};
const handlers=useUpscaleSourceMedia({changeMediaType:setType,onSourceChange:noop,copy:{library:'Media'},locale:'fr',mediaType,mediaUrl,setError:noop,setLibraryModalOpen:noop,setMediaUrl,setMessage:noop,setPreviewMode,setResult:noop,setSource,setUploading:noop,source});
const state=useUpscalePreviewState({mediaType,mediaUrl,mode:'factor',previewMode,previewZoom:'fit',result:null,source,upscaleFactor:2});window.source=source;window.mediaUrl=mediaUrl;window.choose=handlers.selectLibraryAsset;
return <UpscalePreviewCard {...state} copy={{}} previewZoom='fit' previewScrollerRef={null} onPreviewModeChange={setPreviewMode} onPreviewZoomChange={noop} onDownload={noop} onSave={noop} onCompareKeyDown={state.handleCompareKeyDown} onComparePointerDown={state.handleComparePointerDown} onComparePointerMove={state.handleComparePointerMove} onComparePointerUp={state.handleComparePointerUp}/>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};
`,{'@/lib/supabaseClientLoader':'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession(),onAuthStateChange:callback=>{window.authCallback=callback;return{data:{subscription:{unsubscribe(){}}}}}}});','@/lib/i18n/I18nProvider':'export const useI18n=()=>({locale:"fr",t:(_key,fallback)=>fallback});'});
async function settle(w:any,p:()=>boolean,label:string){for(let i=0;i<80;i++){if(p())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}assert.fail(label);}
for(const kind of ['image','video'])test('Upscale '+kind+' retains original identity and renders renewable original grant with owner retirement',async()=>{
 const dom=createClientFlowDom('/app/tools/upscale'),w=dom.window as any;let calls=0,probes=0,pauses=0,fail=false;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}}});
 w.Image=class{set src(_url:string){probes++;}};w.HTMLMediaElement.prototype.pause=function(){pauses++;};
 w.fetch=async()=>{calls++;return{ok:!fail,json:async()=>fail?{ok:false}:{ok:true,access:{...asset,readAccessRef:{...asset.readAccessRef,kind},accessUrl:original+'?grant=renewed',readAccessExpiresAt:new Date(Date.now()+300000).toISOString()}}}};w.eval(await bundle);
 const selected={...asset,kind,ref:{...asset.ref,kind},readAccessRef:{...asset.readAccessRef,kind},mime:kind==='video'?'video/mp4':'image/png'};
 try{await w.fx.act(async()=>w.fx.render());await w.fx.act(async()=>w.choose(selected));
 assert.equal(w.source.assetId,asset.assetId);assert.deepEqual(JSON.parse(JSON.stringify(w.source.mediaFacts)),asset.mediaFacts);assert.equal(w.mediaUrl,original);assert.equal(probes,0,'private unknown dimensions never probe raw canonical URL');
 const tag=kind==='video'?'video':'img';await settle(w,()=>w.document.querySelector(tag)?.src===asset.accessUrl,'original grant, not thumbnail/display role');
 const first=w.document.querySelector(tag);if(kind==='video')assert.equal(first.preload,'none');
 await w.fx.act(async()=>first.dispatchEvent(new w.Event('error')));await settle(w,()=>w.document.querySelector(tag)?.src.endsWith('grant=renewed'),'lease renews');assert.equal(calls,1);
 fail=true;await w.fx.act(async()=>w.document.querySelector(tag).dispatchEvent(new w.Event('error')));await settle(w,()=>Boolean(w.document.querySelector('[role=alert]')),'second media failure is bounded');assert.equal(calls,1);assert.equal(w.document.querySelector(tag),null);
 fail=false;const retry=[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent==='Réessayer') as any;await w.fx.act(async()=>retry.click());await settle(w,()=>Boolean(w.document.querySelector(tag)),'explicit retry recovers');assert.equal(calls,2);
 const final=w.document.querySelector(tag);if(kind==='video')Object.defineProperty(final,'paused',{value:false});
 await w.fx.act(async()=>w.authCallback('SIGNED_IN',{user:{id:'B'}}));assert.equal(w.document.querySelector(tag),null);if(kind==='video'){assert.ok(pauses>0);assert.equal(final.getAttribute('src'),null);}
 assert.equal(w.mediaUrl,original,'operation payload keeps original');
 await w.fx.act(async()=>w.choose({id:'public',url:'https://public.test/example.png',kind:'image',width:100,height:100}));assert.equal(w.document.querySelector('img')?.src,'https://public.test/example.png');
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});

test('Upscale expired descriptor requests a fresh original grant without mounting canonical media',async()=>{
 const dom=createClientFlowDom('/app/tools/upscale'),w=dom.window as any;let calls=0,release:any;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}}});
 w.fetch=async()=>{calls++;await new Promise(r=>{release=r;});return{ok:true,json:async()=>({ok:true,access:{...asset,accessUrl:original+'?grant=fresh'}})}};w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());await w.fx.act(async()=>w.choose({...asset,accessUrl:undefined,readAccessExpiresAt:new Date(0).toISOString()}));
 await settle(w,()=>calls===1,'renewal starts');assert.equal(w.document.querySelector('img'),null);assert.equal(w.document.querySelector('video'),null);
 await w.fx.act(async()=>release());await settle(w,()=>w.document.querySelector('img')?.src.endsWith('grant=fresh'),'fresh original grant displays');assert.equal(w.mediaUrl,original);assert.equal(calls,1);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
