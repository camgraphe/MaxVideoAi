import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {mountToolFixture} from './helpers/tool-selection-fixture';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {resolveStudioMedia} from '../frontend/src/server/studio/media-resolver';
import {createAgentModelCatalogDeps} from '../frontend/src/server/agent-api/model-catalog';
import {getBaseEngines} from '../frontend/src/lib/engines';

const id='ma_'+'a'.repeat(32),ref={type:'asset',assetId:id,kind:'image'},jobRef={type:'job-output',jobId:'owned-job',outputId:'owned-output',kind:'image'};
const source=`
import {useImageReferenceSlots} from './app/(core)/(workspace)/app/image/_hooks/useImageReferenceSlots';
import {useImageWorkspaceReferenceAssets} from './app/(core)/(workspace)/app/image/_hooks/useImageWorkspaceReferenceAssets';
import {useImageComposerPersistence} from './app/(core)/(workspace)/app/image/_hooks/useImageComposerPersistence';
import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
import {composerAssistanceReferences} from './src/lib/prompt-assistance/client-context';
import {listFalEngines} from './src/config/falEngines';
const entry=listFalEngines().find(x=>x.id==='seedream'),engine=entry.engine,engines=[{id:entry.id,engineCaps:engine,modes:['t2i','i2i'],aliases:[entry.id]}];
const setters=Object.fromEntries(['EngineId','Mode','Prompt','NumImages','AspectRatio','Resolution','Seed','OutputFormat','Quality','Background','Style','MaskUrl','EnableWebSearch','ThinkingLevel','Complexity','LimitGenerations','Watermark','CustomImageWidth','CustomImageHeight'].map(name=>['set'+name,noop]));
function App(){
 const state=useImageReferenceSlots({accountId:'owner',selectedEngineCaps:engine,autoModeFromReferences:true,mode:'i2i',resolvedCopy:DEFAULT_COPY,setError:noop,supportedReferenceFormats:['png'],supportedReferenceFormatsLabel:'PNG',toolsEnabled:true});
 const assets=useImageWorkspaceReferenceAssets({...state,mode:'i2i',resolvedCopy:DEFAULT_COPY});
 const persistence=useImageComposerPersistence({...setters,accountId:'owner',engineId:'seedream',engines,mode:'i2i',prompt:'Poster',numImages:1,aspectRatio:'auto',resolution:'2k',seed:'',outputFormat:'jpeg',quality:null,background:null,style:null,maskUrl:'',enableWebSearch:false,thinkingLevel:null,complexity:null,limitGenerations:false,watermark:false,customImageWidth:'',customImageHeight:'',persistableReferenceSlots:state.persistableReferenceSlots,setReferenceSlots:state.setReferenceSlots});
 window.probe={...state,references:composerAssistanceReferences(engine,assets.referenceAssetFields,assets.composerReferenceAssets,'i2i'),hydrated:persistence.storageHydrated};return <output data-reference-name>{assets.composerReferenceAssets.reference_images?.[0]?.name}</output>;
}`;
const stubs={'@/lib/supabaseClient':`export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic'}},error:null})}};`};
const plain=(value:any)=>JSON.parse(JSON.stringify(value));
async function mount(saved?:unknown){return mountToolFixture(source,stubs,w=>{
 w.sessionStorage.setItem('last-known:user-id','owner');w.createImageBitmap=async()=>({width:10,height:10,close(){}});w.fetch=w.fixtureFetch;
 if(saved)w.localStorage.setItem('maxvideoai.image.composer.v1:owner',JSON.stringify(saved));
});}
const snapshot=(slots:unknown)=>({version:5,engineId:'seedream',mode:'i2i',prompt:'Poster',numImages:1,aspectRatio:'auto',resolution:'2k',referenceSlots:slots});
const catalog={...createAgentModelCatalogDeps(),listEngines:async()=>getBaseEngines(),isModeExecutable:()=>true,isEngineExecutable:()=>true};
async function resolve(references:any[],owner='owner'){
 const request={sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en' as const,message:'Poster using this image',draft:{surface:'image' as const,engineId:'seedream',workflow:'edit' as const,mode:'i2i',target:'prompt' as const,text:'',settings:{},references}};
 return buildPromptAssistanceContext(owner,request,{catalog,resolveMedia:(user,identity)=>resolveStudioMedia(user,identity,async(sql,values)=>{
  if(identity.type==='asset'){assert.match(sql,/a.user_id = \$1 AND a.public_id = \$2/);assert.deepEqual(values,[owner,id,'image']);}
  else {assert.match(sql,/o.job_id = \$2 AND o.id = \$3/);assert.deepEqual(values,[owner,'owned-job','owned-output','image']);}
  return [{id:identity.type==='asset'?'legacy-row':'owned-output',public_id:id,job_id:'owned-job',job_user_id:'owner',user_id:'owner',kind:'image',status:'ready',mime_type:'image/png',url:'https://media.maxvideoai.com/a.png?signature=synthetic',width:800,height:600}];
 })});
}

for(const identity of [{ref},{assetId:id},{ref:jobRef}])test(`Image library identity reaches Milo and owned resolver (${'ref' in identity?identity.ref.type:'assetId'})`,async()=>{
 const f=await mount();try{
  await f.act(()=>f.w.probe.handleLibrarySelect({id:'legacy-logical-id',url:'https://example.invalid/photo.png',mime:'image/png',...identity},0));
  const want='ref' in identity?identity.ref:ref;const references=plain(f.w.probe.references);assert.deepEqual(references[0].ref,want);assert.equal(references[0].fieldId,'image_urls');
  const context=await resolve(references);assert.equal(context.references[0].width,800);
  await assert.rejects(resolve([{...references[0],fieldId:'reference_images'}]),/REFERENCE_INVALID/,'server must still reject the UI alias');
  await assert.rejects(resolve(references,'other-owner'),/MEDIA_NOT_AVAILABLE/);
  const saved=plain(f.w.probe.persistableReferenceSlots);assert.deepEqual(saved[0].ref,want);
  const restored=await mount(snapshot(saved));try{assert.deepEqual(plain(restored.w.probe.references[0].ref),want);await resolve(plain(restored.w.probe.references));}finally{await restored.close();}
 }finally{await f.close();}
});

test('Image upload keeps canonical identity distinct from temporary/legacy selection IDs',async()=>{
 const f=await mount();try{
  let pending!:Promise<void>;await f.act(async()=>{pending=f.w.probe.handleReferenceFile(0,new f.w.File(['synthetic'],'photo.png',{type:'image/png'}));});
  assert.equal(f.w.requests.length,1);await f.respond(f.w.requests[0],{ok:true,asset:{id:'legacy-upload',assetId:id,ref,url:'https://example.invalid/photo.png',width:10,height:10}});await f.act(()=>pending);
  assert.deepEqual(plain(f.w.probe.references[0].ref),ref);await resolve(plain(f.w.probe.references));
 }finally{await f.close();}
});

for(const slot of [{url:'https://example.invalid/photo.png'}, {url:'https://example.invalid/photo.png',ref:{type:'asset',assetId:'legacy-logical-id',kind:'image'}}, {url:'https://example.invalid/photo.png',ref:{...ref,kind:'video'}}])test(`old or malformed Image slot cannot derive ownership from URL (${JSON.stringify(slot.ref??null)})`,async()=>{
 const f=await mount(snapshot([slot]));try{assert.equal(f.w.probe.references[0].ref,null);await assert.rejects(resolve(plain(f.w.probe.references)),/REFERENCE_REATTACH_REQUIRED/);}finally{await f.close();}
});

test('a Media card ID or URL alone never becomes an owned image ref',async()=>{
 const f=await mount();try{await f.act(()=>f.w.probe.handleLibrarySelect({id,url:'https://example.invalid/'+id+'.png',mime:'image/png'},0));assert.equal(f.w.probe.references[0].ref,null);await assert.rejects(resolve(plain(f.w.probe.references)),/REFERENCE_REATTACH_REQUIRED/);}finally{await f.close();}
});

test('an uploading Image slot cannot lend its canonical identity to Milo or persistence',async()=>{
 const f=await mount();try{await f.act(()=>f.w.probe.setReferenceSlots([{id:'pending',url:'blob:pending',status:'uploading',ref}]));assert.equal(f.w.probe.references[0].ref,null);assert.equal(f.w.probe.persistableReferenceSlots[0],null);}finally{await f.close();}
});

for(const name of ['  My chosen title  ',undefined])test(`Image selected name priority and real snapshot hydration (${name??'legacy fallback'})`,async()=>{
 const f=await mount();try{
  await f.act(()=>f.w.probe.handleLibrarySelect({id:'legacy-row',ref,url:'https://example.invalid/photo.png',mime:'image/png',name},0));
  const want=name?.trim()??'photo.png';assert.equal(f.w.document.querySelector('[data-reference-name]').textContent,want);assert.equal(f.w.probe.references[0].label,'Image 1');
  const slots=plain(f.w.probe.persistableReferenceSlots);if(name)assert.equal(slots[0].name,'My chosen title');
  const restored=await mount(snapshot(slots));try{assert.equal(restored.w.document.querySelector('[data-reference-name]').textContent,want);assert.deepEqual(plain(restored.w.probe.references[0].ref),ref);assert.equal(restored.w.probe.references[0].label,'Image 1');}finally{await restored.close();}
 }finally{await f.close();}
});
