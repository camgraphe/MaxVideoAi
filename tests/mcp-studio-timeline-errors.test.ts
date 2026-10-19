import assert from 'node:assert/strict';
import test from 'node:test';
import {asStudioTimelineAgentError} from '../frontend/src/server/agent-api/studio-timeline';
import {AgentApiError} from '../frontend/src/server/agent-api/errors';
import {runAgentTool} from '../frontend/src/server/mcp/tool-result';

test('Studio subtitle errors expose exact corrective messages without document content or private metadata',async()=>{
  const projectId='owned-project';
  const cases=[
    ['SUBTITLE_NOT_FOUND','REFERENCE_NOT_FOUND','The requested subtitle document or revision is not available.',null],
    ['SUBTITLE_REVISION_INVALID','PARAMETER_INVALID','Provide a positive saved subtitle revision.',null],
    ['SUBTITLE_SOURCE_MISMATCH','REFERENCE_INVALID','These subtitles belong to a different source. Select a document for the exact clip source.',null],
    ['SUBTITLE_SEQUENCE_CHANGED','PARAMETER_INVALID','The saved audio mix changed or does not match these subtitles. Read the timeline again and select subtitles for the current mix.',{action:'read_timeline',projectId}],
    ['SUBTITLE_SEQUENCE_SOURCE_REQUIRED','REFERENCE_INVALID','Each sequence clip needs an owned media reference before sequence subtitles can be attached.',null],
    ['SUBTITLE_MIX_TRANSITION_UNSUPPORTED','PARAMETER_INVALID','Sequence subtitles do not support this transition. Remove it or use clip subtitles.',null],
    ['SUBTITLE_SOURCE_HAS_NO_AUDIO','REFERENCE_INVALID','The current sequence has no audible audio to subtitle.',null],
  ] as const;
  for(const [internalCode,code,message,nextAction] of cases){
    const original=Object.assign(new Error(internalCode),{documentId:'private-document',userId:'foreign-owner',sourceUrl:'https://private.example/video?token=secret',transcript:'private words'});
    const error=asStudioTimelineAgentError(original,projectId);
    assert.ok(error instanceof AgentApiError);
    const result=await runAgentTool(async()=>{throw error;});
    assert.equal(result.isError,true);
    assert.deepEqual(result.structuredContent,{ok:false,error:{code,message,retryable:false,nextAction}});
    assert.doesNotMatch(JSON.stringify(result),/private-document|foreign-owner|https:|token=|private words|SUBTITLE_/);
  }
});

test('unknown and decorated subtitle errors remain masked, not exposed by a permissive prefix match',async()=>{
  for(const message of ['SUBTITLE_SOURCE_MISMATCH: https://private.example?token=secret','SUBTITLE_PROVIDER_SECRET private transcript']){
    const original=new Error(message);
    assert.equal(asStudioTimelineAgentError(original,'owned-project'),original);
    const result=await runAgentTool(async()=>{throw asStudioTimelineAgentError(original,'owned-project');});
    const error=(result.structuredContent as {error:{code:string;message:string}}).error;
    assert.equal(error.code,'INTERNAL_ERROR');assert.equal(error.message,'An unexpected error occurred.');
    assert.doesNotMatch(JSON.stringify(result),/SUBTITLE_|private.example|token=secret|private transcript/);
  }
});
