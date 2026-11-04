import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import test from 'node:test';
import {chromium,expect} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {miloGenerationVideoSource} from './helpers/milo-generation-authorization-video-source';
import {initialStatus} from './helpers/milo-status-fixture';

const DRAFT='Keep the station camera move and the original timing.';
const MESSAGE='Use the first reference for the station lighting.';
const engine=listFalEngines().find(entry=>entry.id==='seedance-2-5')!.engine;
const image=(id:string)=>({id,assetId:id,fieldId:'image_urls',kind:'image',status:'ready',name:`${id}.png`,url:`/${id}.svg`,previewUrl:`/${id}.svg`,type:'image/png',size:1024,width:1280,height:720});
const config={engine,form:{engineId:engine.id,mode:'v2v',durationSec:8,durationOption:8,resolution:'720p',aspectRatio:'16:9',fps:24,iterations:1,audio:true,seedLocked:false,loop:false,extraInputValues:{}},
 inputAssets:{video_url:[{id:'owned-source',assetId:'owned-source',fieldId:'video_url',kind:'video',status:'ready',name:'Source.mp4',url:'/source.mp4',previewUrl:'/source.mp4',thumbnailUrl:'/first.svg',type:'video/mp4',size:1024,width:1280,height:720,durationSec:8}],image_urls:[image('deleted-reference'),image('kept-reference')]},
 preflight:{ok:true,currency:'USD',total:707,pricing:{totalCents:707,currency:'USD'}}};
// Mount the real Modify surface and generation owner. Only media storage and network are local fixtures.
const source=miloGenerationVideoSource
 .replace("useState('ref2v')","useState('v2v')")
 .replace('useState(DEFAULT_PROMPT)',`useState(${JSON.stringify(DRAFT)})`)
 .replace('activeManualMode={null}','activeManualMode="v2v"')
 .replace('handleAssetRemove={noop}',`handleAssetRemove={(field,index)=>setAssets(current=>({...current,[field.id]:current[field.id].map((asset,slot)=>slot===index?null:asset)}))}`)
 .replace('handleAssetAdd={noop}',`handleAssetAdd={(field,file,index,dimensions)=>setAssets(current=>({...current,[field.id]:current[field.id].map((asset,slot)=>slot===index?{id:'replacement-reference',assetId:'replacement-reference',fieldId:field.id,kind:'image',status:'ready',name:file.name,url:'/replacement.svg',previewUrl:'/replacement.svg',type:file.type,size:file.size,...dimensions}:asset)}))}`);

for(const width of [1440,390])test(`Modify can identify and ${width===1440?'remove':'replace'} Milo's unavailable reference without losing the message or video draft (${width}px)`,{timeout:90000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width,height:1000}}),requests:any[]=[],errors:string[]=[],unexpected:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==new URL(fixture.url).origin){unexpected.push(url.href);return route.abort('blockedbyclient');}
   if(url.pathname==='/api/prompt-assistance'){
    if(request.method()==='GET'){
     if(url.searchParams.has('requestId')){const req=requests[0];return route.fulfill({json:{ok:true,result:{sessionId:req.sessionId,requestId:req.requestId,draftRevision:req.draftRevision,target:'prompt',message:req.message,assistance:initialStatus,state:'failed',safeToRetry:true,error:'MEDIA_NOT_AVAILABLE',unavailableReference:{fieldId:'image_urls',slot:0}}}});}
     return route.fulfill({json:{ok:true,result:initialStatus}});
    }
    const body=request.postDataJSON();assert.equal(body.action,'message');const req=body.request;requests.push(req);
    return route.fulfill({json:{ok:true,result:{sessionId:req.sessionId,requestId:req.requestId,draftRevision:req.draftRevision,target:'prompt',message:req.message,assistance:initialStatus,
     ...(requests.length===1?width===390?{state:'pending',phase:'queued',deadlineAt:new Date(Date.now()+60000).toISOString()}:{state:'failed',safeToRetry:true,error:'MEDIA_NOT_AVAILABLE',unavailableReference:{fieldId:'image_urls',slot:0}}:{state:'complete',reply:{reply:'The remaining references are available.',text:null}})}}});
   }
   if(url.pathname.startsWith('/api/')){unexpected.push(url.pathname);return route.abort('blockedbyclient');}
   return route.continue();
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Milo',exact:true});await input.fill(MESSAGE);await page.getByRole('button',{name:'Send message to Milo'}).click();
  await expect(page.getByText('The Image 1 attached to this message is unavailable.',{exact:false})).toBeVisible();
  await expect(input).toHaveValue(MESSAGE);await expect(page.getByRole('button',{name:'Check reply',exact:true})).toHaveCount(0);
  assert.equal(requests.length,1,'a reference failure must never automatically resend');
  const evidence=process.env.MILO_REFERENCE_RECOVERY_EVIDENCE_DIR;if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:join(evidence,`unavailable-reference-${width}.png`),fullPage:true});}
  await page.getByRole('button',{name:'Manage · Image 1',exact:true}).click();
  const picker=page.getByRole('dialog',{name:'Optional references',exact:true});await expect(picker).toBeVisible();
  const selected=picker.locator('[data-reference-selected="true"]');await expect(selected).toHaveAttribute('data-asset-index','0');await expect(selected).toContainText('Image 1');
  if(width===390){
   const chooser=page.waitForEvent('filechooser');await selected.getByRole('button',{name:'Replace · Image 1',exact:true}).click();
   await (await chooser).setFiles(join(process.cwd(),'frontend/public/assets/marketing/reference-workflow-source-image.webp'));
   await expect(selected.locator('img')).toHaveAttribute('src','/replacement.svg');
   if(evidence)await page.screenshot({path:join(evidence,`replacement-reference-${width}.png`),fullPage:true});
  }
  await picker.getByRole('button',{name:'Close',exact:true}).click();
  if(width===1440)await page.getByRole('button',{name:'Remove · Image 1',exact:true}).click();
  await expect(page.locator('.app-reference-selected-item')).toHaveCount(width===1440?2:3);await expect(input).toHaveValue(MESSAGE);
  await page.getByRole('button',{name:'Send message to Milo'}).click();await expect(page.getByText('The remaining references are available.',{exact:true})).toBeVisible();
  assert.equal(requests.length,2);assert.equal(requests[1].sessionId,requests[0].sessionId);assert.notEqual(requests[1].requestId,requests[0].requestId);
  assert.equal(requests[1].message,MESSAGE);assert.equal(requests[1].draft.text,DRAFT);assert.equal(requests[1].draft.workflow,'modify');assert.equal(requests[1].draft.mode,'v2v');
  assert.deepEqual(requests[1].draft.settings,requests[0].draft.settings,'removal must keep every generation setting');
  assert.deepEqual(requests[1].draft.references.map((ref:any)=>ref.ref.assetId),width===1440?['kept-reference','owned-source']:['replacement-reference','kept-reference','owned-source']);
  await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(DRAFT);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }finally{await browser.close();await fixture.close();}
});

