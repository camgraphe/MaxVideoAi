import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {expect} from '@playwright/test';
import {startStudioIntegrationRuntime} from './helpers/studio-integration-runtime';
import {startStudioConnectedBrowserFixture} from './helpers/studio-connected-browser-fixture';
import {initializeStudioConnectedFixture,STUDIO_CONNECTED_MONTAGE_INPUT} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {postStudioMcpRequest,readStudioMcpResponse} from './helpers/studio-mcp-http-fixture';
import {LIVE_PRICING_POLICY_REVISION,PRICING_POLICY_HEADER} from '../frontend/src/lib/membership-policy';

const engine=process.env.STUDIO_BROWSER_ENGINE ?? 'chromium';
assert.ok(engine==='chromium'||engine==='firefox'||engine==='webkit');

test('native export quote stays accessible on mobile and recovers one identity after a lost acknowledgement ('+engine+')',{timeout:240000},async()=>{
  const runtime=await startStudioIntegrationRuntime({mcp:{studioMontageCreation:true},privateStorage:true,conversation:true,conversationExports:true,initializeDatabase:async database=>{
    await initializeStudioConnectedFixture(database);
    for(const name of ['00_create_profiles.sql','01_legal_documents.sql','02_user_consents.sql','04_profiles_timestamps.sql','12_app_settings.sql','30_mcp_paid_generation.sql','39_mcp_quote_lifetime.sql','49_studio_generation_scope.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql'])await database.pool.query(await readFile('neon/migrations/'+name,'utf8'));
    await database.pool.query('ALTER TABLE app_jobs ADD COLUMN status text');
  }});
  let browser:Awaited<ReturnType<typeof startStudioConnectedBrowserFixture>>|undefined;
  try{
    const session=runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0],{clientId:'chat-export-fixture'});
    const created=await postStudioMcpRequest(runtime,{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'create_studio_montage',arguments:STUDIO_CONNECTED_MONTAGE_INPUT}},{token:session.access_token}).then(readStudioMcpResponse);
    assert.notEqual(created.result.isError,true);
    const projectId=created.result.structuredContent.projectId;
    browser=await startStudioConnectedBrowserFixture({runtime,browserName:engine});
    const {page}=await browser.newContext(session,{viewport:{width:1440,height:900},locale:'en-US',reducedMotion:'reduce'});
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    const auxiliary=new Map([['/api/member-status',{tier:'Member'}],['/api/wallet',{balance:0,balanceCents:0,currency:'USD'}],['/api/admin/access',{ok:false}],['/api/legal/reconsent',{ok:true,needsReconsent:false,documents:[]}],['/api/legal/cookies/version',{ok:true,version:'chat-export-fixture',publishedAt:null}],['/api/legal/cookies',{ok:true,version:'chat-export-fixture'}]]);
    for(const [path,json]of auxiliary)await page.route(runtime.browserOrigin+path,route=>route.fulfill({json}));
    const quote={quoteId:'11111111-1111-4111-8111-111111111111',exportId:'tlx_'+'a'.repeat(64),projectId,sequenceId:created.result.structuredContent.sequenceId,revision:0,durationSec:5,resolution:'720p',aspectRatio:'16:9',fps:30,qualityPreset:'draft',includeAudio:true,price:{amountCents:0,currency:'USD',billingKind:'free'},expiresAt:'2099-01-01T00:00:00.000Z',confirmationRequired:true};
    const endpoint=runtime.browserOrigin+'/api/studio/projects/'+projectId;
    // Only UI acknowledgements are simulated. Canonical confirmation/billing is
    // covered separately with PostgreSQL; no render can escape this fixture.
    await page.route(endpoint+'/image-conversation',route=>{
      assert.equal(route.request().method(),'GET','This journey must not call the director.');
      return route.fulfill({json:{ok:true,result:{projectId,projectName:'Export fixture',turns:[{requestId:'export-turn',message:'Finish and export it, please.',reply:'Review this saved-cut quote before exporting.',references:[],state:'ready',retryable:false,quote:null,exportQuote:quote,generation:null,createdAt:'2026-10-03T00:00:00Z'}]}}});
    });
    const confirmations:unknown[]=[];
    let accepted=false;
    const job={id:quote.exportId,status:'queued',progress:0,message:null,artifact:null,billing:{amountCents:15,currency:'USD',billingKind:'paid'},idempotencyKey:'same-export'};
    await page.route(endpoint+'/conversation-exports',async route=>{
      if(route.request().method()==='GET')return route.fulfill({json:{ok:true,exports:accepted?[job]:[]}});
      assert.equal(route.request().method(),'POST');
      confirmations.push(route.request().postDataJSON());
      assert.equal(route.request().headers()[PRICING_POLICY_HEADER],LIVE_PRICING_POLICY_REVISION);
      if(confirmations.length===1)return route.abort('failed');
      accepted=true;
      return route.fulfill({json:{ok:true,result:{ok:true,export:job,reused:true}}});
    });
    const url=runtime.browserOrigin+'/app/studio/conversation/'+projectId;
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
    const card=page.getByLabel('Film export quote',{exact:true});
    await expect(card).toBeVisible({timeout:45000});
    // The intercepted quote can precede the real timeline route's first compile.
    // Wait for the saved cut before an intentional reload can cancel its HMR refresh.
    await expect(page.locator('[data-timeline-item]')).toHaveCount(2,{timeout:45000});
    await expect(card.getByRole('button',{name:'Confirm export · Free',exact:true})).toBeEnabled();
    assert.equal(confirmations.length,0,'Mounting a quote never starts a render.');
    const cookies=page.getByRole('button',{name:'Reject all',exact:true});
    if(await cookies.isVisible())await cookies.click();
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Open MaxVideoAI menu',exact:true}).click();
    await page.getByRole('button',{name:'Light',exact:true}).click();
    await page.getByRole('dialog',{name:'MaxVideoAI',exact:true}).getByRole('button',{name:'Close ×',exact:true}).click();
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await expect(page.getByRole('textbox',{name:'Message Studio',exact:true})).toBeVisible();
    const box=await card.boundingBox();
    assert.ok(box&&box.x>=0&&box.x+box.width<=390,'The quote fits the mobile chat.');
    await card.getByRole('button',{name:'Confirm export · Free',exact:true}).click();
    await expect(card.getByRole('button',{name:'Resume this export',exact:true})).toBeEnabled();
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(card.getByRole('button',{name:'Resume this export',exact:true})).toBeEnabled({timeout:45000});
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','olive');
    await card.getByRole('button',{name:'Resume this export',exact:true}).click();
    await expect(card).toContainText('$0.15');
    await expect(card).toContainText('Rendering your film…');
    await expect(card.getByRole('button')).toHaveCount(0);
    assert.deepEqual(confirmations,[{quoteId:quote.quoteId,confirmed:true},{quoteId:quote.quoteId,confirmed:true}]);
    await page.getByRole('button',{name:'Open MaxVideoAI menu',exact:true}).click();
    await page.getByRole('button',{name:'Dark',exact:true}).click();
    await page.getByRole('dialog',{name:'MaxVideoAI',exact:true}).getByRole('button',{name:'Close ×',exact:true}).click();
    await expect(page.locator('[data-tone]')).toHaveAttribute('data-tone','charcoal');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
    assert.deepEqual(errors,[]);
    if(process.env.STUDIO_PROOF_DIRECTORY){
      await mkdir(process.env.STUDIO_PROOF_DIRECTORY,{recursive:true});
      await page.screenshot({path:join(process.env.STUDIO_PROOF_DIRECTORY,engine+'-export-quote-recovered-mobile.png')});
    }
  }finally{await browser?.close();await runtime.close();}
});
