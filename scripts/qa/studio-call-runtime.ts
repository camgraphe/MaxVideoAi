import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {basename,extname} from 'node:path';
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
import {resolveSupportedReferenceMedia} from '../../frontend/src/server/agent-api/reference-media-policy';

type QuoteRow={quote_id:string;state:string;request_json:CanonicalGenerationRequest|CanonicalAudioRequest;price_cents:number;currency:string;job_id:string|null};
type McpQuoteRow={request_json:CanonicalGenerationRequest;price_cents:number;currency:string;auth_origin:string;studio_project_id:string|null};
type FixtureKind='image'|'video'|'audio';
export type StudioCallFixtureReference={key:string;kind:FixtureKind;mime:string;width:number|null;height:number|null;durationSec:number|null;sizeBytes:number;sha256:string};
type FixtureProbe={streams?:Array<{codec_type?:string;width?:number;height?:number;duration?:string;disposition?:{attached_pic?:number}}>;format?:{duration?:string}};

function readFixture(fixture:{key:string;kind:FixtureKind;path:string}) {
  const path='frontend/public'+fixture.path;
  const bytes=readFileSync(path);
  const detectedMime=execFileSync('file',['--mime-type','-b',path],{encoding:'utf8'}).trim();
  const media=resolveSupportedReferenceMedia(fixture.kind,detectedMime);
  assert.ok(media,'Unsupported local QA fixture MIME: '+fixture.key);
  const probe:FixtureProbe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height,duration:stream_disposition=attached_pic','-of','json',path],{encoding:'utf8'}));
  const stream=probe.streams?.find(item=>item.codec_type===(fixture.kind==='audio'?'audio':'video')&&item.disposition?.attached_pic!==1);
  assert.ok(stream,'Missing local QA media stream: '+fixture.key);
  const width=fixture.kind==='audio'?null:stream.width??null;
  const height=fixture.kind==='audio'?null:stream.height??null;
  const durationSec=fixture.kind==='image'?null:Number(probe.format?.duration??stream.duration);
  assert.ok(fixture.kind==='audio'||(Number.isSafeInteger(width)&&Number(width)>0&&Number.isSafeInteger(height)&&Number(height)>0),'Missing measured QA image/video dimensions.');
  assert.ok(durationSec===null||(Number.isFinite(durationSec)&&durationSec>0),'Missing measured QA media duration.');
  const reference:StudioCallFixtureReference={key:fixture.key,kind:fixture.kind,mime:media.canonicalMime,width,height,durationSec,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  return {...fixture,...reference,bytes,hasAudio:probe.streams?.some(item=>item.codec_type==='audio')??false,reference};
}

/** QA only: real conversation persistence/adapters/pricing, controlled availability, no provider submission. */
export async function createStudioCallRuntime(catalog:AgentPublicGenerationEngine[],previousCaseIds:readonly string[]=[]) {
  if(process.env.DATABASE_URL) throw new Error('Unset DATABASE_URL: live call qualification uses only disposable PostgreSQL.');
  const previousCases=new Set(previousCaseIds);
  const requireCurrentCase=(id:string)=>{if(previousCases.has(id))throw new Error('A restarted disposable runtime requires a fresh case ID; prior database continuity is unavailable.');};
  // Read and probe every fixed local fixture before allocating a PostgreSQL cluster.
  const fixtures=[
    {key:'watch',kind:'image',path:'/media/mcp/project-demo/watch-static.png'},
    {key:'watch_end',kind:'image',path:'/media/mcp/project-demo/watch-motion-poster.png'},
    {key:'portrait',kind:'image',path:'/assets/app-starters/acid-portrait-f5440c7f5eb0.webp'},
    {key:'abstract',kind:'image',path:'/assets/marketing/reference-workflow-source-image.webp'},
    {key:'watch_video',kind:'video',path:'/media/mcp/project-demo/watch-wan-3-prime-scroll.mp4'},
    {key:'ambient_audio',kind:'audio',path:'/studio/demo-ambient.wav'},
    {key:'voice_sample',kind:'audio',path:'/assets/audio/seed-audio/quentin_en_zh.mp3'},
  ].map(fixture=>readFixture({...fixture,kind:fixture.kind as FixtureKind}));
  const hash=(value:string)=>createHash('sha256').update(value).digest('hex').slice(0,32);
  const ownerFor=(id:string)=>{const digest=hash('owner:'+id);return digest.slice(0,8)+'-'+digest.slice(8,12)+'-4'+digest.slice(13,16)+'-8'+digest.slice(17,20)+'-'+digest.slice(20);};
  const referenceId=(id:string,key:string)=>'ma_'+hash(id+'\0'+key);
  const fixtureUrl=(id:string,fixture:typeof fixtures[number])=>'https://cdn.maxvideoai.com/qa/'+hash(id)+'/'+fixture.key+extname(fixture.path);
  const pg=await startDisposablePostgres('studio-call-qualification');
  process.env.DATABASE_URL=pg.databaseUrl;
  const fixtureImages:Record<string,string>={};
  const fixtureVideoProbes=new Map<string,{durationSec:number;width:number;height:number;hasAudio:boolean}>();
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
        if(fixture.kind==='image')fixtureImages[url]='data:'+fixture.mime+';base64,'+fixture.bytes.toString('base64');
        if(fixture.kind==='video'){
          assert.ok(fixture.durationSec&&fixture.width&&fixture.height);
          fixtureVideoProbes.set(url,{durationSec:fixture.durationSec,width:fixture.width,height:fixture.height,hasAudio:fixture.hasAudio});
        }
        const metadata={originalName:basename(fixture.path),durationSec:fixture.durationSec,mediaFacts:{source:'probe',
          ...(fixture.durationSec===null?{}:{durationSec:fixture.durationSec}),
          ...(fixture.width===null?{}:{width:fixture.width,height:fixture.height}),hasAudio:fixture.hasAudio}};
        await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
          VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,'ready',$9::jsonb)`,[referenceId(id,fixture.key),userId,fixture.kind,url,fixture.mime,fixture.bytes.length,fixture.width,fixture.height,JSON.stringify(metadata)]);
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
      prepareDependencies:{listCapabilities:()=>listAudioCapabilities(audioEnv),prepareRun:(body,owner)=>prepareAudioRun(body,owner,{env:audioEnv,pricingPolicy:{loadOverrides:()=>loadPricingPolicyOverridesWithExecutor(executor)},
        inspectSourceVideo:async url=>{const probe=fixtureVideoProbes.get(url);assert.ok(probe,'Only an exact locally measured owned QA video may be probed.');return {...probe};}})},
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
        const selected=referenceKeys.map(key=>{const fixture=fixtures.find(f=>f.key===key);if(!fixture)throw new Error('Unknown QA reference');return fixture;});
        const references=selected.filter(f=>f.kind==='image').map(f=>referenceId(id,f.key));
        const attachments=selected.filter(f=>f.kind!=='image').map(f=>({type:'asset' as const,kind:f.kind,assetId:referenceId(id,f.key)}));
        const countsByKind={image:0,video:0,audio:0};
        const referenceMentions=selected.map(f=>({assetId:referenceId(id,f.key),label:f.kind[0].toUpperCase()+f.kind.slice(1)+' '+(++countsByKind[f.kind])}));
        await ensureCase(id);
        await pg.pool.query("INSERT INTO studio_projects(id,user_id,name) VALUES ($1,$2,'Call qualification') ON CONFLICT DO NOTHING",[id,ownerFor(id)]);
        const service=createImageConversationService(actorFor(id),{enabled:true,actionsEnabled:true,mediaEnabled:true,
          generationFactory:imageFactory,videoGenerationFactory:videoFactory,audioGenerationFactory:audioFactory,
          assistancePolicy:{enabled:false,solAllowanceNanoUsd:0,lunaAllowanceNanoUsd:0,campaignNanoUsd:0,maxAdditionalBudgetCents:0},createActionResponse:createResponse});
        let result:Awaited<ReturnType<typeof service.submit>>|undefined,error:{code:string}|undefined;
        try{result=await service.submit({requestId,message,references,...(attachments.length?{attachments}:{}),referenceMentions});}
        catch(e){error={code:(e as {code?:string}).code??'quality-run-error'};}
        return {result,error,fixtureReferences:selected.map(f=>({...f.reference})),project:await readStudioConversationProject(actorFor(id)),...await inspect(id,requestId)};
      },
      async close(){await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();},
    };
  } catch(error){await getDb().end().catch(()=>{});delete process.env.DATABASE_URL;await pg.cleanup();throw error;}
}
