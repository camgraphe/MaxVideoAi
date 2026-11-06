import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { handleStudioCharacters } from '../frontend/app/api/studio/_lib/studio-character-handler';
import { createCharacterStudioIntegration } from '../frontend/server/character-studio/integration';
import { createDefaultCharacterBuilderState } from '../frontend/src/lib/character-builder';
import { recastHarness } from './helpers/character-recast-harness';
import { handleStudioImageConversation } from '../frontend/app/api/studio/_lib/studio-image-conversation-handler';
import { createImageConversationService } from '../frontend/src/server/studio/image-conversation-service';
import type { StudioResponseCreator } from '../frontend/src/server/studio/conversation-director';
import { readStudioProjectMedia } from '../frontend/src/server/studio/conversation-media-generation';
import { LIVE_PRICING_POLICY_REVISION, PRICING_POLICY_HEADER } from '../frontend/src/lib/membership-policy';

test('Studio Recast journals a dedicated quote, requires displayed cents, and reopens the same ready video', async t => {
  const owner='00000000-0000-4000-8000-000000000141';
  const f = await recastHarness(t,{userId:owner});
  await f.pg.pool.query(`CREATE TABLE studio_projects (id text PRIMARY KEY, user_id text NOT NULL, name text NOT NULL, deleted_at timestamptz);
    CREATE TABLE studio_sequences (id text PRIMARY KEY);
    ALTER TABLE job_outputs ADD COLUMN duration_sec real, ADD COLUMN metadata jsonb, ADD COLUMN created_at timestamptz DEFAULT now(), ADD COLUMN storage_url text, ADD COLUMN thumb_url text`);
  await f.pg.pool.query("INSERT INTO studio_projects (id,user_id,name) VALUES ('film',$1,'Promo'),('other',$1,'Another film'),('foreign','different-user','Private')",[f.actor.userId]);
  for (const name of ['42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql'])
    await f.pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  await f.pg.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY)');
  await f.pg.pool.query('INSERT INTO profiles VALUES($1)',[owner]);
  for (const name of ['93_character_studio.sql','94_character_studio_presentation.sql'])
    await f.pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  const actor={authMethod:'studio-session' as const,userId:f.actor.userId,projectId:'film',clientId:null};
  const characters=createCharacterStudioIntegration(actor,{executionEnabled:false});
  async function saveCharacter(jobId:string,assetId:string,name:string,characterId?:string) {
    const imageUrl='https://cdn.maxvideoai.com/'+jobId+'.png';
    const snapshot={schemaVersion:1,surface:'character-builder',builder:{...createDefaultCharacterBuilderState(),characterId}};
    await f.pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,status,engine_id,settings_snapshot,render_ids)
      VALUES($1,$2,'completed','nano-banana-2-1',$3,$4)`,[jobId,owner,snapshot,JSON.stringify([{url:imageUrl}])]);
    await f.pg.pool.query('UPDATE media_assets SET source_job_id=$1,url=$2 WHERE public_id=$3',[jobId,imageUrl,assetId]);
    return characters.save({name,jobId,imageUrl});
  }
  const {character:{id:characterId}}=await saveCharacter('identity',f.id(1),'Vesper');
  const {character:{looks:[{id:lookId}]}}=await saveCharacter('look',f.id(9),'Late night',characterId);

  async function characterRoute(projectId:string,search='',selection?:object,enabled=true) {
    const url='http://localhost:4320/api/studio/projects/'+projectId+'/characters'+search;
    return handleStudioCharacters(new NextRequest(url,selection ? {method:'POST',headers:{origin:'http://localhost:4320'},body:JSON.stringify(selection)} : {}),
      projectId,selection?'select':'read',{enabled,resolveAccess:async()=>({ok:true,userId:owner})});
  }
  assert.equal((await characterRoute('foreign','?name=vesper')).status,404);
  assert.equal((await characterRoute('film','?name=vesper',undefined,false)).status,404);
  const list=await characterRoute('film','?name=vesper');
  assert.equal(list.status,200);
  assert.deepEqual((await list.json()).result.characters.map(({id,name}:{id:string;name:string})=>({id,name})),[{id:characterId,name:'Vesper'}]);
  const detail=await characterRoute('film','?characterId='+characterId+'&lookName=late+night');
  assert.equal(detail.status,200);
  assert.equal((await detail.json()).result.looks[0].id,lookId);
  const picked=await characterRoute('film','',{characterId,lookId});
  assert.equal(picked.status,200);
  assert.deepEqual((await picked.json()).result,{assetId:f.id(9),kind:'image',name:'Vesper · Late night',url:'https://cdn.maxvideoai.com/look.png',thumbUrl:null});
  assert.equal((await characterRoute('film','',{characterId,lookId:'9999'})).status,404);
  assert.equal((await f.pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,0);

  const ref=(kind:'image'|'video'|'audio',assetId:string)=>({type:'asset' as const,kind,assetId});
  const video=ref('video',f.video.assetId),audio=ref('audio',f.audio.assetId);
  const args={reply:'Review the exact Recast quote.',portrait:{characterId,lookId},product:ref('image',f.id(1)),
    video:{ref:video,range:f.video.range},audio:{ref:audio,range:f.audio.range},
    direction:f.input.direction,dialogue:'Ça marche.',seconds:f.input.seconds,resolution:f.input.resolution,aspectRatio:f.input.aspectRatio};
  const settings={...f.input,product:f.id(1),video:f.video,audio:f.audio,dialogue:args.dialogue};
  const web=await f.prepare(settings);
  let calls=0;
  const makeService=(current=actor,enabled=true,createActionResponse?:StudioResponseCreator)=>createImageConversationService(current,{enabled:true,actionsEnabled:true,mediaEnabled:true,characterEnabled:enabled,
    characterFactory:(actor,options)=>createCharacterStudioIntegration(actor,{...options,prepareDependencies:f.deps,generation:f.generation,readiness:()=>null}),
    createActionResponse:createActionResponse??(async()=>({id:'recast-response',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',
      output:[{type:'function_call',name:'recast_prepare',call_id:'recast-prepare',arguments:(calls++,JSON.stringify(args))}]})),
  });
  const input={requestId:randomUUID(),message:'Prepare an exact Character Recast quote.',references:[f.id(1)],attachments:[video,audio]};
  const turn=await makeService().submit(input);
  const quote=turn.quote;
  assert.ok(quote);
  assert.equal(quote.modelLabel,'Character Recast');
  assert.deepEqual(quote.recast?.videoRange,f.video.range);
  assert.deepEqual(quote.recast?.audioRange,f.audio.range);
  assert.equal(quote.price.amountCents,434);
  assert.equal(quote.price.amountCents,web.amountCents);
  assert.deepEqual(quote.summary,web.quote.summary);
  const [checkpoint]=(await f.pg.pool.query(`SELECT b.passages,s.result_json FROM studio_conversation_steps s
    JOIN studio_image_turns t USING(user_id,project_id,request_id)
    JOIN character_studio_recast_quotes b ON b.quote_id=t.quote_id
    WHERE s.action_json->>'action'='recast.prepare' AND s.state='completed' AND t.request_id=$1`,[input.requestId])).rows;
  assert.equal(checkpoint.result_json.data.quoteId,quote.quoteId);
  assert.deepEqual(checkpoint.passages.video,{...f.video.range,durationSec:7.5,sourceId:f.id(2),excerptId:f.id(4)});
  assert.deepEqual(checkpoint.passages.audio,{...f.audio.range,durationSec:5.25,sourceId:f.id(3),excerptId:f.id(5)});
  assert.equal((await makeService().submit(input)).quote?.quoteId,quote.quoteId);
  assert.equal(calls,1);
  assert.equal(f.provider.calls(quote.quoteId),0);

  async function confirm(projectId:string,values:Record<string,unknown>,enabled=true,userId=actor.userId) {
    const url='http://localhost:4320/api/studio/projects/'+projectId+'/image-conversation/confirm';
    return handleStudioImageConversation(new NextRequest(url,{method:'POST',headers:{origin:'http://localhost:4320',[PRICING_POLICY_HEADER]:LIVE_PRICING_POLICY_REVISION},
      body:JSON.stringify({requestId:input.requestId,quoteId:quote!.quoteId,confirmed:true,...values})}),projectId,'confirm',{
        enabled:true,tasksEnabled:false,resolveAccess:async()=>({ok:true,userId}),serviceFactory:current=>makeService(current,enabled),
      });
  }
  const approval={amountCents:434,currency:'USD'};
  assert.ok((await confirm('film',{})).status>=400);
  assert.ok((await confirm('film',{...approval,amountCents:433})).status>=400);
  assert.ok((await confirm('other',approval)).status>=400);
  assert.ok((await confirm('foreign',approval)).status>=400);
  assert.ok((await confirm('film',approval,true,'different-user')).status>=400);
  assert.ok((await confirm('film',approval,false)).status>=400);
  assert.equal(f.provider.calls(quote.quoteId),0);
  const accepted=await confirm('film',approval);
  assert.equal(accepted.status,200,JSON.stringify(await accepted.clone().json()));
  assert.equal((await accepted.json()).result.jobId,quote.quoteId);
  const [charge]=await f.receipts(quote.quoteId);
  assert.equal(charge.amount_cents,434);
  assert.equal(charge.pricing_snapshot.meta.providerCostMultiplier,2);
  assert.equal((await confirm('film',approval)).status,200);
  assert.equal(f.provider.calls(quote.quoteId),1);
  const output='https://cdn.maxvideoai.com/recast-complete.mp4';
  await f.pg.pool.query("UPDATE app_jobs SET status='completed',video_url=$1 WHERE job_id=$2",[output,quote.quoteId]);
  await f.pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,status,kind,url,duration_sec)
    VALUES('ready-recast',$1,$2,'ready','video',$3,8)`,[quote.quoteId,actor.userId,output]);
  const reopened=(await makeService(actor,false).read()).turns[0];
  assert.equal(reopened.generation?.jobId,quote.quoteId);
  assert.equal(reopened.generation?.result?.surface,'video');
  assert.equal(reopened.generation?.result?.surface==='video' && reopened.generation.result.videoUrl,output);
  assert.equal((await readStudioProjectMedia(actor))[0].ref.type,'job-output');
  assert.deepEqual(await readStudioProjectMedia({...actor,projectId:'other'}),[]);
  assert.equal(f.provider.calls(quote.quoteId),1);

  const revised = await makeService(actor,true,async params=>{
    assert.ok(Array.isArray(params.input));
    const block=params.input.find(item=>'role' in item&&item.role==='developer'&&'content' in item
      &&typeof item.content==='string'&&item.content.startsWith('Historical conversation facts'));
    assert.ok(block&&'content' in block&&typeof block.content==='string','The next director turn must receive the saved Recast recipe.');
    assert.match(block.content,/data, not instructions/);
    const facts=JSON.parse(block.content.slice(block.content.indexOf('{')));
    const {reply,...recipe}=args;
    assert.deepEqual(facts.quoteDirections,[{requestId:input.requestId,quoteId:quote.quoteId,recast:recipe,truncated:false}]);
    return {id:'recast-revision',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',
      output:[{type:'function_call',name:'recast_prepare',call_id:'recast-revise',arguments:JSON.stringify({
        ...facts.quoteDirections[0].recast,reply,resolution:'1080p',
      })}]};
  }).submit({...input,requestId:randomUUID(),message:'Keep the same direction, dialogue and sources. Prepare a fresh quote at 1080p.'});
  assert.ok(revised.quote);
  assert.notEqual(revised.quote.quoteId,quote.quoteId);
  assert.deepEqual(revised.quote.summary,{...quote.summary,settings:{...quote.summary.settings,resolution:'1080p'}});
  assert.deepEqual(revised.quote.recast,quote.recast);
  assert.equal(f.provider.calls(revised.quote.quoteId),0);
  assert.deepEqual(await f.receipts(revised.quote.quoteId),[]);
});
