import assert from 'node:assert/strict';
import test from 'node:test';
import {STUDIO_ASSISTANCE_TARIFF,type StudioAssistanceStatus} from '../frontend/src/lib/studio/assistance-contract';
import {additionalAssistanceBudget,assistanceStatusSchema,canResumeAssistanceRequest} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_lib/conversation-assistance';
import {ConversationRequestError,conversationIssue,conversationErrorMessage} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_lib/conversation-errors';
export const status:StudioAssistanceStatus={enabled:true,policyVersion:'test',revision:3,selectedModel:'gpt-6.1-sol',mode:'included_sol',tariff:STUDIO_ASSISTANCE_TARIFF,includedSol:{remainingPercent:0,renewal:'one_time'},sponsoredLuna:{remainingPercent:100,renewal:'one_time'},paid:{enabled:true,authorizedCents:300,spentCents:100,reservedCents:50,remainingCents:150,maxAdditionalBudgetCents:1850},unresolvedCalls:0,canContinue:false,blockedReason:'included_exhausted'};
test('additional budget includes previously spent, reserved and remaining allowance',()=>{
  assert.equal(additionalAssistanceBudget(status,500),800);
  assert.throws(()=>additionalAssistanceBudget(status,2000));assert.throws(()=>additionalAssistanceBudget(status,-1));
  assert.equal(assistanceStatusSchema.safeParse({...status,paid:{...status.paid,remainingCents:-1}}).success,false);
});
test('a malformed credit balance cannot create spending authority in the browser',()=>{
  const credits={creditsPerDollar:1000,included:{total:500,remaining:360,reserved:0,period:'2026-10-01',renewsAt:'2026-11-01T00:00:00Z'},purchased:{total:2000,remaining:1280,reserved:0,packs:[{id:'pack',total:2000,remaining:1280,reserved:0,amountCents:200,purchasedAt:'2026-10-05T00:00:00Z'}]}};
  assert.equal(assistanceStatusSchema.safeParse({...status,credits}).success,true);
  assert.equal(assistanceStatusSchema.safeParse({...status,credits:{...credits,included:{...credits.included,remaining:501}}}).success,false);
  assert.equal(assistanceStatusSchema.safeParse({...status,credits:{...credits,purchased:{...credits.purchased,remaining:2000}}}).success,false);
  assert.equal(assistanceStatusSchema.safeParse({...status,credits:{...credits,creditsPerDollar:0}}).success,false);
});
test('quota recovery preserves only the server-validated safe replay decision',()=>{
  const action={type:'studio_assistance',reason:'included_exhausted',safeToStartNewRequest:true};
  const issue=conversationIssue('submit',new ConversationRequestError('SPENDING_LIMIT_EXCEEDED',action));
  assert.deepEqual(issue.assistance,action);
  assert.match(conversationErrorMessage(issue,'en'),/assistance/i);
  const unknown=conversationIssue('submit',new ConversationRequestError('SPENDING_LIMIT_EXCEEDED',{...action,safeToStartNewRequest:'true'}));
  assert.equal(unknown.assistance,undefined);
  const other=conversationIssue('confirm',new ConversationRequestError('INSUFFICIENT_FUNDS',action));
  assert.equal(other.assistance,undefined);
});

test('only verified reconciliation permits explicit recovery; technical limits permit a follow-up',()=>{
 const action={type:'studio_assistance' as const,reason:'usage_unresolved' as const,safeToStartNewRequest:false};
 assert.equal(canResumeAssistanceRequest(action,null,null),false);
 assert.equal(canResumeAssistanceRequest(action,{...status,unresolvedCalls:1},null),false);
 assert.equal(canResumeAssistanceRequest(action,status,'UNAVAILABLE'),false);
 assert.equal(canResumeAssistanceRequest(action,status,null),true);
 const limit=conversationIssue('submit',new ConversationRequestError('SPENDING_LIMIT_EXCEEDED',{...action,reason:'call_limit',canStartFollowup:true,completedModelCalls:4}));
 assert.equal(limit.assistance?.canStartFollowup,true);
 assert.match(conversationErrorMessage(limit,'en'),/follow-up/);
 assert.equal(canResumeAssistanceRequest(limit.assistance!,status,null),false);
});
