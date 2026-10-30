import type {AssistanceNextAction, StudioAssistanceStatus} from './assistance-contract';

/** The server reserves the maximum cost before dispatch, so a positive balance can still be insufficient. */
export function needsMiloCredits(status:StudioAssistanceStatus|null, action?:AssistanceNextAction|null) {
  if(!status?.enabled || status.selectedModel==='gpt-6-luna' || status.unresolvedCalls)return false;
  if(action?.safeToStartNewRequest && ['included_exhausted','paid_budget_exhausted'].includes(action.reason))return true;
  if(status.credits)return status.credits.included.remaining+(status.paid.enabled?status.credits.purchased.remaining:0)<=0;
  return ['included_exhausted','paid_budget_exhausted'].includes(status.blockedReason??'');
}
export function canUseMiloLite(status:StudioAssistanceStatus|null) {
  return !!status?.enabled && !status.unresolvedCalls && status.sponsoredAvailable!==false && !['campaign_exhausted','luna_exhausted'].includes(status.blockedReason??'');
}
