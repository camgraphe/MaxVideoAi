import {STUDIO_ASSISTANCE_POLICY_VERSION,STUDIO_ASSISTANCE_LEGACY_POLICY_VERSION} from '@/lib/studio/assistance-contract';
export type StudioAssistancePolicy = {enabled: boolean;solAllowanceNanoUsd: number;lunaAllowanceNanoUsd: number;campaignNanoUsd: number;maxAdditionalBudgetCents: number;credits?:boolean;lunaMaxInputTokens?:number;version?:typeof STUDIO_ASSISTANCE_POLICY_VERSION|typeof STUDIO_ASSISTANCE_LEGACY_POLICY_VERSION};
/** Injected legacy policies omit credits; identity always follows the selected funding regime. */
export function studioAssistancePolicyVersion(policy:Pick<StudioAssistancePolicy,'credits'>) {
  return policy.credits===true?STUDIO_ASSISTANCE_POLICY_VERSION:STUDIO_ASSISTANCE_LEGACY_POLICY_VERSION;
}
export function studioAssistancePolicy(env: Readonly<Record<string,string|undefined>> = process.env): StudioAssistancePolicy {
  const globalEndpoint = !env.OPENAI_BASE_URL || env.OPENAI_BASE_URL.replace(/\/$/,'') === 'https://api.openai.com/v1';
  const credits=env.NODE_ENV!=='production'||env.STUDIO_ASSISTANCE_APPROVED_POLICY===STUDIO_ASSISTANCE_POLICY_VERSION;
  const version=studioAssistancePolicyVersion({credits});
  return {enabled: globalEndpoint && env.STUDIO_ASSISTANCE_ENABLED === 'true' && (env.NODE_ENV !== 'production' || env.STUDIO_ASSISTANCE_APPROVED_POLICY === version),
    solAllowanceNanoUsd: 1_000_000_000,lunaAllowanceNanoUsd: 250_000_000,campaignNanoUsd: 100_000_000_000,maxAdditionalBudgetCents: 2000,credits,version,lunaMaxInputTokens:128_000};
}
