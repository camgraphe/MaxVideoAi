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
