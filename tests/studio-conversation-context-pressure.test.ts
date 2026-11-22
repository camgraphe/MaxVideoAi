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

test('extended requests checkpoint only terminal stream snapshots, including output-limit usage', async () => {
  const {receiveStudioResponse} = await import('../frontend/src/server/studio/conversation-response-transport');
  for (const status of ['completed','incomplete','interrupted']) {
    const reply = {status,usage:{output_tokens:3120},incomplete_details:status === 'incomplete'?{reason:'max_output_tokens'}:null,
      output:[{type:'message',content:[{type:'output_text',text:'terminal answer'}]}]};
    async function* events() {
      yield {type:'response.output_text.delta',delta:'partial content'};
      if (status !== 'interrupted') yield {type:'response.'+status,response:reply};
    }
    const client = {responses:{create:async (params:{stream?:boolean})=>{assert.equal(params.stream,true);return events();}}};
    const receive=receiveStudioResponse(client as never,{model:'gpt-6.1-sol',input:'Test'},true,120_000);
    if(status==='interrupted') await assert.rejects(receive,/before its final usage/);
    else {const result=await receive;assert.equal(result.output_text,'terminal answer');assert.equal(result.usage?.output_tokens,3120);assert.equal(result.status,status);}
  }
});
