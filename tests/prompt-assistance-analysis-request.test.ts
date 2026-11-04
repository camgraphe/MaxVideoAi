import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePromptProviderReply} from '../frontend/src/server/prompt-assistance/reply-format';
import {isCurrentPromptAnalysisRequest,promptAnalysisRequestSchema} from '../frontend/src/lib/prompt-assistance/analysis-request';
import {createPreviewState,previewReducer} from '../frontend/src/lib/prompt-assistance/preview-state';
import {promptSessionSnapshotSchema} from '../frontend/src/lib/prompt-assistance/session';

const ref={type:'asset' as const,assetId:'ma_'+'a'.repeat(32),kind:'video' as const};
const references=[{fieldId:'reference_video_urls',slot:1,ref}];
const context={replyFormat:'destination-analysis-v2',analysisAvailability:{visual:true,audio:true,requiresUpgrade:false},references:[{field:'reference_video_urls',slot:1,kind:'video',durationSec:90}]};
const proposal={fieldId:'reference_video_urls',slot:1,modality:'visual',startSec:10,endSec:35};
const output=(analysisRequest:unknown)=>JSON.stringify({kind:'conversation',reply:'I can inspect that excerpt after you review the cost.',text:null,analysisRequest});

test('versioned analysis recommendation is bound to the admitted owned reference, without provider identity',()=>{
  assert.deepEqual(parsePromptProviderReply(output(proposal),context,references),{reply:'I can inspect that excerpt after you review the cost.',text:null,analysisRequest:{...proposal,ref}});
});

test('invalid optional recommendations preserve the useful answer without an action',()=>{
  for(const invalid of [
    {...proposal,slot:0},{...proposal,fieldId:'unknown'}, {...proposal,ref}, {...proposal,url:'https://private.invalid'},
    {...proposal,startSec:-1},{...proposal,startSec:35},{...proposal,endSec:91},{...proposal,endSec:71},
    {...proposal,modality:'audio',endSec:41},{...proposal,endSec:0},{...proposal,modality:'other'},
  ])assert.deepEqual(parsePromptProviderReply(output(invalid),context,references),{reply:'I can inspect that excerpt after you review the cost.',text:null});
});

test('recommendations require current owned metadata, available modality and verified duration',()=>{
  for(const saved of [
    {...context,references:[]}, {...context,references:[{...context.references[0],durationSec:null}]},
    {...context,references:[{...context.references[0],durationSec:0}]},
    {...context,references:[{...context.references[0],kind:'image'}]},
    {...context,references:[{...context.references[0],kind:'audio'}]},
    {...context,analysisAvailability:{visual:false,audio:true,requiresUpgrade:false}},
  ])assert.equal(parsePromptProviderReply(output(proposal),saved,references).analysisRequest,undefined);
  assert.equal(parsePromptProviderReply(output(proposal),context,[]).analysisRequest,undefined);
  assert.equal(parsePromptProviderReply(output(proposal),context,[{...references[0],ref:{...ref,kind:'audio'}}]).analysisRequest,undefined);
});

test('nullable proposed end becomes an exact bounded interval and audio on video has its own ceiling',()=>{
  assert.equal(parsePromptProviderReply(output({...proposal,endSec:null}),context,references).analysisRequest?.endSec,70);
  assert.equal(parsePromptProviderReply(output({...proposal,modality:'audio',endSec:null}),context,references).analysisRequest?.endSec,40);
  assert.equal(parsePromptProviderReply(output({...proposal,startSec:89,endSec:null}),context,references).analysisRequest?.endSec,90);
  assert.equal(parsePromptProviderReply(output({...proposal,startSec:90,endSec:null}),context,references).analysisRequest,undefined);
});

