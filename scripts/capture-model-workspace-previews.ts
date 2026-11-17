/** Local, non-generating captures of actual Create components for model-page illustrations. */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { startWorkspaceReferenceFixture } from '../tests/helpers/workspace-reference-browser-fixture';
import keyframes from '../frontend/config/model-keyframe-demos.json';

// A release candidate may live in another isolated checkout; compile its real
// component/CSS while writing only this checkout's immutable display artifacts.
const outputRoot = process.cwd();
const sourceRoot = process.env.MODEL_PREVIEW_SOURCE_ROOT ?? outputRoot;
const selectedModels = process.env.MODEL_PREVIEW_MODELS?.split(',') ?? ['seedance-2-5', 'flux-3-max'];
if (selectedModels.some(model => !['seedance-2-5', 'flux-3-max'].includes(model))) throw Error('Unknown preview model');

const source = `
import {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {SeedanceDraftFinalAction} from './components/library/SeedanceDraftFinalAction.client';
import {LumaRay32KeyframeEditor} from './app/(core)/(workspace)/app/_components/LumaRay32KeyframeEditor';
const noop=()=>{};const c=globalThis.fixtureConfig;
function Fixture(){
 const [form,setForm]=useState({engineId:c.engine.id,mode:'ref2v',durationSec:16,durationOption:'16',resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:true,extraInputValues:{keyframe_indexes:'0,192,384'}});
 const field=[...c.engine.inputSchema.required,...c.engine.inputSchema.optional].find(f=>f.id==='reference_image_urls');
 return <I18nProvider locale={c.locale} dictionary={{}} fallback={{}}><main className="app-workspace-main" style={{padding:24,width:Math.min(innerWidth,760),background:'var(--surface)',borderRadius:12}}>
  <div style={{fontSize:13,fontWeight:600,marginBottom:16,color:'var(--text-primary)'}}>{c.engine.id==='seedance-2-5'?({en:'Library',fr:'Bibliothèque',es:'Biblioteca'}[c.locale]):'Create'} / {c.engine.label}</div>
  {c.engine.id==='seedance-2-5'?<SeedanceDraftFinalAction locale={c.locale} jobId="preview-draft" account={{userId:'preview',token:'local-fixture-only'}} />:
   <LumaRay32KeyframeEditor engine={c.engine} form={form} setForm={setForm} assetFields={[{field,required:true}]} inputAssets={{reference_image_urls:c.images.map((url,i)=>({id:'public-'+i,url,previewUrl:url,thumbUrl:url,name:'Keyframe '+(i+1),kind:'image',status:'ready',width:1536,height:864}))}}
    onAssetAdd={noop} onAssetRemove={noop} onOpenLibrary={noop} onNotice={noop} uiLocale={c.locale} />}
 </main></I18nProvider>;
}createRoot(document.getElementById('root')).render(<Fixture/>);`;

async function main() {
 process.chdir(sourceRoot);
 const browser=await chromium.launch({headless:true});
 const requireFrontend=createRequire(path.resolve('frontend/package.json'));const sharp=requireFrontend('sharp');
 const entries=[];
 try { for(const modelSlug of selectedModels) for(const locale of ['en','fr','es']) {
  const engine=getBaseEngines().find(e=>e.id===modelSlug)!;
  const fixture=await startWorkspaceReferenceFixture({source,config:{engine,locale,images:keyframes.demos[0].referenceImages},assistancePreview:true,
   hostModules:{
    '@/hooks/useSeedanceWorkflowAccount': 'export const useSeedanceWorkflowAccount=()=>null;',
    '@/hooks/useSeedanceWorkflowView': `const data={draft:{jobId:'preview-draft',status:'completed',amountCents:null,currency:'USD',paymentStatus:'paid_wallet',videoUrl:null,thumbUrl:null},final:null,eligibility:'ready',expiresAt:null,settings:{durationSec:8,aspectRatio:'16:9',audio:true,resolution:'480p'}};export const useSeedanceWorkflowView=()=>({data,mutate:()=>{},error:null});`,
   }});
  try {
   const captures=[];for(const width of [800,390]){
   const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:2});
   page.on('pageerror',error=>console.error(modelSlug,locale,error.message));
   await page.route('**/api/**', route=>{throw Error('No API calls permitted in marketing capture: '+route.request().url());});
   await page.goto(fixture.url,{waitUntil:'networkidle'});
   await page.locator('main').waitFor();
   if(modelSlug==='seedance-2-5') await page.getByRole('combobox').selectOption('4k');
   await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));
   const bytes=await page.locator('main').screenshot();const result=await sharp(bytes).webp({quality:88}).toBuffer({resolveWithObject:true});
   const sha256=createHash('sha256').update(result.data).digest('hex');const url='/assets/model-examples/workspace-controls/'+sha256+'.webp';
   const destination=path.join(outputRoot,'frontend/public'+url);
   await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,result.data);
   captures.push({url,sha256,width:result.info.width,height:result.info.height});
   await page.close();}
   const component=modelSlug==='seedance-2-5'?'SeedanceDraftFinalAction':'LumaRay32KeyframeEditor';
   const componentPath=modelSlug==='seedance-2-5'?'components/library/SeedanceDraftFinalAction.client.tsx':'app/(core)/(workspace)/app/_components/LumaRay32KeyframeEditor.tsx';
   entries.push({modelSlug,locale,...captures[0],mobile:captures[1],component,capturedAt:'2026-11-17',sourceSha256:createHash('sha256').update(await readFile(path.join(sourceRoot,'frontend',componentPath))).digest('hex')});
  }finally{await fixture.close();}
 }}finally{await browser.close();}
 const manifestPath=path.join(outputRoot,'frontend/config/model-cinematic-workspace-previews.json');
 const previous=JSON.parse(await readFile(manifestPath,'utf8'));
 await writeFile(manifestPath,JSON.stringify({capturedAt:'2026-11-17',purpose:'Actual workspace components with example state; no generation or price quote',entries:[...entries,...previous.entries.filter((entry:{modelSlug:string})=>!selectedModels.includes(entry.modelSlug))]},null,2)+'\n');
 console.log(entries.map(e=>({model:e.modelSlug,locale:e.locale,size:[e.width,e.height]})));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
