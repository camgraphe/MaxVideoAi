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

test('task ceilings, explicit continuation and saved progress work on desktop/mobile without hidden dispatch',async()=>{
  const previous=process.env.DATABASE_URL;
  const runtime=await startStudioIntegrationRuntime({mcp:{studioMontageCreation:false},conversation:true,conversationTasks:true,initializeDatabase:async db=>{
    await initializeStudioConnectedFixture(db);
    for(const name of ['00_create_profiles.sql','01_legal_documents.sql','02_user_consents.sql','04_profiles_timestamps.sql','12_app_settings.sql','30_mcp_paid_generation.sql','39_mcp_quote_lifetime.sql','49_studio_generation_scope.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','65_studio_task_budgets.sql','67_studio_luna_reasoning.sql'])await db.pool.query(await readFile('neon/migrations/'+name,'utf8'));
    await db.pool.query('ALTER TABLE app_jobs ADD COLUMN status text');
    await db.pool.query(`CREATE TABLE user_account_restrictions(user_id text PRIMARY KEY,reason text NOT NULL,message text,active boolean NOT NULL DEFAULT true,restricted_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
  }});
  process.env.DATABASE_URL=runtime.database.databaseUrl;
  let browser:Awaited<ReturnType<typeof startStudioConnectedBrowserFixture>>|undefined;
  try{
    const project=await createStudioConversationProject({userId:STUDIO_FIXTURE_OWNERS[0]},{name:'Task allowance',idempotencyKey:randomUUID()},{featureEnabled:true});
    const session=runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0],{clientId:'task-browser-fixture'});
    browser=await startStudioConnectedBrowserFixture({runtime,browserName:'chromium'});
    const owned=await browser.newContext(session,{viewport:{width:1440,height:900},locale:'en-US',reducedMotion:'reduce'}),page=owned.page;
    await page.route('**/api/legal/reconsent',route=>route.fulfill({json:{ok:true,needsReconsent:false,documents:[]}}));
    const conversationPath=`/app/studio/conversation/${project.projectId}`;
    // This suite checks behavior, not compilation speed. Prepare the owned
    // dev routes with real authenticated GETs before the 30-second UI waiters.
    for(const path of [conversationPath,`/api/studio/projects/${project.projectId}/image-conversation`,'/api/studio/assistance']){
      const prepared=await owned.context.request.get(runtime.browserOrigin+path,{timeout:90_000,maxRedirects:0});
      assert.equal(prepared.status(),200,`Studio fixture preparation failed: ${path}`);
      await prepared.dispose();
    }
    const loaded=page.waitForResponse(response=>response.url().endsWith('/image-conversation')&&response.request().method()==='GET',{timeout:30_000});
    const assistanceLoaded=page.waitForResponse(response=>response.url().endsWith('/api/studio/assistance')&&response.request().method()==='GET',{timeout:30_000});
    const [,initial,assistance]=await Promise.all([
      page.goto(runtime.browserOrigin+conversationPath),loaded,assistanceLoaded,
    ]);
    const initialBody=await initial.json();assert.equal(initial.status(),200,JSON.stringify(initialBody));assert.ok(initialBody.result.taskPolicyVersion);
    assert.equal(assistance.status(),200,JSON.stringify(await assistance.json()));
    const picker=page.getByRole('group',{name:'Work allowance'}),message=page.getByRole('textbox',{name:'Message Studio'});
    await expect(picker).toBeVisible();await expect(picker.getByRole('radio',{name:/Complex/})).toBeEnabled();
    await picker.getByRole('radio',{name:/Complex/}).check();await message.fill('Help shape this film');
    const send=page.getByRole('button',{name:'Send to Studio',exact:true});await expect(send).toBeDisabled();
    await picker.getByRole('checkbox').check();await expect(send).toBeEnabled();
    await picker.getByRole('radio',{name:/Quick/}).check();
    const posted=page.waitForResponse(response=>response.url().endsWith('/image-conversation')&&response.request().method()==='POST');
    await send.click();const submitted=await posted;assert.equal(submitted.status(),200,JSON.stringify(await submitted.json()));
    const taskCard=page.getByRole('region',{name:'Studio task'});await expect(taskCard.getByText('Waiting for Studio')).toBeVisible();
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,0);
    const generationFactory=(()=>({resolveReferences:async()=>[],walletSummary:async()=>({balanceCents:0,currency:'USD'}),catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;
    let calls=0;
    const worker={enabled:true,assistancePolicy:studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'}),serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{
      calls++;return {id:'offline-'+calls,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:'',output:[{type:'function_call' as const,name:'project_read',call_id:'read-'+calls,arguments:'{}'}]};
    }}};
    await runStudioTaskWorkerOnce(worker);assert.equal(calls,2);
    await expect(taskCard.getByText('Request paused')).toBeVisible({timeout:15_000});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    const evidence=join(process.cwd(),'.superpowers/sdd/2026-10-06-studio-task-budgets/browser');await mkdir(evidence,{recursive:true});await page.screenshot({path:join(evidence,'task-mobile.png'),fullPage:true});
    const resumed=page.waitForResponse(response=>response.url().includes('/conversation-tasks/')&&response.request().method()==='POST');
    await taskCard.getByRole('button',{name:'Continue · same ceiling'}).click();const approved=await resumed;assert.equal(approved.status(),200,JSON.stringify(await approved.json()));
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM studio_task_approvals')).rows[0].n,1);assert.equal(calls,2);
    await page.reload();await expect(page.getByRole('region',{name:'Studio task'}).getByText('Waiting for Studio')).toBeVisible();assert.equal(calls,2);
    await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async()=>{calls++;return {id:'finished',model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply:'The requested guidance is complete.'}),output:[]};}}});
    await expect(page.getByText('The requested guidance is complete.')).toBeVisible({timeout:15_000});assert.equal(calls,3);
    await page.reload();await expect(page.getByText('The requested guidance is complete.')).toBeVisible();assert.equal(calls,3);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM studio_tasks')).rows[0].n,1);
    await runtime.database.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=380 WHERE user_id=$1',[STUDIO_FIXTURE_OWNERS[0]]);
    await picker.getByRole('radio',{name:/Complex/}).check();await picker.getByRole('checkbox').check();
    await message.fill('Continue with the approved vertical framing.');
    const fallbackPosted=page.waitForResponse(response=>response.url().endsWith('/image-conversation')&&response.request().method()==='POST');
    await send.click();assert.equal((await fallbackPosted).status(),200);
    await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async params=>{
      calls++;assert.equal(params.model,'gpt-6-luna');assert.match(JSON.stringify(params.input),/approved vertical framing/);
      return {id:'fallback-finished',model:params.model!,status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply:'Continued with the approved framing.'}),output:[]};
    }}});
    await expect(page.getByText('Continued with the approved framing.')).toBeVisible({timeout:15_000});
    await expect(page.getByRole('region',{name:'Studio task'}).last().getByText('Luna · Included assistance')).toBeVisible();
    await page.reload();await expect(page.getByText('Continued with the approved framing.')).toBeVisible();assert.equal(calls,4);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,0,'Assistance fallback cannot implicitly prepare or confirm generation');
    await runtime.database.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=500 WHERE user_id=$1',[STUDIO_FIXTURE_OWNERS[0]]);
    await page.reload();await expect(picker).toBeVisible();
    await picker.getByRole('radio',{name:/Complex/}).check();await picker.getByRole('checkbox').check();
    await message.fill('Continue when no Sol credits remain.');await expect(send).toBeEnabled();
    const zeroPosted=page.waitForResponse(response=>response.url().endsWith('/image-conversation')&&response.request().method()==='POST');
    await send.click();assert.equal((await zeroPosted).status(),200);
    await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async params=>{
      calls++;assert.equal(params.model,'gpt-6-luna');return {id:'zero-finished',model:params.model!,status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply:'Continued with zero Sol credits.'}),output:[]};
    }}});
    await expect(page.getByText('Continued with zero Sol credits.')).toBeVisible({timeout:15_000});assert.equal(calls,5);
  }catch(error){
    console.error(summarizeStudioReadinessFailure(runtime.readLogs(),8000));
    throw error;
  }finally{await browser?.close();await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await runtime.close();}
});