test('canonical binding rejects same-slot swaps, changed kind, different location and job output identity',()=>{
  const action=promptAnalysisRequestSchema.parse({...proposal,ref});
  assert.equal(isCurrentPromptAnalysisRequest(action,references),true);
  for(const changed of [[],[{...references[0],slot:0}],[{...references[0],ref:{...ref,assetId:'replacement'}}],[{...references[0],ref:{...ref,kind:'audio'}}]])assert.equal(isCurrentPromptAnalysisRequest(action,changed),false);
  const job={...action,ref:{type:'job-output' as const,jobId:'job_a',outputId:'output_a',kind:'video' as const}};
  assert.equal(isCurrentPromptAnalysisRequest(job,[{...references[0],ref:{kind:'video',outputId:'output_a',type:'job-output',jobId:'job_a'}}]),true,'property order does not change canonical identity');
  for(const changed of [{...job.ref,jobId:'job_b'},{...job.ref,outputId:'output_b'}])assert.equal(isCurrentPromptAnalysisRequest(job,[{...references[0],ref:changed}]),false);
});

test('public action schema preserves only bounded media suggestions with canonical URL-free identity',()=>{
  for(const invalid of [
    {...proposal,ref:{...ref,kind:'image'}},{...proposal,ref:{...ref,kind:'audio'}},
    {...proposal,endSec:71,ref},{...proposal,endSec:10,ref},{...proposal,ref,url:'https://private.invalid'},
    {...proposal,ref:{...ref,url:'https://private.invalid'}},
  ])assert.equal(promptAnalysisRequestSchema.safeParse(invalid).success,false);
});

test('reply reducer, recovery and strict session snapshot retain bound recommendation without a replacement',()=>{
  const analysisRequest=promptAnalysisRequestSchema.parse({...proposal,ref});
  let state=createPreviewState('video:create','manual');
  state=previewReducer(state,{type:'send',id:1,message:'Describe the movement.'});
  state=previewReducer(state,{type:'reply',id:1,reply:'Review this excerpt.',text:null,analysisRequest});
  assert.deepEqual(state.messages.at(-1)?.analysisRequest,analysisRequest);assert.equal(state.proposal,null);
  const recovered=previewReducer(createPreviewState('video:create','manual'),{type:'restored',message:'Describe movement.',reply:'Review this excerpt.',text:null,analysisRequest});
  assert.deepEqual(recovered.messages.at(-1)?.analysisRequest,analysisRequest);
  const snapshot=promptSessionSnapshotSchema.parse({sessionId:'10000000-0000-4000-8000-000000000001',scope:'video:create',status:'active',turns:[{requestId:'20000000-0000-4000-8000-000000000001',message:'Describe movement.',reply:'Review this excerpt.',analysisRequest}],proposal:null,pending:null});
  assert.deepEqual(snapshot.turns[0].analysisRequest,analysisRequest);
});

test('v2 requires its own exact root shape while null produces an unchanged public reply',()=>{
  assert.deepEqual(parsePromptProviderReply(output(null),context),{reply:'I can inspect that excerpt after you review the cost.',text:null});
  for(const body of [
    {kind:'conversation',reply:'Advice',text:null},
    {kind:'conversation',reply:'Advice',text:'Replacement',analysisRequest:null},
    {kind:'replacement',reply:'Advice',text:null,analysisRequest:null},
    {kind:'conversation',reply:'Advice',text:null,analysisRequest:null,extra:true},
  ])assert.throws(()=>parsePromptProviderReply(JSON.stringify(body),context,references));
});

test('absent and v1 markers cannot opt into the new action from output shape',()=>{
  for(const saved of [{},{replyFormat:'destination-v1'},{replyFormat:null},{replyFormat:'destination-analysis-v999'}])assert.throws(()=>parsePromptProviderReply(output(proposal),saved,references));
  assert.deepEqual(parsePromptProviderReply(JSON.stringify({kind:'conversation',reply:'Saved v1 advice.',text:null}),{replyFormat:'destination-v1'}),{reply:'Saved v1 advice.',text:null});
  assert.deepEqual(parsePromptProviderReply(JSON.stringify({reply:'Saved legacy advice.',text:null}),{}),{reply:'Saved legacy advice.',text:null});
});
