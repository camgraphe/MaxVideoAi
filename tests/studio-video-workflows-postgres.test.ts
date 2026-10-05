import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {getDb,withDbTransaction,type TransactionQueryExecutor} from '../frontend/src/lib/db';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import {addTopup,ProviderHarness,createServices,principal} from './helpers/mcp-paid-e2e-harness';
import {workflowCatalog,workflowActor,workflowInput,workflowAction,workflowAssetIds,workflowReference} from './helpers/studio-video-workflow-fixtures';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {studioMediaRequest,type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import type {CanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-types';
import {randomUUID} from 'node:crypto';
import {computeCanonicalBillingSnapshot} from '../frontend/server/pricing/quote-billing';
import {loadPricingPolicyOverridesWithExecutor} from '../frontend/src/lib/pricing-rule-store';
import {runStudioImageActions} from '../frontend/src/server/studio/conversation-image-run';
import {claimImageTurn} from '../frontend/src/server/studio/image-conversation-repository';
import {chooseStudioAssistance} from '../frontend/src/server/studio/assistance-ledger';
import {STUDIO_ASSISTANCE_TARIFF} from '../frontend/src/lib/studio/assistance-contract';
import {studioReferenceFingerprint} from '../frontend/src/server/agent-api/generation-actor';
import {toEngineGenerationMode} from '../frontend/src/server/agent-api/generation-mode-aliases';

test('all certified video tuples share MCP exact price, owned payload and one-attempt confirmed dispatch',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined,'Disposable DB only');
  const pg=await startDisposablePostgres('studio-video-workflows');process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/53_studio_media_generation_scope.sql','utf8'));
  await addTopup(pg.pool,workflowActor.userId,10000000);
  await pg.pool.query(`CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,status text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
  for(const kind of ['image','video','audio'] as const){const ref=workflowReference(kind,'source');await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata) VALUES($1,$2,$3,$1,$4,$5,$6,$7,$8,'ready',$9::jsonb)`,[kind,workflowAssetIds[kind],workflowActor.userId,ref.storageUrl,ref.mimeType,ref.sizeBytes,ref.width,ref.height,JSON.stringify({durationSec:ref.durationSec,originalName:ref.originalName,mediaFacts:{source:'probe',durationSec:ref.durationSec,width:ref.width,height:ref.height}})]);}
  const catalog=await workflowCatalog();const provider=new ProviderHarness(pg.pool);
  const executable=()=>({executable:true as const,reason:'available' as const});
  const options={enabled:true,prepareDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:executable},confirmDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:executable,submitPaidGeneration:provider.submit}};
  const service=createStudioVideoGenerationService(workflowActor,options);
  const factories={video:()=>service} as unknown as StudioMediaFactories;
  const mcp=createServices({publicEngines:catalog,resolveRequestExecutability:executable,submitPaidGeneration:provider.submit});
  let totalCharge=0;
  for(const candidate of catalog)for(const mode of candidate.publicModes)await t.test(candidate.engine.id+' '+mode,async()=>{
    const action=workflowAction(candidate,mode);const request=await studioMediaRequest(workflowActor,action,workflowInput,factories,true) as CanonicalGenerationRequest;
    const before=provider.captures.length;const quote=await service.prepare(request);const oauthQuote=await mcp.prepareGeneration!(request,principal(workflowActor.userId));
    assert.deepEqual(quote.summary,oauthQuote.summary,'Same canonical request');assert.equal(quote.requestHash,oauthQuote.requestHash);assert.deepEqual(quote.price,oauthQuote.price,'Same real persisted tariff and owned facts');
    assert.ok(Number.isSafeInteger(quote.price.amountCents)&&quote.price.amountCents>0);assert.equal(provider.captures.length,before,'Preparation never dispatches');
    await assert.rejects(mcp.confirmGeneration!({quoteId:quote.quoteId,confirmed:true},principal(workflowActor.userId)),{code:'QUOTE_EXPIRED'});
    await assert.rejects(createStudioVideoGenerationService({...workflowActor,projectId:'other'},options).confirm({quoteId:quote.quoteId,confirmed:true}),{code:'QUOTE_EXPIRED'});
    await assert.rejects(createStudioVideoGenerationService({...workflowActor,userId:'foreign'},options).confirm({quoteId:quote.quoteId,confirmed:true}),{code:'QUOTE_EXPIRED'});
    await service.confirm({quoteId:quote.quoteId,confirmed:true});await service.confirm({quoteId:quote.quoteId,confirmed:true});
    const calls=provider.captures.filter(call=>call.quoteId===quote.quoteId);assert.equal(calls.length,1);const body=calls[0].body;
    assert.equal(body.engineId,candidate.engine.id);assert.equal(body.mode,toEngineGenerationMode(candidate.engine.id,mode));
    for(const selected of action.references??[])assert.ok(JSON.stringify(body).includes(workflowReference(selected.ref.kind,selected.role).storageUrl),'Selected owned media reaches actual dispatch projection');
    const receipts=await pg.pool.query<{amount_cents:number}>(`SELECT amount_cents FROM app_receipts WHERE job_id=$1 AND type='charge'`,[quote.quoteId]);assert.deepEqual(receipts.rows.map(row=>row.amount_cents),[quote.price.amountCents]);
    totalCharge+=quote.price.amountCents;
  });
  assert.equal((await pg.pool.query<{total:number}>(`SELECT sum(amount_cents)::int AS total FROM app_receipts WHERE user_id=$1 AND type='charge'`,[workflowActor.userId])).rows[0].total,totalCharge);
  await t.test('canonical source facts are reread after the strict confirmation lock',async()=>{
    const request={schemaVersion:1 as const,surface:'video' as const,engineId:'wan-3',mode:'i2v' as const,prompt:'Keep this exact image.',settings:{durationSec:5,resolution:'720p',aspectRatio:'16:9',audio:false},references:[{kind:'asset' as const,assetId:workflowAssetIds.image,role:'first_frame' as const}],outputCount:1};
    const quote=await service.prepare(request);const before=provider.captures.length;
    const changedUrl='https://cdn.maxvideoai.com/changed-after-kind.png';let changed=false;const order:string[]=[];
    const refs=await withDbTransaction(async executor=>service.resolveReferences(request,{query:async<T>(sql:string,params?:ReadonlyArray<unknown>)=>{
      const rows=await executor.query<T>(sql,params);
      if(sql.includes('FROM media_assets')&&!sql.includes('FOR SHARE')){
        order.push('canonical');if(!changed){changed=true;await pg.pool.query('UPDATE media_assets SET url=$1 WHERE public_id=$2',[changedUrl,workflowAssetIds.image]);}
      }else if(sql.includes('FOR SHARE OF a'))order.push('strict-lock');
      return rows;
    }} as TransactionQueryExecutor));
    assert.deepEqual(order,['canonical','strict-lock','canonical']);assert.equal(refs[0].storageUrl,changedUrl,'The initial kind read is not trusted as the locked payload');
    await assert.rejects(service.confirm({quoteId:quote.quoteId,confirmed:true}),{code:'QUOTE_EXPIRED'});
    assert.equal(provider.captures.length,before,'Drift never dispatches or buys');
    assert.equal((await pg.pool.query<{count:number}>(`SELECT count(*)::int AS count FROM app_receipts WHERE type='charge' AND job_id=$1`,[quote.quoteId])).rows[0].count,0);
  });
  for(const mode of ['v2v','extend'] as const)await t.test(`Omni ${mode} keeps exact fractional source duration in quote, estimate and confirmation`,async()=>{
    const candidate=catalog.find(c=>c.engine.id==='gemini-omni-flash')!;const prices:number[]=[];
    for(const duration of [3.25,7.75]){
      const metadata={durationSec:duration,originalName:'workflow.mp4',mediaFacts:{source:'probe',durationSec:duration,width:1920,height:1080}};
      await pg.pool.query('UPDATE media_assets SET metadata=$1::jsonb WHERE public_id=$2',[JSON.stringify(metadata),workflowAssetIds.video]);
      const request=await studioMediaRequest(workflowActor,workflowAction(candidate,mode),workflowInput,factories,true) as CanonicalGenerationRequest;
      const prepared=await service.prepare(request);const oauth=await mcp.prepareGeneration!(request,principal(workflowActor.userId));const estimate=await service.estimate(request);
      assert.deepEqual(prepared.price,oauth.price);assert.deepEqual(prepared.price,estimate.price,'Read-only pricing uses the same actual source facts');assert.equal(estimate.outputDurationSec,mode==='v2v'?duration:request.settings.durationSec,'Displayed timing follows recorded canonical pricing facts');
      const expected=await computeCanonicalBillingSnapshot({engine:candidate.engine,durationSec:Number(request.settings.durationSec),resolution:String(request.settings.resolution),aspectRatio:String(request.settings.aspectRatio),mode,hasVideoInput:true,membershipTier:'member',inputImageCount:0,inputVideoDurationSec:duration,...(mode==='v2v'?{inheritedDurationSec:duration}:{})},{pricingPolicy:{loadOverrides:()=>loadPricingPolicyOverridesWithExecutor({query:async<TRecord=unknown>(sql:string,values?:ReadonlyArray<unknown>)=>(await pg.pool.query<TRecord>(sql,values)).rows})}});
      assert.equal(prepared.price.amountCents,expected.totalCents,'Authoritative billing priced from independently supplied measured duration');
      const row=(await pg.pool.query<{pricing_snapshot:{canonicalPricing:{meta:Record<string,unknown>}}}>('SELECT pricing_snapshot FROM mcp_generation_quotes WHERE quote_id=$1',[prepared.quoteId])).rows[0];
      assert.equal(row.pricing_snapshot.canonicalPricing.meta.input_video_duration_sec,duration);assert.equal(row.pricing_snapshot.canonicalPricing.meta.output_duration_sec,mode==='v2v'?duration:request.settings.durationSec);
      await service.confirm({quoteId:prepared.quoteId,confirmed:true});await service.confirm({quoteId:prepared.quoteId,confirmed:true});
      assert.equal(provider.captures.filter(c=>c.quoteId===prepared.quoteId).length,1);
      assert.deepEqual((await pg.pool.query<{amount_cents:number}>("SELECT amount_cents FROM app_receipts WHERE job_id=$1 AND type='charge'",[prepared.quoteId])).rows.map(row=>row.amount_cents),[prepared.price.amountCents]);
      prices.push(prepared.price.amountCents);
    }
    assert.ok(prices[1]>prices[0],'A longer measured input changes the actual customer price');
  });
  await t.test('missing Omni source measurement refuses both transports and estimate without creating a quote or buying media',async()=>{
    const candidate=catalog.find(c=>c.engine.id==='gemini-omni-flash')!;const action=workflowAction(candidate,'v2v');
    const request=await studioMediaRequest(workflowActor,action,workflowInput,factories,true) as CanonicalGenerationRequest;
    await pg.pool.query("UPDATE media_assets SET metadata='{}'::jsonb WHERE public_id=$1",[workflowAssetIds.video]);
    await assert.rejects(studioMediaRequest(workflowActor,action,workflowInput,factories,true),{code:'REFERENCE_INVALID'});
    const before=(await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n;const dispatches=provider.captures.length;
    for(const prepare of [()=>service.prepare(request),()=>mcp.prepareGeneration!(request,principal(workflowActor.userId)),()=>service.estimate(request)])await assert.rejects(prepare(),{code:'REFERENCE_INVALID'});
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,before);assert.equal(provider.captures.length,dispatches);
  });
  await t.test('a paid video response cannot quote a source changed during review and replays without a second model purchase',async()=>{
    await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);CREATE TABLE studio_sequences(id text PRIMARY KEY);INSERT INTO studio_projects VALUES('workflow-project','workflow-owner','Test',NULL);`);
    for(const file of ['42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
    const policy={enabled:true,credits:false,solAllowanceNanoUsd:1_000_000_000,lunaAllowanceNanoUsd:250_000_000,campaignNanoUsd:100_000_000_000,maxAdditionalBudgetCents:2000};
    await chooseStudioAssistance(workflowActor.userId,{action:'authorize_paid',budgetCents:100,tariffVersion:STUDIO_ASSISTANCE_TARIFF.version,expectedRevision:0},policy);
    await pg.pool.query('UPDATE media_assets SET metadata=$1::jsonb WHERE public_id=$2',[JSON.stringify({mediaFacts:{source:'probe',durationSec:6,width:1920,height:1080}}),workflowAssetIds.video]);
    const candidate=catalog.find(c=>c.engine.id==='wan-3')!;const action=workflowAction(candidate,'extend');
    const request=await studioMediaRequest(workflowActor,action,workflowInput,factories,true) as CanonicalGenerationRequest;const reviewed=await service.resolveReferences(request);
    const input={...workflowInput,requestId:randomUUID()};const turn=(await claimImageTurn(workflowActor,input)).turn;
    const before=(await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n;const dispatches=provider.captures.length;let modelCalls=0;
    const run=()=>runStudioImageActions({actor:workflowActor,turn,input,references:reviewed,referenceFingerprint:studioReferenceFingerprint(reviewed),history:[],enabled:true,factory:createStudioVideoGenerationService, factories,mediaEnabled:true,assistancePolicy:policy,countInputTokens:async()=>1000,
      createResponse:async()=>{modelCalls++;await pg.pool.query('UPDATE media_assets SET url=$1 WHERE public_id=$2',['https://cdn.maxvideoai.com/replaced-during-response.mp4',workflowAssetIds.video]);const {action:actionName,...args}=action;return {id:'paid-video-review',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50,output_tokens_details:{reasoning_tokens:0},total_tokens:150},output_text:'',output:[{type:'function_call',name:actionName.replace('.','_'),call_id:'video-drift',arguments:JSON.stringify(args)}]};}});
    await assert.rejects(run(),{code:'REFERENCE_INVALID'});await assert.rejects(run(),{code:'REFERENCE_INVALID'});assert.equal(modelCalls,1);
    const stored=(await pg.pool.query<{draft_json:unknown|null;quote_id:string|null}>('SELECT draft_json,quote_id FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0];assert.equal(stored.draft_json,null);assert.equal(stored.quote_id,null);
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM studio_conversation_responses WHERE request_id=$1',[input.requestId])).rows[0].n,1);
    assert.equal((await pg.pool.query<{n:number}>("SELECT count(*)::int n FROM studio_assistance_calls WHERE request_id=$1 AND state='settled'",[input.requestId])).rows[0].n,1);
    assert.equal((await pg.pool.query<{n:number}>("SELECT count(*)::int n FROM app_receipts WHERE type='charge' AND job_id IN (SELECT 'studio-assistance:'||id FROM studio_assistance_calls WHERE request_id=$1)",[input.requestId])).rows[0].n,1);
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,before);assert.equal(provider.captures.length,dispatches);
  });
  assert.equal(provider.captures.length,catalog.reduce((total,candidate)=>total+candidate.publicModes.length,0)+4);
});
