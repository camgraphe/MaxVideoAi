import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';

test('Sol edits through a gated typed tool, then explains the actual result',async () => {
  const args = {sequenceId: 'sequence',expectedRevision: 8,edit: {kind: 'trim',clipId: 'clip',edge: 'end',durationFrames: 90}};
  assert.equal(actionFromTool('timeline_edit',args).action,'timeline.edit');
  assert.throws(() => actionFromTool('timeline_edit',{...args,confirmed: true}));
  let calls = 0;
  let executed = 0;
  const createResponse = async (params: any) => {
    calls++;
    assert.ok(params.tools.some((tool: any) => tool.name === 'timeline_edit'));
    assert.ok(!params.tools.some((tool: any) => /confirm|export|shell/.test(tool.name)));
    return {id: 'resp-'+calls,model: 'gpt-6.1-sol',status: 'completed' as const,usage: null,service_tier: 'default' as const,
      output_text: calls === 1 ? '' : '{"reply":"The opening is now three seconds. You can adjust it on the timeline."}',
      output: calls === 1 ? [{type: 'function_call' as const,name: 'timeline_edit',call_id: 'cut',arguments: JSON.stringify(args)}] : []};
  };
  const context = {message: 'Make the opening shorter.',references: [],history: [],project: {name: 'Film',revision: 8,memory: {revision: 0,brief: '',decisions: []}},checkpoint: async (_: number,create: () => Promise<any>) => create(),execute: async () => {executed++; return {ok: true,action: 'timeline.edit',data: {revision: 9}} as never;}};
  await createStudioConversationDirector({editingEnabled: true,createResponse} as any)(context);
  assert.equal(executed,1);
  const gatedResponse = async () => ({id: 'bad',model: 'gpt-6.1-sol',status: 'completed' as const,usage: null,service_tier: 'default' as const,output_text: '',output: [{type: 'function_call' as const,name: 'timeline_edit',call_id: 'bad',arguments: JSON.stringify(args)}]});
  await assert.rejects(createStudioConversationDirector({createResponse: gatedResponse})(context),{code: 'ENGINE_UNAVAILABLE'});
  assert.equal(executed,1);
});

test('the last bounded response explains completed actions instead of leaving a saved edit behind an action-limit error',async () => {
  let calls = 0;let actions = 0;
  const context = {message: 'Make it a little tighter.',references: [],history: [],project: {name: 'Film',revision: 0,memory: {revision: 0,brief: '',decisions: []}},checkpoint: async (_: number,create: () => Promise<any>) => create(),execute: async () => {actions++;return {ok: true,action: 'project.read',data: {}} as never;}};
  const createResponse = async (params: any) => {
    calls++;
    if (calls === 4) assert.equal(params.tool_choice,'none','The final bounded call must reserve a client reply.');
    return {id: 'bounded-'+calls,model: 'gpt-6.1-sol',status: 'completed' as const,usage: null,service_tier: 'default' as const,
      output_text: calls === 4 ? '{"reply":"Your changes are saved. We can continue with the next shot."}' : '',
      output: calls === 4 ? [] : [{type: 'function_call' as const,name: 'project_read',call_id: 'read-'+calls,arguments: '{}'}]};
  };
  const result = await createStudioConversationDirector({editingEnabled: true,createResponse})(context);
  assert.equal(actions,3);assert.match(result.reply,/saved/);assert.equal(calls,4);
});
