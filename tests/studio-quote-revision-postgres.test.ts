import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {normalizeGenerationRequest,hashCanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {createStudioAudioGenerationService} from '../frontend/src/server/studio/audio-generation-service';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {normalizeAudioGenerationRequest, hashCanonicalAudioRequest} from '../frontend/src/server/agent-api/audio-normalization';
import {prepareAudioRun} from '../frontend/src/server/audio/prepare-audio';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {workflowCatalog} from './helpers/studio-video-workflow-fixtures';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {recallStudioReferences} from '../frontend/src/server/studio/conversation-reference-recall';
import type {ImageTurnInput} from '../frontend/src/lib/studio/image-conversation-contract';

test('switching the model on a prepared edit reuses only the signed source, including after an old refusal',async t=>{
  const fixture=await studioTaskFixture(t);
  const {pool}=fixture, actor=await fixture.actor();
  for(const file of ['53_studio_media_generation_scope.sql','27_pricing_admin_cockpit.sql','54_customer_tariff_cells.sql','55_customer_tariff_versions.sql'])
    await pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  await pool.query(`UPDATE app_customer_tariff_state SET active=true,revision=1;
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text)`);
  const v1='ma_'+'1'.repeat(32),v2='ma_'+'2'.repeat(32);
  const source=(assetId:string)=>({type:'asset' as const,assetId,kind:'video' as const});
  const message=(message:string):ImageTurnInput=>({message,requestId:randomUUID(),locale:'fr',references:[]});
  for(const id of [v1,v2]) await pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
    VALUES($1,$1,$2,'video',$3,'video/mp4',10000,1080,1920,'ready','{"durationSec":8}')`,[id,actor.userId,'https://cdn.maxvideoai.com/'+id+'.mp4']);
  const quoteId=randomUUID(), prompt='Change the red coat to blue and preserve the face.';
  const request={schemaVersion:1,surface:'video',mode:'v2v',engineId:'seedance-2-5',references:[{kind:'asset',assetId:v1,role:'source'}],prompt,outputCount:1,settings:{resolution:'480p',durationSec:8,audio:true,outputFormat:'mp4'}};
  await pool.query(`INSERT INTO mcp_generation_quotes(quote_id,user_id,request_json,request_hash,catalog_revision,pricing_snapshot,price_cents,currency,funding_mode,state,expires_at,auth_origin,studio_project_id)
    VALUES($1,$2,$3,$5,'catalog','{"totalCents":189}',189,'USD','wallet','prepared',now()+interval '45 minutes','studio-session',$4)`,[quoteId,actor.userId,request,actor.projectId,hashCanonicalGenerationRequest(normalizeGenerationRequest(request))]);
  const store=async(input:ImageTurnInput,draft:object,quote:string|null=null,projectId=actor.projectId)=>{
    await pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,lease_id,lease_expires_at,state,quote_id)
    VALUES($1,$2,$3,repeat('a',64),$4,$5,repeat('b',64),$6,now(),'ready',$7)`,
      [actor.userId,projectId,input.requestId,input,draft,randomUUID(),quote]);
  };
  const original={...message('Change la veste de la première vidéo.'),attachments:[source(v1),source(v2)],referenceMentions:[
    {label:'Video 1',assetId:v1},{label:'Video 2',assetId:v2}]};
  const media={action:'video.prepare',source:null,mode:'v2v',modelId:request.engineId,prompt,aspectRatio:null,references:[{ref:source(v1),role:'source'}],
    settings:[{name:'resolution',value:'480p'},{name:'outputFormat',value:'mp4'}],reply:'Voici le devis.'};
  await store(original,{reply:media.reply,image:null,media},quoteId);
  const choice='Je préférerais faire ça avec wan 3';
  await store(message(choice),{image:null,reply:'Rattachez la vidéo précédente.'});
  const catalog=await workflowCatalog();
  const open=()=>createImageConversationService(actor,{enabled:true,actionsEnabled:true,mediaEnabled:true,
    createActionResponse:async()=>{throw Error('A model switch must not purchase assistance.');},
    videoGenerationFactory:(a,options)=>createStudioVideoGenerationService(a,{...options,prepareDependencies:{
      listPublicEngines:async()=>catalog,resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    }})});
  const next=message(choice);
  const result=await open().submit(next);
  assert.ok(result.quote,result.reply??'missing quote');
  assert.equal(result.quote.summary.engineId,'wan-3');
  assert.equal(result.quote.summary.mode,'v2v');
  assert.deepEqual(result.quote.summary.references,request.references);
  assert.equal(result.quote.summary.prompt,prompt);
  assert.equal(result.quote.sourceReferenceSummary,'Vidéo 1');
  assert.equal((await open().submit(next)).quote?.quoteId,result.quote.quoteId);
  const replacement=await open().submit(message('Plutôt Vidéo 2.'));
  assert.equal(replacement.quote?.sourceReferenceSummary,'Vidéo 2',replacement.reply??'');
  assert.deepEqual(replacement.quote?.summary.references,[{kind:'asset',assetId:v2,role:'source'}]);
  const reopened=(await open().read()).turns;
  assert.equal(reopened.find(turn=>turn.requestId===next.requestId)?.quote?.quoteId,result.quote.quoteId);
  const incompatible=await open().submit(message('Seedream 5.0 Flash'));
  assert.equal(incompatible.quote,null);
  assert.match(incompatible.reply!,/Vidéo 2/);
  assert.doesNotMatch(incompatible.reply!,/rattache|rejoindre/);
  await pool.query("UPDATE media_assets SET deleted_at=now() WHERE public_id=$1",[v2]);
  const unavailable=await open().submit(message('Utilise Vidéo 2.'));
  assert.equal(unavailable.quote,null);
  assert.match(unavailable.reply!,/ne peux pas lire/);
  const another=await fixture.actor(),isolated=message(choice);
  await pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,lease_id,lease_expires_at,state)
    VALUES($1,$2,$3,repeat('c',64),$4,$5,now(),'thinking')`,[another.userId,another.projectId,isolated.requestId,isolated,randomUUID()]);
  assert.equal((await recallStudioReferences(another,isolated,null)).sources,undefined);
  const counts=(await pool.query(`SELECT sum(jsonb_array_length(coalesce(input_json->'attachments','[]')))::int attachments,
    (SELECT count(*)::int FROM app_jobs) jobs,(SELECT count(*)::int FROM app_receipts WHERE type='charge') charges
    FROM studio_image_turns WHERE project_id=$1`,[actor.projectId])).rows[0];
  assert.deepEqual(counts,{attachments:2,jobs:0,charges:0});

  await t.test('image model change prepares an i2i quote on the same photo',async t=>{
  const environment=process.env.NODE_ENV;
  Object.assign(process.env,{NODE_ENV:'development'});
  t.after(()=>{if(environment===undefined) Reflect.deleteProperty(process.env,'NODE_ENV'); else Object.assign(process.env,{NODE_ENV:environment});});
  const sandbox=process.env.PRICING_SANDBOX;
  process.env.PRICING_SANDBOX='1';
  t.after(()=>{if(sandbox===undefined) delete process.env.PRICING_SANDBOX; else process.env.PRICING_SANDBOX=sandbox;});

    const projectId=randomUUID(), owner={...actor,projectId},assetId='ma_'+'4'.repeat(32);
    await pool.query("INSERT INTO studio_projects(id,user_id,name,persistence_mode) VALUES($1,$2,'Photo','connected')",[projectId,actor.userId]);
    await pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
      VALUES($1,$1,$2,'image',$3,'image/png',2048,1024,1024,'ready','{}')`,[assetId,actor.userId,'https://cdn.maxvideoai.com/photo.png']);
    const request=normalizeGenerationRequest({schemaVersion:1,surface:'image',engineId:'gpt-image-2',mode:'i2i',prompt:'Give the boat a green background.',
      settings:{aspectRatio:'1:1'},references:[{kind:'asset',assetId,role:'reference'}],outputCount:1});
    const quoteId=randomUUID();
    await pool.query(`INSERT INTO mcp_generation_quotes(quote_id,user_id,request_json,request_hash,catalog_revision,pricing_snapshot,price_cents,currency,funding_mode,state,expires_at,auth_origin,studio_project_id)
      VALUES($1,$2,$3,$4,'catalog','{"totalCents":7}',7,'USD','wallet','prepared',now()+interval '45 minutes','studio-session',$5)`,[quoteId,actor.userId,request,hashCanonicalGenerationRequest(request),projectId]);
    await store({...message('Retouche cette photo.'),references:[assetId]}, {reply:'Voici le devis.',image:{prompt:request.prompt,mode:'i2i',modelId:request.engineId,aspectRatio:'1:1'}},quoteId,projectId);
    const entry=getFalEngineById('seedream-5-0-flash')!;
    const openImage=()=>createImageConversationService(owner,{enabled:true,actionsEnabled:true,mediaEnabled:true,createActionResponse:async()=>{throw Error('Unexpected provider call');},
      generationFactory:(a,options)=>createStudioImageGenerationService(a,{...options,prepareDependencies:{
        listPublicEngines:async()=>[{engine:entry.engine,surface:'image',publicModes:['t2i','i2i'],modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui]))}],
        resolveRequestExecutability:()=>({executable:true,reason:'available'}),
      }})});
    const turn=await openImage().submit(message('Seedream 5.0 Flash'));
    assert.ok(turn.quote,turn.reply??'missing image quote');
    assert.equal(turn.quote.summary.mode,'i2i');
    assert.equal(turn.quote.summary.engineId,entry.engine.id);
    assert.deepEqual(turn.quote.summary.references,[{kind:'asset',assetId,role:'reference',slot:0}]);
    assert.equal(turn.quote.sourceReferenceSummary,'Image 1');
    const read=(await openImage().read()).turns.find(item=>item.requestId===turn.requestId);
    assert.equal(read?.quote?.quoteId,turn.quote.quoteId);
  });

  const audio={type:'asset' as const,kind:'audio' as const,assetId:'ma_'+'3'.repeat(32)};
  await pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,status,metadata)
    VALUES($1,$1,$2,'audio',$3,'audio/mpeg',10000,'ready','{"durationSec":8}')`,[audio.assetId,actor.userId,'https://cdn.maxvideoai.com/voice.mp3']);
  for(const mode of ['voice_only','cinematic_voice'] as const) await t.test(mode,async()=>{
    const projectId=randomUUID(), owner={...actor,projectId};
    await pool.query("INSERT INTO studio_projects(id,user_id,name,persistence_mode) VALUES($1,$2,'Sound','connected')",[projectId,actor.userId]);
    const engineId=mode==='voice_only'?'audio-voice-only':'audio-cinematic-voice';
    const references=[...(mode==='cinematic_voice'?[{role:'source_video' as const,asset:source(v1)}]:[]),{role:'voice_sample' as const,asset:audio}];
    const settings={script:'Read this sentence.',voiceModel:'seed',...(mode==='cinematic_voice'?{mood:'dreamy',musicEnabled:false}:{})};
    const request=normalizeAudioGenerationRequest({schemaVersion:1,surface:'audio',engineId,mode,settings,prompt:'A warm original sound.',references,outputCount:1});
    const quoteId=randomUUID();
    await pool.query(`INSERT INTO mcp_generation_quotes(quote_id,user_id,request_json,request_hash,catalog_revision,pricing_snapshot,price_cents,currency,funding_mode,state,expires_at,auth_origin,studio_project_id)
      VALUES($1,$2,$3,$4,'catalog','{"totalCents":10,"currency":"USD"}',10,'USD','wallet','prepared',now()+interval '45 minutes','studio-session',$5)`,
      [quoteId,actor.userId,request,hashCanonicalAudioRequest(request),projectId]);
    const attachments=references.map(r=>r.asset);
    await store({...message('Utilise ma prise.'),attachments,referenceMentions:attachments.map(asset=>({assetId:asset.assetId,label:asset.kind==='video'?'Video 1':'Audio 1'}))},
      {reply:'Voici le devis.',image:null,media:{action:'audio.prepare',reply:'Voici le devis.',prompt:request.prompt,mode,modelId:engineId,
        settings:Object.entries(settings).map(([name,value])=>({name,value})),references}},quoteId,projectId);
    const env={FAL_KEY:'offline-fixture'};
    const openAudio=()=>createImageConversationService(owner,{enabled:true,actionsEnabled:true,mediaEnabled:true,createActionResponse:async()=>{throw Error('Unexpected provider call');},
      audioGenerationFactory:(a,options)=>createStudioAudioGenerationService(a,{...options,prepareDependencies:{
        listCapabilities:()=>listAudioCapabilities(env),prepareRun:(body,owner)=>prepareAudioRun(body,owner,{env,inspectSourceVideo:async()=>({durationSec:8,width:1080,height:1920,hasAudio:true})}),
      }})});
    const input=message('Seed Audio 1.0');
    const turn=await openAudio().submit(input);
    assert.ok(turn.quote,turn.reply??'missing audio quote');
    assert.deepEqual(turn.quote.summary.references,request.references);
    assert.equal(turn.quote.summary.engineId,request.engineId);
    assert.equal(turn.quote.sourceReferenceSummary,mode==='voice_only'?'Audio 1':'Vidéo 1 et Audio 1');
    assert.equal((await openAudio().submit(input)).quote?.quoteId,turn.quote.quoteId);
    const reopened=(await openAudio().read()).turns.find(saved=>saved.requestId===input.requestId);
    assert.equal(reopened?.quote?.sourceReferenceSummary,turn.quote.sourceReferenceSummary);
    assert.equal((await pool.query("SELECT count(*)::int n FROM app_jobs")).rows[0].n,0);
  });
});
