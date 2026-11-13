import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {recastHarness} from './helpers/character-recast-harness';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createCharacterBuilderAuthoringService} from '../frontend/server/character-studio/authoring';
import {createCreatorGenerationService} from '../frontend/src/server/tools/creator-generation-service';
import {getFalEngineById} from '../frontend/src/config/falEngines';

test('native Milo authors one real Builder identity and saved look with atomic quote recovery and exact client approval',async t=>{
  const owner='00000000-0000-4000-8000-000000000091';
  const f=await recastHarness(t,{userId:owner});
  for(const name of ['26_studio_projects.sql','42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql','101_character_builder_quotes.sql'])
    await f.pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  await f.pg.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY)');
  await f.pg.pool.query('INSERT INTO profiles VALUES($1)',[owner]);
  for(const name of ['93_character_studio.sql','94_character_studio_presentation.sql'])await f.pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  await f.pg.pool.query('ALTER TABLE job_outputs ADD COLUMN storage_url text;ALTER TABLE job_outputs ADD COLUMN thumb_url text');
  await f.pg.pool.query(`INSERT INTO studio_projects(id,user_id,name,canvas_template_id,settings,workspace_state,persistence_mode)
    VALUES('film',$1,'Film','minimal-start','{}','{}','connected'),('other',$1,'Other','minimal-start','{}','{}','connected')`,[owner]);
  const actor={authMethod:'studio-session' as const,userId:owner,projectId:'film',clientId:null};
  const entry=getFalEngineById('nano-banana-2-1')!;
  const runtime={listPublicEngines:async()=>[{engine:entry.engine,surface:'image' as const,publicModes:['t2i','i2i'] as const,
    modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}],resolveRequestExecutability:()=>({executable:true,reason:'available' as const})};
  const generation:typeof createCreatorGenerationService=(current,options)=>createCreatorGenerationService(current,{
    ...options,prepareDependencies:{...options.prepareDependencies,...runtime},confirmDependencies:{...options.confirmDependencies,...runtime,submitPaidGeneration:f.provider.submit},
  });
  let modelCalls=0,dropAck=true,savedCharacterId:string|undefined;
  let mode:'prepare'|'save'|'select'='prepare',targetQuoteId='',saveName='Freckle',selectedLookId:string|null=null;
  let recipeOverride:Record<string,unknown>|undefined;
  const builderFactory:typeof createCharacterBuilderAuthoringService=(current,options)=>{
    const service=createCharacterBuilderAuthoringService(current,{...options,generation});
    return {...service,prepare:async(input)=>{const result=await service.prepare(input);if(dropAck){dropAck=false;throw new Error('Local lost quote acknowledgement');}return result;}};
  };
  const dependencies={requestOrigin:'http://localhost:3217',enabled:true,actionsEnabled:true,mediaEnabled:true,characterEnabled:true,characterBuilderEnabled:true,characterBuilderFactory:builderFactory,
    createActionResponse:async(params:any)=>{
      modelCalls++;
      const terminal=mode!=='prepare'&&Array.isArray(params.input)&&params.input.at(-1)?.type==='function_call_output';
      const args=mode==='save'?{quoteId:targetQuoteId,name:saveName}:mode==='select'?{characterId:savedCharacterId,lookId:selectedLookId}:
        {reply:'Review this exact Character Builder quote.',recipe:recipeOverride??(savedCharacterId?{characterId:savedCharacterId,traits:{customOutfitDescription:'A blue velvet jacket'}}:{traits:{customDetailsDescription:'One small cheek freckle'},qualityMode:'final',formatMode:'4k'})};
      return{id:'character-response-'+modelCalls,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default' as const,usage:null,
        output_text:terminal?JSON.stringify({reply:'The requested character library action is saved.'}):'',output:terminal?[]:[{type:'function_call' as const,
          name:mode==='save'?'character_save':mode==='select'?'character_select':'character_prepare',call_id:'character-'+modelCalls,arguments:JSON.stringify(args)}]};
    },
  };
  const service=createImageConversationService(actor,dependencies);
  const input={requestId:randomUUID(),message:'Create a reusable Character Studio identity with one cheek freckle.',references:[]};
  await assert.rejects(service.submit(input));
  assert.equal((await f.pg.pool.query('SELECT count(*)::int n FROM character_builder_quotes')).rows[0].n,1);
  const identity=await service.submit(input);
  assert.equal(identity.quote?.modelLabel,'Character Builder');assert.equal(identity.quote?.characterBuilder?.recipe.builder.traits.customDetailsDescription,'One small cheek freckle');
  assert.equal(modelCalls,1);assert.equal(f.provider.captures.length,0);
  assert.equal((await service.submit(input)).quote?.quoteId,identity.quote!.quoteId);
  const approval={requestId:input.requestId,quoteId:identity.quote!.quoteId,confirmed:true,amountCents:identity.quote!.price.amountCents,currency:'USD'};
  await assert.rejects(service.confirm({...approval,amountCents:approval.amountCents+1}));
  const {amountCents,currency,...missingPrice}=approval;await assert.rejects(service.confirm(missingPrice),{code:'PARAMETER_INVALID'});
  await assert.rejects(createImageConversationService({...actor,projectId:'other'},dependencies).confirm(approval));
  await assert.rejects(createImageConversationService({...actor,userId:'foreign'},dependencies).confirm(approval));
  const [first,second]=await Promise.all([service.confirm(approval),service.confirm(approval)]);
  assert.equal(first.jobId,second.jobId);assert.equal(f.provider.calls(identity.quote!.quoteId),1);
  assert.equal((await f.receipts(identity.quote!.quoteId)).filter(row=>row.type==='charge').length,1);
  const reopened=createImageConversationService(actor,{...dependencies,characterBuilderEnabled:false,characterEnabled:false});
  const turn=(await reopened.read()).turns[0];assert.equal(turn.quote?.characterBuilder?.confirmationEnabled,false);
  assert.equal(turn.generation?.status,'completed');await reopened.confirm(approval);assert.equal(f.provider.calls(approval.quoteId),1);
  const [job]=(await f.pg.pool.query('SELECT surface,settings_snapshot,render_ids FROM app_jobs WHERE job_id=$1',[approval.quoteId])).rows;
  assert.equal(job.surface,'character');assert.equal(job.settings_snapshot.surface,'character-builder');
  mode='save';targetQuoteId=approval.quoteId;
  const saveInput={requestId:randomUUID(),message:'Save that character as Freckle.',references:[]};
  const closedPurchase=createImageConversationService(actor,{...dependencies,characterBuilderEnabled:false});
  await closedPurchase.submit(saveInput);
  const beforeRepeat=modelCalls;await closedPurchase.submit(saveInput);assert.equal(modelCalls,beforeRepeat);
  assert.equal((await f.pg.pool.query('SELECT count(*)::int n FROM character_studio_characters')).rows[0].n,1);
  const saved=(await f.pg.pool.query("SELECT result_json->'data' data FROM studio_conversation_steps WHERE request_id=$1 AND action_json->>'action'='character.save'",[saveInput.requestId])).rows[0].data;
  assert.equal(saved.kind,'character');assert.equal(saved.name,'Freckle');savedCharacterId=saved.characterId;
  mode='prepare';
  await f.pg.pool.query('UPDATE media_assets SET source_job_id=$1,url=$2 WHERE public_id=$3',[approval.quoteId,job.render_ids[0].url,f.id(9)]);
  const lookInput={requestId:randomUUID(),message:'Give that saved character a blue velvet look.',references:[]};
  const beforeLook=modelCalls;const look=await service.submit(lookInput);assert.equal(modelCalls,beforeLook+1);
  assert.equal(look.quote?.characterBuilder?.recipe.builder.characterId,savedCharacterId);
  assert.equal(look.quote?.characterBuilder?.recipe.builder.traits.customDetailsDescription,'One small cheek freckle');
  assert.equal(look.quote?.characterBuilder?.recipe.builder.traits.customOutfitDescription,'A blue velvet jacket');
  await service.confirm({requestId:lookInput.requestId,quoteId:look.quote!.quoteId,confirmed:true,amountCents:look.quote!.price.amountCents,currency:'USD'});
  assert.equal(f.provider.calls(look.quote!.quoteId),1);
  assert.doesNotMatch(JSON.stringify(look.quote?.characterBuilder?.recipe),/https?:\/\//);
  mode='save';targetQuoteId=look.quote!.quoteId;saveName='Blue velvet';
  const saveLookInput={requestId:randomUUID(),message:'Save this look as Blue velvet.',references:[]};
  const providerCount=f.provider.captures.length,charges=(await f.pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n;
  await closedPurchase.submit(saveLookInput);await closedPurchase.submit(saveLookInput);
  const savedLook=(await f.pg.pool.query("SELECT result_json->'data' data FROM studio_conversation_steps WHERE request_id=$1 AND action_json->>'action'='character.save'",[saveLookInput.requestId])).rows[0].data;
  assert.equal(savedLook.kind,'look');assert.equal(savedLook.characterId,savedCharacterId);assert.equal(savedLook.lookName,'Blue velvet');
  assert.equal((await f.pg.pool.query('SELECT count(*)::int n FROM character_studio_looks')).rows[0].n,1);
  const [lookJob]=(await f.pg.pool.query('SELECT render_ids FROM app_jobs WHERE job_id=$1',[look.quote!.quoteId])).rows;
  // The supplier transport double omits the normal ready-media projection; provide only that owned projection.
  await f.pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,source_job_id)
    VALUES($1,$1,$2,'image',$3,'image/png',4096,720,1280,'ready',$4)`,[f.id(8),owner,lookJob.render_ids[0].url,look.quote!.quoteId]);
  mode='select';selectedLookId=savedLook.lookId;
  const selectInput={requestId:randomUUID(),message:'Select Freckle’s Blue velvet look.',references:[]};
  await closedPurchase.submit(selectInput);await closedPurchase.submit(selectInput);
  const selection=(await f.pg.pool.query("SELECT result_json->'data' data FROM studio_conversation_steps WHERE request_id=$1 AND action_json->>'action'='character.select'",[selectInput.requestId])).rows[0].data;
  assert.equal(selection.assetId,f.id(8));assert.equal(selection.lookId,selectedLookId);
  assert.equal(f.provider.captures.length,providerCount);
  assert.equal((await f.pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,charges);
  mode='prepare';recipeOverride={referenceImages:[{assetId:selection.assetId,role:'identity'}],traits:{customSceneDescription:'In a quiet library'}};
  const referenceInput={requestId:randomUUID(),message:'Prepare a Character Builder identity from this selected look in a quiet library.',references:[]};
  const selectedQuote=await service.submit(referenceInput);
  assert.equal(selectedQuote.quote?.summary.references[0].kind,'asset');
  assert.equal((selectedQuote.quote?.summary.references[0] as {assetId:string}).assetId,selection.assetId);
  assert.equal(f.provider.captures.length,providerCount,'Preparing from the selected look does not purchase it.');
  const other=createImageConversationService({...actor,projectId:'other'},dependencies);
  await assert.rejects(other.submit({...referenceInput,requestId:randomUUID()}));
  assert.equal((await f.pg.pool.query("SELECT count(*)::int n FROM mcp_generation_quotes WHERE studio_project_id='other'")).rows[0].n,0);

  await f.pg.pool.query('DELETE FROM character_studio_looks WHERE id=$1',[selectedLookId]);
  const beforeRemoved=(await f.pg.pool.query('SELECT count(*)::int n FROM character_builder_quotes')).rows[0].n;
  await assert.rejects(service.submit({...referenceInput,requestId:randomUUID()}));
  assert.equal((await f.pg.pool.query('SELECT count(*)::int n FROM character_builder_quotes')).rows[0].n,beforeRemoved);

});
