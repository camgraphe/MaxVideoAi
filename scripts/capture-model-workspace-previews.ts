/** Local, non-generating captures of actual Create components for model-page illustrations. */
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { startWorkspaceReferenceFixture } from '../tests/helpers/workspace-reference-browser-fixture';
import keyframes from '../frontend/config/model-keyframe-demos.json';

const source = `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {SeedanceDraftSettingsNotice} from './app/(core)/(workspace)/app/_components/SeedanceDraftSettingsNotice.client';
import {LumaRay32KeyframeEditor} from './app/(core)/(workspace)/app/_components/LumaRay32KeyframeEditor';
const noop=()=>{};const c=globalThis.fixtureConfig;
function Fixture(){
 const [selected,setSelected]=useState(true);
 const [form,setForm]=useState({engineId:c.engine.id,mode:'ref2v',durationSec:16,durationOption:'16',resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:true,extraInputValues:{keyframe_indexes:'0,192,384'}});
 const field=[...c.engine.inputSchema.required,...c.engine.inputSchema.optional].find(f=>f.id==='reference_image_urls');
 return <I18nProvider locale={c.locale} dictionary={{}} fallback={{}}><main className="app-workspace-main" style={{padding:24,width:Math.min(innerWidth,760),background:'var(--surface)',borderRadius:12}}>
  <div style={{fontSize:13,fontWeight:600,marginBottom:16,color:'var(--text-primary)'}}>Create / {c.engine.label}</div>
  {c.engine.id==='seedance-2-5'?<SeedanceDraftSettingsNotice locale={c.locale} setup={{engineId:c.engine.id,mode:'t2v',iterations:1,aspectRatio:'16:9'}} controls={{available:true,selected,phase:'setup',live:true,toggle:()=>setSelected(v=>!v),generate:()=>{throw Error('Generation disabled in capture')}}} />:
   <LumaRay32KeyframeEditor engine={c.engine} form={form} setForm={setForm} assetFields={[{field,required:true}]} inputAssets={{reference_image_urls:c.images.map((url,i)=>({id:'public-'+i,url,previewUrl:url,thumbUrl:url,name:'Keyframe '+(i+1),kind:'image',status:'ready',width:1536,height:864}))}}
    onAssetAdd={noop} onAssetRemove={noop} onOpenLibrary={noop} onNotice={noop} uiLocale={c.locale} />}
 </main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;

async function main() {
 const browser=await chromium.launch({headless:true});
 const requireFrontend=createRequire(path.resolve('frontend/package.json'));const sharp=requireFrontend('sharp');
 const entries=[];
 try { for(const modelSlug of ['seedance-2-5','flux-3-max']) for(const locale of ['en','fr','es']) {
  const engine=getBaseEngines().find(e=>e.id===modelSlug)!;
  const fixture=await startWorkspaceReferenceFixture({source,config:{engine,locale,images:keyframes.demos[0].referenceImages},assistancePreview:true});
  try {
   const captures=[];for(const width of [800,390]){
   const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:2});
   page.on('pageerror',error=>console.error(modelSlug,locale,error.message));
   await page.goto(fixture.url,{waitUntil:'networkidle'});
   await page.locator('main').waitFor();
   await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));
   const bytes=await page.locator('main').screenshot();const result=await sharp(bytes).webp({quality:88}).toBuffer({resolveWithObject:true});
   const sha256=createHash('sha256').update(result.data).digest('hex');const url='/assets/model-examples/workspace-controls/'+sha256+'.webp';
   await mkdir(path.dirname('frontend/public'+url),{recursive:true});await writeFile('frontend/public'+url,result.data);
   captures.push({url,sha256,width:result.info.width,height:result.info.height});
   await page.close();}
   entries.push({modelSlug,locale,...captures[0],mobile:captures[1],component:modelSlug==='seedance-2-5'?'SeedanceDraftSettingsNotice':'LumaRay32KeyframeEditor'});
  }finally{await fixture.close();}
 }}finally{await browser.close();}
 await writeFile('frontend/config/model-cinematic-workspace-previews.json',JSON.stringify({capturedAt:'2026-11-16',purpose:'Actual Create components with example settings; no generation or price quote',entries},null,2)+'\n');
 console.log(entries.map(e=>({model:e.modelSlug,locale:e.locale,size:[e.width,e.height]})));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
