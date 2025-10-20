import type { MemberTier, PricingInput } from '@maxvideoai/pricing';

export interface PricingScenario {
  engineId: string;
  durationSec: number;
  resolution: string;
  memberTier?: MemberTier | string;
}

export const DEFAULT_MARKETING_SCENARIO: PricingScenario = {
  engineId: 'veo3',
  durationSec: 12,
  resolution: '1080p',
  memberTier: 'member',
};

function normalizeMemberTier(tier?: PricingScenario['memberTier']): MemberTier | undefined {
  if (!tier) {
    return undefined;
  }
  const normalized = tier.toString().toLowerCase();
  if (normalized === 'member' || normalized === 'plus' || normalized === 'pro') {
    return normalized as MemberTier;
  }
  return undefined;
}

export function scenarioToPricingInput(scenario: PricingScenario): PricingInput {
  return {
    engineId: scenario.engineId,
    durationSec: scenario.durationSec,
    resolution: scenario.resolution,
    memberTier: normalizeMemberTier(scenario.memberTier),
  };
}
