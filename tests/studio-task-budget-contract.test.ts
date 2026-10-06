import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {STUDIO_TASK_POLICY_VERSION,STUDIO_TASK_PROFILES,studioTaskSelectionSchema,studioTaskResumeSchema,studioTaskStatusSchema,studioTaskProfileForModel} from '../frontend/src/lib/studio/task-budget-contract';
import {imageTurnInputSchema,imageTurnRetryInput} from '../frontend/src/lib/studio/image-conversation-contract';

test('client ceilings are exact, complex is explicit, and legacy messages stay valid',()=>{
  assert.deepEqual(Object.values(STUDIO_TASK_PROFILES).map(p=>[p.maxCredits,p.maxCalls,p.maxOutputTokens,p.maxInputTokens,p.deadlineSec]),[[100,2,2200,12000,180],[250,4,2200,24000,300],[500,8,6000,48000,600]]);
  const standard={profile:'standard',maxCredits:250,policyVersion:STUDIO_TASK_POLICY_VERSION};
  assert.equal(studioTaskSelectionSchema.parse(standard).profile,'standard');
  for(const value of [{...standard,maxCredits:500},{...standard,autoRecharge:true},{...standard,profile:'complex',maxCredits:500}])assert.equal(studioTaskSelectionSchema.safeParse(value).success,false);
  const complex=studioTaskSelectionSchema.parse({profile:'complex',maxCredits:500,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmedComplex:true});
  assert.equal(studioTaskProfileForModel(complex,'gpt-6.1-sol').maxCalls,8);
  assert.throws(()=>studioTaskProfileForModel(complex,'gpt-6-luna'),/Sol/);
  const input={requestId:randomUUID(),message:'Create the requested image',references:[]};
  assert.deepEqual(imageTurnInputSchema.parse(input),input);
  assert.deepEqual(imageTurnInputSchema.parse({...input,taskBudget:standard}).taskBudget,standard);
  assert.deepEqual(imageTurnRetryInput({...input,taskBudget:standard} as never).taskBudget,standard);
});
test('resumption confirms an owned identity and exact ceiling, never an implicit pack or model change',()=>{
  const value={requestId:randomUUID(),approvalId:randomUUID(),expectedRevision:0,action:'continue',maxCredits:250,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true};
  assert.equal(studioTaskResumeSchema.parse(value).maxCredits,250);
  for(const delta of [{confirmed:false},{maxCredits:2001},{maxCredits:251},{buyPack:true},{model:'gpt-6.1-sol'},{expectedRevision:-1}])assert.equal(studioTaskResumeSchema.safeParse({...value,...delta}).success,false);
});
test('task status exposes bounded resource progress without private worker or media data',()=>{
  const value={requestId:randomUUID(),profile:'standard',policyVersion:STUDIO_TASK_POLICY_VERSION,model:'gpt-6.1-sol',state:'paused',phase:'paused',maxCredits:250,consumedCredits:60,reservedCredits:0,completedCalls:1,allowedCalls:4,revision:0,canContinue:true,error:'steps'};
  assert.equal(studioTaskStatusSchema.parse(value).consumedCredits,60);
  for(const delta of [{sourceUrl:'https://private.invalid/video'},{workerId:randomUUID()},{allowedCalls:25},{maxCredits:2010},{consumedCredits:61},{phase:'100% complete'}])assert.equal(studioTaskStatusSchema.safeParse({...value,...delta}).success,false);
});
