import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import type { EngineCaps, Mode } from '@/types/engines';

export type PricingContext = {
  engine: EngineCaps;
  durationSec: number;
  resolution: string;
  aspectRatio?: string | null;
  quality?: string | null;
  customImageSize?: GptImage2ImageSize | null;
  mode?: Mode;
  membershipTier?: string | null;
  currency?: string;
  loop?: boolean;
  hasVideoInput?: boolean;
  durationOption?: number | string | null;
  referenceImageCount?: number;
  addons?: Record<string, boolean | number | undefined>;
};
