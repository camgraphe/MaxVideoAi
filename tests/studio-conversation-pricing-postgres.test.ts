import assert from 'node:assert/strict';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {createStudioActionExecutor} from '../frontend/src/server/studio/conversation-actions';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';
import type {StudioActionRequest} from '../frontend/lib/studio/conversation-action-contract';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

test('price comparison reads owned attached images and preserves prepared quotes, receipts and assets',async t=> {
  const pg=await startDisposablePostgres('studio-pricing-read');
  const previous=process.env.DATABASE_URL;
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz,revision bigint);
    INSERT INTO studio_projects VALUES ('project','owner','Creative work',NULL,0);
    CREATE TABLE studio_conversation_memory(user_id text,project_id text,revision bigint,brief text,decisions jsonb);
    CREATE TABLE studio_image_turns(user_id text,project_id text,quote_id uuid,created_at timestamptz);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
  const assetId='ma_11111111111111111111111111111111';
  await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
    VALUES('ref',$1,'owner','image','https://cdn.maxvideoai.com/reference.png','image/png',1024,1024,1024,'ready','{}')`,[assetId]);
  const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
  const entry=getFalEngineById('gpt-image-2')!;
  let currentPrice=123;
  let pricingReads=0;
  const generation=createStudioImageGenerationService(actor,{enabled:true,prepareDependencies:{
    listPublicEngines:async()=>[{engine:entry.engine,surface:'image',publicModes:['t2i','i2i'],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}],
    resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    priceGeneration:async(request,tier,context)=>{pricingReads++;assert.equal(context.resolvedReferences?.[0]?.assetId,assetId);assert.equal(context.resolvedReferences?.[0]?.width,1024);
      return {priceCents:currentPrice,currency:'USD',membershipTier:tier,pricingSnapshot:{totalCents:currentPrice,currency:'USD',membershipTier:tier}};},
  }});
  const settings={resolution:'1024x1024',aspectRatio:'1:1',quality:'high'};
  const prepared=await generation.prepare({surface:'image',engineId:entry.id,mode:'i2i',prompt:'Warmer light',settings,references:[{kind:'asset',assetId,role:'reference'}],outputCount:1});
  const quoteBefore=(await pg.pool.query('SELECT * FROM mcp_generation_quotes WHERE quote_id=$1',[prepared.quoteId])).rows;
  const dependencies={enabled:true,generation,attachedImageIds:[assetId],prepareImage:async()=>{throw new Error('A pricing read must not prepare.');}};
  const execute=createStudioActionExecutor(actor,dependencies);
  const scenario:Extract<StudioActionRequest,{action:'pricing.read'}>={action:'pricing.read',surface:'image',modelId:entry.id,mode:'i2i',settings:Object.entries(settings).map(([name,value])=>({name,value})),references:[{ref:{type:'asset',assetId,kind:'image'},role:'reference',slot:null}],outputCount:1};
  const first=await execute(scenario);
  assert.equal(first.ok,true);
  if(!first.ok||first.action!=='pricing.read')throw new Error('Expected a price read');
  assert.deepEqual(first.data.price,{amountCents:123,currency:'USD',formattedAmount:'$1.23'});
  currentPrice=167;
  const second=await execute(scenario);
  if(!second.ok||second.action!=='pricing.read')throw new Error('Expected refreshed pricing');
  assert.deepEqual(second.data.price,{amountCents:167,currency:'USD',formattedAmount:'$1.67'});
  assert.doesNotMatch(JSON.stringify(second),/quoteId|storageUrl|reference\.png/);
  let calls=0;
  const director=createStudioConversationDirector({createResponse:async()=>{
    calls++;
    const {action,...args}=scenario;
    return {id:`price-${calls}`,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,
      output_text:calls===3?JSON.stringify({reply:'These are current scenario estimates; review the final quote before creation.'}):'',
      output:calls<3?[{type:'function_call',name:'pricing_read',call_id:`price-${calls}`,arguments:JSON.stringify(args)}]:[]};
  }});
  const draft=await director({message:'Compare my options before creating.',history:[],references:[],project:{name:'Creative work',revision:0,memory:{revision:0,brief:'',decisions:[]}},checkpoint:async(_,create)=>create(),execute:async(_,action)=>execute(action)});
  assert.equal(calls,3,'Read estimates do not terminate the turn or consume more than the existing budget.');
  assert.equal(draft.image,null);
  const readsBeforeDenials=pricingReads;
  const unattached=await createStudioActionExecutor(actor,{...dependencies,attachedImageIds:[]})(scenario);
  assert.equal(unattached.ok,false);
  if(!unattached.ok)assert.equal(unattached.error.code,'REFERENCE_INVALID');
  const foreign=await createStudioActionExecutor({...actor,userId:'foreign'},dependencies)(scenario);
  assert.equal(foreign.ok,false);
  await pg.pool.query("UPDATE media_assets SET user_id='foreign' WHERE id='ref'");
  const revoked=await execute(scenario);
  assert.equal(revoked.ok,false);
  if(!revoked.ok)assert.equal(revoked.error.code,'REFERENCE_INVALID');
  assert.equal(pricingReads,readsBeforeDenials);
  assert.deepEqual((await pg.pool.query('SELECT * FROM mcp_generation_quotes WHERE quote_id=$1',[prepared.quoteId])).rows,quoteBefore);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS count FROM mcp_generation_quotes')).rows[0].count,1);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS count FROM app_receipts WHERE type='charge'")).rows[0].count,0);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS count FROM media_assets')).rows[0].count,1);
});
