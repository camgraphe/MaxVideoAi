import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {initializeStudioConnectedFixture,STUDIO_CONNECTED_ASSET_IDS} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {createStudioConversationProject} from '../frontend/src/server/studio/conversation-project-command';
import {readStudioWorkspace} from '../frontend/src/server/studio/workspace-command';
import type {QueryExecutor} from '../frontend/src/lib/db';
import {getDb} from '../frontend/src/lib/db';
import {createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {addTopup,ProviderHarness} from './helpers/mcp-paid-e2e-harness';
import {readFileSync} from 'node:fs';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {resolveStudioMedia} from '../frontend/src/server/studio/media-resolver';
import {studioExtensionSourceSnapshot} from '../frontend/src/server/studio/conversation-extension-assembly';

test('extension planning preserves the original already on the timeline and declines edited or non-boundary sources',async()=>{
  const {planStudioExtensionAssembly}=await import('../frontend/src/server/studio/conversation-extension-assembly');
  const source={type:'asset',assetId:STUDIO_CONNECTED_ASSET_IDS.a,kind:'video'};
  const action={action:'video.prepare',mode:'extend',source,settings:[]} as never;
  const timeline={sequenceId:'sequence',revision:4,fps:30,clips:[]} as never;
  const snapshot={sourceOriginalHash:'a'.repeat(64),sourceDurationSec:5,sourceSizeBytes:1024};
  assert.equal(planStudioExtensionAssembly(action,timeline,5,snapshot)?.includeSource,true);
  assert.equal(planStudioExtensionAssembly({...action as object,assembleExtension:false} as never,timeline,5,snapshot),undefined,'An explicit continuation-only request leaves the timeline alone.');
  const clip={id:'original',ref:source,kind:'video',startFrame:0,durationFrames:150,sourceInFrame:0};
  const existing={...timeline as object,clips:[clip]} as never;
  const planned=planStudioExtensionAssembly(action,existing,5,snapshot)!;
  assert.equal(planned.includeSource,false);assert.equal(planned.expectedRevision,4);
  for(const change of [{durationFrames:120},{sourceInFrame:1}]){
    const next={...timeline as object,clips:[{...clip,...change}]} as never;
    assert.equal(planStudioExtensionAssembly(action,next,5,snapshot),undefined);
  }
  assert.equal(planStudioExtensionAssembly(action,{...timeline as object,clips:[clip,{...clip,id:'later',ref:{...source,assetId:'other'},startFrame:150}]} as never,5,snapshot),undefined);
});

test('a confirmed completed continuation finishes its frozen sequence once, while a manual revision blocks assembly',async t=>{
  const {finishStudioExtensionAssembly}=await import('../frontend/src/server/studio/conversation-extension-assembly');
  const pg=await startDisposablePostgres('studio-extension-finish');t.after(()=>pg.cleanup());
  await initializeStudioConnectedFixture(pg);
  const actor={userId:STUDIO_FIXTURE_OWNERS[0]};
  const withTransaction=async<T>(run:(executor:QueryExecutor)=>Promise<T>)=>{const client=await pg.pool.connect();try{await client.query('BEGIN');const result=await run({query:async(sql,values)=>(await client.query(sql,values)).rows});await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}};
  const deps={withTransaction,featureEnabled:true};
  const project=await createStudioConversationProject(actor,{name:'Five plus five',idempotencyKey:randomUUID()},deps);
  await pg.pool.query(`ALTER TABLE app_jobs ADD COLUMN status text;
    CREATE TABLE studio_image_turns(user_id text,project_id text,request_id uuid,quote_id uuid,draft_json jsonb);
    CREATE TABLE mcp_generation_quotes(quote_id uuid,user_id text,job_id text,studio_project_id text,auth_origin text,state text,request_json jsonb);
    UPDATE media_assets SET url='https://cdn.maxvideoai.com/source.mp4',metadata='{"mediaFacts":{"source":"probe","durationSec":5,"width":320,"height":180,"hasAudio":true}}';`);
  const requestId=randomUUID(),quoteId=randomUUID(),outputId=randomUUID();
  const source={type:'asset',assetId:STUDIO_CONNECTED_ASSET_IDS.a,kind:'video'};
  const original=await resolveStudioMedia(actor.userId,source,async(sql,values)=>(await pg.pool.query(sql,values)).rows);
  const plan={sequenceId:project.sequenceId,expectedRevision:0,fps:30,source,includeSource:true,position:'after',...studioExtensionSourceSnapshot(original)};
  await pg.pool.query("INSERT INTO studio_image_turns VALUES($1,$2,$3,$4,$5::jsonb)",[actor.userId,project.projectId,requestId,quoteId,JSON.stringify({extensionAssembly:plan})]);
  await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status) VALUES('continuation',$1,'completed')",[actor.userId]);
  await pg.pool.query("INSERT INTO mcp_generation_quotes VALUES($1,$2,'continuation',$3,'studio-session','prepared','{\"mode\":\"extend\"}')",[quoteId,actor.userId,project.projectId]);
  await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url,mime_type,status,metadata) VALUES($1,'continuation',$2,'video','https://cdn.maxvideoai.com/continuation.mp4','video/mp4','ready','{\"mediaFacts\":{\"source\":\"probe\",\"durationSec\":5,\"width\":320,\"height\":180,\"hasAudio\":true}}')",[outputId,actor.userId]);
  const commandDeps={query:async<T>(sql:string,values:readonly unknown[]=[])=> (await pg.pool.query(sql,[...values])).rows as T[],editDependencies:deps};
  await assert.rejects(finishStudioExtensionAssembly({...actor,projectId:project.projectId},requestId,commandDeps),/EXTENSION_NOT_READY/);
  await pg.pool.query("UPDATE mcp_generation_quotes SET state='accepted'");
  await pg.pool.query('UPDATE studio_projects SET revision=1 WHERE id=$1',[project.projectId]);
  await assert.rejects(finishStudioExtensionAssembly({...actor,projectId:project.projectId},requestId,commandDeps),{code:'STUDIO_REVISION_CONFLICT'});
  assert.deepEqual((await readStudioWorkspace(actor,project.projectId,deps)).sequences[0].timelineState.timelineItems,[]);
  await pg.pool.query('UPDATE studio_projects SET revision=0 WHERE id=$1',[project.projectId]);
  await pg.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/replacement.mp4'");
  await assert.rejects(finishStudioExtensionAssembly({...actor,projectId:project.projectId},requestId,commandDeps),{code:'EXTENSION_SOURCE_CHANGED'});
  assert.deepEqual((await readStudioWorkspace(actor,project.projectId,deps)).sequences[0].timelineState.timelineItems,[]);
  await pg.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/source.mp4'");
  await pg.pool.query("UPDATE job_outputs SET metadata='{}'");
  await assert.rejects(finishStudioExtensionAssembly({...actor,projectId:project.projectId},requestId,{
    ...commandDeps,editDependencies:{...deps,hydrateVideoFacts:async()=>{
      await pg.pool.query(`UPDATE job_outputs SET metadata='{"mediaFacts":{"source":"probe","durationSec":5,"width":320,"height":180,"hasAudio":true}}';
        UPDATE media_assets SET url='https://cdn.maxvideoai.com/replaced-during-qualification.mp4'`);
      return undefined as never;
    }},
  }),{code:'EXTENSION_SOURCE_CHANGED'});
  assert.deepEqual((await readStudioWorkspace(actor,project.projectId,deps)).sequences[0].timelineState.timelineItems,[]);
  await pg.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/source.mp4'");
  await pg.pool.query(`UPDATE media_assets SET metadata='{"durationSec":5}'`);
  const legacy=await resolveStudioMedia(actor.userId,source,async(sql,values)=>(await pg.pool.query(sql,values)).rows);
  await pg.pool.query('UPDATE studio_image_turns SET draft_json=$1::jsonb',[JSON.stringify({extensionAssembly:{...plan,...studioExtensionSourceSnapshot(legacy)}})]);
  const first=await finishStudioExtensionAssembly({...actor,projectId:project.projectId},requestId,{
    ...commandDeps,editDependencies:{...deps,hydrateVideoFacts:async()=>{
      await pg.pool.query(`UPDATE media_assets SET metadata='{"durationSec":5.02,"mediaFacts":{"source":"probe","durationSec":5.02,"width":320,"height":180,"hasAudio":true}}'`);
      return undefined as never;
    }},
  });
  assert.equal(first.totalFrames,300);assert.equal(first.clipCount,2);
  assert.deepEqual(await finishStudioExtensionAssembly({...actor,projectId:project.projectId},requestId,commandDeps),first);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM studio_project_commands WHERE command_kind='conversation_timeline_edit'")).rows[0].n,1);
  await assert.rejects(finishStudioExtensionAssembly({...actor,userId:STUDIO_FIXTURE_OWNERS[1],projectId:project.projectId},requestId,commandDeps),/EXTENSION_NOT_READY/);
});

