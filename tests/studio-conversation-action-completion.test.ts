import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioConversationDirector,isReplayableStudioResponse,type StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';
import {imageDraftSchema} from '../frontend/src/lib/studio/image-conversation-contract';
import type {StudioActionResult} from '../frontend/lib/studio/conversation-action-contract';

const project = {name: 'Film',revision: 0,memory: {revision: 0,brief: '',decisions: []}};
function toolResponse(index: number,name: string,args: unknown): StudioDirectorResponse {
  return {id: 'response-'+index,model: 'gpt-6.1-sol',status: 'completed',usage: null,service_tier: 'default',output_text: '',
    output: [{type: 'function_call',name,call_id: 'action-'+index,arguments: JSON.stringify(args)}]};
}

test('the fourth action can finish a quiet music insertion without increasing the four-call token allowance',async () => {
  const steps = [
    ['timeline_read',{}],
    ['timeline_edit',{sequenceId: 'sequence',expectedRevision: 0,edit: {kind: 'insert',ref: {type: 'asset',assetId: 'ma_'+ 'a'.repeat(32),kind: 'audio'},startFrame: 0,durationFrames: 150}}],
    ['timeline_read',{}],
    ['timeline_edit',{sequenceId: 'sequence',expectedRevision: 1,edit: {kind: 'gain',clipId: 'music',volume: 18}}],
  ] as const;
  let calls = 0;let volume = 0;let edits = 0;let outputAllowance = 0;
  const draft = await createStudioConversationDirector({editingEnabled: true,createResponse: async params => {
    outputAllowance += params.max_output_tokens!;
    const [name,args] = steps[calls];
    if (calls === 3) assert.ok(params.tools?.some(tool => tool.type === 'function' && tool.name === 'timeline_edit'));
    return toolResponse(calls++,name,args);
  }})({message: 'Add the music quietly under the voice.',references: [],history: [],project,checkpoint: async (_,create) => create(),
    execute: async (_,action) => {
      if (action.action === 'timeline.edit') {edits++;volume = action.edit.kind === 'gain' ? action.edit.volume : 100;}
      return {ok: true,action: action.action,data: {changed: action.action === 'timeline.edit'}} as StudioActionResult;
    }});
  assert.equal(volume,18,'A fourth supported action must run, rather than silently leave the music at full gain.');
  assert.equal(edits,2);
  assert.equal(calls,4);
  assert.equal(outputAllowance,8800);
  assert.deepEqual((draft as any).continuation,{reason: 'action_limit',completedEdits: 2});
  assert.match(draft.reply,/2 timeline edits/);
  assert.match(draft.reply,/haven't verified.*every part/i);
  assert.deepEqual(imageDraftSchema.parse(JSON.parse(JSON.stringify(draft))),draft,'Pending assessment must survive persisted draft validation.');
});

test('a fourth failed edit reports the actual failure and keeps earlier successful edits',async () => {
  let calls = 0;let applied = 0;
  const draft = await createStudioConversationDirector({editingEnabled: true,createResponse: async () => {
    const index = calls++;
    return index % 2 === 0 ? toolResponse(index,'timeline_read',{}) : toolResponse(index,'timeline_edit',{sequenceId: 'sequence',expectedRevision: index === 1 ? 0 : 1,edit: {kind: 'gain',clipId: 'music',volume: 20}});
  }})({message: 'Make the music quiet and shorten the voice.',references: [],history: [],project,checkpoint: async (_,create) => create(),execute: async (_,action) => {
    if (action.action !== 'timeline.edit') return {ok: true,action: action.action,data: {}} as StudioActionResult;
    if (applied++ === 0) return {ok: true,action: action.action,data: {changed: true}} as StudioActionResult;
    return {ok: false,action: action.action,error: {code: 'PARAMETER_INVALID',message: 'The timeline changed. Read it again and preserve the manual edit.',retryable: false}};
  }});
  assert.equal(calls,4);
  assert.deepEqual((draft as any).continuation,{reason: 'action_limit',completedEdits: 1,lastError: {code: 'PARAMETER_INVALID',message: 'The timeline changed. Read it again and preserve the manual edit.'}});
  assert.match(draft.reply,/1 timeline edit/);
  assert.match(draft.reply,/last action failed/i);
  assert.match(draft.reply,/preserve the manual edit/);
});

test('three research actions leave the final response for an answer even when the pricing read failed',async () => {
  const steps = [
    ['catalog_read',{}],
    ['model_details',{modelId: 'kling-o3-pro'}],
    ['pricing_read',{surface: 'video',modelId: 'kling-o3-pro',mode: 't2v',settings: [{name: 'duration',value: 8},{name: 'resolution',value: '1080p'},{name: 'aspectRatio',value: '9:16'},{name: 'audio',value: false}],references: [],outputCount: 1}],
  ] as const;
  const actions: string[] = [];
  let calls = 0;let outputAllowance = 0;
  const draft = await createStudioConversationDirector({mediaEnabled: true,editingEnabled: true,exportsEnabled: true,createResponse: async params => {
    const index = calls++;
    outputAllowance += params.max_output_tokens!;
    if (index < 3) return toolResponse(index,...steps[index]);
    const names = params.tools?.filter(tool => tool.type === 'function').map(tool => tool.name) ?? [];
    assert.deepEqual(names.sort(),['audio_prepare','export_prepare','image_prepare','music_prepare','pricing_compare','quote_discard','timeline_edit','video_prepare','voice_prepare'],
      'Only a comparison with a server-rendered terminal reply can remain alongside finishing actions.');
    assert.equal(params.tool_choice,'auto');
    assert.match(JSON.stringify(params.input),/The pricing scenario is invalid/,'The final answer sees the failed estimate rather than inventing a price.');
    return {...toolResponse(index,'model_details',{modelId: 'seedance-2-5'}),output: [],output_text: JSON.stringify({reply: 'Use soft morning light and a slow camera move. Upload the product photo to guide bottle consistency. The price read failed, so I cannot yet verify the budget.'})};
  }})({message: 'Compare two models for an eight-second vertical perfume ad under $5. Shape the direction; do not generate.',references: [],history: [],project,
    checkpoint: async (_,create) => create(),execute: async (_,action) => {
      actions.push(action.action);
      if (action.action === 'pricing.read') return {ok: false,action: action.action,error: {code: 'PARAMETER_INVALID',message: 'The pricing scenario is invalid.',retryable: false}};
      return {ok: true,action: action.action,data: []} as StudioActionResult;
    }});
  assert.deepEqual(actions,['catalog.read','model.details','pricing.read']);
  assert.equal(calls,4);
  assert.equal(outputAllowance,8800);
  assert.equal(draft.continuation,undefined);
  assert.equal(draft.image,null);
});

test('previously checkpointed fourth reads remain replayable without another model response',async () => {
  const receipts = Array.from({length: 4},(_,index) => toolResponse(index,'catalog_read',{}));
  let recovered = 0;
  assert.ok(receipts.every(isReplayableStudioResponse));
  const draft = await createStudioConversationDirector({createResponse: async () => {throw new Error('Saved Responses must not be repurchased.');}})({message: 'Help me make this film.',references: [],history: [],project,
    checkpoint: async index => receipts[index],execute: async () => {recovered++;return {ok: true,action: 'catalog.read',data: []};}});
  assert.equal(recovered,4);
  assert.equal((draft as any).continuation.completedEdits,0);
  assert.match(draft.reply,/continue/i);
  assert.doesNotMatch(draft.reply,/saved/i);
});

test('known output-token exhaustion returns saved edits and pending assessment instead of discarding them',async () => {
  let calls = 0;let edits = 0;
  const draft = await createStudioConversationDirector({editingEnabled: true,createResponse: async () => {
    if (calls++ === 0) return toolResponse(0,'timeline_edit',{sequenceId: 'sequence',expectedRevision: 0,edit: {kind: 'gain',clipId: 'music',volume: 20}});
    return {id: 'limited',model: 'gpt-6.1-sol',status: 'incomplete',usage: null,service_tier: 'default',output_text: '',output: [],incomplete_details: {reason: 'max_output_tokens'}} as StudioDirectorResponse;
  }})({message: 'Make the music quiet and shorten the voice.',references: [],history: [],project,checkpoint: async (_,create) => create(),execute: async () => {edits++;return {ok: true,action: 'timeline.edit',data: {changed: true}} as StudioActionResult;}});
  assert.equal(edits,1);
  assert.equal(calls,2);
  assert.deepEqual((draft as any).continuation,{reason: 'output_limit',completedEdits: 1});
  assert.match(draft.reply,/1 timeline edit/);
  assert.match(draft.reply,/output limit/i);
});

test('a known output limit is replayable as pending assessment but cannot execute its truncated tool call',async () => {
  const partial = {...toolResponse(0,'timeline_edit',{sequenceId: 'sequence',expectedRevision: 0,edit: {kind: 'gain',clipId: 'music',volume: 20}}),status: 'incomplete' as const,incomplete_details: {reason: 'max_output_tokens' as const}};
  assert.equal(isReplayableStudioResponse(partial),true,'The saved limit receipt must resume without repeating a billed model response.');
  assert.equal(isReplayableStudioResponse({...partial,incomplete_details: {reason: 'content_filter'}}),false);
  let actions = 0;
  const draft = await createStudioConversationDirector({editingEnabled: true,createResponse: async () => partial})({message: 'Lower the music.',references: [],history: [],project,checkpoint: async (_,create) => create(),execute: async () => {actions++;throw new Error('A truncated call must never run.');}});
  assert.equal(actions,0);
  assert.deepEqual(draft.continuation,{reason: 'output_limit',completedEdits: 0});
});
