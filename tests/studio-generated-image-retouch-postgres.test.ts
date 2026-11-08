import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {ensureMediaLibrarySchema} from '../frontend/src/lib/schema/media-library-schema';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {validateStudioImageRequest} from '../frontend/src/server/studio/conversation-image-preparation';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import {addTopup,ProviderHarness} from './helpers/mcp-paid-e2e-harness';

test('Milo retouches an exact generated project image without attachments and recovers the native draft without another response or charge',async t=>{
  const pg=await startDisposablePostgres('studio-retouch');
  const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);
    CREATE TABLE studio_sequences(id text PRIMARY KEY);
    INSERT INTO studio_projects VALUES('film','owner','Image retouch',NULL),('other','owner','Another project',NULL),('foreign','foreign','Private',NULL);`);
  for(const name of ['42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql'])
    await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  // Explicit disposable fixture initialization; production reads never bootstrap these tables.
  await ensureMediaLibrarySchema();
  await addTopup(pg.pool,'owner',1000);
  const output={type:'job-output' as const,kind:'image' as const,jobId:'generated-job',outputId:'generated-job:image:0'};
  const assetId='ma_'+'a'.repeat(32);
  const original='https://cdn.maxvideoai.com/generated.png',saved='https://cdn.maxvideoai.com/saved.png';
  await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,engine_id,engine_label,status) VALUES('generated-job','owner','gpt-image-2','Image','completed')");
  await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url,mime_type,width,height,status) VALUES('generated-job:image:0','generated-job','owner','image',$1,'image/png',1024,1024,'ready')",[original]);
  await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,thumb_url,mime_type,width,height,size_bytes,source,source_job_id,source_output_id,status,metadata)
      VALUES('output:generated-job:image:0',$2,'owner','image',$3,$1,'image/png',1024,1024,4096,'saved_job_output','generated-job','generated-job:image:0','ready',jsonb_build_object('originUrl',$1::text))`,[original,assetId,saved]);
  await pg.pool.query(`INSERT INTO mcp_generation_quotes(quote_id,user_id,request_json,request_hash,catalog_revision,pricing_snapshot,price_cents,currency,funding_mode,state,expires_at,auth_origin,studio_project_id)
      VALUES('10000000-0000-4000-8000-000000000001','owner','{"schemaVersion":1,"surface":"image"}',repeat('a',64),'catalog','{}',1,'USD','wallet','prepared',now()+interval '45 minutes','studio-session','film');
    UPDATE mcp_generation_quotes SET state='claimed',job_id='generated-job',claimed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE state='prepared';
    UPDATE mcp_generation_quotes SET state='accepted',updated_at=clock_timestamp() WHERE state='claimed';`);
  const entry=getFalEngineById('gpt-image-2')!;
  const catalog=[{engine:entry.engine,surface:'image' as const,publicModes:['t2i' as const,'i2i' as const],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}];
  const provider=new ProviderHarness(pg.pool);
  let interrupt=true,responses=0;
  const factory:typeof createStudioImageGenerationService=(actor,options)=>{
    const generation=createStudioImageGenerationService(actor,{...options,
      prepareDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:()=>({executable:true,reason:'available'})},
      confirmDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:()=>({executable:true,reason:'available'}),submitPaidGeneration:provider.submit},
    });
    return {...generation,prepare:async request=>{
      if(interrupt){interrupt=false;throw new Error('Interrupted after native draft and copy validation');}
      return generation.prepare(request);
    }};
  };
  const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
  const image={prompt:'Keep the original scene and shorten the object.',aspectRatio:'1:1',modelId:'gpt-image-2',mode:'i2i',
    settings:[{name:'resolution',value:'1024x1024'},{name:'quality',value:'medium'},{name:'outputFormat',value:'png'}],
    references:[{ref:output,role:'reference',slot:null}],outputCount:1};
  const createResponse=async()=>{
    responses++;
    return {id:'retouch-response-'+responses,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default' as const,usage:null,output_text:'',
      output:[{type:'function_call' as const,name:responses===1?'media_read':'image_prepare',call_id:'retouch-call-'+responses,
        arguments:JSON.stringify(responses===1?{}:{reply:'Review the retouch quote.',...image})}]};
  };
  const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,mediaEnabled:true,generationFactory:factory,createActionResponse:createResponse});
  const input={requestId:randomUUID(),message:'Shorten the object in the image you just generated.',references:[]};
  await assert.rejects(service.submit(input),{code:'INTERNAL_ERROR'});
  const persisted=(await pg.pool.query('SELECT draft_json,state FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0];
  assert.deepEqual(persisted.draft_json.image.references,[{ref:output,role:'reference',slot:null}]);
  assert.equal(persisted.state,'failed');
  assert.equal(responses,2);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,1);
  const resumed=await service.submit(input);
  assert.equal(resumed.state,'ready');assert.ok(resumed.quote);assert.equal(responses,2);
  assert.deepEqual(resumed.quote.summary.references,[{kind:'asset',assetId,role:'reference'}]);
  assert.equal(resumed.quote.summary.engineId,'gpt-image-2');
  assert.equal((await service.submit(input)).quote?.quoteId,resumed.quote.quoteId);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM media_assets')).rows[0].n,1);
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  assert.equal(provider.captures.length,0);
  const savedDraft=persisted.draft_json;
  for(const denied of [{...actor,projectId:'other'},{...actor,userId:'foreign',projectId:'foreign'}]) {
    await assert.rejects(validateStudioImageRequest({actor:denied,draft:savedDraft,input,catalog,reviewedReferences:[],resolveReferences:factory(denied,{enabled:true}).resolveReferences}),{code:'REFERENCE_INVALID'});
  }
  await pg.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id='generated-job'");
  await assert.rejects(validateStudioImageRequest({actor,draft:savedDraft,input,catalog,reviewedReferences:[],resolveReferences:factory(actor,{enabled:true}).resolveReferences}),{code:'REFERENCE_INVALID'});
  await pg.pool.query("UPDATE app_jobs SET hidden=false WHERE job_id='generated-job'");
  await pg.pool.query("UPDATE job_outputs SET status='processing' WHERE id='generated-job:image:0'");
  await assert.rejects(validateStudioImageRequest({actor,draft:savedDraft,input,catalog,reviewedReferences:[],resolveReferences:factory(actor,{enabled:true}).resolveReferences}),{code:'REFERENCE_INVALID'});
  await pg.pool.query("UPDATE job_outputs SET status='ready' WHERE id='generated-job:image:0'");
  await service.confirm({requestId:input.requestId,quoteId:resumed.quote.quoteId,confirmed:true});
  await service.confirm({requestId:input.requestId,quoteId:resumed.quote.quoteId,confirmed:true});
  assert.equal(provider.captures.length,1);
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,1);
  const nextInput={...input,requestId:randomUUID()};
  const next=await service.submit(nextInput);assert.ok(next.quote);
  await pg.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/replaced-copy.png' WHERE public_id=$1",[assetId]);
  await assert.rejects(service.confirm({requestId:nextInput.requestId,quoteId:next.quote.quoteId,confirmed:true}),{code:'QUOTE_EXPIRED'});
  assert.equal(provider.captures.length,1,'Changed reference facts must not dispatch another provider job.');
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,1);
});
