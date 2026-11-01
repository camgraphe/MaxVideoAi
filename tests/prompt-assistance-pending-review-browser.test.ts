import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {NextRequest} from 'next/server';
import {chromium,webkit,expect} from '@playwright/test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {startWorkspaceReferenceFixture} from './helpers/workspace-reference-browser-fixture';
import {promptAssistanceReloadBrowserSource as source} from './helpers/prompt-assistance-reload-browser-source';

const config={engine:listFalEngines().find(x=>x.id==='wan-3-prime')!.engine,otherEngine:listFalEngines().find(x=>x.id==='wan-3')!.engine,companionEngine:listFalEngines().find(x=>x.id==='wan-2-6')!.engine};
const proposed='A station employee changes the final departure on a board. One continuous shot.';
const chatKey='milo-composer:v2:["owner","video","create"]';

test('a modern pending reply retains its original review baseline through real workspace and API restoration',{timeout:180_000},async t=>{
 const pg=await startDisposablePostgres('pending-review');
 const previousDatabase=process.env.DATABASE_URL,previousEnabled=process.env.STUDIO_ASSISTANCE_ENABLED;
 process.env.DATABASE_URL=pg.databaseUrl;process.env.STUDIO_ASSISTANCE_ENABLED='true';
 const {getDb}=await import('../frontend/src/lib/db');
 t.after(async()=>{await getDb().end();if(previousDatabase===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousDatabase;if(previousEnabled===undefined)delete process.env.STUDIO_ASSISTANCE_ENABLED;else process.env.STUDIO_ASSISTANCE_ENABLED=previousEnabled;await pg.cleanup();});
 await createPaidGenerationTestSchema(pg.pool);
 for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql','92_milo_reply_workers.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
 const {chooseStudioAssistance,readStudioAssistanceStatus}=await import('../frontend/src/server/studio/assistance-ledger');
 const {studioAssistancePolicy}=await import('../frontend/src/server/studio/assistance-policy');
 await chooseStudioAssistance('owner',{action:'select_sol',expectedRevision:0},studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'}));
 const {handlePromptAssistance}=await import('../frontend/src/server/prompt-assistance/route-handler');
 const {claimPromptRequest}=await import('../frontend/src/server/prompt-assistance/repository');
 const {readPromptAssistance}=await import('../frontend/src/server/prompt-assistance/service');
 const fixture=await startWorkspaceReferenceFixture({source,config,assistanceLive:true});
 t.after(()=>fixture.close());
 const scenarios=[{browserType:chromium,manual:'',kind:'success'},{browserType:chromium,manual:'An unrelated synthetic manual draft.',kind:'success'},{browserType:webkit,manual:'',kind:'success'},{browserType:chromium,manual:'A fresh manual revision.',kind:'stale-predecessor'},{browserType:chromium,manual:'',kind:'pending-predecessor'},
  ...['mounted','completed-before-restore','missing','corrupt','wrong-hash','wrong-request','wrong-status-identity','different-terminal-text','quota','digest-race','editor-roundtrip','companion-roundtrip','active-companion-roundtrip','model-roundtrip','mode-roundtrip','reference-roundtrip','unknown-roundtrip','soft-pending','older-proposal'].map(kind=>({browserType:chromium,manual:'',kind}))];
 for(const {browserType,manual,kind} of scenarios)await t.test(`${browserType.name()}, ${manual?'existing':'empty'} editor, ${kind}`,async t=>{
  const ownedRequests:{sessionId:string;requestId:string}[]=[];
  // A failed subcase must not leave its own synthetic request blocking the next; terminal history and financial rows stay intact.
  t.after(async()=>{for(const id of ownedRequests)await pg.pool.query("DELETE FROM prompt_assistance_requests WHERE user_id='owner' AND session_id=$1 AND request_id=$2 AND state IN ('preparing','calling','reported','unknown')",[id.sessionId,id.requestId]);});
  const browser=await browserType.launch();let releaseMessage:(()=>void)|undefined;
  try{
   const page=await browser.newPage({viewport:{width:390,height:1000}}),errors:string[]=[];let beforeRecovery=true;
   page.on('pageerror',error=>{if(browserType===webkit&&beforeRecovery&&error.message.endsWith('/api/prompt-assistance due to access control checks.'))return;errors.push(error.message);});
   const initialManual=kind==='stale-predecessor'?'':manual;
   const scenarioEngineId=kind==='active-companion-roundtrip'?config.companionEngine.id:config.engine.id;
   await page.addInitScript(({manual,engineId})=>{const key='maxvideoai.generate.form.v1:owner';if(localStorage.getItem(key)===null){localStorage.setItem(key,JSON.stringify({engineId,mode:'t2v',durationSec:6,durationOption:6,resolution:'720p',aspectRatio:'9:16',audio:false}));localStorage.setItem('maxvideoai.generate.prompt.v1:owner',manual);}},{manual:initialManual,engineId:scenarioEngineId});
   let request:any,messagePosts=0,recoveries=0,statusReads=0;
   await page.route('**/api/prompt-assistance*',async route=>{
    const body=route.request().method()==='POST'?route.request().postDataJSON():undefined;
    if(body?.action==='message'){
     messagePosts++;request=body.request;assert.equal(request.draft.text,kind==='stale-predecessor'&&messagePosts===1?initialManual:manual);assert.equal(request.draft.settings.aspectRatio,'9:16');assert.equal(request.draft.engineId,scenarioEngineId);assert.equal(request.draft.mode,'t2v');assert.deepEqual(request.draft.references,[]);
     if(['companion-roundtrip','active-companion-roundtrip'].includes(kind))assert.equal(request.draft.readOnlyText?.negativePrompt,undefined,'the empty companion is absent from the original request');
     const persisted=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!),chatKey);assert.equal(persisted.pending.requestId,request.requestId);
     if(['quota','digest-race'].includes(kind))assert.equal(persisted.pendingReview,undefined);else assert.equal(persisted.pendingReview.requestId,request.requestId,'the original proof must be durable before the message POST');
     // The optional E09 snapshot describes the original Wan 3 Prime fixture, not the added companion engine.
     if(process.env.E09_PREFLIGHT_PATH&&!manual&&kind!=='active-companion-roundtrip')assert.deepEqual(request.draft,JSON.parse(readFileSync(process.env.E09_PREFLIGHT_PATH,'utf8')).request.draft,'actual workspace serialization must match the private E09 input');
     if(kind==='older-proposal'){
      const older={...request,requestId:randomUUID(),message:'Earlier independent turn'};
      await claimPromptRequest('owner',older,studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'}),{enabled:true,executionOwner:'local'});
      ownedRequests.push({sessionId:older.sessionId,requestId:older.requestId});
      await pg.pool.query("UPDATE prompt_assistance_requests SET state='complete',reply_json=$1::jsonb WHERE user_id='owner' AND request_id=$2",[JSON.stringify({reply:'Earlier proposal.',text:proposed}),older.requestId]);
     }
     await claimPromptRequest('owner',request,studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'}),{enabled:true,executionOwner:'local'});
     ownedRequests.push({sessionId:request.sessionId,requestId:request.requestId});
     await pg.pool.query("UPDATE prompt_assistance_requests SET state='calling' WHERE user_id='owner' AND request_id=$1",[request.requestId]);
     if(kind.endsWith('predecessor')&&messagePosts===1){
      await pg.pool.query("UPDATE prompt_assistance_requests SET state='complete',reply_json=$1::jsonb WHERE user_id='owner' AND request_id=$2",[JSON.stringify({reply:'Earlier proposal.',text:'An earlier synthetic scene.'}),request.requestId]);
      await route.fulfill({json:{ok:true,result:await readPromptAssistance('owner',request.sessionId,request.requestId)}});return;
     }
     await new Promise<void>(resolve=>releaseMessage=resolve);
     if(kind==='mounted'){
      await pg.pool.query("UPDATE prompt_assistance_requests SET state='complete',reply_json=$1::jsonb WHERE user_id='owner' AND request_id=$2",[JSON.stringify({reply:'Revisa la propuesta.',text:proposed}),request.requestId]);
      await route.fulfill({json:{ok:true,result:await readPromptAssistance('owner',request.sessionId,request.requestId)}});return;
     }
     await route.fulfill({json:{ok:true,result:{sessionId:request.sessionId,requestId:request.requestId,draftRevision:request.draftRevision,target:'prompt',message:request.message,state:'pending',assistance:await readStudioAssistanceStatus('owner')}}}).catch(()=>{});return;
    }
    if(body?.action==='recover'){
     recoveries++;assert.equal(body.sessionId,request.sessionId);assert.equal(body.requestId,request.requestId);
     await pg.pool.query("UPDATE prompt_assistance_requests SET state='complete',reply_json=$1::jsonb WHERE user_id='owner' AND request_id=$2",[JSON.stringify({reply:'Revisa la propuesta.',text:kind==='older-proposal'?null:proposed}),request.requestId]);
    }
    const url=new NextRequest(route.request().url()).nextUrl;
    if(url.searchParams.has('requestId'))statusReads++;
    const response=await handlePromptAssistance(new NextRequest(url,body?{method:'POST',headers:{origin:url.origin,'content-type':'application/json'},body:JSON.stringify(body)}:undefined),{enabled:true,access:async()=>({ok:true,userId:'owner'} as never)});
    const payload=await response.json();assert.equal(payload.ok,true,payload.error);
    if(url.searchParams.has('requestId')&&kind==='wrong-status-identity')payload.result.requestId=randomUUID();
    if(url.searchParams.has('requestId')&&kind==='different-terminal-text')payload.result.reply.text='Another identity-bound terminal proposal.';
    await route.fulfill({status:response.status,json:payload});
   });
   await page.goto(fixture.url);await expect(page.locator('[data-workspace-prompt]')).toHaveValue(initialManual);
   if(['companion-roundtrip','active-companion-roundtrip'].includes(kind))await expect(page.locator('input[type="text"]')).toHaveCount(kind==='active-companion-roundtrip'?1:0);
   await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
   if(kind==='quota')await page.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('milo-composer:')&&value.includes('"pendingReview":'))throw new DOMException('Synthetic quota refusal','QuotaExceededError');return write.call(this,key,value);};});
   if(kind==='digest-race')await page.evaluate(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle),waiting:(()=>Promise<void>)[]=[];
    crypto.subtle.digest=(algorithm,data)=>new Promise<ArrayBuffer>((resolve,reject)=>waiting.push(async()=>{try{resolve(await digest(algorithm,data));}catch(error){reject(error);}}));
    (globalThis as any).releaseReviewDigests=async()=>{crypto.subtle.digest=digest;await Promise.all(waiting.splice(0).map(run=>run()));};
   });
   await page.locator('[data-assistance-message]').fill('Quiero una escena breve en una estación con un tablero de salidas.');await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();
   if(kind.endsWith('predecessor')){
    await expect(page.locator('[data-assistance-apply]')).toBeEnabled();await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!)?.local?.proposal?.review?.compatible,chatKey)).toBe(true);
    if(kind==='stale-predecessor'){await page.evaluate(manual=>(globalThis as any).workspaceActions.setPrompt(manual),manual);await expect(page.locator('[data-workspace-prompt]')).toHaveValue(manual);}
    await page.locator('[data-assistance-message]').fill('Ahora una escena independiente en la estación.');await page.getByRole('button',{name:'Send message to Milo',exact:true}).click();
   }
   if(kind==='digest-race'){
    assert.equal(messagePosts,0,'a model request cannot precede its baseline capture');
    for(const text of ['An intervening manual edit','']){await page.evaluate(text=>(globalThis as any).workspaceActions.setPrompt(text),text);await expect(page.locator('[data-workspace-prompt]')).toHaveValue(text);}
    await page.evaluate(()=>(globalThis as any).releaseReviewDigests());
   }
   await expect.poll(()=>!!releaseMessage).toBe(true);await expect(page.getByText('Milo is writing…',{exact:true})).toBeVisible();
   const baseline=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pendingReview,chatKey);
   if(['quota','digest-race'].includes(kind))assert.equal(baseline,undefined);else{
    assert.equal(baseline.requestId,request.requestId);assert.equal(baseline.settings.aspectRatio,'9:16');assert.equal(baseline.compatible,true);assert.match(baseline.draftFingerprint,/^[a-f0-9]{64}$/);assert.match(baseline.compatibilityFingerprint,/^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(baseline).sort(),['version','requestId','settings','compatible','draftFingerprint','compatibilityFingerprint'].sort());
   }
   if(['missing','corrupt','wrong-hash','wrong-request'].includes(kind))await page.evaluate(({chatKey,kind})=>{const saved=JSON.parse(sessionStorage.getItem(chatKey)!);if(kind==='missing')delete saved.pendingReview;else if(kind==='corrupt')saved.pendingReview.draftFingerprint='corrupt';else if(kind==='wrong-hash')saved.pendingReview.compatibilityFingerprint='0'.repeat(64);else saved.pendingReview.requestId=crypto.randomUUID();sessionStorage.setItem(chatKey,JSON.stringify(saved));},{chatKey,kind});
   if(kind.endsWith('-roundtrip')){
    for(const restore of [false,true]){
     if(kind==='active-companion-roundtrip'){
      const input=page.locator('input[type="text"]');await expect(input).toBeVisible();await input.fill(restore?'':'An intervening companion edit');await expect(input).toHaveValue(restore?'':'An intervening companion edit');
     }else await page.evaluate(({kind,restore})=>{const a=(globalThis as any).workspaceActions;
     if(kind==='editor-roundtrip')a.setPrompt(restore?'':'An intervening manual edit');
     if(kind==='companion-roundtrip')a.setNegativePrompt(restore?'':'An intervening companion edit');
     if(kind==='model-roundtrip')a.setForm((f:any)=>({...f,engineId:restore?'wan-3-prime':'wan-3'}));
     if(kind==='mode-roundtrip')a.setForm((f:any)=>({...f,mode:restore?'t2v':'v2v'}));
     if(kind==='reference-roundtrip')a.setInputAssets(restore?{}:{image_url:[{id:'synthetic-reference',name:'Synthetic',kind:'image',status:'ready',ref:{type:'asset',assetId:'synthetic-reference',kind:'image'}}]});
     if(kind==='unknown-roundtrip')a.setForm((f:any)=>({...f,extraInputValues:restore?{}:{unsupportedControl:'changed'}}));
     },{kind,restore});
     if(['companion-roundtrip','active-companion-roundtrip'].includes(kind)){
      await expect.poll(()=>page.evaluate(()=>localStorage.getItem('maxvideoai.generate.negativePrompt.v1:owner'))).toBe(restore?'':'An intervening companion edit');
      await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pendingReview?.compatible,chatKey)).toBe(kind==='companion-roundtrip');
     }
    }
    if(kind==='companion-roundtrip')await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pendingReview?.compatible,chatKey)).toBe(true);
    else await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!).pendingReview?.compatible,chatKey)).toBe(false);
   }
   if(kind==='soft-pending')await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('16:9');
   if(kind==='completed-before-restore')await pg.pool.query("UPDATE prompt_assistance_requests SET state='complete',reply_json=$1::jsonb WHERE user_id='owner' AND request_id=$2",[JSON.stringify({reply:'Revisa la propuesta.',text:proposed}),request.requestId]);
   if(kind==='mounted')releaseMessage?.();else{await page.reload();releaseMessage?.();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();}
   if(!['mounted','completed-before-restore'].includes(kind)){
    await expect(page.getByRole('button',{name:'Check reply',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Send message to Milo',exact:true})).toBeDisabled();
    if(kind==='pending-predecessor')assert.equal(statusReads,0,'the real session read keeps the completed predecessor identity while the new reply is calling');
    beforeRecovery=false;await page.getByRole('button',{name:'Check reply',exact:true}).click();
   }
   if(kind==='wrong-status-identity'){
    await expect(page.getByRole('button',{name:'Retry loading chat',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Send message to Milo',exact:true})).toBeDisabled();await expect(page.locator('[data-assistance-proposal]')).toHaveCount(0);
    assert.equal(messagePosts,1);assert.equal(recoveries,1);assert.equal(statusReads,1);return;
   }
   await expect(page.locator('[data-assistance-proposal]')).toBeVisible();beforeRecovery=false;
   if(kind!=='soft-pending'&&(!kind.endsWith('-roundtrip')||kind==='companion-roundtrip'))await expect(page.locator('[data-assistance-apply]')).toBeEnabled();
   await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('16:9');
   if(!['success','soft-pending','mounted','completed-before-restore','stale-predecessor','pending-predecessor','companion-roundtrip'].includes(kind)){
    await expect(page.getByRole('button',{name:'Review & use',exact:true})).toHaveCount(0);await expect(page.locator('[data-assistance-apply]')).toBeDisabled();
    if(kind==='older-proposal')assert.equal(statusReads,1,'terminal status must not lend a text-less reply identity to the older snapshot proposal');
    assert.equal(messagePosts,1);assert.equal(recoveries,1);assert.deepEqual(errors,[]);return;
   }
   await expect(page.getByRole('button',{name:'Review & use',exact:true})).toBeEnabled();
   await expect.poll(()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!)?.local?.proposal?.review?.compatible,chatKey)).toBe(true);
   await page.reload();await page.getByRole('tab',{name:'AI assistant',exact:true}).click();
   await page.getByRole('button',{name:'Review & use',exact:true}).click();assert.equal((await page.locator('[data-assistance-proposal]').boundingBox())!.height,53);
   await expect(page.locator('[data-assistance-settings-changes]')).toContainText('9:16');await expect(page.locator('[data-assistance-settings-changes]')).toContainText('16:9');
   if(process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR&&kind==='success'&&!manual)await page.screenshot({path:process.env.PROMPT_ASSISTANCE_EVIDENCE_DIR+`/pending-review-${browserType.name()}.png`,fullPage:true});
   await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('9:16');await expect(page.getByRole('button',{name:'Use with current settings',exact:true})).toBeDisabled();
   await page.getByRole('combobox',{name:'Aspect ratio',exact:true}).selectOption('16:9');await page.getByRole('button',{name:'Review changes',exact:true}).click();
   await expect(page.locator('[data-workspace-prompt]')).toHaveValue(manual);await page.getByRole('button',{name:'Use with current settings',exact:true}).click();
   await expect(page.locator('[data-workspace-prompt]')).toHaveValue(proposed);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('[data-workspace-prompt]')).toHaveValue(manual);
   await expect(page.getByRole('combobox',{name:'Aspect ratio',exact:true})).toHaveValue('16:9');assert.equal(messagePosts,kind.endsWith('predecessor')?2:1);assert.equal(recoveries,['mounted','completed-before-restore'].includes(kind)?0:1);assert.deepEqual(errors,[]);
  }finally{releaseMessage?.();await browser.close();}
 });
});
