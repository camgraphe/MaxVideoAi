import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb,type QueryExecutor} from '../frontend/src/lib/db';
import {normalizeGenerationRequest,hashCanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {normalizeAudioGenerationRequest,hashCanonicalAudioRequest} from '../frontend/src/server/agent-api/audio-normalization';
import {createQuoteRepository,generationQuoteCodec} from '../frontend/src/server/agent-api/quote-repository';
import {audioQuoteRepositoryForActor} from '../frontend/src/server/agent-api/audio-quote-repository';
import {readStudioConversationProject} from '../frontend/src/server/studio/conversation-run-repository';
import {projectStudioConversationQuotes,type StudioConversationQuoteRow} from '../frontend/src/server/studio/conversation-quote-facts';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

test('persisted Studio quote facts stay exact, bounded, isolated and available to a fresh Response without a purchase',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined,'Only disposable PostgreSQL is allowed.');
  const pg=await startDisposablePostgres('studio-quote-facts');
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query("CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);CREATE TABLE studio_sequences(id text PRIMARY KEY);INSERT INTO studio_projects(id,user_id,name) VALUES('film','owner','Film'),('other','owner','Other'),('private','foreign','Private')");
  for(const name of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','42_studio_connected_montages.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql'])await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
  const executor:QueryExecutor={query:async<Row>(sql:string,params?:ReadonlyArray<unknown>)=>(await pg.pool.query<Row>(sql,params)).rows};
  const repository=createQuoteRepository(generationQuoteCodec,{origin:'studio-session',projectId:actor.projectId});
  const request=normalizeGenerationRequest({surface:'video',engineId:'seedance-2-5',mode:'i2v',prompt:'PRIVATE_PROMPT',
    settings:{audio:true,durationSec:8,resolution:'720p',aspectRatio:'16:9',negativePrompt:'PRIVATE_NEGATIVE_PROMPT'},
    references:[{kind:'asset',assetId:'PRIVATE_ASSET_ID',role:'first_frame'},{kind:'https',url:'https://example.com/PRIVATE_SOURCE_URL',mediaKind:'image',role:'last_frame'}],outputCount:1});
  const baseDate=new Date(Date.now()-2*60*60*1000);
  let turnOrder=0;
  async function linkQuote(quoteId:string,userId='owner',projectId='film',draft:unknown={reply:'Review the quote.',image:null}){
    const requestId=randomUUID();
    await pg.pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,quote_id,state,lease_id,lease_expires_at,created_at)
      VALUES($1,$2,$3,$4,$5::jsonb,$9::jsonb,$4,$6,'ready',$7,clock_timestamp(),$8)`,
    [userId,projectId,requestId,'0'.repeat(64),JSON.stringify({requestId,message:'A synthetic quote request.',references:[]}),quoteId,randomUUID(),new Date(baseDate.getTime()+ ++turnOrder*1000),JSON.stringify(draft)]);
  }
  async function insertQuote(now=new Date(),repo=repository,userId='owner',clientId:string|null=null){
    const quote=await repo.insertPreparedQuote({userId,oauthClientId:clientId,request,requestHash:hashCanonicalGenerationRequest(request),catalogRevision:'fixture',
      pricingSnapshot:{providerAccountId:'PRIVATE_PROVIDER_ACCOUNT',providerCostCents:2,authToken:'PRIVATE_TOKEN'},priceCents:48,currency:'USD',fundingMode:'wallet'}, {executor,now:()=>now});
    return quote;
  }
  const fresh=await insertQuote();await linkQuote(fresh.quoteId);
  const expectedFresh={price:{amountCents:48,currency:'USD'},expiresAt:fresh.expiresAt.toISOString(),expiredUnconfirmedQuote:false,
    modelId:request.engineId,mode:request.mode,settings:{audio:true,durationSec:8,resolution:'720p',aspectRatio:'16:9'},outputCount:1,referenceCount:2,referenceRoles:['first_frame','last_frame']};

  await t.test('the current quote supplies recorded customer cents and a private-field-free canonical configuration',async()=>{
    const project=await readStudioConversationProject(actor);
    assert.deepEqual(project.generations,[{quoteId:fresh.quoteId,surface:'video',quoteState:'prepared',jobId:null,status:null,quote:expectedFresh}]);
    assert.doesNotMatch(JSON.stringify(project),/PRIVATE_|pricingSnapshot|providerCost|requestHash|oauthClient|storage|prompt/i);
  });

  await t.test('expired unconfirmed quotes are explicit while accepted and claimed prices survive a past TTL',async()=>{
    for(const state of ['prepared','expired','claimed','accepted','failed'] as const){
      const quote=await insertQuote(baseDate);await linkQuote(quote.quoteId);
      if(state==='expired')await pg.pool.query("UPDATE mcp_generation_quotes SET state='expired',updated_at=clock_timestamp() WHERE quote_id=$1",[quote.quoteId]);
      if(state==='claimed'||state==='accepted'||state==='failed'){
        await pg.pool.query("UPDATE mcp_generation_quotes SET state='claimed',job_id=$2,claimed_at=created_at+interval '1 minute',updated_at=clock_timestamp() WHERE quote_id=$1",[quote.quoteId,'recorded-'+state]);
        if(state!=='claimed')await pg.pool.query('UPDATE mcp_generation_quotes SET state=$2,updated_at=clock_timestamp() WHERE quote_id=$1',[quote.quoteId,state]);
      }
      const summary=(await readStudioConversationProject(actor)).generations?.find(value=>value.quoteId===quote.quoteId);
      assert.deepEqual(summary,{quoteId:quote.quoteId,surface:'video',quoteState:state,jobId:['claimed','accepted','failed'].includes(state)?'recorded-'+state:null,status:null,
        quote:{...expectedFresh,expiresAt:quote.expiresAt.toISOString(),expiredUnconfirmedQuote:state==='prepared'||state==='expired'}});
    }
  });

  await t.test('recorded inherited output timing reaches the quote card and director without changing the request',async()=>{
    await pg.pool.query("INSERT INTO studio_projects(id,user_id,name) VALUES('timing','owner','Timing')");
    const timingActor={...actor,projectId:'timing'};
    const timingRepository=createQuoteRepository(generationQuoteCodec,{origin:'studio-session',projectId:'timing'});
    const edit=normalizeGenerationRequest({surface:'video',engineId:'gemini-omni-flash',mode:'v2v',prompt:'PRIVATE_EDIT',
      settings:{durationSec:3,resolution:'720p'},references:[{kind:'asset',assetId:'ma_'+'a'.repeat(32),role:'source'}],outputCount:1});
    const quote=await timingRepository.insertPreparedQuote({userId:actor.userId,oauthClientId:null,request:edit,requestHash:hashCanonicalGenerationRequest(edit),catalogRevision:'fixture',
      pricingSnapshot:{canonicalPricing:{meta:{output_duration_sec:3.25}},privateToken:'PRIVATE_TOKEN'},priceCents:48,currency:'USD',fundingMode:'wallet'},{executor});
    await linkQuote(quote.quoteId,actor.userId,'timing',{reply:'Review the edit.',image:null,
      media:{action:'video.prepare',reply:'Review the edit.',mode:'v2v',modelId:edit.engineId,prompt:edit.prompt,aspectRatio:'16:9',source:null,
        settings:Object.entries(edit.settings).map(([name,value])=>({name,value})),references:[{ref:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'video'},role:'source'}]}});
    const project=await readStudioConversationProject(timingActor);
    const fact=project.generations?.find(row=>row.quoteId===quote.quoteId)?.quote;
    assert.equal(fact?.outputDurationSec,3.25);
    assert.equal(fact?.settings.durationSec,3,'The recorded request remains distinct from effective output timing');
    assert.doesNotMatch(JSON.stringify(project),/PRIVATE_|privateToken|canonicalPricing|pricingSnapshot/);
    const service=createImageConversationService(timingActor,{enabled:true,mediaEnabled:true});
    const shown=(await service.read()).turns.find(turn=>turn.quote?.quoteId===quote.quoteId)?.quote;
    assert.equal(shown?.outputDurationSec,3.25);
    assert.deepEqual(shown?.summary,edit);
    assert.equal(shown?.price.amountCents,48);
    assert.equal(shown?.requestHash,hashCanonicalGenerationRequest(edit));
  });

  await t.test('same-account other-project, foreign-account and OAuth quote links cannot leak into this context',async()=>{
    const wrongScopes=[
      {repo:createQuoteRepository(generationQuoteCodec,{origin:'studio-session',projectId:'other'}),userId:'owner',clientId:null},
      {repo:createQuoteRepository(generationQuoteCodec,{origin:'studio-session',projectId:'film'}),userId:'foreign',clientId:null},
      {repo:createQuoteRepository(generationQuoteCodec),userId:'owner',clientId:'oauth-client'},
    ];
    const excluded:string[]=[];
    for(const scope of wrongScopes){const quote=await insertQuote(new Date(),scope.repo,scope.userId,scope.clientId);await linkQuote(quote.quoteId);excluded.push(quote.quoteId);}
    const project=await readStudioConversationProject(actor);
    for(const quoteId of excluded)assert.ok(!project.generations?.some(value=>value.quoteId===quoteId));
    await assert.rejects(readStudioConversationProject({...actor,projectId:'private'}),{code:'PARAMETER_INVALID'});
    assert.deepEqual((await readStudioConversationProject({...actor,projectId:'other'})).generations,[]);
  });

  await t.test('audio variants are visible without the narration, lyrics, sample IDs or private pricing data',async()=>{
    const audio=normalizeAudioGenerationRequest({schemaVersion:1,surface:'audio',engineId:'audio-voice-only',mode:'voice_only',prompt:'PRIVATE_AUDIO_PROMPT',
      settings:{script:'PRIVATE_SCRIPT',voiceModel:'seed',seedAudioOutputFormat:'mp3',seedAudioSampleRate:24000},references:[{role:'voice_sample',asset:{type:'asset',assetId:'PRIVATE_VOICE_ID',kind:'audio'}}],outputCount:1});
    const quote=await audioQuoteRepositoryForActor(actor).insertPreparedQuote({userId:actor.userId,oauthClientId:null,request:audio,requestHash:hashCanonicalAudioRequest(audio),catalogRevision:'fixture',
      pricingSnapshot:{totalCents:17,currency:'USD',privateToken:'PRIVATE_TOKEN'},priceCents:17,currency:'USD',fundingMode:'wallet'},{executor});
    await linkQuote(quote.quoteId);
    const summary=(await readStudioConversationProject(actor)).generations?.find(value=>value.quoteId===quote.quoteId);
    assert.deepEqual(summary,{quoteId:quote.quoteId,surface:'audio',quoteState:'prepared',jobId:null,status:null,quote:{
      price:{amountCents:17,currency:'USD'},expiresAt:quote.expiresAt.toISOString(),expiredUnconfirmedQuote:false,modelId:audio.engineId,mode:audio.mode,
      settings:{voiceModel:'seed',seedAudioOutputFormat:'mp3',seedAudioSampleRate:24000},outputCount:1,referenceCount:1,referenceRoles:['voice_sample']}});
    assert.doesNotMatch(JSON.stringify(summary),/PRIVATE_|script|lyrics|prompt|pricingSnapshot/);
  });

  await t.test('custom image dimensions, quality and output count preserve the recorded configuration',async()=>{
    const image=normalizeGenerationRequest({surface:'image',engineId:'gpt-image-2',mode:'t2i',prompt:'PRIVATE_IMAGE_PROMPT',settings:{resolution:'custom',aspectRatio:'3:4',imageWidth:1024,imageHeight:1360,quality:'high',style:'PRIVATE_ARTISTIC_STYLE'},references:[],outputCount:3});
    const quote=await repository.insertPreparedQuote({userId:actor.userId,oauthClientId:null,request:image,requestHash:hashCanonicalGenerationRequest(image),catalogRevision:'fixture',pricingSnapshot:{},priceCents:144,currency:'USD',fundingMode:'wallet'},{executor});
    await linkQuote(quote.quoteId);
    const summary=(await readStudioConversationProject(actor)).generations?.find(value=>value.quoteId===quote.quoteId);
    assert.deepEqual(summary,{quoteId:quote.quoteId,surface:'image',quoteState:'prepared',jobId:null,status:null,quote:{
      price:{amountCents:144,currency:'USD'},expiresAt:quote.expiresAt.toISOString(),expiredUnconfirmedQuote:false,modelId:image.engineId,mode:image.mode,
      settings:{resolution:'custom',aspectRatio:'3:4',imageWidth:1024,imageHeight:1360,quality:'high'},outputCount:3,referenceCount:0,referenceRoles:[]}});
    assert.doesNotMatch(JSON.stringify(summary),/PRIVATE_|style|prompt/);
  });

  await t.test('thirty summaries remain but only the eight newest carry bounded quote facts',async()=>{
    for(let index=0;index<32;index++){const quote=await insertQuote();await linkQuote(quote.quoteId);}
    const project=await readStudioConversationProject(actor);
    assert.equal(project.generations?.length,30);
    assert.equal(project.generations?.filter(value=>'quote' in value).length,8);
    assert.ok(project.generations?.slice(0,8).every(value=>'quote' in value));
    assert.ok(project.generations?.slice(8).every(value=>!('quote' in value)));
    assert.ok(Buffer.byteLength(JSON.stringify(project))<10_000,'Project facts must remain compact.');
  });

  await t.test('the pure projection drops malformed, oversized and private settings without mutating stored facts',()=>{
    const row:StudioConversationQuoteRow={quoteId:fresh.quoteId,surface:'image',quoteState:'prepared',jobId:null,status:null,
      amountCents:48,currency:'USD',expiresAt:fresh.expiresAt,databaseNow:new Date(),modelId:'gpt-image-2',mode:'t2i',outputCount:1,referenceCount:3,
      referenceRoles:['reference','reference','mask','PRIVATE_ROLE'],settings:{audio:false,imageWidth:1024,imageHeight:'1360',durationSec:Infinity,
        resolution:'https://example.test/PRIVATE_URL',quality:'x'.repeat(65),aspectRatio:'3:4',prompt:'PRIVATE_PROMPT',script:'PRIVATE_SCRIPT',providerAccountId:'PRIVATE_PROVIDER'}};
    const before=structuredClone(row);
    const projected=projectStudioConversationQuotes([row]);
    assert.deepEqual(projected[0].quote?.settings,{audio:false,imageWidth:1024,aspectRatio:'3:4'});
    assert.deepEqual(projected[0].quote?.referenceRoles,['reference','mask']);
    assert.deepEqual(row,before,'Projection must not rewrite the persisted request.');
    assert.doesNotMatch(JSON.stringify(projected),/PRIVATE_|provider|prompt|script/);
    assert.equal(projectStudioConversationQuotes([{...row,amountCents:-1}])[0].quote,undefined,'Invalid stored facts cannot become an authoritative displayed price.');
  });

  await t.test('a new service Response gets an unread prepared quote without pricing, mutation, generation or charge',async()=>{
    const latest=await insertQuote();await linkQuote(latest.quoteId);
    const before=(await pg.pool.query('SELECT * FROM mcp_generation_quotes ORDER BY quote_id')).rows;
    let responses=0;
    const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:{enabled:false,solAllowanceNanoUsd:0,lunaAllowanceNanoUsd:0,campaignNanoUsd:0,maxAdditionalBudgetCents:0},
      createActionResponse:async params=>{
        responses++;
        assert.ok(Array.isArray(params.input));
        const item=params.input.find(value=>typeof value!=='string'&&'role' in value&&value.role==='developer'&&'content' in value&&typeof value.content==='string'&&value.content.startsWith('Current project facts'));
        assert.ok(item&&typeof item!=='string'&&'content' in item&&typeof item.content==='string');
        const context=JSON.parse(item.content.slice(item.content.indexOf('{')));
        assert.deepEqual(context.generations[0],{quoteId:latest.quoteId,surface:'video',quoteState:'prepared',jobId:null,status:null,quote:{...expectedFresh,expiresAt:latest.expiresAt.toISOString()}});
        return {id:'fresh-price-explanation',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:undefined,output_text:JSON.stringify({reply:'The saved quote is 48 cents. Review its expiration before deciding.'}),output:[]};
      }});
    const input={requestId:randomUUID(),message:'Can you verify the price of my current quote?',references:[]};
    assert.match((await service.submit(input)).reply??'',/48 cents/);
    await service.submit(input);
    assert.equal(responses,1,'Replaying the completed turn must not request another Response.');
    assert.deepEqual((await pg.pool.query('SELECT * FROM mcp_generation_quotes ORDER BY quote_id')).rows,before);
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
    assert.equal((await pg.pool.query<{n:number}>("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  });
});
