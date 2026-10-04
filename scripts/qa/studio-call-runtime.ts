import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {startDisposablePostgres, createPaidGenerationTestSchema} from '../../tests/helpers/disposable-postgres';
import {getDb} from '../../frontend/src/lib/db';
import {createImageConversationService} from '../../frontend/src/server/studio/image-conversation-service';
import {createStudioImageGenerationService,createStudioVideoGenerationService} from '../../frontend/src/server/studio/image-generation-service';
import {createStudioAudioGenerationService} from '../../frontend/src/server/studio/audio-generation-service';
import {listAudioCapabilities} from '../../frontend/src/server/agent-api/audio-capabilities';
import {prepareAudioRun} from '../../frontend/src/server/audio/prepare-audio';
import {loadPricingPolicyOverridesWithExecutor} from '../../frontend/src/lib/pricing-rule-store';
import {readStudioConversationProject} from '../../frontend/src/server/studio/conversation-run-repository';
import type {AgentPublicGenerationEngine} from '../../frontend/src/server/agent-api/model-catalog';
import type {StudioResponseCreator} from '../../frontend/src/server/studio/conversation-director';
import type {ResponseCreateParamsNonStreaming} from 'openai/resources/responses/responses';
import {createPrepareGenerationService,type PrepareGenerationInput} from '../../frontend/src/server/agent-api/prepare-generation';
import type {CanonicalGenerationRequest} from '../../frontend/src/server/agent-api/generation-types';
import type {StudioActionRequest,StudioActionResult} from '../../frontend/lib/studio/conversation-action-contract';
import type {CanonicalAudioRequest} from '../../frontend/src/server/agent-api/audio-normalization';

type QuoteRow={quote_id:string;state:string;request_json:CanonicalGenerationRequest|CanonicalAudioRequest;price_cents:number;currency:string;job_id:string|null};
type McpQuoteRow={request_json:CanonicalGenerationRequest;price_cents:number;currency:string;auth_origin:string;studio_project_id:string|null};

