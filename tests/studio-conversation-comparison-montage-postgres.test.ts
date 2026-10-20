import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {createStudioConversationProject} from '../frontend/src/server/studio/conversation-project-command';
import {readStudioWorkspace} from '../frontend/src/server/studio/workspace-command';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import type {StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';

const comparison={surface:'video',mode:'t2v',prompt:'One minute of educational visuals with narration',settings:[{name:'durationSec',value:60},{name:'audio',value:true}],references:[],baselineModelId:null,baselineSettings:null,candidateModelIds:null,outputCount:1};
const toolResponse=(index:number,name:string,args:unknown):StudioDirectorResponse=>({id:'reply-'+randomUUID(),model:'gpt-6.1-sol',status:'completed',usage:null,service_tier:'default',output_text:'',output:[{type:'function_call',name,call_id:'action-'+index,arguments:JSON.stringify(args)}]});

test('after an impossible single-clip comparison Studio assembles a real sixty-second montage and voice track; lost stop replies recover without spending',async t=>{
  const pg=await startDisposablePostgres('studio-comparison-montage'),before=process.env.DATABASE_URL;
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(before===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=before;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,mime_type text,status text,metadata jsonb);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,status text,original_name text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
  for(const migration of ['26_studio_projects.sql','42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql'])await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
  const actor={authMethod:'studio-session' as const,userId:randomUUID(),clientId:null,projectId:''};
  const entry=getFalEngineById('ltx-2-5-pro')!;
  let priced=0;
  const videoGenerationFactory:typeof createStudioVideoGenerationService=(owner,options)=>createStudioVideoGenerationService(owner,{...options,prepareDependencies:{
    listPublicEngines:async()=>[{engine:entry.engine,surface:'video',publicModes:['t2v'],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}],
    resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    priceGeneration:async()=>{priced++;throw Error('An unsupported 60-second clip must fail before pricing.');},
  }});
  const project=await createStudioConversationProject(actor,{name:'Film',idempotencyKey:randomUUID()},{featureEnabled:true});
  actor.projectId=project.projectId;
  const attachments=[];
  for(let i=0;i<7;i++){
    const kind=i===6?'audio' as const:'video' as const,assetId='ma_'+(i+1).toString(16).padStart(32,'0');
    attachments.push({type:'asset' as const,assetId,kind});
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,original_name,metadata)
      VALUES($1,$2,$3,$4,$5,$6,'ready',$7,$8::jsonb)`,['asset-'+i,assetId,actor.userId,kind,'https://cdn.maxvideoai.com/owned-'+i+(kind==='audio'?'.mp3':'.mp4'),kind==='audio'?'audio/mpeg':'video/mp4',kind==='audio'?'Narration':'Scene '+(i+1),JSON.stringify({mediaFacts:{source:'probe',durationSec:kind==='audio'?60:10,hasAudio:kind==='audio',width:kind==='audio'?undefined:1920,height:kind==='audio'?undefined:1080}})]);
  }
  let calls=0;
  const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,mediaEnabled:true,editingEnabled:true,videoGenerationFactory,createActionResponse:async params=>{
    const index=++calls;
    if(index===1)return toolResponse(index,'pricing_compare',comparison);
    const outputs=(params.input as any[]).filter(item=>item.type==='function_call_output').map(item=>JSON.parse(item.output));
    assert.equal(outputs[0].error.nextAction.durationMismatch,true);
    assert.ok(params.tools?.some(tool=>tool.type==='function'&&tool.name==='timeline_edit'));
    if(index===2)return toolResponse(index,'timeline_read',{});
    if(index===3){
      const facts=outputs.find(result=>result.action==='timeline.read').data;
      return toolResponse(index,'timeline_edit',{sequenceId:facts.sequenceId,expectedRevision:facts.revision,edit:{kind:'assemble',clips:attachments.map((ref,i)=>({ref,startFrame:i===6?0:i*10*facts.fps,durationFrames:(i===6?60:10)*facts.fps,sourceInFrame:0}))}});
    }
    assert.equal(outputs.at(-1).data.totalFrames,1800);
    return {...toolResponse(index,'unused',{}),output:[],output_text:JSON.stringify({reply:'I assembled the six ready clips into the full minute and layered the ready narration. The export is still to prepare.'})};
  }});
  const input={requestId:randomUUID(),message:'Create the one-minute film with voiceover; assemble the supplied ready clips and narration when a single generated clip cannot meet that duration.',references:[],attachments};
  const result=await service.submit(input),saved=await readStudioWorkspace(actor,project.projectId);
  assert.equal(result.state,'ready');assert.equal(result.quote,null);assert.equal(calls,4);assert.equal(saved.project.revision,1);
  const clips=(saved.sequences[0].timelineState as any).timelineItems;
  assert.equal(clips.length,7);assert.equal(clips.filter((clip:any)=>clip.mediaKind==='video').length,6);
  assert.deepEqual(clips.filter((clip:any)=>clip.mediaKind==='video').map((clip:any)=>clip.startSec).sort((a:number,b:number)=>a-b),[0,10,20,30,40,50]);
  assert.equal(clips.find((clip:any)=>clip.mediaKind==='audio').durationSec,60);
  assert.deepEqual(await service.submit(input),result);assert.equal(calls,4);

  const second=await createStudioConversationProject(actor,{name:'Another film',idempotencyKey:randomUUID()},{featureEnabled:true});actor.projectId=second.projectId;
  let duplicateCalls=0;
  const duplicateService=createImageConversationService(actor,{enabled:true,actionsEnabled:true,mediaEnabled:true,editingEnabled:true,videoGenerationFactory,createActionResponse:async()=>toolResponse(++duplicateCalls,'pricing_compare',comparison)});
  await pg.pool.query(`CREATE FUNCTION fail_comparison_stop() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.draft_json->>'reply' LIKE '%This comparison already failed%' THEN RAISE EXCEPTION 'Controlled lost duplicate-stop reply'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_stop BEFORE UPDATE OF draft_json ON studio_image_turns FOR EACH ROW EXECUTE FUNCTION fail_comparison_stop();`);
  const secondInput={requestId:randomUUID(),message:'Create another full minute',references:[]};
  await assert.rejects(duplicateService.submit(secondInput),/Controlled lost duplicate-stop reply/);
  await pg.pool.query('DROP TRIGGER fail_stop ON studio_image_turns; DROP FUNCTION fail_comparison_stop();');
  const recovered=await duplicateService.submit(secondInput);
  assert.equal(recovered.state,'ready');assert.equal(duplicateCalls,2,'Both paid responses replay; the skipped duplicate never executes.');
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_conversation_steps WHERE request_id=$1',[secondInput.requestId])).rows[0].n,1);
  assert.equal((await pg.pool.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[secondInput.requestId])).rows[0].draft_json.continuation,undefined);
  assert.equal(priced,0);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,0);
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
});
