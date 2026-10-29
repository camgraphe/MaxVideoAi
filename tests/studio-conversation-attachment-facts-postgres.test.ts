import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {getDb} from '../frontend/src/lib/db';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {hydrateOwnedVideoMediaFacts} from '../frontend/server/media-library/owned-video-facts';
import {inspectSourceVideo} from '../frontend/src/server/audio/source-video-probe';

test('new selected legacy videos qualify before any assistant call and completed replay never probes or charges again',async t=>{
  const pg=await startDisposablePostgres('studio-attachment-facts');
  const prior=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  const userId='00000000-0000-4000-8000-000000000089';
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text,name text,deleted_at timestamptz);
    CREATE TABLE studio_sequences(id text PRIMARY KEY);CREATE TABLE profiles(id uuid PRIMARY KEY,preferred_currency text);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,mime_type text,status text,metadata jsonb);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text,updated_at timestamptz);`);
  await pg.pool.query("INSERT INTO profiles VALUES($1,'usd');",[userId]);
  await pg.pool.query("INSERT INTO studio_projects VALUES('project',$1,'Transition',NULL)",[userId]);
  for(const migration of ['42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','53_studio_media_generation_scope.sql'])
    await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
  const refs=['a','b'].map(letter=>({type:'asset' as const,kind:'video' as const,assetId:'ma_'+letter.repeat(32)}));
  for(const [index,ref]of refs.entries())await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,status,metadata)
    VALUES($1,$2,$3,'video',$4,'video/mp4',4630982,'ready','{"legacy":true}')`,[`row-${index}`,ref.assetId,userId,`https://cdn.maxvideoai.com/selected-${index}.mp4`]);
  const bytes=readFileSync('tests/fixtures/studio-media/pattern-a.mp4');
  let probes=0,assistantCalls=0;
  const execute=async<T>(sql:string,values?:readonly unknown[])=>(await pg.pool.query(sql,values)).rows as T[];
  const hydrate:typeof hydrateOwnedVideoMediaFacts=input=>hydrateOwnedVideoMediaFacts(input,{
    query:execute,createReadUrl:async({url})=>url,
    inspectVideo:url=>{probes++;return inspectSourceVideo(url,{download:async()=>({bytes,mimeType:'video/mp4',sizeBytes:bytes.length})});},
  });
  const actor={authMethod:'studio-session' as const,userId,projectId:'project',clientId:null};
  const options:Parameters<typeof createImageConversationService>[1]={enabled:true,actionsEnabled:true,mediaEnabled:true,
    assistancePolicy:{enabled:false,solAllowanceNanoUsd:0,lunaAllowanceNanoUsd:0,campaignNanoUsd:0,maxAdditionalBudgetCents:0},
    attachmentFacts:{hydrateVideoFacts:hydrate},createActionResponse:async params=>{
      assistantCalls++;
      const content=JSON.stringify(params.input);
      assert.match(content,/Video 1/);assert.match(content,/durationSec[^\d]*6/);
      assert.doesNotMatch(content,/selected-0\.mp4/,'Private video bytes/URLs are not assistant inputs.');
      return {id:'response-'+assistantCalls,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,
        output:[],output_text:JSON.stringify({reply:'The saved clip is available for planning.'})};
    }};
  const service=createImageConversationService(actor,options);
  const input={requestId:randomUUID(),message:'Use this saved video.',references:[],attachments:[refs[0]],referenceMentions:[{assetId:refs[0].assetId,label:'Video 1'}]};
  const result=await service.submit(input);
  assert.equal(result.quote,null);assert.equal(probes,1);assert.equal(assistantCalls,1);
  const stored=(await pg.pool.query('SELECT metadata,width,height,url FROM media_assets WHERE public_id=$1',[refs[0].assetId])).rows[0];
  assert.deepEqual(stored.metadata,{legacy:true,mediaFacts:{source:'probe',durationSec:6,width:320,height:180,hasAudio:true}});
  assert.equal(stored.url,'https://cdn.maxvideoai.com/selected-0.mp4');
  assert.equal((await service.submit(input)).requestId,result.requestId);
  assert.equal(probes,1);assert.equal(assistantCalls,1);

  const failed=createImageConversationService(actor,{...options,attachmentFacts:{hydrateVideoFacts:async()=>{throw new Error('SECRET signed URL');}}});
  await assert.rejects(failed.submit({requestId:randomUUID(),message:'Use the other saved clip.',references:[],attachments:[refs[1]]}),error=>{
    assert.equal((error as {code:string}).code,'REFERENCE_INVALID');assert.match((error as Error).message,/verify.*saved video/i);
    assert.doesNotMatch((error as Error).message,/SECRET/);return true;
  });
  assert.equal(assistantCalls,1,'A failed source probe must stop before metered assistant work.');
  for(const sql of ['SELECT count(*)::int AS n FROM mcp_generation_quotes','SELECT count(*)::int AS n FROM app_jobs',"SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'",'SELECT count(*)::int AS n FROM studio_image_model_usage'])
    assert.equal((await pg.pool.query(sql)).rows[0].n,0);
});
