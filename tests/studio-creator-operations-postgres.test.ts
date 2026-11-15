import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { DEFAULT_SUBTITLE_STYLE } from '../frontend/src/lib/subtitles/document';
import { createImageConversationService } from '../frontend/src/server/studio/image-conversation-service';
import { createStudioCreatorToolsService, type StudioCreatorFactory } from '../frontend/src/server/studio/conversation-creator';
import { createSubtitleOperationsService } from '../frontend/src/server/subtitles/operations';
import { createSubtitleJobStore } from '../frontend/src/server/subtitles/jobs';
import { resolveStudioMedia } from '../frontend/src/server/studio/media-resolver';
import { readStudioConversationProject } from '../frontend/src/server/studio/conversation-run-repository';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const source = { type:'asset' as const, assetId:'ma_22222222222222222222222222222222', kind:'video' as const };

test('native Milo creator quotes, exact client approval, included exports and paid recovery keep one scoped durable operation',async t=>{
  const pg=await startDisposablePostgres('studio-native-creators');const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const migration of ['26_studio_projects.sql','42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','73_subtitle_operations.sql'])await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
  await pg.pool.query(`INSERT INTO studio_projects(id,user_id,name,canvas_template_id,settings,workspace_state,persistence_mode)
    VALUES('film','owner','Film','minimal-start','{}','{}','connected'),('other','owner','Other','minimal-start','{}','{}','connected');
    INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES('owner','topup',500,'USD');
    CREATE TABLE job_outputs(id uuid PRIMARY KEY,job_id text,user_id text,kind text,status text);
    CREATE TABLE media_assets(id uuid PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,status text,deleted_at timestamptz,source_job_id text,source_output_id uuid,metadata jsonb);
    INSERT INTO media_assets VALUES('20000000-0000-4000-8000-000000000001','ma_22222222222222222222222222222222','owner','video','https://cdn.maxvideoai.com/owned.mp4','video/mp4','ready',NULL,NULL,NULL,'{}')`);
  const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
  const subtitleSource={ref:source,fingerprint:'a'.repeat(64),durationMs:10000};
  const document={version:1 as const,id:'captions',revision:2,source:subtitleSource,language:'eng',words:[],segments:[{id:'line',text:'Hello.',startMs:0,endMs:1000,wordIds:[],alignment:'edited' as const}],style:DEFAULT_SUBTITLE_STYLE};
  const jobs=createSubtitleJobStore({validatePricing:async()=>{},preferredCurrency:async()=> 'usd'});
  let dispatches=0,modelCalls=0,interruptPreparation=true;
  const creatorFactory:StudioCreatorFactory=(current,options)=>{const tools=createStudioCreatorToolsService(current,{...options,readAccess:async(_owner,value)=>value,
    subtitles:(scope,settings)=>createSubtitleOperationsService(scope,{...settings,dependencies:{jobs,
      documents:{read:async userId=>userId==='owner'?document:null} as never,
      readSource:async()=>({source:subtitleSource,originalIdentity:{id:'20000000-0000-4000-8000-000000000001',url:'https://cdn.maxvideoai.com/owned.mp4'},facts:{durationMs:10000,width:320,height:180,fps:30,hasAudio:true}}),
      quoteTranscription:async()=>({totalCents:17,currency:'USD'}),dispatch:async()=>{dispatches++;},
    }}),
  });return{...tools,prepare:async(...args:Parameters<typeof tools.prepare>)=>{const quote=await tools.prepare(...args);if(interruptPreparation){interruptPreparation=false;throw new Error('Lost preparation acknowledgement after commit');}return quote;}};};
  const dependencies={enabled:true,actionsEnabled:true,mediaEnabled:true,creatorEnabled:true,creatorFactory,
    attachmentFacts:{resolveMedia:async(userId:string,ref:Parameters<typeof resolveStudioMedia>[1])=>({...await resolveStudioMedia(userId,ref),durationSec:10,width:320,height:180})},
    createActionResponse:async(params:any)=>{modelCalls++;const paid=JSON.stringify(params.input).includes('Transcribe this source');
      return{id:'native-creator-'+modelCalls,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default' as const,usage:null,output_text:'',
        output:[{type:'function_call' as const,name:paid?'creator_prepare':'creator_subtitle_export_prepare',call_id:'creator-'+modelCalls,
          arguments:JSON.stringify(paid?{reply:'Review the transcription quote.',toolId:'subtitles',inputs:[{role:'source',source,segment:null}],settings:[],profileId:null,language:'eng',keyterms:[]}:{reply:'Review the included captioned export.',documentId:'captions',revision:2})}]};},
  };
  const service=createImageConversationService(actor,dependencies);
  const includedInput={requestId:randomUUID(),message:'Export these saved captions.',references:[]};
  await assert.rejects(service.submit(includedInput),'The saved success receipt must survive loss of acknowledgement after preparation.');
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM subtitle_operations')).rows[0].n,1);
  const included=await service.submit(includedInput);
  assert.equal(included.quote,null);assert.equal(included.creatorQuote?.kind,'render');assert.equal(included.creatorQuote?.price.amountCents,0);
  assert.equal(included.creatorOperation?.state,'prepared');assert.equal(dispatches,0);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
  assert.equal((await service.submit(includedInput)).creatorQuote?.operationId,included.creatorQuote!.operationId);assert.equal(modelCalls,1);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM subtitle_operations')).rows[0].n,1);
  const receipt=(await pg.pool.query("SELECT result_json FROM studio_conversation_steps WHERE action_json->>'action'='creator.subtitle-export.prepare'")).rows[0].result_json;
  assert.equal(receipt.data.operationId,included.creatorQuote!.operationId);
  assert.deepEqual((await readStudioConversationProject(actor)).creatorOperations,[included.creatorQuote]);
  const approved={requestId:includedInput.requestId,confirmed:true,creator:{operationId:included.creatorQuote!.operationId,toolId:'subtitles',amountCents:0,currency:'USD'}};
  await assert.rejects(service.confirm({...approved,creator:{...approved.creator,amountCents:1}}),{code:'PARAMETER_INVALID'});
  await assert.rejects(service.confirm({...approved,creator:{...approved.creator,operationId:randomUUID()}}),{code:'QUOTE_EXPIRED'});
  await assert.rejects(service.confirm({requestId:includedInput.requestId,quoteId:included.creatorQuote!.operationId,confirmed:true}),{code:'QUOTE_EXPIRED'});
  await assert.rejects(createImageConversationService({...actor,projectId:'other'},dependencies).confirm(approved),{code:'QUOTE_EXPIRED'});
  await assert.rejects(createImageConversationService({...actor,userId:'foreign'},dependencies).confirm(approved));
  assert.equal(dispatches,0);
  const accepted=await service.confirm(approved);assert.equal((accepted as any).state,'queued');assert.equal(dispatches,1);
  const reopened=createImageConversationService(actor,{...dependencies,creatorEnabled:false});
  assert.equal((await reopened.read()).turns[0].creatorOperation?.state,'queued');
  await reopened.confirm(approved);assert.equal(dispatches,1,'An accepted operation recovers even after execution closes.');
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  const job=(await pg.pool.query("SELECT payment_status FROM app_jobs WHERE job_id=$1",['subtitle_'+included.creatorQuote!.operationId])).rows[0];assert.equal(job.payment_status,'platform');
  const lease=await jobs.claim(included.creatorQuote!.operationId);await jobs.complete(included.creatorQuote!.operationId,{documentId:'captions',revision:2},lease!.lease_token);
  const completed=(await reopened.read()).turns[0].creatorOperation!;assert.equal(completed.state,'completed');assert.equal(completed.retry.afterSeconds,null);assert.equal(completed.result?.document?.revision,2);
  const paidInput={requestId:randomUUID(),message:'Transcribe this source.',references:[],attachments:[source]};
  const paid=await service.submit(paidInput);assert.equal(paid.creatorQuote?.price.amountCents,17);assert.equal(dispatches,1);
  const paidApproval={requestId:paidInput.requestId,confirmed:true,creator:{operationId:paid.creatorQuote!.operationId,toolId:'subtitles',amountCents:17,currency:'USD'}};
  await service.confirm(paidApproval);await createImageConversationService(actor,dependencies).confirm(paidApproval);
  assert.equal(dispatches,2);assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,1);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM subtitle_operations')).rows[0].n,2);assert.equal(modelCalls,2);
  const foreign=creatorFactory({...actor,projectId:'other'},{enabled:true});assert.equal((await foreign.read(paid.creatorQuote!)).state,'unavailable');
});
