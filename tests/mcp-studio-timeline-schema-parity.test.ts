import assert from 'node:assert/strict';
import test from 'node:test';
import {conversationTimelineCommandSchema} from '../frontend/lib/studio/conversation-timeline-editing';
import {editStudioTimelineToolInputSchema} from '../frontend/src/server/mcp/tools/studio-timeline';

// The SDK's v4 transport schema must not drift from the existing mutation contract.
test('MCP timeline inputs preserve the canonical frame, gain, reference and strict-command bounds',()=>{
  const base = {projectId: 'project',sequenceId: 'sequence',expectedRevision: 0,idempotencyKey: 'retry'};
  const fixtures = [
    {edit: {kind: 'move',clipId: 'clip',startFrame: 0},valid: true},
    {edit: {kind: 'move',clipId: 'clip',startFrame: 5_184_000},valid: true},
    {edit: {kind: 'move',clipId: 'clip',startFrame: 5_184_001},valid: false},
    {edit: {kind: 'move',clipId: 'clip',startFrame: .5},valid: false},
    {edit: {kind: 'trim',clipId: 'clip',edge: 'end',durationFrames: 1},valid: true},
    {edit: {kind: 'trim',clipId: 'clip',edge: 'end',durationFrames: 0},valid: false},
    {edit: {kind: 'gain',clipId: 'clip',volume: 100},valid: true},
    {edit: {kind: 'gain',clipId: 'clip',volume: 0},valid: true},
    {edit: {kind: 'gain',clipId: 'clip',volume: 101},valid: false},
    {edit: {kind: 'remove',clipId: 'clip',owner: 'forged'},valid: false},
    {edit: {kind: 'insert',ref: {type: 'asset',assetId: 'returned-id',kind: 'image'},startFrame: 0,durationFrames: 30},valid: true},
    {edit: {kind: 'insert',ref: {type: 'job-output',jobId: 'job',outputId: 'returned-output',kind: 'video'},startFrame: 0,durationFrames: 30},valid: true},
    {edit: {kind: 'insert',ref: {type: 'asset',assetId: 'returned-id',kind: 'image',url: 'https://forged.example'},startFrame: 0,durationFrames: 30},valid: false},
  ];
  for (const {edit,valid} of fixtures) {
    const input = {...base,edit};
    assert.equal(editStudioTimelineToolInputSchema.safeParse(input).success,valid,JSON.stringify(input));
    assert.equal(conversationTimelineCommandSchema.safeParse(input).success,valid,JSON.stringify(input));
  }
  for (const extra of [{projectId: 'x'.repeat(201)},{expectedRevision: -1},{idempotencyKey: ''},{userId: 'forged'}]) {
    const input = {...base,edit: {kind: 'remove',clipId: 'clip'},...extra};
    assert.equal(editStudioTimelineToolInputSchema.safeParse(input).success,false);
    assert.equal(conversationTimelineCommandSchema.safeParse(input).success,false);
  }
});
