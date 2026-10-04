import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {createStudioConversationProject} from '../frontend/src/server/studio/conversation-project-command';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {estimateOwnedTimelineExport,submitOwnedTimelineExport} from '../frontend/src/server/timeline-exports/orchestration';
import {ensureTimelineExportSchema} from '../frontend/src/server/timeline-exports/schema';
import {prepareStudioTimelineExport,confirmStudioTimelineExport,readStudioTimelineExport} from '../frontend/src/server/studio/conversation-export-command';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

test('export preparation snapshots the owned saved cut without charging and preserves one scoped quote after interruption',async t => {
  const pg=await startDisposablePostgres('st-export-tools');
  const previous=process.env.DATABASE_URL;
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for(const name of ['26_studio_projects.sql','42_studio_connected_montages.sql'])await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  const actor={userId:'00000000-0000-4000-8000-000000000191',authOrigin:'studio-session' as const,clientId:null};
  const project=await createStudioConversationProject(actor,{name:'A quiet launch',idempotencyKey:randomUUID()},{featureEnabled:true});
  const clip={id:'opening',title:'Opening',outputNodeId:'opening-output',assetId:'ma_'+'a'.repeat(32),track:'video',mediaKind:'image',startSec:0,durationSec:5,sourceStartSec:0,sourceWidth:1920,sourceHeight:1080,mediaUrl:'https://cdn.maxvideoai.com/owned.png',status:'completed'};
  await pg.pool.query(`UPDATE studio_sequences SET timeline_state=jsonb_set(timeline_state,'{timelineItems}',$2::jsonb) WHERE id=$1`,[project.sequenceId,JSON.stringify([clip])]);
  const input={projectId:project.projectId,sequenceId:project.sequenceId,expectedRevision:0,qualityPreset:'draft' as const,includeAudio:true,idempotencyKey:randomUUID()};
  let estimates=0,submitted=0;
  const estimate=async (params:any)=>{
    estimates++;
    assert.equal(params.userId,actor.userId);
    assert.equal(params.rawRequest.projectId,project.projectId);
    assert.equal(params.rawRequest.manifest.tracks[0].clips[0].durationSec,5);
    assert.equal(params.rawRequest.exportSettings.includeAudio,true);
    return {status:200,body:{ok:true as const,quota:{freeLimit:3,usedFreeExports:0,freeExportsRemaining:3,billingKind:'free' as const},estimate:{billingKind:'free' as const,amountCents:0,currency:'USD' as const,freeExportsRemaining:3,unitCentsPerSecond:1,multiplier:1},estimateToken:'private-estimate-token',estimateExpiresAt:Math.floor(Date.now()/1000)+300}};
  };
  const dependencies={enabled:true,requestOrigin:'http://localhost:3000',estimate};
  await assert.rejects(prepareStudioTimelineExport(actor,input,{...dependencies,onPrepared:async()=>{throw new Error('Interrupted quote checkpoint');}}),/Interrupted quote checkpoint/);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM studio_project_commands WHERE command_kind=\'timeline_export_prepare\'')).rows[0].n,0);
  const quote=await prepareStudioTimelineExport(actor,input,dependencies);
  assert.equal(quote.durationSec,5);
  assert.equal(quote.price.amountCents,0);
  assert.equal(quote.confirmationRequired,true);
  assert.doesNotMatch(JSON.stringify(quote),/private-estimate-token|mediaUrl|owned\.png/);
  assert.deepEqual(await prepareStudioTimelineExport(actor,input,dependencies),quote);
  assert.equal(estimates,2,'completed preparation receipt replays without a second estimate');
  await assert.rejects(prepareStudioTimelineExport(actor,{...input,qualityPreset:'high'},dependencies),/IDEMPOTENCY_CONFLICT/);
  await assert.rejects(prepareStudioTimelineExport({...actor,userId:'foreign'},input,dependencies),/PROJECT_NOT_FOUND/);
  await assert.rejects(prepareStudioTimelineExport(actor,{...input,sequenceId:'foreign',idempotencyKey:randomUUID()},dependencies),/SEQUENCE_CONFLICT/);
  await assert.rejects(confirmStudioTimelineExport({...actor,authOrigin:'oauth',clientId:'host'}, {projectId:project.projectId,quoteId:quote.quoteId,confirmed:true},dependencies),/EXPORT_QUOTE_NOT_FOUND/);
  await assert.rejects(confirmStudioTimelineExport(actor,{projectId:project.projectId,quoteId:quote.quoteId,confirmed:false},dependencies),/CONFIRMATION_REQUIRED/);
  assert.equal(await readStudioTimelineExport(actor,{projectId:project.projectId,quoteId:quote.quoteId},dependencies),null);
  await pg.pool.query('UPDATE studio_projects SET revision=1 WHERE id=$1',[project.projectId]);
  await assert.rejects(confirmStudioTimelineExport(actor,{projectId:project.projectId,quoteId:quote.quoteId,confirmed:true},{...dependencies,submit:async()=>{submitted++;throw new Error('Should not submit');}}),/PROJECT_STATE_STALE/);
  assert.equal(submitted,0);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  await t.test('a saved muted track and hidden track stay excluded from the prepared film',async()=>{
    const hidden={...clip,id:'hidden',track:'video-2',durationSec:10};
    const audio={...clip,id:'music',track:'audio',mediaKind:'audio',sourceDurationSec:5,audioMix:{volume:20,muted:false}};
    await pg.pool.query(`UPDATE studio_sequences SET timeline_state=timeline_state || $2::jsonb WHERE id=$1`,[project.sequenceId,JSON.stringify({timelineItems:[clip,hidden,audio],hiddenVideoTracks:['video-2'],mutedAudioTracks:['audio']})]);
    try{
      const prepared=await prepareStudioTimelineExport(actor,{...input,expectedRevision:1,idempotencyKey:randomUUID()},{...dependencies,estimate:async(params:any)=>{
        const clips=params.rawRequest.manifest.tracks.flatMap((track:any)=>track.clips);
        assert.ok(!clips.some((item:any)=>item.id==='hidden'),'hidden video is not rendered or priced');
        assert.equal(clips.find((item:any)=>item.id==='music')?.audioMix?.muted,true,'track mute wins over the clip mix');
        return estimate(params);
      }});
      assert.equal(prepared.durationSec,5);
    }finally{
      await pg.pool.query(`UPDATE studio_sequences SET timeline_state=timeline_state || $2::jsonb WHERE id=$1`,[project.sequenceId,JSON.stringify({timelineItems:[clip],hiddenVideoTracks:[],mutedAudioTracks:[]})]);
    }
  });
  await t.test('a native export quote and its action receipt recover after a lost final draft without another model call',async()=>{
    for(const name of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql'])await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
    const sessionActor={authMethod:'studio-session' as const,userId:actor.userId,clientId:null,projectId:project.projectId};
    let calls=0;
    const serviceOptions={enabled:true,actionsEnabled:true,editingEnabled:true,exportsEnabled:true,requestOrigin:'http://localhost:3000',exportDependencies:{estimate},createActionResponse:async()=>{
      calls++;
      return {id:'export-response-'+calls,model:'gpt-6.1-sol',status:'completed' as const,usage:null,service_tier:'default' as const,output_text:'',output:[{type:'function_call' as const,name:calls===1?'timeline_read':'export_prepare',call_id:'export-'+calls,arguments:JSON.stringify(calls===1?{}:{reply:'The five-second cut is ready. Confirm the export quote below.',sequenceId:project.sequenceId,expectedRevision:1,qualityPreset:'draft',includeAudio:true})}]};
    }};
    await pg.pool.query(`CREATE FUNCTION fail_export_draft() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.draft_json ? 'exportQuote' THEN RAISE EXCEPTION 'Lost final export draft'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_export_draft BEFORE UPDATE ON studio_image_turns FOR EACH ROW EXECUTE FUNCTION fail_export_draft();`);
    const message={requestId:randomUUID(),message:'Finish and export it, please.',references:[]};
    await assert.rejects(createImageConversationService(sessionActor,serviceOptions).submit(message),/Lost final export draft/);
    assert.equal(calls,2);
    const completed=(await pg.pool.query("SELECT result_json FROM studio_conversation_steps WHERE action_json->>'action'='export.prepare'")).rows[0].result_json;
    assert.equal(completed.data.durationSec,5);
    await pg.pool.query('DROP TRIGGER fail_export_draft ON studio_image_turns');
    const recovered=await createImageConversationService(sessionActor,serviceOptions).submit(message);
    assert.equal(calls,2,'complete Responses and prepared action replay rather than repurchasing text');
    assert.equal(recovered.state,'ready');
    assert.deepEqual(recovered.exportQuote,completed.data);
    const reloaded=await createImageConversationService(sessionActor,serviceOptions).read();
    assert.deepEqual(reloaded.turns[0].exportQuote,completed.data);
    assert.doesNotMatch(JSON.stringify(reloaded),/private-estimate-token|mediaUrl/);
    assert.equal(reloaded.turns[0].quote,null);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  });
  await t.test('concurrent human confirmations reserve one canonical paid job and recover its original price after later edits',async()=>{
    await ensureTimelineExportSchema();
    await pg.pool.query(`INSERT INTO app_timeline_exports(id,user_id,idempotency_key,project_name,status,billing_kind,billing_status,render_manifest,export_settings)
      VALUES('used-free-1',$1,'used-free-1','Previous','completed','free','free_completed',$2::jsonb,'{}'),('used-free-2',$1,'used-free-2','Previous','completed','free','free_completed',$2::jsonb,'{}')`,[actor.userId,JSON.stringify({sequenceId:project.sequenceId})]);
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',100,'USD')",[actor.userId]);
    let starts=0;
    // Only media URL validation and the external worker are doubled. Actual
    // parsing, pricing, HMAC, wallet lock/reservation, job and receipt SQL execute.
    const ownerDependencies={resolveOwnedTimelineExportRequest:async(params:any)=>params.request,resolveTimelineExportEstimateSecret:()=> 'disposable-export-secret-with-at-least-32-bytes',assertTimelineExportWorkerLauncherConfigured:()=>{},launchTimelineExportWorkerTask:async()=>{starts++;return {status:'skipped' as const,reason:'test_environment' as const};}};
    const connected={enabled:true,requestOrigin:'http://localhost:3000',estimate:(params:any)=>estimateOwnedTimelineExport(params,ownerDependencies),submit:(params:any)=>submitOwnedTimelineExport(params,ownerDependencies)};
    const paid=await prepareStudioTimelineExport(actor,{...input,expectedRevision:1,qualityPreset:'high',idempotencyKey:randomUUID()},connected);
    assert.equal(paid.price.amountCents,35,'five saved seconds at canonical high quality cost 35 cents');
    const confirmed={projectId:project.projectId,quoteId:paid.quoteId,confirmed:true};
    const [first,replay]=await Promise.all([confirmStudioTimelineExport(actor,confirmed,connected),confirmStudioTimelineExport(actor,confirmed,connected)]);
    assert.equal(first.export.id,replay.export.id);
    assert.equal(starts,1);
    assert.equal([first.reused,replay.reused].filter(Boolean).length,1);
    assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,1);
    assert.equal((await pg.pool.query("SELECT amount_cents FROM app_receipts WHERE type='charge'")).rows[0].amount_cents,35);
    await pg.pool.query('UPDATE studio_projects SET revision=2 WHERE id=$1',[project.projectId]);
    const recovered=await confirmStudioTimelineExport(actor,confirmed,{...connected,submit:async()=>{throw new Error('Accepted job must recover before stale snapshot validation');}});
    assert.equal(recovered.reused,true);
    assert.deepEqual(recovered.export.billing,{amountCents:35,currency:'USD',billingKind:'paid'});
    assert.equal((await readStudioTimelineExport(actor,{projectId:project.projectId,quoteId:paid.quoteId},connected))?.id,paid.exportId);
    assert.equal(starts,1);
  });
});