/** QA only: real conversation persistence/adapters/pricing, controlled availability, no provider submission. */
export async function createStudioCallRuntime(catalog:AgentPublicGenerationEngine[],previousCaseIds:readonly string[]=[]) {
  if(process.env.DATABASE_URL) throw new Error('Unset DATABASE_URL: live call qualification uses only disposable PostgreSQL.');
  const previousCases=new Set(previousCaseIds);
  const requireCurrentCase=(id:string)=>{if(previousCases.has(id))throw new Error('A restarted disposable runtime requires a fresh case ID; prior database continuity is unavailable.');};
  const fixtures=[
    {key:'watch',id:'8',path:'/media/mcp/project-demo/watch-static.png',width:1672,height:941,mime:'image/png'},
    {key:'watch_end',id:'9',path:'/media/mcp/project-demo/watch-motion-poster.png',width:1672,height:941,mime:'image/png'},
    {key:'portrait',id:'a',path:'/assets/app-starters/acid-portrait-f5440c7f5eb0.webp',width:1024,height:1024,mime:'image/webp'},
    {key:'abstract',id:'b',path:'/assets/marketing/reference-workflow-source-image.webp',width:900,height:620,mime:'image/webp'},
  ];
  const hash=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,32);
  const ownerFor=(id:string)=>{const digest=hash('owner:'+id);return digest.slice(0,8)+'-'+digest.slice(8,12)+'-4'+digest.slice(13,16)+'-8'+digest.slice(17,20)+'-'+digest.slice(20);};
  const referenceId=(id:string,key:string)=>'ma_'+hash(id+'\0'+key);
  const fixtureUrl=(id:string,fixture:typeof fixtures[number])=>'https://cdn.maxvideoai.com/qa/'+hash(id)+'/'+fixture.key+(fixture.mime==='image/png'?'.png':'.webp');
  const fixtureBytes=Object.fromEntries(fixtures.map(f=>[f.key,readFileSync('frontend/public'+f.path)]));
  const pg=await startDisposablePostgres('studio-call-qualification');
  process.env.DATABASE_URL=pg.databaseUrl;
  const fixtureImages:Record<string,string>={};
  const ensuredCases=new Set<string>();
  const parityQuotes=new Map<string,{requestHash:string;priceCents:number;currency:string}>();
  try {
    await createPaidGenerationTestSchema(pg.pool);
    await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);
      CREATE TABLE studio_sequences(id text PRIMARY KEY);
      CREATE TABLE profiles(id uuid PRIMARY KEY,preferred_currency text);
      CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,mime_type text,status text,duration_sec double precision,metadata jsonb,created_at timestamptz DEFAULT clock_timestamp());
      CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
    for(const migration of ['42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql'])
      await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
    async function ensureCase(id:string){
      if(ensuredCases.has(id))return;
      const userId=ownerFor(id);
      await pg.pool.query("INSERT INTO profiles VALUES ($1,'usd')",[userId]);
      for(const fixture of fixtures){
        const url=fixtureUrl(id,fixture);
        fixtureImages[url]='data:'+fixture.mime+';base64,'+fixtureBytes[fixture.key].toString('base64');
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
          VALUES ($1,$1,$2,'image',$3,$4,$5,$6,$7,'ready','{}')`,[referenceId(id,fixture.key),userId,url,fixture.mime,fixtureBytes[fixture.key].length,fixture.width,fixture.height]);
      }
      await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency,description) VALUES ($1,'topup',10000,'USD','Isolated QA funding fixture')",[userId]);
      ensuredCases.add(id);
    }
    const availability=()=>({executable:true as const,reason:'available' as const});
    const neverSubmit=async()=>{throw new Error('Paid media submission is forbidden in call qualification.');};
    const imageFactory:typeof createStudioImageGenerationService=(actor,options)=>createStudioImageGenerationService(actor,{...options,
      prepareDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:availability},
      confirmDependencies:{submitPaidGeneration:neverSubmit}});
    const videoFactory:typeof createStudioVideoGenerationService=(actor,options)=>createStudioVideoGenerationService(actor,{...options,
      prepareDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:availability},
      confirmDependencies:{submitPaidGeneration:neverSubmit}});
    const audioEnv={FAL_KEY:'test-only-no-network',GOOGLE_VERTEX_PROJECT_ID:'test-only',GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON:'test-only-no-network'};
    const executor={query:async<TRecord=unknown>(sql:string,values?:ReadonlyArray<unknown>)=>(await pg.pool.query<TRecord>(sql,values)).rows};
    const audioFactory:typeof createStudioAudioGenerationService=(actor,options)=>createStudioAudioGenerationService(actor,{...options,
      prepareDependencies:{listCapabilities:()=>listAudioCapabilities(audioEnv),prepareRun:(body,owner)=>prepareAudioRun(body,owner,{env:audioEnv,pricingPolicy:{loadOverrides:()=>loadPricingPolicyOverridesWithExecutor(executor)}})},
      confirmDependencies:{executeRun:neverSubmit}});
    const actorFor=(id:string)=>({authMethod:'studio-session' as const,userId:ownerFor(id),projectId:id,clientId:null});
    async function prepareMcp(request:PrepareGenerationInput,id:string){
      await ensureCase(id);
      const prepare=createPrepareGenerationService('https://maxvideoai.com/account/connections',{clientIp:null,userAgent:null},{
        paidGenerationEnabled:()=>true,listPublicEngines:async()=>catalog,resolveRequestExecutability:availability,
      });
      const prepared=await prepare(request,{authMethod:'oauth',userId:ownerFor(id),clientId:'call-qualification-client',emailVerified:true});
      const quote=(await pg.pool.query<McpQuoteRow>('SELECT request_json,price_cents,currency,auth_origin,studio_project_id FROM mcp_generation_quotes WHERE quote_id=$1',[prepared.quoteId])).rows[0];
      return {prepared,quote};
    }
    const inspect=async(id:string,requestId:string)=>{
      const steps=(await pg.pool.query<{request:StudioActionRequest;result:StudioActionResult}>('SELECT action_json AS request,result_json AS result FROM studio_conversation_steps WHERE project_id=$1 AND request_id=$2 ORDER BY created_at',[id,requestId])).rows;
      const quotes=(await pg.pool.query<QuoteRow>('SELECT quote_id,state,request_json,price_cents,currency,job_id FROM mcp_generation_quotes WHERE studio_project_id=$1 ORDER BY created_at',[id])).rows;
      const counts=(await pg.pool.query<{jobs:number;charges:number}>("SELECT (SELECT count(*)::int FROM app_jobs) AS jobs,(SELECT count(*)::int FROM app_receipts WHERE type='charge') AS charges")).rows[0];
      assert.equal(counts.jobs,0);assert.equal(counts.charges,0);
      assert.ok(quotes.every(q=>q.job_id===null));
      const parity=[];
      for(const quote of quotes){
        if(quote.request_json.surface==='audio')continue; // The public MCP audio gate remains closed.
        if(!parityQuotes.has(quote.quote_id)){
          const mcp=await prepareMcp(quote.request_json,id);
          assert.deepEqual(mcp.quote.request_json,quote.request_json);
          assert.equal(mcp.quote.price_cents,quote.price_cents);assert.equal(mcp.quote.currency,quote.currency);
          assert.equal(mcp.quote.auth_origin,'oauth');assert.equal(mcp.quote.studio_project_id,null);
          parityQuotes.set(quote.quote_id,{requestHash:mcp.prepared.requestHash,priceCents:mcp.quote.price_cents,currency:mcp.quote.currency});
        }
        parity.push({studioQuoteId:quote.quote_id,...parityQuotes.get(quote.quote_id),matched:true});
      }
      return {steps,quotes,counts,parity};
    };
    return {
      requireCurrentCase,
      referenceId,prepareMcp,
      responseParams(params:ResponseCreateParamsNonStreaming):ResponseCreateParamsNonStreaming {
        // Controlled storage is not a public URL. Give the real LLM the exact fixture bytes.
        return JSON.parse(JSON.stringify(params,(key,value)=>key==='image_url'&&typeof value==='string'&&fixtureImages[value]?fixtureImages[value]:value));
      },
      async submit(id:string,message:string,referenceKeys:string[],createResponse:StudioResponseCreator,requestId=randomUUID()){
        requireCurrentCase(id);
        const references=referenceKeys.map(key=>{const fixture=fixtures.find(f=>f.key===key);if(!fixture)throw new Error('Unknown QA reference');return referenceId(id,fixture.key);});
        await ensureCase(id);
        await pg.pool.query("INSERT INTO studio_projects(id,user_id,name) VALUES ($1,$2,'Call qualification') ON CONFLICT DO NOTHING",[id,ownerFor(id)]);
        const service=createImageConversationService(actorFor(id),{enabled:true,actionsEnabled:true,mediaEnabled:true,
          generationFactory:imageFactory,videoGenerationFactory:videoFactory,audioGenerationFactory:audioFactory,
          assistancePolicy:{enabled:false,solAllowanceNanoUsd:0,lunaAllowanceNanoUsd:0,campaignNanoUsd:0,maxAdditionalBudgetCents:0},createActionResponse:createResponse});
        let result:Awaited<ReturnType<typeof service.submit>>|undefined,error:{code:string}|undefined;
        try{result=await service.submit({requestId,message,references,referenceMentions:references.map((assetId,index)=>({assetId,label:'Image '+(index+1)}))});}
        catch(e){error={code:(e as {code?:string}).code??'quality-run-error'};}
        return {result,error,project:await readStudioConversationProject(actorFor(id)),...await inspect(id,requestId)};
      },
      async close(){await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();},
    };
  } catch(error){await getDb().end().catch(()=>{});delete process.env.DATABASE_URL;await pg.cleanup();throw error;}
}
