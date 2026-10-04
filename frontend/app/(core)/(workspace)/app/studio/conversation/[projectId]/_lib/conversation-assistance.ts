import {z} from 'zod';
import type {StudioAssistanceStatus} from '@/lib/studio/assistance-contract';
const cents=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const allowance=z.object({remainingPercent:z.number().min(0).max(100),renewal:z.enum(['one_time','monthly','unlimited'])});
const creditQuantity=z.object({total:cents,remaining:cents,reserved:cents});
const creditBalance=z.object({
  creditsPerDollar:cents.positive(),
  included:creditQuantity.extend({period:z.string().regex(/^\d{4}-\d{2}-01$/),renewsAt:z.string().datetime()}),
  purchased:creditQuantity.extend({packs:z.array(creditQuantity.extend({id:z.string().min(1),amountCents:cents.positive(),purchasedAt:z.string().datetime()}))}),
}).superRefine((value,context)=>{
  if(value.included.total===0||[value.included,value.purchased,...value.purchased.packs].some(item=>item.remaining+item.reserved>item.total))context.addIssue({code:'custom',message:'Credit quantities exceed their grants'});
  for(const field of ['total','remaining','reserved'] as const){if(value.purchased[field]!==value.purchased.packs.reduce((sum,pack)=>sum+pack[field],0))context.addIssue({code:'custom',message:'Purchased totals do not match their packs'});}
  if(new Set(value.purchased.packs.map(pack=>pack.id)).size!==value.purchased.packs.length||value.purchased.packs.some(pack=>pack.total!==pack.amountCents*value.creditsPerDollar/100))context.addIssue({code:'custom',message:'Purchased credit identity or value is invalid'});
});
export const assistanceStatusSchema=z.object({
  enabled:z.boolean(),policyVersion:z.string(),revision:cents,
  selectedModel:z.enum(['gpt-6.1-sol','gpt-6-luna']),mode:z.enum(['included_sol','paid_sol','sponsored_luna']),
  tariff:z.object({version:z.string(),effectiveAt:z.string(),currency:z.literal('USD'),noncachedInputUsdPerMillion:z.number().nonnegative(),cachedInputUsdPerMillion:z.number().nonnegative(),outputUsdPerMillion:z.number().nonnegative(),rounding:z.string(),maxCallsPerMessage:cents,automaticRecharge:z.literal(false)}),
  includedSol:allowance.extend({renewal:z.enum(['one_time','monthly'])}),sponsoredLuna:allowance.extend({renewal:z.enum(['one_time','unlimited'])}),
  credits:creditBalance.optional(),
  paid:z.object({enabled:z.boolean(),authorizedCents:cents,spentCents:cents,reservedCents:cents,remainingCents:cents,maxAdditionalBudgetCents:cents}),
  unresolvedCalls:cents,canContinue:z.boolean(),blockedReason:z.enum(['disabled','included_exhausted','luna_exhausted','paid_budget_exhausted','campaign_exhausted']).nullable(),
});
export const assistanceNextActionSchema=z.object({type:z.literal('studio_assistance'),reason:z.enum(['included_exhausted','luna_exhausted','paid_budget_exhausted','campaign_exhausted','usage_unresolved','wallet_insufficient','call_limit','luna_busy','luna_request_too_large']),safeToStartNewRequest:z.boolean(),canStartFollowup:z.boolean().optional(),completedModelCalls:z.number().int().nonnegative().optional()});
export type AssistanceNextAction=z.infer<typeof assistanceNextActionSchema>;
/** Set an absolute account ceiling: retain settled/in-flight costs, add to available budget. */
export function additionalAssistanceBudget(status:StudioAssistanceStatus,additionalCents:number) {
  if(!Number.isSafeInteger(additionalCents)||additionalCents<=0||additionalCents>status.paid.maxAdditionalBudgetCents)throw new Error('INVALID_BUDGET');
  return status.paid.spentCents+status.paid.reservedCents+status.paid.remainingCents+additionalCents;
}

/** Only a fresh, verified account read may unlock an explicit resume after reconciliation. */
export function canResumeAssistanceRequest(action:AssistanceNextAction|null,status:StudioAssistanceStatus|null,error:string|null) {
  return action?.reason==='usage_unresolved'&&!!status?.enabled&&status.unresolvedCalls===0&&!error;
}
