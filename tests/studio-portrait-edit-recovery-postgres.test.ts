import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {workflowCatalog} from './helpers/studio-video-workflow-fixtures';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {readStudioPreparationRefusals} from '../frontend/src/server/studio/tasks/preparation-refusals';
import type {ImageTurnInput} from '../frontend/src/lib/studio/image-conversation-contract';

test('a short creative confirmation uses the original portrait clip after clarification and authenticated legacy refusals',async t=>{
  const f=await studioTaskFixture(t);
  for(const file of ['53_studio_media_generation_scope.sql','27_pricing_admin_cockpit.sql','54_customer_tariff_cells.sql','55_customer_tariff_versions.sql'])
    await f.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  await f.pool.query(`UPDATE app_customer_tariff_state SET active=true,revision=1;
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,status text,kind text,url text);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,size_bytes bigint,width int,height int,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text)`);
  const catalog=await workflowCatalog();
  const prompt='Ajouter un casque de pilote ouvert, garder le visage reconnaissable.';
  for(const scenario of ['fresh','legacy','revoked','unrelated failure'] as const){
    const actor=await f.actor(),assetId='ma_'+randomUUID().replaceAll('-','');
    const source={type:'asset' as const,assetId,kind:'video' as const};
    await f.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,size_bytes,width,height,status,metadata)
      VALUES($1,$1,$2,'video',$3,'video/quicktime',65536,1080,1920,'ready','{"durationSec":4.132}')`,[assetId,actor.userId,'https://cdn.maxvideoai.com/'+assetId+'.mov']);
    const message=(message:string):ImageTurnInput=>({message,requestId:randomUUID(),locale:'fr',references:[]});
    const store=async(input:ImageTurnInput, reply?:string)=>{
      const lease=randomUUID();
      await f.pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,lease_id,lease_expires_at,state)
        VALUES($1,$2,$3,repeat('a',64),$4,$5,CASE WHEN $7='ready' THEN repeat('b',64) END,$6,now(),$7)`,[actor.userId,actor.projectId,input.requestId,input,reply?{reply,image:null}:null,lease,reply?'ready':'failed']);
      return lease;
    };
    await store({...message('Suggest two ways to edit this video.'),attachments:[source],referenceMentions:[{assetId,label:'Video 1'}]},'Deux idées pour ta vidéo. Laquelle préfères-tu ?');
    await store(message('Je voudrais un casque ouvert et garder mon visage.'),'Un casque de pilote façon Star Wars, avec ton visage visible ?');
    const failed=(await f.pool.query('SELECT count(*) FROM app_jobs')).rows[0].count;
    if(scenario==='legacy'||scenario==='unrelated failure'){
      for(const text of ['Oui','Ok go']){
        const old=message(text),lease=await store(old);
        const scope=[actor.userId,actor.projectId,old.requestId,lease];
        await f.pool.query(`INSERT INTO studio_conversation_steps(user_id,project_id,request_id,lease_id,call_id,action_hash,action_json,observed_revision,state,result_json)
          VALUES($1,$2,$3,$4,'attempt',repeat('b',64),'{"action":"creator.prepare"}',0,'completed','{"ok":false,"action":"creator.prepare","error":{"code":"REFERENCE_INVALID","retryable":false}}')`,scope);
        await f.pool.query(`INSERT INTO studio_conversation_responses(user_id,project_id,request_id,lease_id,response_index,state,response_id,response_json)
          VALUES($1,$2,$3,$4,0,'reported',$5,$6)`,[...scope,'resp-'+old.requestId,{output:[{type:'function_call',call_id:scenario==='legacy'?'attempt':'unrelated'}]}]);
        const receipts=await readStudioPreparationRefusals(actor,[old.requestId]);
        assert.equal(receipts.get(old.requestId),scenario==='legacy'?'REFERENCE_INVALID':undefined);
        assert.equal((await readStudioPreparationRefusals(await f.actor(),[old.requestId])).size,0);
        if(text==='Oui') await store(message('Comme on disait.'),'Je laisse le visage visible sous le casque. Je prépare la retouche ?');
      }
    }
    if(scenario==='revoked') await f.pool.query('UPDATE media_assets SET deleted_at=now() WHERE id=$1',[assetId]);
    let calls=0;
    const open=()=>createImageConversationService(actor,{
      enabled:true,actionsEnabled:true,mediaEnabled:true,creatorEnabled:true,
      createActionResponse:async(params)=>{
        calls++;
        if(scenario==='unrelated failure') {
          assert.ok(!JSON.stringify(params.input).includes('Attached video: '+assetId));
          return {id:'clarify',model:'gpt-6-luna',status:'completed',service_tier:'default',usage:null,output_text:JSON.stringify({reply:'Quelle source veux-tu utiliser ?'}),output:[]};
        }
        assert.ok(calls===1,'a regular edit must not repeat the rejected recipe');
        return {id:'edit-'+randomUUID(),model:'gpt-6-luna',status:'completed',service_tier:'default',usage:null,output_text:'',
          output:[{type:'function_call',name:'creator_prepare',call_id:'edit',arguments:JSON.stringify({toolId:'product-video-editor',profileId:'product-video-wan-v1',
            inputs:[{role:'source',source,segment:null}],settings:[{name:'instruction',value:prompt},{name:'resolution',value:'720p'}],reply:'Voici la retouche.',keyterms:[]})}]};
      },
      videoGenerationFactory:(a,o)=>createStudioVideoGenerationService(a,{...o,prepareDependencies:{listPublicEngines:async()=>catalog,resolveRequestExecutability:()=>({executable:true,reason:'available'})}}),
    });
    const input=message(scenario==='fresh'?'Oui':'Ok go');
    const turn=await open().submit(input);
    if(scenario==='revoked'){assert.equal(calls,0);assert.equal(turn.quote,null);assert.match(turn.reply!,/ne peux pas lire/);}
    else if(scenario==='unrelated failure'){assert.equal(turn.quote,null);}
    else{
      assert.ok(turn.quote,scenario+': '+turn.reply);
      assert.equal(turn.quote.summary.engineId,'wan-3');assert.equal(turn.quote.summary.prompt,prompt);
      assert.equal(turn.quote.summary.settings.aspectRatio,'9:16');assert.equal(turn.quote.summary.settings.durationSec,4);
      assert.deepEqual(turn.quote.summary.references,[{kind:'asset',assetId,role:'source'}]);assert.equal(turn.quote.sourceReferenceSummary,'Vidéo 1');
      assert.equal((await open().submit(input)).quote?.quoteId,turn.quote.quoteId);
      assert.equal((await open().read()).turns.find(x=>x.requestId===input.requestId)?.quote?.quoteId,turn.quote.quoteId);
    }
    const stored=await f.pool.query('SELECT input_json FROM studio_image_turns WHERE user_id=$1',[actor.userId]);
    assert.equal(stored.rows.flatMap(row=>row.input_json.attachments??[]).length,1);
    assert.equal((await f.pool.query('SELECT count(*) FROM app_jobs')).rows[0].count,failed);
  }
});
