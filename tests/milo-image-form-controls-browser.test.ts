import assert from 'node:assert/strict';
import test from 'node:test';
import {join} from 'node:path';
import {chromium,webkit,expect,type Page} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {STUDIO_ASSISTANCE_CREDIT_TARIFF,STUDIO_ASSISTANCE_TERRA_TARIFF} from '../frontend/src/lib/studio/assistance-contract';
import {initialStatus} from './helpers/milo-status-fixture';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';

const source=`import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {I18nProvider} from './lib/i18n/I18nProvider';
import {ImageWorkspaceComposerSurface} from './app/(core)/(workspace)/app/image/_components/ImageWorkspaceComposerSurface';
import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
const config=globalThis.fixtureConfig,noop=()=>{};globalThis.formRuns=[];
const setters=Object.fromEntries(['setAspectRatio','setBackground','setCustomImageHeight','setCustomImageWidth','setEnableWebSearch','setError','setLimitGenerations','setMaskUrl','setMode','setNumImagesPreset','setOutputFormat','setQuality','setResolutionPreset','setSeed','setSelectedPreviewImageIndex','setStyle','setThinkingLevel','setWatermark'].map(key=>[key,noop]));
const flags=Object.fromEntries(['AspectRatio','Background','CustomImageSize','EnableWebSearch','LimitGenerations','MaskUrl','NumImages','OutputFormat','Quality','Resolution','Seed','Style','ThinkingLevel','Watermark'].map(key=>['show'+key+'Control',false]));
function Fixture(){const [prompt,setPrompt]=useState('An authored synthetic portrait with a nonempty image prompt.');return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main style={{maxWidth:980,margin:'auto',padding:16}}>
<ImageWorkspaceComposerSurface {...setters} {...flags} assistanceAccountId="owner" mode="t2i" numImages={1} resolution="2k" aspectRatio="1:1" quality={null} enableWebSearch={false} customImageWidth="" customImageHeight=""
 selectedEngineId={config.engine.id} engineCapsList={[config.engine]} selectedEngineCaps={config.engine} setEngineId={noop} resolvedCopy={DEFAULT_COPY} advancedSettingsTitle="Options" compositePreviewEntry={null} selectedPreviewImageIndex={0} previewEntry={undefined} copiedUrl={null} currency="USD" estimatedCostAmount={0.07}
 composerError={null} composerReferenceAssets={{}} referenceAssetFields={[]} prompt={prompt} setPrompt={setPrompt} pendingGenerations={[]} statusMessage={null} imageCountOptions={[]} aspectRatioSelectOptions={[]} booleanSelectOptions={[]} backgroundSelectOptions={[]} outputFormatSelectOptions={[]} qualitySelectOptions={[]} resolutionSelectOptions={[]} styleSelectOptions={[]} thinkingLevelSelectOptions={[]}
 background={null} outputFormat={null} style={null} thinkingLevel={null} seed="" maskUrl="" limitGenerations={false} watermark={false} isInLibrary={false} isRemovingFromLibrary={false} isSavingToLibrary={false} isResolutionLocked={false}
 handleRun={event=>{event?.preventDefault();globalThis.formRuns.push({source:event?'submit':'generate',submitter:event?.nativeEvent?.submitter?.textContent??null});}} handleAddToLibrary={noop} handleCopy={noop} handleDownload={noop} handleEditSelectedPreview={noop} handleOpenHistoryEntry={noop} handleReferenceFile={noop} handleReferenceUrl={noop} handleRemoveFromLibrary={noop} handleRemoveReferenceSlot={noop} openLibraryForSlot={noop}/>
</main></I18nProvider>};createRoot(document.getElementById('root')).render(<Fixture/>);`;

async function noMediaRun(page:Page,label:string){assert.deepEqual(await page.evaluate(()=>(globalThis as any).formRuns),[],`${label} must not invoke the real Image host handler`);}

