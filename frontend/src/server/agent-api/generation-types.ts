export type CanonicalGenerationSurface = 'video' | 'image';

export type CanonicalGenerationMode =
  | 't2v'
  | 'i2v'
  | 'ref2v'
  | 'v2v'
  | 'extend'
  | 't2i'
  | 'i2i';

export type CanonicalGenerationSettingValue = string | number | boolean | null;

export type CanonicalGenerationReferenceRole =
  | 'source'
  | 'reference'
  | 'first_frame'
  | 'last_frame';

export type CanonicalReferenceMediaKind = 'image' | 'video' | 'audio';

export type CanonicalGenerationReference =
  | {
      kind: 'asset';
      assetId: string;
      role: CanonicalGenerationReferenceRole;
    }
  | {
      kind: 'https';
      url: string;
      role: CanonicalGenerationReferenceRole;
      mediaKind: CanonicalReferenceMediaKind;
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
  outputCount: 1;
};
