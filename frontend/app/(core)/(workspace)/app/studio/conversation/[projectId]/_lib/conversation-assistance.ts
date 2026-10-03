import {z} from 'zod';
import type {StudioAssistanceStatus} from '@/lib/studio/assistance-contract';
const cents=z.number().int().nonnegative();
const allowance=z.object({remainingPercent:z.number().min(0).max(100),renewal:z.literal('one_time')});
export const assistanceStatusSchema=z.object({
  enabled:z.boolean(),policyVersion:z.string(),revision:cents,
  selectedModel:z.enum(['gpt-6.1-sol','gpt-6-luna']),mode:z.enum(['included_sol','paid_sol','sponsored_luna']),
  tariff:z.object({version:z.string(),effectiveAt:z.string(),currency:z.literal('USD'),noncachedInputUsdPerMillion:z.number().nonnegative(),cachedInputUsdPerMillion:z.number().nonnegative(),outputUsdPerMillion:z.number().nonnegative(),rounding:z.string(),maxCallsPerMessage:cents,automaticRecharge:z.literal(false)}),
  includedSol:allowance,sponsoredLuna:allowance,
  paid:z.object({enabled:z.boolean(),authorizedCents:cents,spentCents:cents,reservedCents:cents,remainingCents:cents,maxAdditionalBudgetCents:cents}),
  unresolvedCalls:cents,canContinue:z.boolean(),blockedReason:z.enum(['disabled','included_exhausted','luna_exhausted','paid_budget_exhausted','campaign_exhausted']).nullable(),
});
export const assistanceNextActionSchema=z.object({type:z.literal('studio_assistance'),reason:z.enum(['included_exhausted','luna_exhausted','paid_budget_exhausted','campaign_exhausted','usage_unresolved','wallet_insufficient']),safeToStartNewRequest:z.boolean(),canStartFollowup:z.boolean().optional(),completedModelCalls:z.number().int().nonnegative().optional()});
export type AssistanceNextAction=z.infer<typeof assistanceNextActionSchema>;
/** Set an absolute account ceiling: retain settled/in-flight costs, add to available budget. */
export function additionalAssistanceBudget(status:StudioAssistanceStatus,additionalCents:number) {
  if(!Number.isSafeInteger(additionalCents)||additionalCents<=0||additionalCents>status.paid.maxAdditionalBudgetCents)throw new Error('INVALID_BUDGET');
  return status.paid.spentCents+status.paid.reservedCents+status.paid.remainingCents+additionalCents;
}