test('unverified or historical reference locations use generic guidance and never guess a current slot',{timeout:90000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage();let detail:any;const requests:any[]=[];
  await page.route('**/api/prompt-assistance*',route=>{
   if(route.request().method()==='GET')return route.fulfill({json:{ok:true,result:initialStatus}});
   const req=route.request().postDataJSON().request;requests.push(req);
   return route.fulfill({json:{ok:true,result:{sessionId:req.sessionId,requestId:req.requestId,draftRevision:req.draftRevision,target:'prompt',message:req.message,assistance:initialStatus,state:'failed',safeToRetry:true,error:'MEDIA_NOT_AVAILABLE',unavailableReference:detail}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Message Milo',exact:true});
  for(const location of [undefined,{fieldId:'image_urls',slot:99},{fieldId:'unverified_private_field',slot:0},{fieldId:'image_urls',slot:-1}]){
   detail=location;await input.fill(MESSAGE);await page.getByRole('button',{name:'Send message to Milo'}).click();
   await expect(page.getByText('A reference is unavailable. Open References to remove or replace it before resending.',{exact:true})).toBeVisible();
   await expect(input).toHaveValue(MESSAGE);assert.doesNotMatch(await page.locator('body').innerText(),/unverified_private_field|The Image 1 attached/);
  }
  assert.equal(requests.length,4);await expect(page.locator('.app-reference-selected-item')).toHaveCount(3);
 }finally{await browser.close();await fixture.close();}
});

test('a real reload recovers the submitted reference label and message without resending',{timeout:90000},async()=>{
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});const browser=await chromium.launch();
 try{
  const page=await browser.newPage();let original:any;let messages=0,recoveries=0;
  await page.route('**/api/prompt-assistance*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()==='GET')return route.fulfill({json:{ok:true,result:url.searchParams.has('sessionId')?{sessionId:original.sessionId,scope:'video:modify',status:'active',turns:recoveries?[{requestId:original.requestId,message:original.message,state:'failed',reply:null,error:'MEDIA_NOT_AVAILABLE'}]:[],pending:recoveries?null:{requestId:original.requestId},proposal:null}:initialStatus}});
   const body=request.postDataJSON();
   if(body.action==='message'){messages++;original=body.request;return route.abort('failed');}
   recoveries++;assert.equal(body.action,'recover');assert.equal(body.requestId,original.requestId);
   return route.fulfill({json:{ok:true,result:{sessionId:original.sessionId,requestId:original.requestId,draftRevision:original.draftRevision,target:'prompt',message:original.message,assistance:initialStatus,state:'failed',safeToRetry:true,error:'MEDIA_NOT_AVAILABLE',unavailableReference:{fieldId:'image_urls',slot:0}}}});
  });
  await page.goto(fixture.url);await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
  await page.getByRole('textbox',{name:'Message Milo',exact:true}).fill(MESSAGE);await page.getByRole('button',{name:'Send message to Milo'}).click();
  await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();
  const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('milo-composer:v2:["owner","video","modify"]')!).pending);
  assert.deepEqual(pending.references,[{fieldId:'image_urls',slot:0,label:'Image 1'},{fieldId:'image_urls',slot:1,label:'Image 2'},{fieldId:'video_url',slot:0,label:'Source video'}]);
  await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();await page.getByRole('button',{name:'Check reply',exact:true}).click();
  await expect(page.getByText('The Image 1 attached to this message is unavailable.',{exact:false})).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Message Milo',exact:true})).toHaveValue(MESSAGE);assert.equal(messages,1);assert.equal(recoveries,1);
  await expect(page.getByRole('button',{name:'Send message to Milo'})).toBeEnabled();
  await expect(page.locator('.app-reference-selected-item')).toHaveCount(3);await page.getByRole('tab',{name:'Prompt',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(DRAFT);
 }finally{await browser.close();await fixture.close();}
});
