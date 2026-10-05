import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {loadPricingPolicyOverridesWithExecutor} from '../frontend/src/lib/pricing-rule-store';
import {createStudioAudioGenerationService} from '../frontend/src/server/studio/audio-generation-service';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {audioRequestToGenerationBody,type CanonicalAudioRequest} from '../frontend/src/server/agent-api/audio-normalization';
import {parseAudioQuoteExecutionEvidence} from '../frontend/src/server/agent-api/audio-quote-snapshot';
import {prepareAudioRun} from '../frontend/src/server/audio/prepare-audio';
import {buildAudioRunReservation} from '../frontend/src/server/audio/audio-run-reservation';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

const env={FAL_KEY:'test-only',GOOGLE_VERTEX_PROJECT_ID:'test-only',GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON:'test-only'};
const video={type:'asset' as const,kind:'video' as const,assetId:'ma_'+'c'.repeat(32)};
const voice={type:'asset' as const,kind:'audio' as const,assetId:'ma_'+'d'.repeat(32)};
const videoUrl='https://cdn.maxvideoai.com/fixture/source.mp4';
const voiceUrl='https://cdn.maxvideoai.com/fixture/voice.mp3';
const source={role:'source_video' as const,asset:video};
const sample={role:'voice_sample' as const,asset:voice};

