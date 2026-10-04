import {z} from 'zod';

export const STUDIO_ASSISTANCE_POLICY_VERSION = 'studio-beta-2026-10-03-v1';
export const STUDIO_ASSISTANCE_TARIFF = {
  version: 'studio-sol-usd-2026-10-03-v1', effectiveAt: '2026-10-03T00:00:00.000Z', currency: 'USD' as const,
  noncachedInputUsdPerMillion: 7.5, cachedInputUsdPerMillion: 0.3, outputUsdPerMillion: 30,
  rounding: 'Aggregate all model calls in a client message, then round up to the next USD cent.',
  maxCallsPerMessage: 4, automaticRecharge: false as const,
};
export type StudioAssistantModel = 'gpt-6.1-sol' | 'gpt-6-luna';
export type StudioAssistanceMode = 'included_sol' | 'paid_sol' | 'sponsored_luna';
export type StudioAssistanceBlockedReason = 'disabled' | 'included_exhausted' | 'luna_exhausted' | 'paid_budget_exhausted' | 'campaign_exhausted' | null;
export type StudioAssistanceStatus = {
  enabled: boolean; policyVersion: string; revision: number;
  selectedModel: StudioAssistantModel; mode: StudioAssistanceMode;
  tariff: typeof STUDIO_ASSISTANCE_TARIFF;
  includedSol: {remainingPercent: number; renewal: 'one_time'};
  sponsoredLuna: {remainingPercent: number; renewal: 'one_time'};
  /** maxAdditionalBudgetCents is the current permitted increment to authorizedCents. */
  paid: {enabled: boolean; authorizedCents: number; spentCents: number; reservedCents: number; remainingCents: number; maxAdditionalBudgetCents: number};
  unresolvedCalls: number; canContinue: boolean; blockedReason: StudioAssistanceBlockedReason;
};
export const studioAssistanceChoiceSchema = z.discriminatedUnion('action',[
  z.object({action: z.literal('authorize_paid'),budgetCents: z.number().int().nonnegative().max(1_000_000),tariffVersion: z.string(),expectedRevision: z.number().int().nonnegative()}).strict(),
  z.object({action: z.enum(['select_luna','select_sol','disable_paid']),expectedRevision: z.number().int().nonnegative()}).strict(),
]);
export type StudioAssistanceChoice = z.infer<typeof studioAssistanceChoiceSchema>;
