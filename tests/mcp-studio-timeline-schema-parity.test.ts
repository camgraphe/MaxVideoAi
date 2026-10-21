import assert from 'node:assert/strict';
import test from 'node:test';
import {AjvJsonSchemaValidator} from '@modelcontextprotocol/sdk/validation/ajv';
import type {JsonSchemaType} from '@modelcontextprotocol/sdk/validation';
import {STUDIO_EDITING_DIRECTOR_TOOLS} from '../frontend/lib/studio/conversation-editing-contract';
import {conversationTimelineCommandSchema} from '../frontend/lib/studio/conversation-timeline-editing';
import {editStudioTimelineToolInputSchema} from '../frontend/src/server/mcp/tools/studio-timeline';
import {studioTimelineOutputSchema} from '../frontend/src/server/agent-api/studio-timeline';

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
    {edit:{kind:'insert',ref:{type:'asset',assetId:'music',kind:'audio'},startFrame:0,durationFrames:900,sourceInFrame:150},valid:true},
    {edit:{kind:'insert',ref:{type:'asset',assetId:'music',kind:'audio'},startFrame:0,durationFrames:900,sourceInFrame:-1},valid:false},
    {edit:{kind:'assemble',clips:[{ref:{type:'asset',assetId:'one',kind:'video'},startFrame:0,durationFrames:300,sourceInFrame:0},{ref:{type:'asset',assetId:'two',kind:'video'},startFrame:300,durationFrames:300,sourceInFrame:60}]},valid:true},
    {edit:{kind:'assemble',clips:[]},valid:false},
    {edit:{kind:'assemble',clips:[{ref:{type:'asset',assetId:'one',kind:'video'}}]},valid:true},
    {edit:{kind:'assemble',clips:[{ref:{type:'asset',assetId:'one',kind:'video'},startFrame:null,durationFrames:null,sourceInFrame:0}]},valid:true},
    {edit:{kind:'assemble',clips:[{ref:{type:'asset',assetId:'one',kind:'video'},startFrame:-1,durationFrames:null}]},valid:false},
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

test('replacement and pinned clip/sequence subtitles have canonical MCP and director schema parity',()=>{
  const base={projectId:'project',sequenceId:'sequence',expectedRevision:1,idempotencyKey:'replacement'};
  const ref={type:'asset',assetId:'owned',kind:'video'};
  const properties=STUDIO_EDITING_DIRECTOR_TOOLS.find(tool=>tool.name==='timeline_edit')!.properties;
  const director=new AjvJsonSchemaValidator().getValidator({type:'object',additionalProperties:false,properties,required:Object.keys(properties)} as JsonSchemaType);
  const directorInput=(edit:unknown)=>({sequenceId:base.sequenceId,expectedRevision:base.expectedRevision,edit});
  assert.equal(director(directorInput({kind:'assemble',clips:[{ref,startFrame:null,durationFrames:null,sourceInFrame:0}]})).valid,true);
  for(const edit of [{kind:'replace',clipId:'clip',ref},{kind:'replace',clipId:'clip',ref,sourceInFrame:30},{kind:'subtitles',clipId:'clip',documentId:'document',revision:1},{kind:'sequence-subtitles',documentId:null},{kind:'sequence-subtitles',documentId:'document',revision:2}]){
    assert.equal(conversationTimelineCommandSchema.safeParse({...base,edit}).success,true);
    assert.equal(editStudioTimelineToolInputSchema.safeParse({...base,edit}).success,true);
    // Strict director JSON requires every property; HTTP/MCP may omit defaults.
    const normalized=edit.kind==='replace'?{...edit,sourceInFrame:'sourceInFrame' in edit?edit.sourceInFrame:0}:{...edit,revision:'revision' in edit?edit.revision:1};
    assert.equal(director(directorInput(normalized)).valid,true,JSON.stringify(normalized));
  }
  for(const extra of [{durationFrames:60},{startFrame:0},{loop:true},{sourceInFrame:-1},{sourceInFrame:1.5},{ref:{...ref,url:'https://unowned.example/video.mp4'}}]){
    const input={...base,edit:{kind:'replace',clipId:'clip',ref,...extra}};
    assert.equal(conversationTimelineCommandSchema.safeParse(input).success,false);
    assert.equal(editStudioTimelineToolInputSchema.safeParse(input).success,false);
    assert.equal(director(directorInput({sourceInFrame:0,...input.edit})).valid,false);
  }
});

test('timeline output accepts pinned subtitle identity without allowing document payload or invalid revisions',()=>{
  const base={projectId:'project',sequenceId:'sequence',sequenceName:'Sequence',updatedAt:'2026-10-19T12:00:00Z',revision:1,fps:30};
  const clip={id:'clip',title:'Video',kind:'video',track:'video',startFrame:0,durationFrames:60,sourceInFrame:0};
  assert.equal(studioTimelineOutputSchema.safeParse({...base,clips:[{...clip,subtitle:{documentId:'document',revision:2}}]}).success,true);
  for(const subtitle of [{documentId:'document',revision:0},{documentId:'document',revision:2,content:'private document'},{documentId:'',revision:1}]){
    assert.equal(studioTimelineOutputSchema.safeParse({...base,clips:[{...clip,subtitle}]}).success,false);
  }
});