test('seven certified Audio packs use real canonical quotes, exact owned sources and project-bound native outputs',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined,'This suite only uses disposable PostgreSQL.');
  const pg=await startDisposablePostgres('studio-audio-catalog');process.env.DATABASE_URL=pg.databaseUrl;
  const fetch=globalThis.fetch;let fetches=0;
  globalThis.fetch=async()=>{fetches++;throw new Error('No external media fetch or provider request is authorized.');};
  t.after(async()=>{globalThis.fetch=fetch;await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(readFileSync('neon/migrations/53_studio_media_generation_scope.sql','utf8'));
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);
    CREATE TABLE profiles(id uuid PRIMARY KEY,preferred_currency text);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,storage_url text,mime_type text,status text,duration_sec double precision,width int,height int,metadata jsonb);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,width int,height int,size_bytes bigint,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text);`);
  const userId='00000000-0000-4000-8000-000000000098';
  await pg.pool.query("INSERT INTO profiles VALUES ($1,'usd');",[userId]);
  await pg.pool.query("INSERT INTO studio_projects VALUES ('audio',$1,'Audio',NULL),('other',$1,'Other',NULL)",[userId]);
  await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ($1,'topup',10000,'USD')",[userId]);
  for(const [ref,url,mime]of [[video,videoUrl,'video/mp4'],[voice,voiceUrl,'audio/mpeg']] as const)
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,width,height,size_bytes,status,metadata)
      VALUES ($1,$1,$2,$3,$4,$5,1920,1080,1000,'ready',$6::jsonb)`,[ref.assetId,userId,ref.kind,url,mime,JSON.stringify({durationSec:999,mediaFacts:{source:'probe',durationSec:999}})]);
  const executor={query:async<TRecord=unknown>(sql:string,values?:ReadonlyArray<unknown>)=>(await pg.pool.query<TRecord>(sql,values)).rows};
  const probes:string[]=[];let executions=0;
  const dependencies={env,pricingPolicy:{loadOverrides:()=>loadPricingPolicyOverridesWithExecutor(executor)},inspectSourceVideo:async(url:string)=>{
    assert.equal(url,videoUrl);probes.push(url);return {durationSec:6,width:1920,height:1080,hasAudio:false};
  }};
  const options={enabled:true,prepareDependencies:{listCapabilities:()=>listAudioCapabilities(env),prepareRun:(body:Parameters<typeof prepareAudioRun>[0],owner:string)=>prepareAudioRun(body,owner,dependencies)},
    confirmDependencies:{listCapabilities:()=>listAudioCapabilities(env),executeRun:async()=>{executions++;throw new Error('No generation is authorized.');}}};
  const actor={authMethod:'studio-session' as const,userId,projectId:'audio',clientId:null};
  const service=createStudioAudioGenerationService(actor,options);
  const requests:CanonicalAudioRequest[]=[
    {schemaVersion:1,surface:'audio',engineId:'audio-music-only',mode:'music_only',prompt:'A warm cinematic instrumental.',settings:{mood:'dreamy',musicModel:'pro',durationSec:12},references:[],outputCount:1},
    {schemaVersion:1,surface:'audio',engineId:'audio-voice-only',mode:'voice_only',prompt:'',settings:{script:'The watch marks a new beginning.',voiceModel:'seed',language:'english'},references:[sample],outputCount:1},
    {schemaVersion:1,surface:'audio',engineId:'audio-sfx-only',mode:'sfx_only',prompt:'A mechanical watch winds, then clicks.',settings:{durationSec:8},references:[],outputCount:1},
    {schemaVersion:1,surface:'audio',engineId:'audio-song',mode:'song',prompt:'An intimate acoustic folk song.',settings:{lyrics:'[Verse]\nCarry the morning home.'},references:[],outputCount:1},
    {schemaVersion:1,surface:'audio',engineId:'audio-ambience',mode:'ambience_only',prompt:'Forest rain with a distant stream.',settings:{durationSec:60},references:[],outputCount:1},
    {schemaVersion:1,surface:'audio',engineId:'audio-cinematic',mode:'cinematic',prompt:'Subtle mechanical sound design.',settings:{mood:'dreamy',musicEnabled:false,exportAudioFile:false},references:[source],outputCount:1},
    {schemaVersion:1,surface:'audio',engineId:'audio-cinematic-voice',mode:'cinematic_voice',prompt:'A warm original cinematic sound.',settings:{mood:'dreamy',musicEnabled:false,exportAudioFile:true,script:'The watch marks a new beginning.',voiceModel:'seed'},references:[source,sample],outputCount:1},
  ];
  for(const request of requests){
    const quote=await service.prepare(request);assert.equal(quote.confirmationRequired,true);assert.ok(quote.price.amountCents>0);assert.equal(quote.price.currency,'USD');
    const stored=await service.getQuote(quote.quoteId);assert.ok(stored);assert.equal(stored.state,'prepared');assert.equal(stored.jobId,null);
    assert.deepEqual(stored.request,quote.summary);assert.equal(stored.priceCents,quote.price.amountCents);
    const evidence=parseAudioQuoteExecutionEvidence(stored.pricingSnapshot);assert.deepEqual(evidence.references.map(ref=>({role:ref.role,asset:ref.asset})),request.references);
    const prepared=await prepareAudioRun(audioRequestToGenerationBody(quote.summary,{...(request.references.includes(source)?{sourceVideoUrl:videoUrl}:{}),...(request.references.includes(sample)?{voiceSampleUrl:voiceUrl}:{})}),userId,dependencies);
    assert.equal(quote.price.amountCents,prepared.pricingSnapshot.totalCents);assert.equal(quote.price.currency,prepared.pricingSnapshot.currency);
    const reservation=buildAudioRunReservation(prepared,userId);
    assert.equal(reservation.execution.initialSettingsSnapshot.pack,request.mode);
    assert.equal(prepared.normalized.outputKind,request.mode==='cinematic'?'video':request.mode==='cinematic_voice'?'both':'audio');
    if(request.references.includes(source)){assert.equal(evidence.durationSec,6);assert.equal(evidence.sourceProbe?.durationSec,6);assert.equal(prepared.durationSec,6,'Untrusted stored duration must never replace the source probe.');}
    if(request.references.includes(sample)){assert.equal(prepared.normalized.voiceMode,'clone');assert.equal(reservation.execution.initialSettingsSnapshot.refs.voiceSampleUrl,voiceUrl);}
    if(request.mode==='song'){assert.equal(reservation.initialJob.durationSec,null);assert.equal(reservation.execution.initialSettingsSnapshot.lyrics,request.settings.lyrics);}
  }
  assert.deepEqual((await pg.pool.query<{jobs:number;charges:number}>("SELECT (SELECT count(*)::int FROM app_jobs) jobs,(SELECT count(*)::int FROM app_receipts WHERE type='charge') charges")).rows[0],{jobs:0,charges:0});
  assert.ok(probes.length>0);assert.equal(fetches,0);assert.equal(executions,0);
  // Existing ready jobs are source fixtures, not generated by any preparation.
  const otherService=createStudioAudioGenerationService({...actor,projectId:'other'},options);
  const outputQuote=await otherService.prepare(requests[0]);
  await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,surface) VALUES ('existing-audio',$1,'completed','audio')",[userId]);
  await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url,mime_type,status,duration_sec,metadata) VALUES ('native-output','existing-audio',$1,'audio',$2,'audio/mpeg','ready',6,'{}')",[userId,voiceUrl]);
  await pg.pool.query("UPDATE mcp_generation_quotes SET state='claimed',job_id='existing-audio',claimed_at=statement_timestamp(),updated_at=statement_timestamp() WHERE quote_id=$1",[outputQuote.quoteId]);
  await pg.pool.query("UPDATE mcp_generation_quotes SET state='accepted',updated_at=statement_timestamp() WHERE quote_id=$1",[outputQuote.quoteId]);
  const nativeRequest={...requests[1],references:[{role:'voice_sample' as const,asset:{type:'job-output' as const,kind:'audio' as const,jobId:'existing-audio',outputId:'native-output'}}]};
  await assert.rejects(service.prepare(nativeRequest),{code:'REFERENCE_INVALID'},'Same-account outputs from another project must not enter the quote.');
  await pg.pool.query("UPDATE job_outputs SET status='processing' WHERE id='native-output'");
  await assert.rejects(otherService.prepare(nativeRequest),{code:'REFERENCE_INVALID'},'A current-project output must be ready.');
  await pg.pool.query("UPDATE job_outputs SET status='ready' WHERE id='native-output'");
  const native=await otherService.prepare(nativeRequest);assert.deepEqual(native.summary.references,nativeRequest.references);
  const beforeAssets=(await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM media_assets')).rows[0].n;
  await pg.pool.query("UPDATE mcp_generation_quotes SET state='failed',updated_at=statement_timestamp() WHERE quote_id=$1",[outputQuote.quoteId]);
  await assert.rejects(otherService.confirm({quoteId:native.quoteId,confirmed:true}),{code:'QUOTE_EXPIRED'});
  assert.equal(executions,0);assert.equal((await pg.pool.query<{n:number}>("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM media_assets')).rows[0].n,beforeAssets,'Native output references are never promoted to the library.');
  await pg.pool.query("UPDATE job_outputs SET status='processing' WHERE id='native-output'");
  await assert.rejects(service.prepare(nativeRequest),{code:'REFERENCE_INVALID'});
  assert.equal(fetches,0);
});
