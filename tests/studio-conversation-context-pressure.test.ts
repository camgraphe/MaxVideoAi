import assert from 'node:assert/strict';
import test from 'node:test';
import type {ResponseCreateParamsNonStreaming, ResponseInputItem} from 'openai/resources/responses/responses';
import {compactStudioRequestHistory, measureStudioRequest, studioRecentHistoryInput} from '../frontend/src/server/studio/conversation-context-pressure';

test('compact an over-target conversation without altering sources, newest scripts, or tool replay', async () => {
  const turns = Array.from({length:8}, (_, i) => ({message:'script '+i+'X'.repeat(1900)+' end',reply:'Answer '+i+'X'.repeat(20_000)+' end'}));
  const history = studioRecentHistoryInput(turns);
  const current: ResponseInputItem = {role:'user', content:[{type:'input_text',text:'Continue with the selected video and preserve sound'}]};
  const tool: ResponseInputItem = {type:'function_call_output',call_id:'abc',output:'Project-owned video source'};
  const params:ResponseCreateParamsNonStreaming = {model:'gpt-6-luna',input:[...history,current,tool]};
  const initial = params.input;
  let counts = 0;
  const count = async () => ++counts === 1 ? 80_000 : 29_000;
  const compact = () => compactStudioRequestHistory(params,turns,history);
  assert.equal(await measureStudioRequest(params,count,{targetInputTokens:64_000,compact}),29_000);
  assert.ok(Array.isArray(params.input));
  assert.deepEqual(params.input.slice(-6),[...history.slice(-4),current,tool]);
  assert.ok(JSON.stringify(params.input).length < JSON.stringify(initial).length / 2);
  assert.equal(params.input.at(-1),tool);
  assert.equal(params.input.at(-2),current);
  assert.equal(counts,2);
});

test('normal and frozen requests retain their counted payload and unhelpful compaction is discarded', async () => {
  const params:ResponseCreateParamsNonStreaming = {model:'gpt-6-luna',input:'original'};
  const unexpected = () => { throw new Error('not under pressure'); };
  assert.equal(await measureStudioRequest(params,async()=>47_999,{targetInputTokens:64_000,compact:unexpected}),47_999);
  assert.equal(await measureStudioRequest(params,async()=>90_000),90_000);
  const compact=()=>{params.input='candidate';return true};
  assert.equal(await measureStudioRequest(params,async()=>params.input==='original'?48_000:48_001,{targetInputTokens:64_000,compact}),48_000);
  assert.equal(params.input,'original');
});
