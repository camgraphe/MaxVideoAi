export type CanonicalGenerationSurface = 'video' | 'image';

export const CANONICAL_VIDEO_GENERATION_MODES = [
  't2v',
  'i2v',
  'i2v_standard',
  'ref2v',
  'fl2v',
  'v2v',
  'r2v',
  'extend',
  'a2v',
  'retake',
  'reframe',
] as const;

export const CANONICAL_IMAGE_GENERATION_MODES = [
  't2i',
  'i2i',
] as const;

export const CANONICAL_GENERATION_MODES = [
  ...CANONICAL_VIDEO_GENERATION_MODES,
  ...CANONICAL_IMAGE_GENERATION_MODES,
] as const;

export type CanonicalVideoGenerationMode = (typeof CANONICAL_VIDEO_GENERATION_MODES)[number];
export type CanonicalImageGenerationMode = (typeof CANONICAL_IMAGE_GENERATION_MODES)[number];
export type CanonicalGenerationMode = (typeof CANONICAL_GENERATION_MODES)[number];

export type CanonicalGenerationMultiPromptScene = Readonly<{
  prompt: string;
  durationSec: number;
}>;

export type CanonicalGenerationSettingValue =
  | string
  | number
  | boolean
  | null
  | readonly CanonicalGenerationMultiPromptScene[];

export type CanonicalGenerationReferenceRole =
  | 'source'
  | 'reference'
  | 'first_frame'
  | 'last_frame'
  | 'mask';

export type CanonicalReferenceMediaKind = 'image' | 'video' | 'audio';

export type CanonicalGenerationReference =
  | {
      kind: 'asset';
      assetId: string;
      role: CanonicalGenerationReferenceRole;
      slot?: number;
    }
  | {
      kind: 'https';
      url: string;
      role: CanonicalGenerationReferenceRole;
      mediaKind: CanonicalReferenceMediaKind;
      slot?: number;
    };

export type GenerationFundingMode = 'wallet' | 'trial';

export type IncludedTrialFundingSnapshot = Readonly<{
  kind: 'included_trial';
  customerChargeCents: 0;
  normalPriceCents: number;
  providerCostCents: number;
}>;

export type CanonicalGenerationRequest = {
  schemaVersion: 1;
  surface: CanonicalGenerationSurface;
  engineId: string;
  mode: CanonicalGenerationMode;
  prompt: string;
  settings: Record<string, CanonicalGenerationSettingValue>;
  references: CanonicalGenerationReference[];
  outputCount: number;
};
