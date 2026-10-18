import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ENV } from '../frontend/src/lib/env';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { createPrepareGenerationService } from '../frontend/src/server/agent-api/prepare-generation';
import { createConfirmGenerationService } from '../frontend/src/server/agent-api/confirm-generation';
import { getAgentGenerationStatus } from '../frontend/src/server/agent-api/generation-status';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { seedanceWorkflowScenarios } from '../frontend/lib/pricing-audit/seedance-workflow-scenarios';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { ensureAssetSchema } from '../frontend/src/lib/schema/asset-schema';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';

test('MCP native Draft and final use separate tariffs, true provider lineage, atomic reservation and same-attempt recovery', { timeout: 90000 }, async () => {
  const db = await startDisposablePostgres('mcp-native-draft');
  const envKeys = ['DATABASE_URL', 'NODE_ENV', 'PRICING_SANDBOX', 'SEEDANCE_2_5_DRAFT_ENABLED', 'MCP_RESOURCE_URL'] as const;
  const previous = envKeys.map(key => process.env[key]);
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1',
    SEEDANCE_2_5_DRAFT_ENABLED: '1', MCP_RESOURCE_URL: 'http://localhost/mcp' });
  const flags = { BYTEPLUS_ARK_ENABLED: 'true', BYTEPLUS_ARK_API_KEY: 'fixture-key', SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true',
    SEEDANCE_2_5_PROVIDER: 'byteplus_modelark', SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY: 'false', SEEDANCE_2_5_BYTEPLUS_MODES: 't2v,i2v,ref2v,v2v,extend' };
  const priorFlags = Object.fromEntries(Object.keys(flags).map(key => [key, (ENV as unknown as Record<string, unknown>)[key]]));
  Object.assign(ENV, flags);
  const previousFetch = globalThis.fetch;
  const payloads: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input, init) => {
    assert.match(String(input), /^https:\/\/ark\./);
    assert.equal(init?.method, 'POST');
    payloads.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ id: `cgt-fixture-${payloads.length}`, status: 'queued' }), { status: 202 });
  }) as typeof fetch;
  const identity = { userId: 'draft-owner', clientId: 'draft-client', emailVerified: true, authMethod: 'oauth' as const };
  try {
    await createPaidGenerationTestSchema(db.pool);
    await db.pool.query(`ALTER TABLE app_jobs ADD COLUMN mcp_trial_outcome_disposition text;
      CREATE TABLE fal_queue_log(job_id text,provider text,provider_job_id text,engine_id text,status text,payload jsonb);
      CREATE TABLE app_pricing_change_events(id uuid PRIMARY KEY,domain text);
      INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ('draft-owner','topup',10000,'USD');`);
    for (const migration of ['54_customer_tariff_cells.sql','55_customer_tariff_versions.sql','53_seedance_draft_links.sql','59_seedance_draft_final_state.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    const entry = getFalEngineById('seedance-2-5')!;
    const candidate: AgentPublicGenerationEngine = { engine: entry.engine, surface: 'video', publicModes: ['t2v','i2v','ref2v','extend'],
      modeCaps: Object.fromEntries(entry.modes.map(m => [m.mode,m.ui])) as AgentPublicGenerationEngine['modeCaps'] };
    const normal = ['480p','1080p'].map(resolution => buildManualTariffCoverageScenario({ engine: entry.engine, mode: 't2v',
      durationSec: 4, resolution, aspectRatio: '16:9', addons: { audio: false }, membershipTier: 'member' }, 'mcp-native'));
    for (const [index, scenario] of [...normal,...seedanceWorkflowScenarios(normal)].entries()) {
      const price = scenario.context.workflowStep === 'draft' ? 77 : scenario.context.workflowStep === 'final' ? 777 : 999;
      const selector = scenario.selector;
      await db.pool.query(`INSERT INTO app_customer_tariff_cells(id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
        VALUES($1,$2,$3,$4,'USD','2026-10-01',1,'11111111-1111-4111-8111-111111111111')`,
        [`native-${index}`,JSON.stringify(Object.entries(selector).sort(([a],[b]) => a.localeCompare(b))),selector,{ kind:'fixed',customerCents:price }]);
    }
    await db.pool.query('UPDATE app_customer_tariff_state SET active=true,revision=1');
    const dependencies = { paidGenerationEnabled: () => true, listPublicEngines: async () => [candidate] };
    const prepare = createPrepareGenerationService('http://localhost/account/connections', { clientIp:null,userAgent:null }, dependencies);
    const confirm = createConfirmGenerationService('http://localhost/account/connections', { clientIp:null,userAgent:null }, dependencies);
    const request = { surface:'video' as const,engineId:'seedance-2-5',mode:'t2v' as const,prompt:'A wave rolls onto the beach',
      settings:{ durationSec:4,resolution:'480p',aspectRatio:'16:9',audio:false } };
    const row = async (id:string) => (await db.pool.query('SELECT * FROM app_jobs WHERE job_id=$1',[id])).rows[0];
    const charges = async () => (await db.pool.query("SELECT job_id,amount_cents FROM app_receipts WHERE type='charge' ORDER BY amount_cents")).rows;
    const ordinary = await prepare(request,identity);
    assert.equal(ordinary.price.amountCents,999);
    const draft = await prepare({...request,seedanceWorkflow:{step:'draft'}},identity);
    assert.equal(draft.price.amountCents,77);
    assert.equal(draft.seedanceWorkflowPrices?.draft?.amountCents,77);
    assert.equal(draft.seedanceWorkflowPrices?.final?.amountCents,777);
    assert.equal(draft.seedanceWorkflowPrices?.total?.amountCents,854);
    assert.equal(draft.seedanceWorkflowPrices?.finalPriceStatus,'current_estimate');
    assert.notEqual(draft.requestHash,ordinary.requestHash);
    await confirm({quoteId:draft.quoteId,confirmed:true},identity);
    assert.equal(payloads.length,1,JSON.stringify(await row(draft.quoteId)));
    assert.equal(payloads[0].draft,true);
    assert.equal(payloads[0].resolution,'480p');
    assert.equal((await row(draft.quoteId)).settings_snapshot.seedanceWorkflow.step,'draft');
    await confirm({quoteId:draft.quoteId,confirmed:true},identity);
    assert.equal(payloads.length,1);
    const finalInput = {surface:'video' as const,engineId:'seedance-2-5',seedanceWorkflow:{step:'final' as const,draftJobId:draft.quoteId}};
    await assert.rejects(prepare(finalInput,identity),/Draft/i,'pending Drafts cannot be finalized');
    // Fixture durable completion; the existing real poll/refund tests own storage and callback qualification.
    await db.pool.query("UPDATE app_jobs SET status='completed',video_url='https://cdn.example.test/draft.mp4' WHERE job_id=$1",[draft.quoteId]);
    await db.pool.query("UPDATE seedance_draft_links SET draft_state='ready' WHERE draft_job_id=$1",[draft.quoteId]);
    await assert.rejects(prepare(finalInput,{...identity,userId:'other-owner'}),/Draft/i);
    const staleParent = await prepare(finalInput,identity);
    await db.pool.query("UPDATE app_jobs SET settings_snapshot=jsonb_set(settings_snapshot,'{advanced}', '{\"extraInputValues\":{\"watermark\":true}}'::jsonb) WHERE job_id=$1",[draft.quoteId]);
    await assert.rejects(confirm({quoteId:staleParent.quoteId,confirmed:true},identity),/Draft facts changed/i);
    await db.pool.query("UPDATE app_jobs SET settings_snapshot=settings_snapshot-'advanced' WHERE job_id=$1",[draft.quoteId]);
    const prepareExpired = createPrepareGenerationService('http://localhost/account/connections', {clientIp:null,userAgent:null},
      {...dependencies,now:()=>new Date(Date.now()-3600000)});
    const expiredQuote = await prepareExpired(finalInput,identity);
    await assert.rejects(confirm({quoteId:expiredQuote.quoteId,confirmed:true},identity),{code:'QUOTE_EXPIRED'});
    assert.equal((await charges()).length,1);
    const first = await prepare(finalInput,identity);
    const second = await prepare(finalInput,identity);
    assert.equal(first.price.amountCents,777);
    assert.equal(first.seedanceWorkflowPrices?.draft?.amountCents,77);
    assert.equal(first.seedanceWorkflowPrices?.final?.amountCents,777);
    assert.equal(first.seedanceWorkflowPrices?.total?.amountCents,854);
    assert.equal(first.seedanceWorkflowPrices?.finalPriceStatus,'exact_quote');
    assert.equal(first.summary.prompt,request.prompt);
    assert.equal(first.summary.settings.resolution,'1080p');
    assert.equal(first.summary.settings.durationSec,4);
    assert.ok(!JSON.stringify(first).includes('cgt-fixture'));
    const results = await Promise.allSettled([first,second].map(q=>confirm({quoteId:q.quoteId,confirmed:true},identity)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(payloads.length,2);
    assert.deepEqual(payloads[1].content,[{type:'draft_task',draft_task:{id:'cgt-fixture-1'}}]);
    assert.equal(payloads[1].resolution,'1080p');
    assert.equal(payloads[1].draft,undefined);
    const finalId = (await db.pool.query('SELECT final_job_id FROM seedance_draft_links')).rows[0].final_job_id;
    await confirm({quoteId:finalId,confirmed:true},identity);
    assert.equal(payloads.length,2);
    assert.deepEqual(await charges(),[{job_id:draft.quoteId,amount_cents:77},{job_id:finalId,amount_cents:777}]);
    await assert.rejects(prepare(finalInput,identity),/Draft/i);
    const status = await getAgentGenerationStatus({jobId:draft.quoteId},identity);
    assert.equal(status.seedanceWorkflow?.eligibility,'finalizing');
    assert.equal(status.seedanceWorkflow?.finalJobId,finalId);
    await db.pool.query("UPDATE seedance_draft_links SET final_job_id=NULL,final_state='none',validity_started_at=now()-interval '8 days',expires_at=now()-interval '1 second'");
    await assert.rejects(prepare(finalInput,identity),/Draft/i);
    assert.equal((await getAgentGenerationStatus({jobId:draft.quoteId},identity)).seedanceWorkflow?.eligibility,'expired');
    process.env.SEEDANCE_2_5_DRAFT_ENABLED='0';
    await assert.rejects(prepare({...request,seedanceWorkflow:{step:'draft'}},identity),/Draft/i);
    assert.equal(payloads.length,2);
    process.env.SEEDANCE_2_5_DRAFT_ENABLED='1';
    await ensureAssetSchema();
    for (const mode of ['i2v','ref2v','v2v','extend'] as const) {
      const video = mode !== 'i2v';
      const ref: ResolvedReference = {...(mode==='extend'?{slot:0}:{}),assetId:`owned-${mode}`,role:mode==='ref2v'?'reference':'source',
        mediaKind:video?'video':'image',storageUrl:`https://cdn.maxvideoai.com/owned/${mode}.${video?'mp4':'png'}`,
        width:1280,height:720,durationSec:video?4:null,mimeType:video?'video/mp4':'image/png',sizeBytes:1000};
      await db.pool.query('INSERT INTO user_assets(asset_id,user_id,url,width,height) VALUES($1,$2,$3,1280,720)',[ref.assetId,identity.userId,ref.storageUrl]);
      const context = {engine:entry.engine,mode,durationSec:4,resolution:'480p',aspectRatio:'16:9',
        addons:{audio:false},membershipTier:'member' as const,hasVideoInput:video,
        ...(video?{inputVideoDurationSec:4}:{}),
        ...(mode==='v2v'?{seedanceEditSource:{durationSec:4,width:1280,height:720,billedDurationSec:4,
          pricingAspectRatio:'16:9' as const,outputDuration:'source' as const,outputAspectRatio:'source' as const}}:{})};
      const base = ['480p','1080p'].map(resolution=>buildManualTariffCoverageScenario({...context,resolution},`mcp-${mode}`));
      for (const [index,scenario] of seedanceWorkflowScenarios(base).entries()) {
        const selector=scenario.selector;
        await db.pool.query(`INSERT INTO app_customer_tariff_cells(id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
          VALUES($1,$2,$3,$4,'USD','2026-10-01',1,'11111111-1111-4111-8111-111111111111')`,
          [`native-${mode}-${index}`,JSON.stringify(Object.entries(selector).sort(([a],[b])=>a.localeCompare(b))),selector,
            {kind:'fixed',customerCents:scenario.context.workflowStep==='draft'?88:888}]);
      }
      let sourcePresent=true;
      const mediaDeps={...dependencies,resolveGenerationReferences:async()=>{
        assert.equal(sourcePresent,true,'finalization must not reimport a deleted original asset');
        return [ref];
      }};
      const prepareMedia=createPrepareGenerationService('http://localhost/account/connections',{clientIp:null,userAgent:null},mediaDeps);
      const confirmMedia=createConfirmGenerationService('http://localhost/account/connections',{clientIp:null,userAgent:null},mediaDeps);
      const mediaSettings={...request.settings} as Record<string,string|number|boolean>;
      if (!candidate.modeCaps[mode]?.aspectRatio?.length) delete mediaSettings.aspectRatio;
      const mediaDraft=await prepareMedia({...request,mode,settings:mediaSettings,references:[{kind:'asset',assetId:ref.assetId,role:ref.role}],
        seedanceWorkflow:{step:'draft'}},identity);
      assert.equal(mediaDraft.price.amountCents,88,mode);
      const draftPayloadIndex=payloads.length;
      await confirmMedia({quoteId:mediaDraft.quoteId,confirmed:true},identity);
      assert.equal(payloads.length,draftPayloadIndex+1,JSON.stringify(await row(mediaDraft.quoteId)));
      assert.equal(payloads[draftPayloadIndex].draft,true);
      await db.pool.query("UPDATE app_jobs SET status='completed',video_url='https://cdn.example.test/draft.mp4' WHERE job_id=$1",[mediaDraft.quoteId]);
      await db.pool.query("UPDATE seedance_draft_links SET draft_state='ready' WHERE draft_job_id=$1",[mediaDraft.quoteId]);
      sourcePresent=false;
      await db.pool.query('DELETE FROM user_assets WHERE asset_id=$1',[ref.assetId]);
      const mediaFinal=await prepareMedia({...finalInput,seedanceWorkflow:{step:'final',draftJobId:mediaDraft.quoteId}},identity);
      assert.equal(mediaFinal.summary.mode,mode);
      assert.equal(mediaFinal.price.amountCents,888,mode);
      await confirmMedia({quoteId:mediaFinal.quoteId,confirmed:true},identity);
      assert.equal(payloads.length,draftPayloadIndex+2,JSON.stringify(await row(mediaFinal.quoteId)));
      assert.deepEqual(payloads[draftPayloadIndex+1].content,[{type:'draft_task',draft_task:{id:`cgt-fixture-${draftPayloadIndex+1}`}}]);
    }
  } finally {
    globalThis.fetch=previousFetch;
    await getDb().end().catch(()=>undefined);
    Object.assign(ENV,priorFlags);
    envKeys.forEach((key,i)=>{if(previous[i]===undefined)delete process.env[key];else process.env[key]=previous[i];});
    await db.cleanup();
  }
});
