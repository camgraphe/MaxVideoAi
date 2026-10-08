import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb,type QueryExecutor} from '../frontend/src/lib/db';
import {normalizeGenerationRequest,hashCanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {createQuoteRepository,generationQuoteCodec} from '../frontend/src/server/agent-api/quote-repository';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

test('a fresh Response receives exact owned historical estimates and quoted draft direction without new purchases',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  const pg=await startDisposablePostgres('studio-history-facts');
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,revision bigint NOT NULL DEFAULT 0,deleted_at timestamptz);
    CREATE TABLE studio_sequences(id text PRIMARY KEY);
    INSERT INTO studio_projects(id,user_id,name,deleted_at) VALUES ('film','owner','Film',NULL),('other','owner','Other',NULL),('private','foreign','Private',NULL),('deleted','owner','Deleted',clock_timestamp());`);
  for(const name of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','42_studio_connected_montages.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql'])await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
  const executor:QueryExecutor={query:async<Row>(sql:string,params?:ReadonlyArray<unknown>)=>(await pg.pool.query<Row>(sql,params)).rows};
  const repository=createQuoteRepository(generationQuoteCodec,{origin:'studio-session',projectId:'film'});
  const prompt='A small red bicycle outside a cosy stationery shop. Include exact lettering “Back on Saturday”.';
  const request=normalizeGenerationRequest({surface:'image',engineId:'nano-banana-2',mode:'t2i',prompt,settings:{resolution:'1k',aspectRatio:'1:1',outputFormat:'png'},references:[],outputCount:1});
  const quote=await repository.insertPreparedQuote({userId:'owner',oauthClientId:null,request,requestHash:hashCanonicalGenerationRequest(request),catalogRevision:'fixture',pricingSnapshot:{providerAccountId:'PRIVATE_PROVIDER'},priceCents:10,currency:'USD',fundingMode:'wallet'},{executor});
  const ids:string[]=[];
  let order=0;
  async function turn(userId='owner',projectId='film',state='ready',quoted=false){
    const id=randomUUID();ids.push(id);
    const draft={reply:'Review one square image.',image:{prompt,aspectRatio:'1:1',modelId:'nano-banana-2',mode:'t2i',settings:[{name:'resolution',value:'1k'}],references:[],outputCount:1}};
    await pg.pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,quote_id,state,lease_id,lease_expires_at,created_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$4,$7,$8,$9,clock_timestamp(),$10)`,[userId,projectId,id,'0'.repeat(64),JSON.stringify({requestId:id,message:'A previous synthetic request.',references:[]}),JSON.stringify(draft),quoted?quote.quoteId:null,state,randomUUID(),new Date(Date.now()-60_000+ ++order*1000)]);
    return id;
  }
  const old=await turn(),wan=await turn(),kling=await turn(),image=await turn('owner','film','ready',true);
  async function receipt(id:string,modelId:string,amountCents:number,userId='owner',projectId='film',ok=true,settings:unknown={durationSec:6,resolution:'1080p',aspectRatio:'16:9',audio:false,providerAccountId:'PRIVATE_PROVIDER',negativePrompt:'PRIVATE_PROMPT'}){
    const data={surface:'video',modelId,mode:'i2v',settings,outputCount:1,referenceCount:1,price:{amountCents,currency:'USD'},estimatedAt:'2026-10-05T00:00:00.000Z',quoteRequired:true,providerUrl:'PRIVATE_URL'};
    await pg.pool.query(`INSERT INTO studio_conversation_steps(user_id,project_id,request_id,call_id,lease_id,action_hash,action_json,observed_revision,state,result_json,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,0,'completed',$8::jsonb,$9)`,[userId,projectId,id,randomUUID(),randomUUID(),'0'.repeat(64),JSON.stringify({action:'pricing.read'}),JSON.stringify({ok,action:'pricing.read',data}),new Date(Date.now()-50_000+ ++order*1000)]);
  }
  await receipt(old,'old-model',999);await receipt(wan,'wan-3-prime',202);await receipt(kling,'kling-3-standard',61);
  const other=await turn('owner','other'),foreign=await turn('foreign','private'),deleted=await turn('owner','deleted'),unfinished=await turn('owner','film','thinking');
  await receipt(kling,'PRIVATE_FAILED',999,'owner','film',false);
  await receipt(other,'PRIVATE_OTHER',999,'owner','other');await receipt(foreign,'PRIVATE_FOREIGN',999,'foreign','private');await receipt(deleted,'PRIVATE_DELETED',999,'owner','deleted');await receipt(unfinished,'PRIVATE_UNFINISHED',999);
  const historyModule=await import('../frontend/src/server/studio/conversation-history-facts');

  await t.test('historical receipt read filters scope, readiness, private fields and older overflow',async()=>{
    const facts=await historyModule.readStudioHistoricalEstimates(actor,ids);
    assert.deepEqual(facts.map(fact=>[fact.modelId,fact.price.amountCents,fact.price.formattedAmount]),[['kling-3-standard',61,'$0.61'],['wan-3-prime',202,'$2.02']]);
    assert.ok(facts.every(fact=>fact.historical===true&&fact.quoteRequired===true&&fact.estimatedAt==='2026-10-05T00:00:00.000Z'));
    assert.doesNotMatch(JSON.stringify(facts),/PRIVATE_|provider|negativePrompt/);
    assert.deepEqual(await historyModule.readStudioHistoricalEstimates({...actor,projectId:'deleted'},ids),[]);
    assert.deepEqual(await historyModule.readStudioHistoricalEstimates(actor,[]),[]);
  });

  await t.test('a historical settings array is sanitized without blocking conversation or inventing new fields',async()=>{
    const malformed=await turn('owner','other');
    await receipt(malformed,'kling-3-standard',61,'owner','other',true,['PRIVATE_SETTINGS_ARRAY']);
    const facts=await historyModule.readStudioHistoricalEstimates({...actor,projectId:'other'},[malformed]);
    assert.deepEqual(facts[0].settings,{});
    assert.deepEqual(facts[0].price,{amountCents:61,currency:'USD',formattedAmount:'$0.61'});
    assert.doesNotMatch(JSON.stringify(facts),/PRIVATE_SETTINGS_ARRAY/);
    await assert.rejects(historyModule.readStudioHistoricalEstimates({...actor,authMethod:'oauth',clientId:'client'} as never,ids),error=>error instanceof Error&&'code' in error&&error.code==='AUTH_REQUIRED');
  });

  await t.test('new paid-response context carries direction linked to its quote and exact prior model differences; replay is free',async()=>{
    const before=(await pg.pool.query('SELECT * FROM mcp_generation_quotes ORDER BY quote_id')).rows;
    let calls=0;
    const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:{enabled:false,solAllowanceNanoUsd:0,lunaAllowanceNanoUsd:0,campaignNanoUsd:0,maxAdditionalBudgetCents:0},createActionResponse:async params=>{
      calls++;
      assert.ok(Array.isArray(params.input));
      const block=params.input.find(item=>typeof item!=='string'&&'role' in item&&item.role==='developer'&&'content' in item&&typeof item.content==='string'&&item.content.startsWith('Historical conversation facts'));
      assert.ok(block&&typeof block!=='string'&&'content' in block&&typeof block.content==='string','Recorded history facts must reach the new Response.');
      const facts=JSON.parse(block.content.slice(block.content.indexOf('{')));
      assert.deepEqual(facts.quoteDirections,[{requestId:image,quoteId:quote.quoteId,text:prompt,truncated:false}]);
      assert.deepEqual(facts.estimates.map((fact:{modelId:string;price:{amountCents:number}})=>[fact.modelId,fact.price.amountCents]),[['kling-3-standard',61],['wan-3-prime',202]]);
      assert.doesNotMatch(block.content,/PRIVATE_|provider|negativePrompt/);
      const project=params.input.find(item=>typeof item!=='string'&&'content' in item&&typeof item.content==='string'&&item.content.startsWith('Current project facts'));
      assert.ok(project&&typeof project!=='string'&&'content' in project&&typeof project.content==='string');
      assert.doesNotMatch(project.content,/prompt|Back on Saturday|PRIVATE_/);
      return {id:'explain-recorded-quote',model:'gpt-6-luna',status:'completed',service_tier:'default',usage:undefined,output_text:JSON.stringify({reply:'The earlier estimate used Wan 3 Prime; this quote uses Kling 3 Standard. The image direction says Back on Saturday. Review the quoted price before deciding.'}),output:[]};
    }});
    const input={requestId:randomUUID(),message:'Explain the existing quote and why the previous model price differed. Do not create anything.',references:[]};
    const response=await service.submit(input);assert.equal(response.state,'ready');assert.match(response.reply??'',/Wan 3 Prime/);
    await service.submit(input);assert.equal(calls,1);
    assert.deepEqual((await pg.pool.query('SELECT * FROM mcp_generation_quotes ORDER BY quote_id')).rows,before);
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
    assert.equal((await pg.pool.query<{n:number}>("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  });
  await t.test('all three options from a completed owned comparison survive as bounded historical estimates',async()=>{
    const id=await turn('owner','other');
    const options=['mini','balanced','preferred'].map((modelId,index)=>({modelId,surface:'video',mode:'i2v',settings:{durationSec:12,resolution:'720p',providerKey:'PRIVATE'},outputCount:1,referenceCount:1,price:{amountCents:100+index*100,currency:'USD'},estimatedAt:'2026-10-08T20:00:00Z',quoteRequired:true,providerUrl:'PRIVATE'}));
    await pg.pool.query(`INSERT INTO studio_conversation_steps(user_id,project_id,request_id,call_id,lease_id,action_hash,action_json,observed_revision,state,result_json,created_at)
      VALUES('owner','other',$1,$2,$3,$4,$5::jsonb,0,'completed',$6::jsonb,clock_timestamp())`,[id,randomUUID(),randomUUID(),'0'.repeat(64),JSON.stringify({action:'pricing.compare'}),JSON.stringify({ok:true,action:'pricing.compare',data:{options}})]);
    const facts=await historyModule.readStudioHistoricalEstimates({...actor,projectId:'other'},[id]);
    assert.deepEqual(facts.map(option=>option.modelId),['mini','balanced','preferred']);
    assert.ok(facts.every(option=>option.historical&&option.quoteRequired));
    assert.doesNotMatch(JSON.stringify(facts),/PRIVATE|provider/);
    assert.deepEqual(await historyModule.readStudioHistoricalEstimates(actor,[id]),[]);
  });
});
