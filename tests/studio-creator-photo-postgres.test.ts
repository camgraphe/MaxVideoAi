import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { createImageConversationService } from '../frontend/src/server/studio/image-conversation-service';
import { createStudioCreatorToolsService, type StudioCreatorFactory } from '../frontend/src/server/studio/conversation-creator';
import { createCreatorOperationsService } from '../frontend/src/server/tools/creator-operations';
import { prepareCreatorProfile } from '../frontend/src/server/tools/creator-profiles';
import { creatorOperationInputSchema } from '../frontend/src/lib/toolbox/creator-tools';
import { creatorSourceFingerprint } from '../frontend/src/server/tools/creator-sources';
import { resolveStudioMedia } from '../frontend/src/server/studio/media-resolver';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { ProviderHarness } from './helpers/mcp-paid-e2e-harness';

const assetId='ma_11111111111111111111111111111111';
test('native Milo product photo uses the trusted request origin account path and recovers one exact paid operation',async t=>{
  const pg=await startDisposablePostgres('st-creator-photo');const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const migration of ['26_studio_projects.sql','42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql','69_toolbox_generation_scope.sql','71_creator_operations.sql'])await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
  await pg.pool.query(`INSERT INTO studio_projects(id,user_id,name,canvas_template_id,settings,workspace_state,persistence_mode)
    VALUES('film','owner','Film','minimal-start','{}','{}','connected'),('other','owner','Other','minimal-start','{}','{}','connected');
    INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES('owner','topup',10000,'USD');
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);
    INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata) VALUES('image','ma_11111111111111111111111111111111','owner','image','https://cdn.maxvideoai.com/image.png','image/png',1234,1024,1024,'ready','{}')`);
  const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
  const entry=getFalEngineById('gpt-image-2-5-flare')!;
  const catalog=[{engine:entry.engine,surface:'image' as const,publicModes:['i2i'],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}];
  const provider=new ProviderHarness(pg.pool);const destinations:string[]=[];
  const executable=()=>({executable:true as const,reason:'available' as const});
  const creatorFactory:StudioCreatorFactory=(scope,options)=>createStudioCreatorToolsService(scope,{...options,readAccess:async(_owner,value)=>value,
    creators:(current,configuration)=>{destinations.push(configuration.generationOptions?.accountUrl??'');return createCreatorOperationsService(current,{...configuration,
      generationOptions:{...configuration.generationOptions,prepareDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:executable},confirmDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:executable,submitPaidGeneration:provider.submit}},
      dependencies:{prepare:async value=>{const input=creatorOperationInputSchema.parse(value);return prepareCreatorProfile(input,[{input:input.inputs[0],asset:{type:'asset',assetId,kind:'image'},url:'https://cdn.maxvideoai.com/image.png',fingerprint:creatorSourceFingerprint(await resolveStudioMedia(current.userId,input.inputs[0].source)),facts:{kind:'image',width:1024,height:1024,durationSec:null,fps:null,hasAudio:false,sizeBytes:1234,mimeType:'image/png'}}]);}},
    });},
  });
  let calls=0;const requestOrigin='http://127.0.0.1:3210';
  const dependencies={enabled:true,actionsEnabled:true,creatorEnabled:true,creatorFactory,requestOrigin,
    createActionResponse:async()=>{calls++;return{id:'photo-'+calls,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default' as const,usage:null,output_text:'',output:[{type:'function_call' as const,name:'creator_prepare',call_id:'photo-prepare',arguments:JSON.stringify({reply:'Review the product photo quote.',toolId:'product-photo-editor',inputs:[{role:'source',source:{type:'asset',assetId,kind:'image'},segment:null}],settings:[],profileId:null,language:null,keyterms:[]})}]};},
  };
  const service=createImageConversationService(actor,dependencies);
  const input={requestId:randomUUID(),message:'Put this product in a studio photo.',references:[assetId]};
  const turn=await service.submit(input);const quote=turn.creatorQuote!;
  assert.equal(turn.creatorOperation?.state,'prepared');assert.equal(quote.toolId,'product-photo-editor');assert.ok(quote.price.amountCents>0);
  assert.ok(destinations.every(url=>url===requestOrigin+'/account/connections'));
  assert.equal(provider.captures.length,0);assert.equal((await service.submit(input)).creatorQuote?.operationId,quote.operationId);assert.equal(calls,1);
  const stored=(await pg.pool.query('SELECT auth_origin,studio_project_id FROM creator_operations WHERE id=$1',[quote.operationId])).rows[0];assert.equal(stored.auth_origin,'studio-session');assert.equal(stored.studio_project_id,'film');
  const confirmation={requestId:input.requestId,confirmed:true,creator:{operationId:quote.operationId,toolId:quote.toolId,amountCents:quote.price.amountCents,currency:'USD'}};
  await service.confirm(confirmation);
  const reopened=createImageConversationService(actor,dependencies);assert.equal((await reopened.read()).turns[0].creatorOperation?.operationId,quote.operationId);await reopened.confirm(confirmation);
  assert.equal(provider.captures.length,1);assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,1);assert.equal(calls,1);
  const other=creatorFactory({...actor,projectId:'other'},{enabled:true,accountUrl:requestOrigin});assert.equal((await other.read(quote)).state,'unavailable');
});
