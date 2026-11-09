import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { mountAngle } from './helpers/tool-selection-fixture';
const original='https://storage.test/user-assets/A/source.png';
const asset={id:'row',assetId:'ma_'+'a'.repeat(32),ref:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'image'},kind:'image',url:original,thumbUrl:'https://storage.test/thumb.webp',previewUrl:'https://storage.test/display.webp',imageDisplay:{version:1,profile:'image-display-v1',sourceUrl:original,sourceSha256:'b'.repeat(64),url:'https://storage.test/display.webp',mimeType:'image/webp',width:960,height:540,sizeBytes:40000},mediaFacts:{source:'probe',width:1800,height:1000},width:1800,height:1000,readAccessOwnerId:'A',readAccessRef:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'image'},readAccessRevision:'ra_'+'a'.repeat(64),readAccessExpiresAt:new Date(Date.now()+300000).toISOString(),accessUrl:original+'?grant=original',thumbnailAccessUrl:'https://storage.test/thumb.webp?grant=thumb',previewAccessUrl:'https://storage.test/display.webp?grant=display'};
const bundle=bundleClientFlow(`
import React,{act,useState,useRef}from'react';import{createRoot}from'react-dom/client';
import{useAngleSourceImageHandlers}from'./src/components/tools/angle/_hooks/useAngleSourceImageHandlers';
import{AngleSourceImagePanel}from'./src/components/tools/angle/_components/angle-source-image-panel';
import{DEFAULT_ANGLE_COPY as copy}from'./src/components/tools/angle/_lib/angle-workspace-copy';
function App(){const[source,setSource]=useState(null);const input=useRef(null);const noop=()=>{};
const handlers=useAngleSourceImageHandlers({copy,fileInputRef:input,onAuthRequired:noop,setError:noop,setGuestExampleDismissed:noop,setLibraryModalOpen:noop,setResult:noop,setSelectedOutputIndex:noop,setSourceDragActive:noop,setSourceImage:setSource,setUploading:noop,userPresent:true});window.source=source;window.choose=handlers.handleLibrarySelect;window.replaceSource=setSource;
return <AngleSourceImagePanel copy={copy} fileInputRef={input} onAuthRequired={noop} onFileSelect={handlers.handleFileSelect} onLibraryOpen={noop} onRemoveSource={handlers.handleRemoveSource} onSourceDragActiveChange={noop} onSourceDrop={handlers.handleSourceDrop} onSourcePaste={handlers.handleSourcePaste} onUploadRequest={noop} sourceDragActive={false} sourceImage={source} uploading={false} userPresent/>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<App/>),unmount:()=>root.unmount()};
`,{'@/lib/supabaseClientLoader':'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession(),onAuthStateChange:callback=>{window.authCallback=callback;return{data:{subscription:{unsubscribe(){}}}}}}});'});
async function settle(w:any,p:()=>boolean,label:string){for(let i=0;i<80;i++){if(p())return;await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));}assert.fail(label);}
test('Angle real selection and panel retain private identity, display role, renewal and account retirement',async()=>{
 const dom=createClientFlowDom('/app/tools/angle'),w=dom.window as any;let calls=0;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}}});
 w.fetch=async()=>{calls++;return{ok:true,json:async()=>({ok:true,access:{...asset,previewAccessUrl:'https://storage.test/display.webp?grant=renewed',readAccessExpiresAt:new Date(Date.now()+300000).toISOString()}})}};
 w.eval(await bundle);
 try{
 await w.fx.act(async()=>w.fx.render());await w.fx.act(async()=>w.choose(asset));
 assert.equal(w.source.url,original);assert.equal(w.source.assetId,asset.assetId,'selected canonical identity survives');assert.deepEqual(JSON.parse(JSON.stringify(w.source.mediaFacts)),asset.mediaFacts);
 await settle(w,()=>w.document.querySelector('img')?.src===asset.previewAccessUrl,'private display grant renders');
 assert.ok(![...w.document.querySelectorAll('img')].some((image:any)=>image.src===original));
 await w.fx.act(async()=>w.document.querySelector('img').dispatchEvent(new w.Event('error')));
 await settle(w,()=>w.document.querySelector('img')?.src.endsWith('grant=renewed'),'failed signed display renews');assert.equal(calls,1);assert.equal(w.source.url,original);
 await w.fx.act(async()=>w.authCallback('SIGNED_IN',{user:{id:'B'}}));assert.equal(w.document.querySelector('img'),null,'retired private owner never falls back to canonical');
 await w.fx.act(async()=>w.replaceSource({url:original,previewUrl:'blob:upload-preview',source:'upload'}));assert.equal(w.document.querySelector('img')?.src,'blob:upload-preview');
 for(const source of ['example','paste']){await w.fx.act(async()=>w.replaceSource({url:'https://public.test/'+source+'.png',source}));assert.equal(w.document.querySelector('img')?.src,'https://public.test/'+source+'.png');}
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
test('Angle account draft retains stable private reference but never serializes transient read grants',async()=>{
 const f=await mountAngle();const key='maxvideoai.tools.angle.v1:A';
 try{await f.act(async()=>f.w.library.onSelect(asset));
 const stored=f.w.localStorage.getItem(key),source=JSON.parse(stored).sourceImage;
 assert.equal(source.assetId,asset.assetId);assert.deepEqual(source.ref,asset.ref);assert.deepEqual(source.mediaFacts,asset.mediaFacts);
 assert.equal(source.readAccessOwnerId,'A');assert.deepEqual(source.readAccessRef,asset.readAccessRef);assert.equal(source.readAccessRevision,asset.readAccessRevision);
 for(const field of ['accessUrl','thumbnailAccessUrl','previewAccessUrl','playbackAccessUrl','readAccessExpiresAt'])assert.equal(source[field],undefined,field+' must stay transient');
 assert.ok(!stored.includes('?grant='));
 const reload=await mountAngle({storage:{[key]:stored}});try{assert.equal(reload.w.settings.sourceImage.url,original);assert.deepEqual(JSON.parse(JSON.stringify(reload.w.settings.sourceImage.ref)),asset.ref);assert.equal(reload.w.settings.sourceImage.accessUrl,undefined);assert.ok(Date.parse(reload.w.settings.sourceImage.readAccessExpiresAt)<Date.now(),'restoration requests a fresh lease');}finally{await reload.close();}
 }finally{await f.close();}
});

test('Angle expired or missing grants renew without canonical fallback; thumbnail-only failure stays bounded',async()=>{
 const dom=createClientFlowDom('/app/tools/angle'),w=dom.window as any;let calls=0,fail=false;
 w.getSession=async()=>({data:{session:{user:{id:'A'},access_token:'token-A'}}});
 w.fetch=async()=>{calls++;return{ok:!fail,json:async()=>fail?{ok:false}:{ok:true,access:{...asset,previewAccessUrl:'https://storage.test/display.webp?grant=restored',readAccessExpiresAt:new Date(Date.now()+300000).toISOString()}}}};w.eval(await bundle);
 try{await w.fx.act(async()=>w.fx.render());await w.fx.act(async()=>w.choose({...asset,accessUrl:undefined,previewAccessUrl:undefined,thumbnailAccessUrl:undefined,readAccessExpiresAt:new Date(0).toISOString()}));
 await settle(w,()=>w.document.querySelector('img')?.src.endsWith('grant=restored'),'expired descriptor renews');assert.equal(calls,1);
 const thumb={...asset,readAccessRevision:'ra_'+'c'.repeat(64),accessUrl:undefined,previewAccessUrl:undefined};
 await w.fx.act(async()=>w.choose(thumb));await settle(w,()=>w.document.querySelector('img')?.src===asset.thumbnailAccessUrl,'only granted thumbnail is used');
 fail=true;await w.fx.act(async()=>w.document.querySelector('img').dispatchEvent(new w.Event('error')));
 await settle(w,()=>Boolean(w.document.querySelector('[role=alert]')),'failed renewal is explicit');assert.equal(w.document.querySelector('img'),null);assert.equal(calls,2);assert.equal(w.source.url,original);
 }finally{await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
test('Angle never persists a signed pasted original or blob display URL',async()=>{
 const f=await mountAngle(),key='maxvideoai.tools.angle.v1:A';
 try{await f.act(async()=>f.w.settings.onSourcePaste({preventDefault(){},clipboardData:{items:[],getData:()=>original+'?X-Amz-Signature=private'}}));
 assert.equal(f.w.settings.sourceImage.url,original+'?X-Amz-Signature=private','live original stays exact');assert.equal(JSON.parse(f.w.localStorage.getItem(key)).sourceImage,null);
 }finally{await f.close();}
});
