import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {getDb} from '../frontend/src/lib/db';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createStudioConversationProject} from '../frontend/src/server/studio/conversation-project-command';
import {editStudioConversationTimeline} from '../frontend/src/server/studio/conversation-edit-command';
import {readStudioWorkspace} from '../frontend/src/server/studio/workspace-command';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import type {ResponseCreateParamsNonStreaming} from 'openai/resources/responses/responses';
import type {StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';

test('a native bot edit and run checkpoint commit together; a lost reply never repeats the cut',async t => {
  const pg = await startDisposablePostgres('stchat-edit-run');
  const before = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end(); if (before === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = before; await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  for (const migration of ['26_studio_projects.sql','42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql']) await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
  const actor = {authMethod: 'studio-session' as const,userId: '00000000-0000-4000-8000-000000000095',clientId: null,projectId: ''};
  const project = await createStudioConversationProject(actor,{name: 'Film',idempotencyKey: randomUUID()},{featureEnabled: true});
  actor.projectId = project.projectId;
  await pg.pool.query(`UPDATE studio_sequences SET timeline_state=jsonb_set(timeline_state,'{timelineItems}',$2::jsonb) WHERE id=$1`,[project.sequenceId,JSON.stringify([{id: 'opening',title: 'Opening',outputNodeId: 'out',track: 'video',mediaKind: 'video',startSec: 0,durationSec: 5,sourceStartSec: 0,sourceDurationSec: 6,mediaUrl: 'https://cdn.maxvideoai.com/opening.mp4',status: 'completed'}])]);
  let calls = 0;
  const service = createImageConversationService(actor,{enabled: true,actionsEnabled: true,editingEnabled: true,createActionResponse: async params => {
    calls++;
    if (calls === 2) throw new Error('Simulated lost final reply');
    return {id: 'reply-'+calls,model: 'gpt-6.1-sol',status: 'completed',usage: null,service_tier: 'default',output_text: calls === 1 ? '' : '{"reply":"The opening is three seconds now."}',output: calls === 1 ? [{type: 'function_call',name: 'timeline_edit',call_id: 'cut',arguments: JSON.stringify({sequenceId: project.sequenceId,expectedRevision: 0,edit: {kind: 'trim',clipId: 'opening',edge: 'end',durationFrames: 90}})}] : []};
  }});
  const input = {requestId: randomUUID(),message: 'Make the opening a little shorter.',references: []};
  await assert.rejects(service.submit(input),/Simulated lost final reply/);
  assert.equal((await readStudioWorkspace(actor,actor.projectId)).project.revision,1);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM studio_conversation_steps WHERE state='completed' AND action_json->>'action'='timeline.edit'")).rows[0].n,1);
  const finished = await service.submit(input);
  assert.equal(finished.state,'ready');
  assert.equal(finished.quote,null);
  assert.equal(calls,3);
  assert.equal((await readStudioWorkspace(actor,actor.projectId)).project.revision,1);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM studio_project_commands WHERE command_kind='conversation_timeline_edit'")).rows[0].n,1);
  await editStudioConversationTimeline(actor,{projectId: actor.projectId,sequenceId: project.sequenceId,expectedRevision: 1,idempotencyKey: randomUUID(),edit: {kind: 'move',clipId: 'opening',startFrame: 30}},{featureEnabled: true});
  let conflictCalls = 0;
  const stale = createImageConversationService(actor,{enabled: true,actionsEnabled: true,editingEnabled: true,createActionResponse: async params => {
    conflictCalls++;
    if (conflictCalls > 1) assert.match(JSON.stringify(params.input),/preserve the manual edit/);
    return {id: 'conflict-'+conflictCalls,model: 'gpt-6.1-sol',status: 'completed',usage: null,service_tier: 'default',output_text: conflictCalls === 1 ? '' : '{"reply":"I kept your manual position. The timeline changed before my cut."}',output: conflictCalls === 1 ? [{type: 'function_call',name: 'timeline_edit',call_id: 'stale-cut',arguments: JSON.stringify({sequenceId: project.sequenceId,expectedRevision: 1,edit: {kind: 'trim',clipId: 'opening',edge: 'end',durationFrames: 30}})}] : []};
  }});
  const conflict = await stale.submit({requestId: randomUUID(),message: 'Make it shorter again.',references: []});
  assert.match(conflict.reply!,/kept your manual position/);
  const saved = await readStudioWorkspace(actor,actor.projectId);
  assert.equal(saved.project.revision,2);
  assert.equal((saved.sequences[0].timelineState as any).timelineItems[0].durationSec,3);
  assert.equal((saved.sequences[0].timelineState as any).timelineItems[0].startSec,1);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
});

function actionResponse(call: number,name: string,args: unknown): StudioDirectorResponse {
  return {id: 'multi-response-'+randomUUID(),model: 'gpt-6.1-sol',status: 'completed',usage: null,service_tier: 'default',output_text: '',
    output: [{type: 'function_call',name,call_id: 'multi-action-'+call,arguments: JSON.stringify(args)}]};
}
function lastTimelineRead(params: ResponseCreateParamsNonStreaming): {sequenceId: string;revision: number;clips: {id: string;kind: string}[]} {
  const input = params.input as any[];
  const results = input.filter(item => item.type === 'function_call_output').map(item => JSON.parse(item.output));
  return results.filter(item => item.action === 'timeline.read' && item.ok).at(-1).data;
}

test('bounded multi-edit completion survives a fresh-service resume and exposes unassessed work durably',async t => {
  const pg = await startDisposablePostgres('stchat-multi-edit');
  const before = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  t.after(async () => {await getDb().end();if (before === undefined) delete process.env.DATABASE_URL;else process.env.DATABASE_URL = before;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE job_outputs (id text PRIMARY KEY,job_id text,user_id text,kind text,url text,mime_type text,status text,metadata jsonb);
    CREATE TABLE media_assets (id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,status text,original_name text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,thumb_url text,preview_url text);`);
  for (const migration of ['26_studio_projects.sql','42_studio_connected_montages.sql','50_studio_image_conversation.sql','51_studio_image_model_usage.sql','52_studio_conversation_runs.sql']) await pg.pool.query(readFileSync('neon/migrations/'+migration,'utf8'));
  const userId = '00000000-0000-4000-8000-000000000096';
  const musicRef = {type: 'asset' as const,assetId: 'ma_'+ 'b'.repeat(32),kind: 'audio' as const};
  await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,original_name,metadata)
    VALUES ('music',$1,$2,'audio','https://cdn.maxvideoai.com/quiet-music.mp3','audio/mpeg','ready','Music',$3::jsonb)`,[musicRef.assetId,userId,JSON.stringify({mediaFacts: {source: 'probe',durationSec: 12,hasAudio: true}})]);
  const actor = {authMethod: 'studio-session' as const,userId,clientId: null,projectId: ''};
  const makeProject = async () => {
    const result = await createStudioConversationProject(actor,{name: 'Film',idempotencyKey: randomUUID()},{featureEnabled: true});
    actor.projectId = result.projectId;
    return result;
  };
  const service = (createActionResponse: (params: ResponseCreateParamsNonStreaming) => Promise<StudioDirectorResponse>) =>
    createImageConversationService({...actor},{enabled: true,actionsEnabled: true,mediaEnabled: true,editingEnabled: true,createActionResponse});
  const countEdits = async (requestId: string) => Number((await pg.pool.query("SELECT count(*)::int AS n FROM studio_conversation_steps WHERE request_id=$1 AND state='completed' AND action_json->>'action'='timeline.edit' AND result_json->>'ok'='true'",[requestId])).rows[0].n);

  await t.test('a lost response after insertion resumes the same request, applies quiet gain, and never inserts twice',async () => {
    const project = await makeProject();
    const input = {requestId: randomUUID(),message: 'Add this music quietly under my film.',references: [],attachments: [musicRef]};
    let calls = 0;
    const create = async (params: ResponseCreateParamsNonStreaming): Promise<StudioDirectorResponse> => {
      const call = ++calls;
      if (call === 3) throw new Error('Controlled interruption after the music insertion');
      if (call === 1 || call === 4) return actionResponse(call,'timeline_read',{});
      const facts = lastTimelineRead(params);
      const edit = call === 2 ? {kind: 'insert',ref: musicRef,startFrame: 0,durationFrames: 150} : {kind: 'gain',clipId: facts.clips.find(clip => clip.kind === 'audio')!.id,volume: 18};
      return actionResponse(call,'timeline_edit',{sequenceId: facts.sequenceId,expectedRevision: facts.revision,edit});
    };
    await assert.rejects(service(create).submit(input),/Controlled interruption/);
    assert.equal((await readStudioWorkspace(actor,actor.projectId)).project.revision,1);
    assert.equal(await countEdits(input.requestId),1);
    const resumed = await service(create).submit(input);
    assert.equal(resumed.state,'ready');
    assert.equal(resumed.quote,null);
    assert.equal(calls,5,'The fresh service replays the two saved model steps and only retries the unknown response.');
    const state = await readStudioWorkspace(actor,project.projectId);
    const clips = (state.sequences[0].timelineState as any).timelineItems;
    assert.equal(clips.length,1);
    assert.equal(clips[0].audioMix.volume,18);
    assert.equal(state.project.revision,2);
    assert.equal(await countEdits(input.requestId),2);
    assert.match(resumed.reply!,/2 timeline edits/);
    assert.match(resumed.reply!,/haven't verified.*every part/);
    const stored = (await pg.pool.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0].draft_json;
    assert.deepEqual(stored.continuation,{reason: 'action_limit',completedEdits: 2});
    assert.deepEqual(await service(create).submit(input),resumed,'A repeated submit returns the persisted completion without another model call.');
    assert.equal(calls,5);
    assert.equal((await service(create).read()).turns[0].reply,resumed.reply);
  });

  await t.test('a manual revision before the fourth edit is preserved with the completed insertion and truthful pending error',async () => {
    const project = await makeProject();
    const input = {requestId: randomUUID(),message: 'Put this music at the start and make it quiet.',references: [],attachments: [musicRef]};
    let calls = 0;
    const reply = await service(async params => {
      const call = ++calls;
      if (call === 1 || call === 3) return actionResponse(call,'timeline_read',{});
      const facts = lastTimelineRead(params);
      const music = facts.clips.find(clip => clip.kind === 'audio');
      if (call === 4) await editStudioConversationTimeline(actor,{projectId: project.projectId,sequenceId: project.sequenceId,expectedRevision: 1,idempotencyKey: randomUUID(),edit: {kind: 'move',clipId: music!.id,startFrame: 30}},{featureEnabled: true});
      return actionResponse(call,'timeline_edit',{sequenceId: facts.sequenceId,expectedRevision: facts.revision,edit: call === 2 ? {kind: 'insert',ref: musicRef,startFrame: 0,durationFrames: 150} : {kind: 'gain',clipId: music!.id,volume: 15}});
    }).submit(input);
    const saved = await readStudioWorkspace(actor,project.projectId);
    const music = (saved.sequences[0].timelineState as any).timelineItems[0];
    assert.equal(saved.project.revision,2);
    assert.equal(music.startSec,1);
    assert.equal(music.audioMix.volume,100,'The failed gain must not overwrite the manual revision.');
    assert.equal(await countEdits(input.requestId),1);
    assert.equal(reply.state,'ready');
    assert.match(reply.reply!,/1 timeline edit/);
    assert.match(reply.reply!,/last action failed.*preserve the manual edit/i);
    const continuation = (await pg.pool.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0].draft_json.continuation;
    assert.equal(continuation.completedEdits,1);
    assert.equal(continuation.lastError.code,'PARAMETER_INVALID');
    assert.match(continuation.lastError.message,/timeline changed/);
  });

  await t.test('known token exhaustion survives a lost pending-reply save without another billed response',async () => {
    const project = await makeProject();
    const input = {requestId: randomUUID(),message: 'Add this music and make the film tighter.',references: [],attachments: [musicRef]};
    let calls = 0;
    const create = async (params: ResponseCreateParamsNonStreaming): Promise<StudioDirectorResponse> => {
      const call = ++calls;
      if (call === 1) return actionResponse(call,'timeline_read',{});
      const facts = lastTimelineRead(params);
      if (call === 2) return actionResponse(call,'timeline_edit',{sequenceId: facts.sequenceId,expectedRevision: facts.revision,edit: {kind: 'insert',ref: musicRef,startFrame: 0,durationFrames: 150}});
      return {id: 'incomplete-budget',model: 'gpt-6.1-sol',status: 'incomplete',service_tier: 'default',output_text: '',output: [],incomplete_details: {reason: 'max_output_tokens'},usage: {input_tokens: 100,output_tokens: 2200,total_tokens: 2300,input_tokens_details: {cached_tokens: 0},output_tokens_details: {reasoning_tokens: 2200}}};
    };
    await pg.pool.query(`CREATE FUNCTION fail_pending_reply_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.draft_json->'continuation'->>'reason'='output_limit' THEN RAISE EXCEPTION 'Controlled lost pending reply save'; END IF;
      RETURN NEW; END $$;
      CREATE TRIGGER fail_pending_reply BEFORE UPDATE OF draft_json ON studio_image_turns FOR EACH ROW EXECUTE FUNCTION fail_pending_reply_save();`);
    await assert.rejects(service(create).submit(input),/Controlled lost pending reply save/);
    assert.equal(calls,3);
    await pg.pool.query('DROP TRIGGER fail_pending_reply ON studio_image_turns; DROP FUNCTION fail_pending_reply_save();');
    const completed = await service(async () => {throw new Error('A known output limit must replay without another billed response.');}).submit(input);
    assert.equal(completed.state,'ready');
    assert.equal(calls,3);
    assert.equal((await readStudioWorkspace(actor,project.projectId)).project.revision,1);
    assert.equal(await countEdits(input.requestId),1);
    const saved = (await pg.pool.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0].draft_json;
    assert.deepEqual(saved.continuation,{reason: 'output_limit',completedEdits: 1});
    assert.match(saved.reply,/output limit/);
    const response = (await pg.pool.query("SELECT response_json FROM studio_conversation_responses WHERE request_id=$1 AND response_id='incomplete-budget'",[input.requestId])).rows[0].response_json;
    assert.equal(response.usage.total_tokens,2300);
    assert.deepEqual(response.incomplete_details,{reason: 'max_output_tokens'});
  });
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM mcp_generation_quotes')).rows[0].n,0);
  assert.equal((await pg.pool.query('SELECT count(*)::int AS n FROM app_jobs')).rows[0].n,0);
});
