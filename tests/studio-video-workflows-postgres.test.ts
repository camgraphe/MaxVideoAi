import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
import {ensureExecutableFfmpegPath} from '../frontend/server/ffmpeg-runtime';
import {getDb,withDbTransaction,type TransactionQueryExecutor} from '../frontend/src/lib/db';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import {addTopup,ProviderHarness,createServices,principal} from './helpers/mcp-paid-e2e-harness';
import {workflowCatalog,workflowActor,workflowInput,workflowAction,workflowAssetIds,workflowReference,workflowLumaSource,workflowLumaSourceRow} from './helpers/studio-video-workflow-fixtures';
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
import {priceCanonicalGeneration,priceCanonicalGenerationInExecutor,type ExecutorGenerationPricingDependencies} from '../frontend/src/server/agent-api/generation-pricing';
import type {PrepareGenerationDependencies} from '../frontend/src/server/agent-api/prepare-generation';
import type {ConfirmGenerationDependencies} from '../frontend/src/server/agent-api/confirm-generation';
import {loadEffectiveCustomerTariffState} from '../frontend/server/pricing/customer-tariff-store';
import {continuousInputTariffSelector} from '../frontend/src/lib/pricing-manual-scenario';
import {collectSellableManualTariffCoverage} from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import {customerTariffCellId} from '../frontend/server/pricing/customer-tariff-seed';
import {videoOperationTariffIdentity} from '../frontend/lib/video-operation';
import {prepareVideoOperationTariffs} from '../frontend/server/pricing/video-operation-tariffs';
import {operationTariffState,operationPolicy,operationIdentity} from './helpers/video-operation-tariff-fixture';
import {qualifyFluxDraftPair} from '../frontend/server/flux-draft-cache';
import {resolveFluxDraftOrigin,persistQualifiedFluxDraftSource} from '../frontend/server/flux-draft-cache-store';
import {publicMediaTransport} from '../frontend/server/public-media-transport';
import {ENV} from '../frontend/src/lib/env';
import {klingV4TariffScenarios} from '../frontend/lib/pricing-audit/kling-v4-tariff-scenario';
import {prepareContinuousInputTariffChange} from '../frontend/server/pricing-admin/continuous-input-tariff';
import {resolveGenerationReferencesForActor} from '../frontend/src/server/agent-api/resolve-generation-references';
import {resolveOwnedReferenceAssetForActor} from '../frontend/src/server/agent-api/reference-assets';

