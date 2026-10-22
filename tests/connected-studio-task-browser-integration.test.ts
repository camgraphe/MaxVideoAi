import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {expect} from '@playwright/test';
import {startStudioIntegrationRuntime,summarizeStudioReadinessFailure} from './helpers/studio-integration-runtime';
import {startStudioConnectedBrowserFixture} from './helpers/studio-connected-browser-fixture';
import {initializeStudioConnectedFixture} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {getDb} from '../frontend/src/lib/db';
import {createStudioConversationProject} from '../frontend/src/server/studio/conversation-project-command';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import type {ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';

const selectedImage='ma_'+'e'.repeat(32),selectedImageUrl='https://cdn.maxvideoai.com/studio-local-fixture/selected.webp';

test('Milo modes preserve model selection, credits, references and explicit consent on desktop and mobile',async()=>{
  const previous=process.env.DATABASE_URL;
  const runtime=await startStudioIntegrationRuntime({mcp:{studioMontageCreation:false},conversation:true,conversationTasks:true,initializeDatabase:async db=>{
    await initializeStudioConnectedFixture(db);
    for(const name of ['00_create_profiles.sql','01_legal_documents.sql','02_user_consents.sql','04_profiles_timestamps.sql','12_app_settings.sql','30_mcp_paid_generation.sql','39_mcp_quote_lifetime.sql','49_studio_generation_scope.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','65_studio_task_budgets.sql','67_studio_luna_reasoning.sql'])await db.pool.query(await readFile('neon/migrations/'+name,'utf8'));
    await db.pool.query('ALTER TABLE app_jobs ADD COLUMN status text');
    await db.pool.query('ALTER TABLE media_assets ADD COLUMN width integer, ADD COLUMN height integer, ADD COLUMN size_bytes bigint');
    await db.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,original_name,metadata) VALUES($1,$2,$3,'image',$4,'image/webp','ready','Selected product',$5::jsonb)`,[randomUUID(),selectedImage,STUDIO_FIXTURE_OWNERS[0],selectedImageUrl,JSON.stringify({mediaFacts:{source:'probe',width:1024,height:1024}})]);
    await db.pool.query(`CREATE TABLE user_account_restrictions(user_id text PRIMARY KEY,reason text NOT NULL,message text,active boolean NOT NULL DEFAULT true,restricted_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
  }});
  process.env.DATABASE_URL=runtime.database.databaseUrl;
  let browser:Awaited<ReturnType<typeof startStudioConnectedBrowserFixture>>|undefined;
  try{
    const project=await createStudioConversationProject({userId:STUDIO_FIXTURE_OWNERS[0]},{name:'Product study',idempotencyKey:randomUUID()},{featureEnabled:true});
    const session=runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0],{clientId:'task-browser-fixture'});
    browser=await startStudioConnectedBrowserFixture({runtime,browserName:'chromium'});
    const owned=await browser.newContext(session,{viewport:{width:1440,height:900},locale:'en-US',reducedMotion:'reduce'}),page=owned.page;
    const assistanceActions:string[]=[];page.on('request',request=>{if(request.url().endsWith('/api/studio/assistance')&&request.method()==='POST')assistanceActions.push(request.postDataJSON().action);});
    // Keep the real endpoint and cover a selection slower than the UI matcher's default wait.
    await page.route('**/api/studio/assistance',async route=>{
      if(route.request().method()==='POST'&&route.request().postDataJSON().action==='select_luna')await new Promise(resolve=>setTimeout(resolve,6000));
      await route.continue();
    });
    await page.route('**/api/legal/reconsent',route=>route.fulfill({json:{ok:true,needsReconsent:false,documents:[]}}));
    await page.route('**/api/wallet',route=>route.fulfill({json:{balance:0,balanceCents:0,currency:'USD'}}));
    const conversationPath=`/app/studio/conversation/${project.projectId}`;
    // This suite checks behavior, not compilation speed. Prepare the owned
    // dev routes with real authenticated GETs before the 30-second UI waiters.
    for(const path of [conversationPath,`/api/studio/projects/${project.projectId}/image-conversation`,'/api/studio/assistance']){
      const prepared=await owned.context.request.get(runtime.browserOrigin+path,{timeout:90_000,maxRedirects:0});
      assert.equal(prepared.status(),200,`Studio fixture preparation failed: ${path}`);
      await prepared.dispose();
    }
    const preparedReferences=await owned.context.request.post(runtime.browserOrigin+`/api/studio/projects/${project.projectId}/reference-previews`,{
      data:{refs:[{type:'asset',assetId:selectedImage,kind:'image'}]},headers:{origin:runtime.browserOrigin},timeout:90_000,
    });
    assert.equal(preparedReferences.status(),200,'Owned reference previews must be ready before visual checks');
    await preparedReferences.dispose();
    const loaded=page.waitForResponse(response=>response.url().endsWith('/image-conversation')&&response.request().method()==='GET',{timeout:30_000});
    const assistanceLoaded=page.waitForResponse(response=>response.url().endsWith('/api/studio/assistance')&&response.request().method()==='GET',{timeout:30_000});
    const [,initial,assistance]=await Promise.all([
      page.goto(runtime.browserOrigin+conversationPath),loaded,assistanceLoaded,
    ]);
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    const evidence=process.env.STUDIO_PROOF_DIRECTORY??'/tmp/studio-sol-review';await mkdir(evidence,{recursive:true});
    const initialBody=await initial.json();assert.equal(initial.status(),200,JSON.stringify(initialBody));assert.ok(initialBody.result.taskPolicyVersion);
    assert.equal(assistance.status(),200,JSON.stringify(await assistance.json()));
    const cookieReject=page.getByRole('button',{name:'Reject all',exact:true});
    if(await cookieReject.isVisible())await cookieReject.click();
    await page.route(selectedImageUrl,route=>route.fulfill({contentType:'image/webp',path:'frontend/public/media/mcp/project-demo/watch-static.webp'}));
    await page.route('**/api/media-library/assets?*',route=>route.fulfill({json:{ok:true,assets:[{assetId:selectedImage,kind:'image',name:'Selected product',url:selectedImageUrl}],nextCursor:null}}));
    await page.getByRole('button',{name:'Open library',exact:true}).click();
    await page.getByRole('button',{name:'Choose Selected product',exact:true}).click();
    await page.getByRole('button',{name:'Add to conversation',exact:true}).click();
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.getByRole('button',{name:'Remove Image 1',exact:true})).toBeVisible();
    const picker=page.getByRole('group',{name:'Work allowance'}),message=page.getByRole('textbox',{name:'Message Milo'});
    const selector=page.getByRole('button',{name:'Milo settings and credits',exact:true});
    const modes=page.getByRole('group',{name:'Milo mode',exact:true});
    const standard=modes.getByRole('button',{name:'Standard',exact:true}),max=modes.getByRole('button',{name:'Max',exact:true});
    const assistanceBody=await assistance.json();
    assert.equal(assistanceBody.result.selectedModel,'gpt-6.1-sol');assert.equal(assistanceBody.result.credits.included.remaining,500);
    await expect(max).toHaveAttribute('aria-pressed','true');await expect(picker).toHaveCount(0);
    const inputBox=await message.boundingBox(),modeBox=await modes.boundingBox();
    assert.ok(inputBox&&modeBox&&modeBox.y>=inputBox.y+inputBox.height,'Mode control follows the composer');
    assert.deepEqual(assistanceActions,[],'Loading the control must not switch the default model');
    assert.match(await page.title(),/Studio|MaxVideoAI/);assert.equal(new URL(page.url()).pathname,conversationPath);
    await expect(page.getByRole('img',{name:'Selected product',exact:true})).toBeVisible({timeout:30_000});
    await page.screenshot({path:join(evidence,'sol-start-desktop.png')});
    await page.screenshot({path:join(evidence,'studio-milo-preview.png'),clip:{x:86,y:68,width:1354,height:832}});
    await page.getByRole('button',{name:'Open MaxVideoAI menu',exact:true}).click();
    await page.getByRole('button',{name:'Dark',exact:true}).click();
    await page.getByRole('dialog',{name:'MaxVideoAI',exact:true}).getByRole('button',{name:'Close ×',exact:true}).click();
    await page.screenshot({path:join(evidence,'milo-dark-desktop.png')});
    await page.getByRole('button',{name:'Open MaxVideoAI menu',exact:true}).click();
    await page.getByRole('button',{name:'Light',exact:true}).click();
    await page.getByRole('dialog',{name:'MaxVideoAI',exact:true}).getByRole('button',{name:'Close ×',exact:true}).click();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:join(evidence,'sol-start-mobile.png')});
    await page.setViewportSize({width:1440,height:900});
    await selector.click();
    const modelChoices=page.getByRole('group',{name:'Assistant model'}).getByRole('button');
    await expect(modelChoices).toHaveCount(2);await expect(picker).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByLabel('Monthly included Max credits remaining')).toHaveAttribute('value','500');
    await modelChoices.filter({hasText:'Standard'}).click();
    const lunaSelected=page.waitForResponse(response=>response.url().endsWith('/api/studio/assistance')&&response.request().method()==='POST'&&response.request().postDataJSON().action==='select_luna',{timeout:30_000});
    await page.getByRole('button',{name:'Continue with Standard',exact:true}).click();
    const lunaSelection=await lunaSelected,lunaBody=await lunaSelection.json();assert.equal(lunaSelection.status(),200,JSON.stringify(lunaBody));assert.equal(lunaBody.result.selectedModel,'gpt-6-luna');
    await expect(standard).toHaveAttribute('aria-pressed','true');
    const topup=max;await expect(topup).toBeVisible();
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(evidence,'luna-mobile.png')});await page.setViewportSize({width:1440,height:900});
    await topup.click();await expect(page.getByText('Your Max credits',{exact:true})).toBeVisible();await expect(picker).toHaveCount(0);
    assert.deepEqual(assistanceActions,['select_luna'],'Opening Max only shows its options and cannot buy a pack or switch models');
    await page.getByRole('button',{name:'Close assistance',exact:true}).click();await expect(topup).toBeFocused();
    await topup.click();
    const solSelected=page.waitForResponse(response=>response.url().endsWith('/api/studio/assistance')&&response.request().method()==='POST'&&response.request().postDataJSON().action==='select_sol',{timeout:30_000});
    await page.getByRole('button',{name:'Continue with Max',exact:true}).click();
    const solSelection=await solSelected,solBody=await solSelection.json();assert.equal(solSelection.status(),200,JSON.stringify(solBody));assert.equal(solBody.result.selectedModel,'gpt-6.1-sol');
    await expect(max).toHaveAttribute('aria-pressed','true');await expect(max).toBeFocused();await expect(picker).toHaveCount(0);
    await message.fill('Help shape this film');
    const send=page.getByRole('button',{name:'Send to Milo',exact:true});await expect(send).toBeEnabled();
    const posted=page.waitForResponse(response=>response.url().endsWith('/image-conversation')&&response.request().method()==='POST');
    await send.click();const submitted=await posted;assert.equal(submitted.status(),200,JSON.stringify(await submitted.json()));
    const sent=JSON.parse(submitted.request().postData()!);assert.equal(sent.taskBudget.profile,'standard');assert.equal(sent.taskBudget.maxCredits,250);
    assert.deepEqual(sent.references,[selectedImage]);
    await expect(page.getByRole('button',{name:'Remove Image 1',exact:true})).toBeVisible();

    const taskCard=page.getByRole('region',{name:'Studio task'});await expect(taskCard.getByText('Waiting for Milo')).toBeVisible();
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,0);
    const generationFactory=((actor,options)=>({resolveReferences:createStudioImageGenerationService(actor,options).resolveReferences,walletSummary:async()=>({balanceCents:0,currency:'USD'}),catalog:async()=>[],getQuote:async()=>null})) as ImageGenerationFactory;
    let calls=0;
    const worker={enabled:true,assistancePolicy:studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'}),serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{
      calls++;return {id:'offline-'+calls,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:'',output:[{type:'function_call' as const,name:'project_read',call_id:'read-'+calls,arguments:'{}'}]};
    }}};
    await runStudioTaskWorkerOnce(worker);assert.equal(calls,4);

    await expect(taskCard.getByText('Request paused')).toBeVisible({timeout:15_000});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await page.screenshot({path:join(evidence,'task-mobile.png'),fullPage:true});
    const resumed=page.waitForResponse(response=>response.url().includes('/conversation-tasks/')&&response.request().method()==='POST');
    await taskCard.getByRole('button',{name:'Continue · same ceiling'}).click();const approved=await resumed;assert.equal(approved.status(),200,JSON.stringify(await approved.json()));
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM studio_task_approvals')).rows[0].n,1);assert.equal(calls,4);
    await page.reload();await expect(page.getByRole('region',{name:'Studio task'}).getByText('Waiting for Milo')).toBeVisible();assert.equal(calls,4);
    await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async()=>{calls++;return {id:'finished',model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply:'The requested guidance is complete.'}),output:[]};}}});
    await expect(page.getByText('The requested guidance is complete.')).toBeVisible({timeout:15_000});assert.equal(calls,5);
    await page.reload();await expect(page.getByText('The requested guidance is complete.')).toBeVisible();assert.equal(calls,5);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM studio_tasks')).rows[0].n,1);
    await runtime.database.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=480 WHERE user_id=$1',[STUDIO_FIXTURE_OWNERS[0]]);
    await message.fill('Continue with the approved vertical framing.');
    const fallbackPosted=page.waitForResponse(response=>response.url().endsWith('/image-conversation')&&response.request().method()==='POST');
    await send.click();const followup=await fallbackPosted;assert.equal(followup.status(),200);assert.deepEqual(followup.request().postDataJSON().references,[selectedImage],'A follow-up keeps the visible owned selection after sending and reloading');
    await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async params=>{
      calls++;assert.equal(params.model,'gpt-6-luna');assert.match(JSON.stringify(params.input),/approved vertical framing/);
      return {id:'fallback-finished',model:params.model!,status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply:'Continued with the approved framing.'}),output:[]};
    }}});
    await expect(page.getByText('Continued with the approved framing.')).toBeVisible({timeout:15_000});
    await expect(page.getByRole('region',{name:'Studio task'}).last().getByText('Standard · Included assistance',{exact:false})).toBeVisible();
    await page.getByRole('region',{name:'Studio task'}).last().getByRole('button',{name:'Explore Max',exact:true}).click();
    await expect(page.getByText('Your Max credits',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Close assistance',exact:true}).click();
    await page.reload();await expect(page.getByText('Continued with the approved framing.')).toBeVisible();assert.equal(calls,6);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,0,'Assistance fallback cannot implicitly prepare or confirm generation');
    await page.getByRole('button',{name:'Remove Image 1',exact:true}).click();
    await page.reload();await expect(page.getByRole('button',{name:'Remove Image 1',exact:true})).toHaveCount(0);
    await runtime.database.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=500 WHERE user_id=$1',[STUDIO_FIXTURE_OWNERS[0]]);
    await page.reload();await expect(picker).toHaveCount(0);await expect(max).toHaveAttribute('aria-pressed','true');
    await message.fill('Continue when no Sol credits remain.');await expect(send).toBeEnabled();
    const zeroPosted=page.waitForResponse(response=>response.url().endsWith('/image-conversation')&&response.request().method()==='POST');
    await send.click();assert.equal((await zeroPosted).status(),200);
    await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async params=>{
      calls++;assert.equal(params.model,'gpt-6-luna');return {id:'zero-finished',model:params.model!,status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply:'Continued with zero Sol credits.'}),output:[]};
    }}});
    await expect(page.getByText('Continued with zero Sol credits.')).toBeVisible({timeout:15_000});assert.equal(calls,7);

    await message.fill('HEY!');
    const greetingPosted=page.waitForResponse(response=>response.url().endsWith('/image-conversation')&&response.request().method()==='POST');
    await send.click();assert.equal((await greetingPosted).status(),200);
    await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,
      countInputTokens:async()=>{throw new Error('A greeting must not count provider input.');},
      createActionResponse:async()=>{throw new Error('A greeting must not buy a model call.');}}});
    await expect(page.getByText('Hey! What would you like to create today?')).toBeVisible({timeout:15_000});
    const greetingTask=page.getByRole('region',{name:'Studio task'}).last();
    await expect(greetingTask.getByText('Request complete')).toBeVisible();
    assert.equal(calls,7);
    const greetingUsage=(await runtime.database.pool.query('SELECT sum(consumed_credits)::int consumed,sum(reserved_credits)::int reserved FROM studio_assistance_credit_lots WHERE user_id=$1',[STUDIO_FIXTURE_OWNERS[0]])).rows[0];
    assert.deepEqual(greetingUsage,{consumed:500,reserved:0});
    await page.reload();await expect(page.getByText('Hey! What would you like to create today?')).toBeVisible();assert.equal(calls,7);
    assert.deepEqual(errors,[],'The Studio flow has no browser runtime errors');

  }catch(error){
    console.error(summarizeStudioReadinessFailure(runtime.readLogs(),8000));
    throw error;
  }finally{await browser?.close();await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await runtime.close();}
});
