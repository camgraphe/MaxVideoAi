import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {initialStatus} from './helpers/milo-status-fixture';

const imageSource=`import {useState} from 'react';import{createRoot}from'react-dom/client';import{Composer}from'./components/Composer';import{I18nProvider}from'./lib/i18n/I18nProvider';
const config=globalThis.fixtureConfig;function Fixture(){const[assets,setAssets]=useState(config.assets),[prompt,setPrompt]=useState('Keep the original image draft.');
globalThis.referenceUpload=ready=>setAssets(current=>({...current,reference_images:current.reference_images.map((asset,index)=>index?asset:{...asset,status:ready?'ready':'uploading',...(ready?{assetId:'ma_'+'c'.repeat(32)}:{})})}));
return <I18nProvider locale="en" dictionary={{}} fallback={{}}><Composer density="workspace" engine={config.engine} prompt={prompt} onPromptChange={setPrompt}
assetFields={config.fields} assets={assets} price={1} currency="USD" isLoading={false} onGenerate={()=>{throw Error('No generation');}}
onAssetRemove={(field,index)=>setAssets(current=>({...current,[field.id]:current[field.id].map((asset,i)=>i===index?null:asset)}))}
assistance={{accountKey:'owner',scopeKey:'image-preflight',contextKey:'image',live:{surface:'image',workflow:'edit',engineId:config.engine.id,mode:'i2i',settings:{resolution:'2k',aspectRatio:'16:9'},references:[]}}}/></I18nProvider>;}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const audioSource=`import{useState}from'react';import{createRoot}from'react-dom/client';import{AudioCreationEditor}from'./app/(core)/(workspace)/app/audio/_components/AudioCreationEditor';import{audioCreationCopy}from'./app/(core)/(workspace)/app/audio/_lib/audio-creation-copy';import{newAudioDraft}from'./src/lib/audio-creation';
function Fixture(){const[draft,setDraft]=useState({...newAudioDraft('voice'),script:'Keep the spoken script.',reference:{name:'legacy.wav',url:'/legacy.wav'}}),[uploading,setUploading]=useState(false);
globalThis.finishAudioUpload=()=>{setUploading(false);setDraft(current=>({...current,reference:{name:'replacement.wav',url:'/replacement.wav',ref:{type:'asset',assetId:'ma_'+'d'.repeat(32),kind:'audio'}}}));};
return <AudioCreationEditor assistanceAccountId="owner" intent="voice" draft={draft} copy={audioCreationCopy('en')} onChange={patch=>setDraft(current=>({...current,...patch}))}
onFile={()=>{globalThis.uploads=(globalThis.uploads??0)+1;setUploading(true);}} uploading={uploading} onLibrary={()=>{}}/>;}createRoot(document.getElementById('root')).render(<Fixture/>);`;

for(const surface of ['image','audio']as const)test(`shared ${surface} preflight names the missing identity, manages the existing input and waits for upload`,{timeout:90000},async()=>{
 const engine=getFalEngineById('seedream')!.engine;
 const asset={id:'legacy',kind:'image',status:'ready',name:'image.png',url:'/first.svg',previewUrl:'/first.svg',type:'image/png',size:1024};
 const config=surface==='image'?{engine,fields:[{field:{id:'reference_images',type:'image',label:'References',maxCount:14,modes:['i2i']},required:false}],assets:{reference_images:[asset,{...asset,id:'kept',url:'/second.svg',previewUrl:'/second.svg',ref:{type:'job-output',jobId:'owned-job',outputId:'owned-output',kind:'image'}}]}}:{};
 const fixture=await startWorkspaceReferenceFixture({source:surface==='image'?imageSource:audioSource,config,assistanceLive:true}),browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:900}}),calls:any[]=[];
  await page.route('**/api/prompt-assistance*',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:initialStatus}});const body=route.request().postDataJSON();calls.push(body);const r=body.request;return route.fulfill({json:{ok:true,result:{sessionId:r.sessionId,requestId:r.requestId,state:'complete',reply:{reply:'Ready after explicit send.',text:null}}}});});
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Milo',exact:true});await input.fill('Keep my pending message.');await input.press('Enter');
  const label=surface==='image'?'Image 1':'Audio 1';await expect(page.getByText(new RegExp(`${label}.*isn’t ready for Milo`))).toBeVisible();assert.equal(calls.length,0);
  const manage=page.getByRole('button',{name:`Manage ${label}`,exact:true});await manage.focus();
  if(surface==='image'){
   await manage.press('Enter');const popup=page.getByRole('dialog');await expect(popup).toBeVisible();
   await expect(popup.locator('[data-reference-selected="true"]')).toHaveAttribute('data-asset-index','0');
   await popup.getByRole('button',{name:'Close',exact:true}).click();
   await page.evaluate(()=>(globalThis as any).referenceUpload(false));await input.press('Enter');assert.equal(calls.length,0);
   await page.evaluate(()=>(globalThis as any).referenceUpload(true));
  }else{
   const chooser=page.waitForEvent('filechooser');await manage.press('Enter');await(await chooser).setFiles({name:'replacement.wav',mimeType:'audio/wav',buffer:Buffer.from('synthetic audio')});
   assert.equal(await page.evaluate(()=>(globalThis as any).uploads),1);await expect(page.getByRole('button',{name:'Send message to Milo'})).toBeDisabled();assert.equal(calls.length,0);
   await page.evaluate(()=>(globalThis as any).finishAudioUpload());
  }
  await expect(page.getByRole('button',{name:`Manage ${label}`,exact:true})).toHaveCount(0);await expect(input).toHaveValue('Keep my pending message.');assert.equal(calls.length,0);
  await input.press('Enter');await expect(page.getByText('Ready after explicit send.')).toBeVisible();assert.equal(calls.length,1);
  assert.equal(calls[0].request.draft.text,surface==='image'?'Keep the original image draft.':'Keep the spoken script.');
  if(surface==='image'){assert.equal(calls[0].request.draft.references[0].fieldId,'image_urls');assert.equal(calls[0].request.draft.references[1].ref.outputId,'owned-output');}
 }finally{await browser.close();await fixture.close();}
});
