import assert from 'node:assert/strict';
import test from 'node:test';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {getDb} from '../frontend/src/lib/db';
import {resolveStudioMedia} from '../frontend/src/server/studio/media-resolver';
import {validateStudioMediaRequest,defaultStudioMediaFactories,type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {listPublicAgentGenerationEngines} from '../frontend/src/server/agent-api/model-catalog';
import type {StudioMediaIntent} from '../frontend/lib/studio/conversation-media-contract';

// Real production-shaped tables, canonical capability validation, and exact project output scope.
test('ready native output with no byte column reaches H3 preflight using its measured owned copy, without writes',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined);
  const pg=await startDisposablePostgres('studio-output-reference');process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,status text,hidden boolean);
    CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,deleted_at timestamptz);
    CREATE TABLE mcp_generation_quotes(job_id text,user_id text,studio_project_id text,auth_origin text,state text);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,storage_url text,
      mime_type text,width integer,height integer,duration_sec double precision,status text,metadata jsonb,created_at timestamptz DEFAULT now());
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,
      source_job_id text,source_output_id text,width integer,height integer,size_bytes bigint,status text,deleted_at timestamptz,metadata jsonb);
    CREATE TABLE app_receipts(type text);
    INSERT INTO app_jobs VALUES('job','owner','completed',false);
    INSERT INTO studio_projects VALUES('project','owner',NULL),('other','owner',NULL);
    INSERT INTO mcp_generation_quotes VALUES('job','owner','project','studio-session','accepted');
    INSERT INTO job_outputs VALUES('output','job','owner','image','https://cdn.maxvideoai.com/original.png',NULL,
      'image/png',1920,1080,NULL,'ready','{}',now());
    INSERT INTO media_assets VALUES('saved','ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','owner','image','https://cdn.maxvideoai.com/copy.png',
      'image/png','job','output',1920,1080,8192,'ready',NULL,'{"originUrl":"https://cdn.maxvideoai.com/original.png"}');`);
  const entries=listFalEngines();
  const catalog=await listPublicAgentGenerationEngines({listEngines:async()=>entries.map(item=>item.engine),
    surfaceByEngineId:id=>entries.find(item=>item.id===id)?.category==='image'?'image':'video',isEngineExecutable:()=>true,isModeExecutable:()=>true});
  const candidate=catalog.find(item=>item.engine.id==='minimax-h3');assert.ok(candidate);
  const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
  const ref={type:'job-output',jobId:'job',outputId:'output',kind:'image'} as const;
  const action:StudioMediaIntent={action:'video.prepare',reply:'Review this animation.',prompt:'Animate the generated landscape.',
    modelId:'minimax-h3',mode:'i2v',aspectRatio:'16:9',source:null,references:[{ref,role:'first_frame',slot:null}],
    settings:[{name:'durationSec',value:6},{name:'resolution',value:candidate.engine.resolutions[0]}]};
  const factories:StudioMediaFactories={...defaultStudioMediaFactories,video:(actor,options)=>({...defaultStudioMediaFactories.video(actor,options),catalog:async()=>catalog})};
  const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:action.prompt,references:[]};
  let promotions=0,heads=0;
  const dependencies={resolveMedia:((owner,reference,execute,options)=>resolveStudioMedia(owner,reference,execute,{...options,
    headReferenceMetadata:async()=>{heads++;throw new Error('Network is forbidden');}})) as typeof resolveStudioMedia,
    saveOutput:async()=>{promotions++;throw new Error('Preflight must not promote');}};
  assert.equal((await resolveStudioMedia('owner',ref)).sizeBytes,null,'Ordinary media reads stay unchanged');
  const validated=await validateStudioMediaRequest(actor,action,input,factories,true,dependencies);
  assert.equal(typeof validated.materialize,'function');assert.equal(promotions,0);assert.equal(heads,0);
  await assert.rejects(validateStudioMediaRequest({...actor,projectId:'other'},action,input,factories,true,dependencies),{code:'REFERENCE_INVALID'});
  await assert.rejects(validateStudioMediaRequest({...actor,userId:'foreign'},action,input,factories,true,dependencies),{code:'REFERENCE_INVALID'});
  await pg.pool.query("UPDATE media_assets SET metadata='{}'");
  await assert.rejects(validateStudioMediaRequest(actor,action,input,factories,true,dependencies),{code:'REFERENCE_INVALID'});
  await pg.pool.query("UPDATE media_assets SET metadata='{\"originUrl\":\"https://cdn.maxvideoai.com/original.png\"}'");
  await pg.pool.query("UPDATE job_outputs SET status='processing'");
  await assert.rejects(validateStudioMediaRequest(actor,action,input,factories,true,dependencies),{code:'REFERENCE_INVALID'});
  const counts=(await pg.pool.query<{jobs:number;assets:number;charges:number}>(`SELECT
    (SELECT count(*)::int FROM app_jobs) jobs,(SELECT count(*)::int FROM media_assets) assets,
    (SELECT count(*)::int FROM app_receipts WHERE type='charge') charges`)).rows[0];
  assert.deepEqual(counts,{jobs:1,assets:1,charges:0});assert.equal(promotions,0);assert.equal(heads,0);
});
