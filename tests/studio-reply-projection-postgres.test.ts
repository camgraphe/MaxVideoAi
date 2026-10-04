import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {STUDIO_ASSISTANCE_TARIFF} from '../frontend/src/lib/studio/assistance-contract';
import {chooseStudioAssistance,readStudioAssistanceStatus} from '../frontend/src/server/studio/assistance-ledger';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {claimImageTurn,persistImageDraft} from '../frontend/src/server/studio/image-conversation-repository';
import type {StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';
import type {ImageDraft} from '../frontend/src/lib/studio/image-conversation-contract';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

const fallback='The explanation is unavailable. Review any available quote before deciding, or send a follow-up to continue.';
const contaminated='Direction.</final> assistant (analysis) We should just final. <|/final|>';
type DraftRow={draft_json:ImageDraft};

test('paid checkpoints replay the raw reply once while drafts, old reads and both history adapters expose safe text',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined,'This test requires an unset DATABASE_URL and creates only disposable PostgreSQL.');
  const pg=await startDisposablePostgres('studio-reply');
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query("CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);CREATE TABLE studio_sequences(id text PRIMARY KEY);INSERT INTO studio_projects(id,user_id,name) VALUES('film','owner','Test'),('drafts','draft-owner','Drafts')");
  for(const file of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','42_studio_connected_montages.sql','52_studio_conversation_runs.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  const actor={userId:'owner',projectId:'film',authMethod:'studio-session' as const,clientId:null};
  const policy={enabled:true,solAllowanceNanoUsd:1_000_000_000,lunaAllowanceNanoUsd:250_000_000,campaignNanoUsd:100_000_000_000,maxAdditionalBudgetCents:2000};
  await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ('owner','topup',1000,'USD')");
  await chooseStudioAssistance('owner',{action:'authorize_paid',budgetCents:100,tariffVersion:STUDIO_ASSISTANCE_TARIFF.version,expectedRevision:0},policy);
  const raw:StudioDirectorResponse={id:'paid-protocol-reply',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50,output_tokens_details:{reasoning_tokens:0},total_tokens:150},output_text:JSON.stringify({reply:contaminated}),output:[]};
  let dispatches=0,counts=0;
  const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:policy,
    countInputTokens:async()=>{counts++;return 1000;},createActionResponse:async()=>{dispatches++;return raw;}});
  const input={requestId:randomUUID(),message:'Explain my final shot.',references:[]};
  await pg.pool.query("CREATE FUNCTION reject_reply_draft() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.draft_json IS NOT NULL THEN RAISE EXCEPTION 'draft acknowledgement unavailable'; END IF; RETURN NEW; END; $$;CREATE TRIGGER reject_reply_draft BEFORE UPDATE ON studio_image_turns FOR EACH ROW EXECUTE FUNCTION reject_reply_draft()");
  await assert.rejects(service.submit(input),/draft acknowledgement unavailable/);
  assert.equal(dispatches,1);assert.equal(counts,1);
  assert.equal((await readStudioAssistanceStatus('owner',policy)).paid.spentCents,1);
  await pg.pool.query('DROP TRIGGER reject_reply_draft ON studio_image_turns');
  const ready=await service.submit(input);
  assert.equal(ready.reply,fallback);assert.equal(ready.state,'ready');
  const settled=await readStudioAssistanceStatus('owner',policy);
  assert.equal((await service.submit(input)).reply,fallback);
  assert.equal(dispatches,1);assert.equal(counts,1);
  assert.deepEqual(await readStudioAssistanceStatus('owner',policy),settled);
  assert.equal(settled.paid.spentCents,1);
  const checkpoint=(await pg.pool.query<{response_json:StudioDirectorResponse}>('SELECT response_json FROM studio_conversation_responses WHERE request_id=$1',[input.requestId])).rows;
  assert.equal(checkpoint.length,1);assert.equal(checkpoint[0].response_json.output_text,raw.output_text);
  const stored=(await pg.pool.query<DraftRow>('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0];
  assert.equal(stored.draft_json.reply,fallback);

  // Simulate an old release's draft without rewriting it during read or ready replay.
  const oldInput={requestId:randomUUID(),message:'An old explanatory turn.',references:[]};
  await claimImageTurn(actor,oldInput);
  await pg.pool.query("UPDATE studio_image_turns SET draft_json=$2::jsonb,draft_reference_fingerprint=$3,state='ready' WHERE request_id=$1",[oldInput.requestId,JSON.stringify({reply:contaminated,image:null}),'0'.repeat(64)]);
  assert.equal((await service.read()).turns.find(turn=>turn.requestId===oldInput.requestId)?.reply,fallback);
  assert.equal((await service.submit(oldInput)).reply,fallback);
  assert.equal((await pg.pool.query<DraftRow>('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[oldInput.requestId])).rows[0].draft_json.reply,contaminated);
  assert.equal(dispatches,1);
  const followup=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:policy,countInputTokens:async()=>1000,
    createActionResponse:async params=>{
      assert.ok(Array.isArray(params.input));
      const assistants=params.input.filter(item=>typeof item!=='string'&&'role' in item&&item.role==='assistant');
      assert.equal(assistants.length,2);
      for(const assistant of assistants){assert.ok(typeof assistant!=='string'&&'content' in assistant);assert.equal(assistant.content,fallback);}
      return {...raw,id:'explicit-followup',output_text:JSON.stringify({reply:'A clean final analysis.'})};
    }});
  await followup.submit({requestId:randomUUID(),message:'Continue the analysis.',references:[]});
  const legacy=createImageConversationService(actor,{enabled:true,director:async(_input,history)=>{
    assert.equal(history.find(turn=>turn.message===oldInput.message)?.reply,fallback);
    return {reply:'A safe legacy direction.',image:null};
  }});
  await legacy.submit({requestId:randomUUID(),message:'Continue through the legacy adapter.',references:[]});

  // Exercise the actual persistence owner for nested preparation replies.
  const draftActor={...actor,userId:'draft-owner',projectId:'drafts'};
  const draftInput={requestId:randomUUID(),message:'Prepare my narration.',references:[]};
  const claimed=await claimImageTurn(draftActor,draftInput);
  const script='Read analysis, final, and </final> verbatim.';
  await persistImageDraft(draftActor,claimed.turn,{reply:contaminated,image:null,media:{action:'voice.prepare',reply:contaminated,script,language:'english'}},'0'.repeat(64));
  const media=(await pg.pool.query<DraftRow>('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[draftInput.requestId])).rows[0].draft_json;
  assert.ok(media.media&&media.media.action==='voice.prepare');
  assert.equal(media.reply,fallback);assert.equal(media.media.reply,fallback);assert.equal(media.media.script,script);
  assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM app_jobs')).rows[0].n,0);
  assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM mcp_generation_quotes')).rows[0].n,0);
});
