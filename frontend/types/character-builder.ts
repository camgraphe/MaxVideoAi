import type { PricingSnapshot } from './engines';
import type { GeneratedImage } from './image-generation';

export type CharacterBuilderSourceMode = 'scratch' | 'reference-image';
export type CharacterBuilderOutputMode = 'portrait-reference' | 'character-sheet';
export type CharacterBuilderConsistencyMode = 'exploratory' | 'balanced' | 'strict';
export type CharacterBuilderReferenceStrength = 'loose' | 'balanced' | 'strong';
export type CharacterBuilderQualityMode = 'draft' | 'final';
export type CharacterBuilderAction = 'generate' | 'full-body-fix' | 'lighting-variant';
export type CharacterBuilderTraitSource = 'auto' | 'manual';
export type CharacterBuilderReferenceImageRole = 'identity' | 'style';

export type TraitValue<T extends string> = {
  value: T | 'auto' | null;
  source: CharacterBuilderTraitSource;
};

export interface CharacterBuilderReferenceImage {
  id: string;
  url: string;
  role: CharacterBuilderReferenceImageRole;
  name?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface CharacterBuilderTraits {
  genderPresentation: TraitValue<'woman' | 'man' | 'androgynous' | 'custom'>;
  customGenderDescription?: string;
  ageRange: TraitValue<'teen' | 'young-adult' | 'adult' | 'mature' | 'senior'>;
  skinTone: TraitValue<string>;
  faceCues: TraitValue<string>;
  hairEnabled: boolean;
  customHairDescription?: string;
  hairColor: TraitValue<string>;
  hairLength: TraitValue<string>;
  hairstyle: TraitValue<string>;
  eyeColor: TraitValue<string>;
  bodyBuild: TraitValue<string>;
  outfitEnabled: boolean;
  customOutfitDescription?: string;
  outfitStyle: TraitValue<string>;
  accessories: string[];
  distinctiveFeatures: string[];
  realismStyle: 'photoreal' | 'cinematic' | 'stylized' | 'animated';
}

export interface CharacterBuilderLineage {
  parentResultId?: string | null;
  parentRunId?: string | null;
  pinnedReferenceResultId?: string | null;
}

export interface CharacterBuilderRequest {
  action: CharacterBuilderAction;
  sourceMode: CharacterBuilderSourceMode;
  outputMode: CharacterBuilderOutputMode;
  consistencyMode: CharacterBuilderConsistencyMode;
  referenceStrength?: CharacterBuilderReferenceStrength | null;
  qualityMode: CharacterBuilderQualityMode;
  referenceImages: CharacterBuilderReferenceImage[];
  traits: CharacterBuilderTraits;
  outputOptions: {
    fullBodyRequired: boolean;
    includeCloseUps: boolean;
    neutralStudioBackground: boolean;
    preserveFacialDetails: boolean;
    avoid3dRenderLook: boolean;
  };
  advancedNotes?: string;
  mustRemainVisible?: string[];
  generateCount?: number;
  selectedResultId?: string | null;
  selectedResultUrl?: string | null;
  pinnedReferenceResultId?: string | null;
  pinnedReferenceResultUrl?: string | null;
  lineage?: CharacterBuilderLineage;
}

export interface CharacterBuilderSettingsSnapshot {
  schemaVersion: 1;
  surface: 'character-builder';
  action: CharacterBuilderAction;
  engineId: string;
  engineLabel: string;
  inputMode: 't2i' | 'i2i';
  prompt: string;
  builder: {
    sourceMode: CharacterBuilderSourceMode;
    outputMode: CharacterBuilderOutputMode;
    consistencyMode: CharacterBuilderConsistencyMode;
    referenceStrength: CharacterBuilderReferenceStrength | null;
    qualityMode: CharacterBuilderQualityMode;
    referenceImages: CharacterBuilderReferenceImage[];
    traits: CharacterBuilderTraits;
    outputOptions: {
      fullBodyRequired: boolean;
      includeCloseUps: boolean;
      neutralStudioBackground: boolean;
      preserveFacialDetails: boolean;
      avoid3dRenderLook: boolean;
    };
    advancedNotes: string;
    mustRemainVisible: string[];
  };
  lineage: CharacterBuilderLineage;
}

export interface CharacterBuilderResult extends GeneratedImage {
  id: string;
  runId: string;
  jobId: string;
  engineId: string;
  engineLabel: string;
  action: CharacterBuilderAction;
  outputMode: CharacterBuilderOutputMode;
  qualityMode: CharacterBuilderQualityMode;
  parentResultId?: string | null;
  createdAt: string;
}

export interface CharacterBuilderRun {
  id: string;
  jobId: string;
  action: CharacterBuilderAction;
  outputMode: CharacterBuilderOutputMode;
  qualityMode: CharacterBuilderQualityMode;
  engineId: string;
  engineLabel: string;
  createdAt: string;
  parentResultId?: string | null;
  results: CharacterBuilderResult[];
  settingsSnapshot: CharacterBuilderSettingsSnapshot;
  pricing?: PricingSnapshot;
  requestId?: string | null;
  providerJobId?: string | null;
}

export interface CharacterBuilderRefinement {
  id: string;
  action: Exclude<CharacterBuilderAction, 'generate'>;
  parentResultId: string;
  childRunId: string;
  childResultIds: string[];
  createdAt: string;
}

export interface CharacterBuilderState {
  sourceMode: CharacterBuilderSourceMode;
  referenceImages: CharacterBuilderReferenceImage[];
  traits: CharacterBuilderTraits;
  outputMode: CharacterBuilderOutputMode;
  consistencyMode: CharacterBuilderConsistencyMode;
  referenceStrength: CharacterBuilderReferenceStrength | null;
  qualityMode: CharacterBuilderQualityMode;
  outputOptions: {
    fullBodyRequired: boolean;
    includeCloseUps: boolean;
    neutralStudioBackground: boolean;
    preserveFacialDetails: boolean;
    avoid3dRenderLook: boolean;
  };
  advancedNotes: string;
  mustRemainVisible: string[];
  selectedResultId: string | null;
  pinnedReferenceResultId: string | null;
  runs: CharacterBuilderRun[];
  refinementHistory: CharacterBuilderRefinement[];
}

export interface CharacterBuilderResponse {
  ok: boolean;
  run?: CharacterBuilderRun;
  settingsSnapshot?: CharacterBuilderSettingsSnapshot;
  pricing?: PricingSnapshot;
  error?: {
    code: string;
    message: string;
    detail?: unknown;
  };
}
