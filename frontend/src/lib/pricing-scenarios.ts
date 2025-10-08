import type { MemberTier } from '@maxvideoai/pricing';

export interface PricingScenario {
  engineId: string;
  durationSec: number;
  resolution: string;
  memberTier?: MemberTier | string;
  addons?: {
    audio?: boolean;
    upscale4k?: boolean;
  };
}

export const DEFAULT_MARKETING_SCENARIO: PricingScenario = {
  engineId: 'runwayg3',
  durationSec: 12,
  resolution: '1080p',
  memberTier: 'member',
};
