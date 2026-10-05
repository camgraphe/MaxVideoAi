import {z} from 'zod';

export const STUDIO_ASSISTANCE_POLICY_VERSION = 'studio-credits-2026-10-05-v2';
export const STUDIO_ASSISTANCE_LEGACY_POLICY_VERSION = 'studio-beta-2026-10-03-v1';
/** Retained for immutable settlements and the earlier budget-only policy. */
export const STUDIO_ASSISTANCE_TARIFF = {
  version: 'studio-sol-usd-2026-10-03-v1', effectiveAt: '2026-10-03T00:00:00.000Z', currency: 'USD' as const,
  noncachedInputUsdPerMillion: 7.5, cachedInputUsdPerMillion: 0.3, outputUsdPerMillion: 30,
  rounding: 'Aggregate all model calls in a client message, then round up to the next USD cent.',
  maxCallsPerMessage: 4, automaticRecharge: false as const,
};
export const STUDIO_ASSISTANCE_CREDIT_TARIFF = {
  ...STUDIO_ASSISTANCE_TARIFF,
  version: 'studio-sol-usd-2026-10-05-v2', effectiveAt: '2026-10-05T00:00:00.000Z',
  noncachedInputUsdPerMillion: 5, cachedInputUsdPerMillion: 0.2, outputUsdPerMillion: 20,
};
export function studioAssistanceTariff(version: string) {
  if(version===STUDIO_ASSISTANCE_TARIFF.version)return STUDIO_ASSISTANCE_TARIFF;
  if(version===STUDIO_ASSISTANCE_CREDIT_TARIFF.version)return STUDIO_ASSISTANCE_CREDIT_TARIFF;
  return null;
}
export const STUDIO_SOL_CREDITS_PER_DOLLAR = 1000;
export const STUDIO_SOL_MONTHLY_CREDITS = 500;
export const STUDIO_SOL_PACK_CENTS = [200,500,1000] as const;
export type StudioCreditQuantity = {total:number;remaining:number;reserved:number};
export type StudioCreditBalance = {
  creditsPerDollar:number;
  included:StudioCreditQuantity&{period:string;renewsAt:string;priorReserved?:number};
  purchased:StudioCreditQuantity&{packs:Array<StudioCreditQuantity&{id:string;amountCents:number;purchasedAt:string}>};
};
export type StudioAssistantModel = 'gpt-6.1-sol' | 'gpt-6-luna';
export type StudioAssistanceMode = 'included_sol' | 'paid_sol' | 'sponsored_luna';
export type StudioAssistanceBlockedReason = 'disabled' | 'included_exhausted' | 'luna_exhausted' | 'paid_budget_exhausted' | 'campaign_exhausted' | null;
export type StudioAssistanceStatus = {
  enabled: boolean; policyVersion: string; revision: number;
  selectedModel: StudioAssistantModel; mode: StudioAssistanceMode;
  tariff: typeof STUDIO_ASSISTANCE_TARIFF;
  includedSol: {remainingPercent: number; renewal: 'one_time'|'monthly'};
  sponsoredLuna: {remainingPercent: number; renewal: 'one_time'|'unlimited'};
  credits?:StudioCreditBalance;
  sponsoredAvailable?:boolean;
  /** maxAdditionalBudgetCents is the current permitted increment to authorizedCents. */
  paid: {enabled: boolean; authorizedCents: number; spentCents: number; reservedCents: number; remainingCents: number; maxAdditionalBudgetCents: number};
  unresolvedCalls: number; canContinue: boolean; blockedReason: StudioAssistanceBlockedReason;
};
export const studioAssistanceChoiceSchema = z.discriminatedUnion('action',[
  z.object({action:z.literal('purchase_pack'),amountCents:z.union([z.literal(200),z.literal(500),z.literal(1000)]),tariffVersion:z.string(),expectedRevision:z.number().int().nonnegative(),purchaseKey:z.string().uuid()}).strict(),
  z.object({action:z.literal('resume_paid'),tariffVersion:z.string(),expectedRevision:z.number().int().nonnegative()}).strict(),
  z.object({action: z.literal('authorize_paid'),budgetCents: z.number().int().nonnegative().max(1_000_000),tariffVersion: z.string(),expectedRevision: z.number().int().nonnegative()}).strict(),
  z.object({action: z.enum(['select_luna','select_sol','disable_paid']),expectedRevision: z.number().int().nonnegative()}).strict(),
]);
export type StudioAssistanceChoice = z.infer<typeof studioAssistanceChoiceSchema>;