for(const browserType of [chromium,webkit])test(`Milo controls never submit the real Image form (${browserType.name()})`,{timeout:90_000},async()=>{
 const engine=listFalEngines().find(x=>x.id==='nano-banana-2')!.engine;
 const fixture=await startWorkspaceReferenceFixture({source,config:{engine},assistanceLive:true,hostModules:{
  'next/link':`import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>;}`,
  'next/image':`import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>;}`,
  'next/navigation':`export function useSearchParams(){return new URLSearchParams();}export function usePathname(){return '/app/image';}export function useRouter(){return {push(){},replace(){},prefetch(){}};}export function redirect(){throw Error('Unexpected navigation');}export const permanentRedirect=redirect;`,
 }}),browser=await browserType.launch();
 try{
  const page=await browser.newPage({viewport:{width:browserType===webkit?390:1440,height:1000}}),errors:string[]=[],choices:any[]=[];page.on('pageerror',error=>errors.push(error.message));
  let status=structuredClone({...initialStatus,credits:{...initialStatus.credits!,purchased:{total:2000,remaining:1280,reserved:0,packs:[{id:'local-existing',amountCents:200,total:2000,remaining:1280,reserved:0,purchasedAt:'2026-10-01T00:00:00Z'}]}}}),rejectChoice=false;
  await page.route('**/api/prompt-assistance*',route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:status}});
   const body=route.request().postDataJSON();assert.equal(body.action,'choose','these controls may only send their dedicated choice, never a model message');const choice=body.choice;choices.push(choice);
   if(rejectChoice){rejectChoice=false;return route.fulfill({status:409,json:{ok:false,error:'CONFIRMATION_REQUIRED'}});}
   assert.equal(choice.expectedRevision,status.revision);
   if(choice.action.startsWith('select_')){status.selectedModel=choice.action==='select_luna'?'gpt-6-luna':choice.action==='select_terra'?'gpt-6.1-terra':'gpt-6.1-sol';status.mode=choice.action==='select_luna'?'sponsored_luna':'included_sol';status.tariff=choice.action==='select_terra'?STUDIO_ASSISTANCE_TERRA_TARIFF:STUDIO_ASSISTANCE_CREDIT_TARIFF;}
   if(choice.action==='purchase_pack'){const total=choice.amountCents*10;status.credits.purchased.packs.push({id:`local-${status.revision}`,amountCents:choice.amountCents,total,remaining:total,reserved:0,purchasedAt:'2026-10-30T00:00:00Z'});status.credits.purchased.total+=total;status.credits.purchased.remaining+=total;}
   if(choice.action==='purchase_pack'||choice.action==='resume_paid')status.paid.enabled=true;
   if(choice.action==='disable_paid')status.paid.enabled=false;
   status.revision++;return route.fulfill({json:{ok:true,result:status}});
  });
  await page.goto(fixture.url);await expect(page.locator('form.app-image-composer')).toBeVisible();await expect(page.locator('[data-workspace-prompt]')).not.toHaveValue('');
  await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await noMediaRun(page,'Opening the assistant');
  const opener=page.getByRole('button',{name:'Milo settings and credits',exact:true});
  const open=async()=>{await opener.click();await expect(page.getByRole('dialog')).toBeVisible();await noMediaRun(page,'Opening Milo settings');};
  const click=async(name:string)=>{await page.getByRole('button',{name,exact:true}).click();await noMediaRun(page,name);};
  await open();await click('Standard');assert.deepEqual(choices,[],'Inspecting Standard leaves the account unchanged');
  await click('Continue with Standard');await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(choices.at(-1).action,'select_terra');
  await open();await click('Max');await click('Continue with Max');await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(choices.at(-1).action,'select_sol');
  await open();await click('Lite');await click('Explore Max');await click('Explore Lite');await click('Continue with Lite');await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(choices.at(-1).action,'select_luna');
  await open();await click('Standard');
  const packs=page.getByRole('group',{name:'Milo pack price',exact:true});for(const name of ['$2 2,000 credits','$5 5,000 credits','$10 10,000 credits']){await packs.getByRole('button',{name,exact:true}).click();await noMediaRun(page,name);}
  const beforePurchase=choices.length;await click('Buy $10 Milo pack');assert.equal(choices.length,beforePurchase);await click('Back to assistance');await click('Buy $10 Milo pack');
  if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR)await page.screenshot({path:join(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR,`image-form-milo-${browserType.name()}.png`),fullPage:true});
  await click('Confirm purchase · $10');await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(choices.at(-1).action,'purchase_pack');assert.equal(choices.at(-1).amountCents,1000);assert.match(choices.at(-1).purchaseKey,/^[a-f0-9-]{36}$/);
  await open();await click('Standard');await click('Pause purchased Milo usage');await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(choices.at(-1).action,'disable_paid');
  await open();await click('Standard');await click('Resume purchased Milo usage');await expect(page.getByRole('dialog')).toHaveCount(0);assert.equal(choices.at(-1).action,'resume_paid');
  await open();await click('Max');rejectChoice=true;await click('Continue with Max');await expect(page.getByRole('alert')).toBeVisible();await click('Refresh usage');await expect(page.getByRole('alert')).toHaveCount(0);
  await click('Close assistance');await expect(page.getByRole('dialog')).toHaveCount(0);
  await open();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await noMediaRun(page,'Escape');
  await open();await page.getByRole('button',{name:'Standard',exact:true}).focus();await page.keyboard.press('Enter');await noMediaRun(page,'Keyboard Standard');await click('Close assistance');
  assert.deepEqual(errors,[]);
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();
  await page.getByRole('button',{name:/^Generate/}).click();assert.deepEqual(await page.evaluate(()=>(globalThis as any).formRuns),[{source:'generate',submitter:null}],'the real dedicated Generate control must still invoke its host handler exactly once');
 }finally{await browser.close();await fixture.close();}
});