test('all certified video tuples share MCP exact price, owned payload and one-attempt confirmed dispatch',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined,'Disposable DB only');
  const readiness={BYTEPLUS_ARK_ENABLED:'true',BYTEPLUS_ARK_API_KEY:'fixture-ark',
    SEEDANCE_2_5_BYTEPLUS_ENABLED:'true',SEEDANCE_2_5_PROVIDER:'byteplus_modelark',
    SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY:'false',SEEDANCE_2_5_BYTEPLUS_MODES:'t2v,i2v,ref2v,v2v,extend',
    SEEDANCE_2_5_LAS_ENABLED:'true',BYTEPLUS_LAS_API_KEY:'fixture-las'};
  const previousReadiness=Object.fromEntries(Object.keys(readiness).map(key=>[key,ENV[key as keyof typeof ENV]]));
  Object.assign(ENV,readiness);
  t.after(()=>{Object.assign(ENV,previousReadiness);});
  const pg=await startDisposablePostgres('studio-video-workflows');process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE app_pricing_change_events(domain text);`);
  await pg.pool.query(readFileSync('neon/migrations/54_customer_tariff_cells.sql','utf8'));
  await pg.pool.query(readFileSync('neon/migrations/55_customer_tariff_versions.sql','utf8'));
  const lasScenario=collectSellableManualTariffCoverage({modelId:'seedance-2-5',mode:'v2v'}).scenarios.find(s=>
    s.selector.resolution==='480p'&&s.selector.durationSec==='4'&&s.selector.aspectRatio==='16:9')!;
  const lasSelector=continuousInputTariffSelector(lasScenario.selector)!;
  await pg.pool.query(`INSERT INTO app_customer_tariff_cells(id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
    VALUES($1,$2,$3,$4,'USD','2026-10-02',1,'11111111-1111-4111-8111-111111111111')`,[
    customerTariffCellId(Object.entries(lasSelector).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('|')),
    JSON.stringify(Object.entries(lasSelector).sort(([a],[b])=>a.localeCompare(b))),lasSelector,
    {kind:'unit_components',rounding:'up',components:[{id:'retail',rounding:'none',flatCents:123.018,
      terms:[{unit:'input_video_seconds',centsPerUnit:30.7545,includedUnits:0}]}]},
  ]);
  const operationTariffs=await prepareVideoOperationTariffs({...operationIdentity,state:operationTariffState(),policy:operationPolicy});
  for(const cell of operationTariffs.cells)await pg.pool.query(`INSERT INTO app_customer_tariff_cells(id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
    VALUES($1,$2,$3,$4,'USD','2026-10-02',1,$5)`,[cell.id,JSON.stringify(Object.entries(cell.selector).sort(([a],[b])=>a.localeCompare(b))),cell.selector,cell.price,operationIdentity.actorId]);
  // New V4 offers have no legacy policy price. Seed only the four selected local
  // fixture classes, using real canonical tariff compilation for Modify's curve.
  const klingFixtures=klingV4TariffScenarios().filter(s=>s.context.resolution==='720p'&&s.context.durationSec===3
    &&(s.context.mode!=='ref2v'||!s.context.hasVideoInput));
  assert.equal(klingFixtures.length,4);
  for(const scenario of klingFixtures){
    const cell=scenario.context.mode==='v2v'?(await prepareContinuousInputTariffChange({scenario,
      state:operationTariffState(),policy:operationPolicy,proposal:{operation:'create',scenarioId:scenario.id,
        scope:'continuous_input',price:{kind:'kling_v4_billable',customerCentsPerBillableSecond:14.1}}})).proposedCell!
      :{id:`fixture-${scenario.id}`,selector:scenario.selector,price:{kind:'fixed',customerCents:71}};
    await pg.pool.query(`INSERT INTO app_customer_tariff_cells(id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES($1,$2,$3,$4,'USD','2026-10-02',1,$5)`,[cell.id,JSON.stringify(Object.entries(cell.selector).sort(([a],[b])=>a.localeCompare(b))),cell.selector,cell.price,operationIdentity.actorId]);
  }
  await pg.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
  await pg.pool.query(readFileSync('neon/migrations/53_studio_media_generation_scope.sql','utf8'));
  await addTopup(pg.pool,workflowActor.userId,10000000);
  await pg.pool.query(`CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,status text,position int,url text,storage_url text,metadata jsonb);
    CREATE TABLE provider_attempts(id bigserial PRIMARY KEY,job_id bigint,provider text,provider_model text,status text,provider_job_id text,request_snapshot jsonb);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
  for(const ref of [...(['image','video','audio'] as const).map(kind=>workflowReference(kind,'source')),workflowReference('video','source',undefined,'luma-ray-3-2')]){await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata) VALUES($1,$1,$2,$3,$4,$5,$6,$7,$8,'ready',$9::jsonb)`,[ref.assetId,workflowActor.userId,ref.mediaKind,ref.storageUrl,ref.mimeType,ref.sizeBytes,ref.width,ref.height,JSON.stringify({durationSec:ref.durationSec,originalName:ref.originalName,mediaFacts:{source:'probe',durationSec:ref.durationSec,width:ref.width,height:ref.height}})]);}
  const source=workflowLumaSource;
  const sourceJob=(await pg.pool.query<{id:number}>(`INSERT INTO app_jobs(job_id,user_id,engine_id,surface,status,provider,provider_job_id,video_url)
    VALUES($1,$2,'luma-ray-3-2','video','completed','luma_agents_direct',$3,$4) RETURNING id`,[source.sourceJobId,source.ownerId,workflowLumaSourceRow.provider_job_id,source.originalUrl])).rows[0];
  await pg.pool.query(`INSERT INTO provider_attempts(job_id,provider,provider_model,status,provider_job_id,request_snapshot)
    VALUES($1,'luma_agents_direct','ray-3.2','completed',$2,'{}')`,[sourceJob.id,workflowLumaSourceRow.provider_job_id]);
  await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,status,position,url) VALUES($1,$2,$3,'video','ready',0,$4)`,[source.outputId,source.sourceJobId,source.ownerId,source.originalUrl]);
  await pg.pool.query('UPDATE media_assets SET source_job_id=$1,source_output_id=$2 WHERE public_id=$3 AND user_id=$4',[source.sourceJobId,source.outputId,source.assetId,source.ownerId]);
  await pg.pool.query(readFileSync('neon/migrations/79_flux_draft_cache_sources.sql','utf8'));
  await pg.pool.query(readFileSync('neon/migrations/80_flux_draft_origin_provenance.sql','utf8'));
  const draftUrl=workflowReference('video','source').storageUrl;
  const draftJob=(await pg.pool.query<{id:number}>(`INSERT INTO app_jobs(job_id,user_id,engine_id,surface,status,provider,provider_job_id,video_url)
    VALUES('workflow-draft-source',$1,'flux-3-draft','video','completed','fal','draft-provider-request',$2) RETURNING id`,[workflowActor.userId,draftUrl])).rows[0];
  await pg.pool.query(`INSERT INTO provider_attempts(job_id,provider,provider_model,status,provider_job_id,request_snapshot)
    VALUES($1,'fal','blackforestlabs/flux-3/image-to-video/draft','completed','draft-provider-request','{}')`,[draftJob.id]);
  await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,status,position,url,metadata)
    VALUES('workflow-draft-output','workflow-draft-source',$1,'video','ready',0,$2,$3)`,[workflowActor.userId,draftUrl,{mediaFacts:{original:{url:draftUrl,sha256:'a'.repeat(64)}}}]);
  await pg.pool.query(`UPDATE media_assets SET source_job_id='workflow-draft-source',source_output_id='workflow-draft-output' WHERE public_id=$1`,[workflowAssetIds.video]);
  const draftOrigin=await resolveFluxDraftOrigin({userId:workflowActor.userId,sourceJobId:'workflow-draft-source',sourceOutputId:'workflow-draft-output'});
  const paired=qualifyFluxDraftPair(draftOrigin,{providerRequestId:'draft-provider-request',providerVideoUrl:'https://v3.fal.media/draft.mp4',cacheUrl:'https://v3.fal.media/cache.bin',
    ownedSha256:draftOrigin.outputSha256,videoIdentity:'fixture-video',ownedVideoIdentity:'fixture-video',audioIdentity:null,ownedAudioIdentity:null,durationSec:10.041667,fps:24,decodedFrameCount:241});
  await withDbTransaction(executor=>persistQualifiedFluxDraftSource(paired,executor));
  const mediaDirectory=await mkdtemp(join(tmpdir(),'operation-workflow-media-'));
  t.after(()=>rm(mediaDirectory,{recursive:true,force:true}));
  const videoFile=join(mediaDirectory,'source.mp4');
  await promisify(execFile)(await ensureExecutableFfmpegPath(ffmpeg.path),['-v','error','-f','lavfi','-i','color=c=blue:s=1920x1080:r=24:d=6','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-y',videoFile]);
  const sourceBytes=await readFile(videoFile);let servedSourceBytes=sourceBytes;
  // Local bytes exercise real source probes; only HTTPS transport/cache reachability is stubbed.

  t.mock.method(publicMediaTransport,'lookupHost',async()=>[{address:'8.8.8.8',family:4}]);
  t.mock.method(publicMediaTransport,'openPinnedHttps',async(url:URL)=>{assert.ok([paired.cacheUrl,draftUrl].includes(url.href));const bytes=url.href===paired.cacheUrl?Buffer.from([1]):servedSourceBytes;return {statusCode:200,headers:{'content-type':url.href===paired.cacheUrl?'application/octet-stream':'video/mp4','content-length':String(bytes.length)},body:(async function*(){yield bytes;})()};});
  const catalog=await workflowCatalog();const provider=new ProviderHarness(pg.pool);
  const lasPricing=async(request:CanonicalGenerationRequest,tier:Parameters<typeof priceCanonicalGeneration>[1],deps:ExecutorGenerationPricingDependencies)=>
    priceCanonicalGenerationInExecutor(request,tier,{...deps,computeBillingSnapshot:async(context,options)=>{
      // This broad legacy matrix keeps its existing ModelArk policy fixture.
      // LAS and new operation offers use real stored reviewed cells, through the canonical
      // calculator's existing explicit fixture reader. Dedicated LAS paid-flow
      // tests exercise the default production reader and actual provider client.
      const state=await loadEffectiveCustomerTariffState(deps.executor);
      if(state.status!=='loaded')throw new Error('The reviewed LAS fixture grid is unavailable');
      const [raw]=await deps.executor.query<{active:boolean}>('SELECT active FROM app_customer_tariff_state WHERE singleton=TRUE');
      return computeCanonicalBillingSnapshot(context,{...options,loadCustomerTariffState:async()=>({...state,active:raw.active})});
    }});
  const hasReviewedTariff=(request:CanonicalGenerationRequest)=>request.engineId==='kling-v4'||Boolean(videoOperationTariffIdentity(request.engineId,request.mode,request.operation))||(request.engineId==='veo-3-1'&&request.mode==='i2v'&&[4,6].includes(Number(request.settings.durationSec)))||(request.engineId==='seedance-2-5'&&request.mode==='v2v');
  const preparePrice:PrepareGenerationDependencies['priceGeneration']=async(request,tier,refs)=>hasReviewedTariff(request)
    ?withDbTransaction(executor=>lasPricing(request,tier,{executor,candidate:catalog.find(c=>c.engine.id===request.engineId)!,resolvedReferences:refs.resolvedReferences,fluxDraftSource:refs.fluxDraftSource}))
    :priceCanonicalGeneration(request,tier,undefined,refs);
  const confirmPrice:ConfirmGenerationDependencies['priceGeneration']=async(request,tier,deps)=>hasReviewedTariff(request)
    ?lasPricing(request,tier,deps):priceCanonicalGenerationInExecutor(request,tier,deps);
  const executable=()=>({executable:true as const,reason:'available' as const});
  const klingMedia={detectVideoMetadataFn:async()=>({width:1920,height:1080,durationSec:6,fps:24})};
  const prepareReferences:PrepareGenerationDependencies['resolveGenerationReferences']=(request,actor)=>resolveGenerationReferencesForActor(request,actor,
    {resolveOwnedReferenceAsset:resolveOwnedReferenceAssetForActor,klingV4MediaDependencies:klingMedia});
  const confirmReferences:ConfirmGenerationDependencies['resolveGenerationReferences']=(request,actor,{executor})=>resolveGenerationReferencesForActor(request,actor,
    {resolveOwnedReferenceAsset:(current,id)=>resolveOwnedReferenceAssetForActor(current,id,{executor}),klingV4MediaDependencies:klingMedia});
  const options={enabled:true,referenceDependencies:{klingV4Media:klingMedia},prepareDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:executable,priceGeneration:preparePrice},confirmDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:executable,submitPaidGeneration:provider.submit,priceGeneration:confirmPrice}};
  const service=createStudioVideoGenerationService(workflowActor,options);
  const factories={video:()=>service} as unknown as StudioMediaFactories;
  const mcp=createServices({publicEngines:catalog,resolveRequestExecutability:executable,submitPaidGeneration:provider.submit,
    preparePriceGeneration:preparePrice,confirmPriceGeneration:confirmPrice,
    prepareResolveGenerationReferences:prepareReferences,confirmResolveGenerationReferences:confirmReferences});
  let totalCharge=0;
  for(const candidate of catalog)for(const mode of candidate.publicModes)await t.test(candidate.engine.id+' '+mode,async()=>{
    const action=workflowAction(candidate,mode);const request=await studioMediaRequest(workflowActor,action,workflowInput,factories,true) as CanonicalGenerationRequest;
    const before=provider.captures.length;const quote=await service.prepare(request);const oauthQuote=await mcp.prepareGeneration!(request,principal(workflowActor.userId));
    assert.deepEqual(quote.summary,oauthQuote.summary,'Same canonical request');assert.equal(quote.requestHash,oauthQuote.requestHash);assert.deepEqual(quote.price,oauthQuote.price,'Same real persisted tariff and owned facts');
    assert.ok(Number.isSafeInteger(quote.price.amountCents)&&quote.price.amountCents>0);assert.equal(provider.captures.length,before,'Preparation never dispatches');
    if(candidate.engine.id==='kling-v4')assert.equal(quote.price.amountCents,mode==='v2v'?127:71,
      'V4 uses its stored native fixture price and the measured 6-second Modify source');
    if(candidate.engine.id==='seedance-2-5'&&mode==='v2v')assert.equal(quote.price.amountCents,308,'LAS quotes the measured 6-second source plus 4-second output from its reviewed literal tariff');
    await assert.rejects(mcp.confirmGeneration!({quoteId:quote.quoteId,confirmed:true},principal(workflowActor.userId)),{code:'QUOTE_EXPIRED'});
    await assert.rejects(createStudioVideoGenerationService({...workflowActor,projectId:'other'},options).confirm({quoteId:quote.quoteId,confirmed:true}),{code:'QUOTE_EXPIRED'});
    await assert.rejects(createStudioVideoGenerationService({...workflowActor,userId:'foreign'},options).confirm({quoteId:quote.quoteId,confirmed:true}),{code:'QUOTE_EXPIRED'});
    await service.confirm({quoteId:quote.quoteId,confirmed:true});await service.confirm({quoteId:quote.quoteId,confirmed:true});
    if(candidate.engine.id==='seedance-2-5'&&mode==='v2v')assert.equal((await pg.pool.query<{provider:string}>(
      'SELECT provider FROM app_jobs WHERE job_id=$1',[quote.quoteId])).rows[0].provider,'byteplus_modelark','The LAS reservation uses the executable provider identity');
    const calls=provider.captures.filter(call=>call.quoteId===quote.quoteId);assert.equal(calls.length,1);const body=calls[0].body;
    assert.equal(body.engineId,candidate.engine.id);assert.equal(body.mode,toEngineGenerationMode(candidate.engine.id,mode));
    if(candidate.engine.id==='luma-ray-3-2'&&mode==='extend'){assert.equal(request.sourceJobId,source.sourceJobId);assert.equal(request.sourceOutputId,source.outputId);assert.equal(body.sourceJobId,source.sourceJobId);assert.equal(body.sourceOutputId,source.outputId);assert.deepEqual(request.references,[]);}
    else if(request.operation==='flux-draft-enhance'){assert.equal(request.sourceJobId,'workflow-draft-source');assert.equal(request.sourceOutputId,'workflow-draft-output');assert.deepEqual(request.references,[]);
      const stored=(await pg.pool.query('SELECT pricing_snapshot FROM app_jobs WHERE job_id=$1',[quote.quoteId])).rows[0];assert.equal(stored.pricing_snapshot.base.seconds,10.041667,'Paired Draft quantity remains distinct from the ordinary 6s media metadata');}
    else for(const selected of action.references??[])assert.ok(JSON.stringify(body).includes(workflowReference(selected.ref.kind,selected.role,undefined,candidate.engine.id).storageUrl),'Selected owned media reaches actual dispatch projection');
    const receipts=await pg.pool.query<{amount_cents:number}>(`SELECT amount_cents FROM app_receipts WHERE job_id=$1 AND type='charge'`,[quote.quoteId]);assert.deepEqual(receipts.rows.map(row=>row.amount_cents),[quote.price.amountCents]);
    totalCharge+=quote.price.amountCents;
  });
  assert.equal((await pg.pool.query<{total:number}>(`SELECT sum(amount_cents)::int AS total FROM app_receipts WHERE user_id=$1 AND type='charge'`,[workflowActor.userId])).rows[0].total,totalCharge);
  await t.test('new source-operation confirmation rejects changed bytes at an unchanged owned URL before debit',async()=>{
    const candidate=catalog.find(c=>c.engine.id==='flux-3')!;
    const request=await studioMediaRequest(workflowActor,workflowAction(candidate,'v2v'),workflowInput,factories,true) as CanonicalGenerationRequest;
    const prepared=await service.prepare(request);const dispatches=provider.captures.length;
    // A valid MP4 with an extra trailing byte preserves timing but changes its bound hash.
    servedSourceBytes=Buffer.concat([sourceBytes,Buffer.from([0])]);
    try {
      await assert.rejects(service.confirm({quoteId:prepared.quoteId,confirmed:true}),{code:'QUOTE_EXPIRED'});
      assert.equal(provider.captures.length,dispatches);
      assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE job_id=$1 AND type='charge'",[prepared.quoteId])).rows[0].n,0);
      assert.equal((await pg.pool.query('SELECT url FROM media_assets WHERE public_id=$1',[workflowAssetIds.video])).rows[0].url,draftUrl);
    } finally {servedSourceBytes=sourceBytes;}
  });
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
