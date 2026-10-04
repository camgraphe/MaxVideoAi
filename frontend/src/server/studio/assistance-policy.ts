import {STUDIO_ASSISTANCE_POLICY_VERSION} from '@/lib/studio/assistance-contract';
export type StudioAssistancePolicy = {enabled: boolean;solAllowanceNanoUsd: number;lunaAllowanceNanoUsd: number;campaignNanoUsd: number;maxAdditionalBudgetCents: number};
export function studioAssistancePolicy(env: Readonly<Record<string,string|undefined>> = process.env): StudioAssistancePolicy {
  const globalEndpoint = !env.OPENAI_BASE_URL || env.OPENAI_BASE_URL.replace(/\/$/,'') === 'https://api.openai.com/v1';
  return {enabled: globalEndpoint && env.STUDIO_ASSISTANCE_ENABLED === 'true' && (env.NODE_ENV !== 'production' || env.STUDIO_ASSISTANCE_APPROVED_POLICY === STUDIO_ASSISTANCE_POLICY_VERSION),
    solAllowanceNanoUsd: 1_000_000_000,lunaAllowanceNanoUsd: 250_000_000,campaignNanoUsd: 100_000_000_000,maxAdditionalBudgetCents: 2000};
}