test('one Studio extension request persists its plan, confirms one generation and assembles the completed output without another model call',async t=>{
  const {finishStudioExtensionAssembly}=await import('../frontend/src/server/studio/conversation-extension-assembly');
  const pg=await startDisposablePostgres('studio-extension-flow');const prior=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const name of ['26_studio_projects.sql','42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql'])await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  const actor={authMethod:'studio-session' as const,userId:STUDIO_FIXTURE_OWNERS[0],clientId:null,projectId:''};
  const project=await createStudioConversationProject(actor,{name:'Extend my clip',idempotencyKey:randomUUID()},{featureEnabled:true});actor.projectId=project.projectId;
  await addTopup(pg.pool,actor.userId,1000);
  const source={type:'asset' as const,kind:'video' as const,assetId:STUDIO_CONNECTED_ASSET_IDS.a};
  await pg.pool.query(`CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,mime_type text,status text,duration_sec double precision,metadata jsonb,created_at timestamptz DEFAULT clock_timestamp());
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
  await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
      VALUES('source',$1,$2,'video','https://cdn.maxvideoai.com/source.mp4','video/mp4',1024,1280,720,'ready','{"durationSec":5,"mediaFacts":{"source":"probe","durationSec":5,"width":1280,"height":720,"hasAudio":true}}');`,[source.assetId,actor.userId]);
  const entry=getFalEngineById('wan-3')!,provider=new ProviderHarness(pg.pool);
  const catalog=[{engine:entry.engine,surface:'video' as const,publicModes:['extend' as const],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}];
  const price=async()=>({priceCents:66,currency:'USD',membershipTier:'member' as const,pricingSnapshot:{totalCents:66,currency:'USD',membershipTier:'member'}});
  const dependencies={listPublicEngines:async()=>catalog,resolveRequestExecutability:()=>({executable:true as const,reason:'available' as const}),priceGeneration:price,
    resolveMembershipPricing:async()=>({tier:'member' as const,source:'app_receipts_rolling_30d' as const,spent30Cents:0,thresholdCents:0,discountPercent:0})};
  let modelCalls=0;
  const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,mediaEnabled:true,editingEnabled:true,
    videoGenerationFactory:(who,options)=>createStudioVideoGenerationService(who,{...options,prepareDependencies:dependencies,confirmDependencies:{...dependencies,submitPaidGeneration:provider.submit}}),
    createActionResponse:async()=>{modelCalls++;return {id:'extend-response',model:'gpt-6-luna',status:'completed',usage:null,service_tier:'default',output_text:'',output:[{type:'function_call',name:'video_prepare',call_id:'extend',arguments:JSON.stringify({reply:'Review the five-second continuation quote.',prompt:'Continue the street scene naturally.',aspectRatio:'16:9',source,modelId:'wan-3',mode:'extend',settings:[{name:'durationSec',value:5},{name:'resolution',value:'480p'},{name:'aspectRatio',value:'16:9'}],outputCount:1,references:[]})}]};}});
  const requestId=randomUUID();
  const prepared=await service.submit({requestId,message:'Add five seconds to make a ten-second sequence with Wan 3.',references:[],attachments:[source]});
  assert.equal(prepared.extensionAssembly?.state,'pending');assert.ok(prepared.quote);
  assert.equal(provider.captures.length,0);
  await service.confirm({requestId,quoteId:prepared.quote!.quoteId,confirmed:true});
  assert.equal(provider.captures.length,1);
  const jobId=prepared.quote!.quoteId;
  await pg.pool.query("UPDATE app_jobs SET status='completed',video_url='https://cdn.maxvideoai.com/continuation.mp4' WHERE job_id=$1",[jobId]);
  await assert.rejects(finishStudioExtensionAssembly(actor,requestId),{code:'EXTENSION_NOT_READY'});
  await pg.pool.query("INSERT INTO job_outputs VALUES($1,$2,$3,'video','https://cdn.maxvideoai.com/continuation.mp4','video/mp4','ready',5,'{\"mediaFacts\":{\"source\":\"probe\",\"durationSec\":5,\"width\":1280,\"height\":720,\"hasAudio\":true}}',clock_timestamp())",[randomUUID(),jobId,actor.userId]);
  const saved=await finishStudioExtensionAssembly(actor,requestId);
  assert.equal(saved.totalFrames,300);assert.equal(saved.clipCount,2);
  assert.deepEqual(await finishStudioExtensionAssembly(actor,requestId),saved);
  assert.equal(modelCalls,1);assert.equal(provider.captures.length,1);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,1);
});
