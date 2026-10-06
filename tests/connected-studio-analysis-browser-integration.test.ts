import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {expect} from '@playwright/test';
import {startStudioIntegrationRuntime,summarizeStudioReadinessFailure} from './helpers/studio-integration-runtime';
import {startStudioConnectedBrowserFixture} from './helpers/studio-connected-browser-fixture';
import {initializeStudioConnectedFixture,STUDIO_CONNECTED_ASSET_IDS} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {getDb} from '../frontend/src/lib/db';
import {createStudioConversationProject} from '../frontend/src/server/studio/conversation-project-command';
import {createStudioAnalysisService} from '../frontend/src/server/studio/media-analysis/service';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {claimImageTurn,persistImageDraft} from '../frontend/src/server/studio/image-conversation-repository';

const policy={version:'offline-browser-v1',processingNanoUsdPerSecond:100_000,marginPercent:1,video:{maxInputTokens:20_000,maxOutputTokens:2200},audio:null};
test('analysis review works on desktop/mobile and only explicit confirmation queues an owned run',async()=>{
  const previous=process.env.DATABASE_URL;
  const runtime=await startStudioIntegrationRuntime({mcp:{studioMontageCreation:false},conversation:true,privateStorage:true,analysisPolicy:policy,initializeDatabase:async db=>{
    await initializeStudioConnectedFixture(db);
    await db.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/studio-local-fixture/' || public_id || '.mp4'");
    for(const name of ['00_create_profiles.sql','01_legal_documents.sql','02_user_consents.sql','04_profiles_timestamps.sql','12_app_settings.sql','30_mcp_paid_generation.sql','39_mcp_quote_lifetime.sql','49_studio_generation_scope.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','64_studio_media_analysis.sql'])await db.pool.query(await readFile('neon/migrations/'+name,'utf8'));
    await db.pool.query('ALTER TABLE app_jobs ADD COLUMN status text');
    await db.pool.query(`CREATE TABLE user_account_restrictions(user_id text PRIMARY KEY,reason text NOT NULL,message text,active boolean NOT NULL DEFAULT true,restricted_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
  }});
  process.env.DATABASE_URL=runtime.database.databaseUrl;
  let browser:Awaited<ReturnType<typeof startStudioConnectedBrowserFixture>>|undefined;
  try {
    const project=await createStudioConversationProject({userId:STUDIO_FIXTURE_OWNERS[0]},{name:'Explicit analysis',idempotencyKey:randomUUID()},{featureEnabled:true});
    const actor={userId:STUDIO_FIXTURE_OWNERS[0],projectId:project.projectId,authMethod:'studio-session' as const,clientId:null};
    const ref={type:'asset' as const,assetId:STUDIO_CONNECTED_ASSET_IDS.a,kind:'video' as const};
    const analysis=createStudioAnalysisService(actor,{policy,assistancePolicy:studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'})});
    const quote=await analysis.prepare({ref,goal:'Find the opening action',reason:'requested',startSec:0,endSec:4},randomUUID());
    const turn=await claimImageTurn(actor,{requestId:randomUUID(),message:'Analyse cette vidéo',references:[],attachments:[ref]});
    await persistImageDraft(actor,turn.turn,{reply:'Review the interval and credit ceiling.',image:null,analysisQuote:quote},'a'.repeat(64));
    const session=runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0],{clientId:'explicit-analysis-fixture'});
    browser=await startStudioConnectedBrowserFixture({runtime,browserName:'chromium'});
    const owned=await browser.newContext(session,{viewport:{width:1440,height:900},locale:'en-US',reducedMotion:'reduce'});
    const page=owned.page;
    // Same isolated auxiliary legal reader as the canonical Studio browser fixture.
    await page.route('**/api/legal/reconsent',route=>route.fulfill({json:{ok:true,needsReconsent:false,documents:[]}}));
    const loaded=page.waitForResponse(response=>response.url().endsWith(`/api/studio/projects/${project.projectId}/image-conversation`)&&response.request().method()==='GET',{timeout:30_000});
    const analysisLoaded=page.waitForResponse(response=>response.url().endsWith(`/api/studio/projects/${project.projectId}/analyses/${quote.analysisId}`)&&response.request().method()==='GET',{timeout:30_000});
    const [,response,analysisResponse]=await Promise.all([
      page.goto(runtime.browserOrigin+`/app/studio/conversation/${project.projectId}`),loaded,analysisLoaded,
    ]);
    assert.equal(response.status(),200,JSON.stringify(await response.json()));
    assert.equal(analysisResponse.status(),200,JSON.stringify(await analysisResponse.json()));
    const card=page.getByRole('region',{name:'Media analysis'});
    await expect(card).toBeVisible();await expect(card.getByRole('button',{name:/Analyse with Sol 6.1/})).toBeEnabled();
    assert.equal((await analysis.read(quote.analysisId)).state,'prepared','Rendering and GETs cannot queue or charge analysis');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    const evidence=join(process.cwd(),'.superpowers/sdd/2026-10-06-studio-media-analysis/browser');await mkdir(evidence,{recursive:true});await page.screenshot({path:join(evidence,'analysis-mobile.png'),fullPage:true});
    const confirmed=page.waitForResponse(response=>response.url().endsWith(`/api/studio/projects/${project.projectId}/analyses/${quote.analysisId}`)&&response.request().method()==='POST',{timeout:30_000});
    await card.getByRole('button',{name:/Analyse with Sol 6.1/}).click();
    const confirmationResponse=await confirmed;
    assert.equal(confirmationResponse.status(),200,JSON.stringify(await confirmationResponse.json()));
    await expect(card.getByText('Analysis in progress. Your media is preserved.')).toBeVisible();
    assert.equal((await analysis.read(quote.analysisId)).state,'queued');
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM studio_analysis_credit_funding')).rows[0].n,1);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,0,'Browser delivery never creates an analytical model call');
    await page.reload();await expect(page.getByRole('region',{name:'Media analysis'}).getByText('Analysis in progress. Your media is preserved.')).toBeVisible();
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int n FROM studio_analysis_credit_funding')).rows[0].n,1);
  }catch(error){
    console.error(summarizeStudioReadinessFailure(runtime.readLogs(),8000));
    throw error;
  }finally{
    await browser?.close();await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await runtime.close();
  }
});
