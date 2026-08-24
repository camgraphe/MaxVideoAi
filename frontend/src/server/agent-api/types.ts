import type { AgentApiFailure } from './errors';
import type { AgentModelGuidance } from './model-guidance';

export type AgentApiResult<T> = { ok: true; data: T } | AgentApiFailure;

export type AgentMoney = {
  amountCents: number;
  currency: string;
};

export type TrialPresetSummary = Readonly<{
  engineId: string;
  surface: 'video';
  mode: 't2v';
  durationSec: number;
  resolution: string;
  aspectRatios: readonly string[];
  audioOptional: boolean;
  outputCount: number;
}>;

export type TrialStatus =
  | Readonly<{ status: 'disabled' }>
  | Readonly<{
      status: 'verification_required';
      nextAction: Readonly<{ type: 'verify_email'; url: string }>;
    }>
  | Readonly<{ status: 'available'; preset: TrialPresetSummary }>
  | Readonly<{ status: 'reserved'; jobId: string | null }>
  | Readonly<{ status: 'consumed'; jobId: string | null }>
  | Readonly<{
      status: 'temporarily_unavailable';
      reason: 'account_restricted' | 'preset_unavailable' | 'service_unavailable';
    }>;

export type AgentAccountStatus = {
  accountId: string;
  emailVerified: boolean;
  clientId: string | null;
  wallet: AgentMoney & { pendingCents: number };
  trial: TrialStatus;
  spendingLimits: {
    perGenerationCents: number | null;
    dailyCents: number | null;
    webApprovalAboveCents: number | null;
  };
  accountUrl: string;
};

export type AgentGenerationMode = 't2v' | 'i2v' | 'ref2v' | 't2i' | 'i2i';

export type AgentModel = {
  id: string;
  label: string;
  surface: 'video' | 'image';
  modes: AgentGenerationMode[];
  aspectRatios: string[];
  resolutions: string[];
  maxDurationSec: number | null;
  audio: boolean;
  referenceImages: boolean;
  availability: string;
};

export type AgentModelFilter = {
  id?: string;
  surface?: 'video' | 'image';
  mode?: AgentGenerationMode;
  aspectRatio?: string;
  resolution?: string;
  maxDurationSec?: number;
  audio?: boolean;
  referenceImages?: boolean;
};

export type AgentModelRecommendationInput = AgentModelFilter & {
  budgetPreference?: 'lowest' | 'balanced' | 'flexible';
  speedPreference?: 'fastest' | 'balanced' | 'quality';
  qualityPreference?: 'draft' | 'balanced' | 'highest';
};

export type AgentModelRecommendation = {
  rank: number;
  model: AgentModel;
  reasons: string[];
  tradeoffs: string[];
  nextAction: 'prepare_generation' | 'clarify_requirements';
};

export type AgentModelRecommendationResult = {
  recommendations: AgentModelRecommendation[];
  nextAction: 'prepare_generation' | 'clarify_requirements';
  message?: string;
};

export type AgentModelAudioPolicy = 'unavailable' | 'optional' | 'always_generated';

export type AgentModelDurationDetails = Readonly<{
  options: readonly (number | string)[] | null;
  range: Readonly<{ min: number; max: number }> | null;
}>;

export type AgentModelReferenceFieldDetails = Readonly<{
  id: string;
  type: 'image' | 'video' | 'audio';
  required: boolean;
  min: number | null;
  max: number | null;
}>;

export type AgentModelModeDetails = Readonly<{
  mode: AgentGenerationMode;
  duration: AgentModelDurationDetails | null;
  resolutions: readonly string[];
  aspectRatios: readonly string[];
  fps: readonly number[];
  audio: AgentModelAudioPolicy;
  references: readonly AgentModelReferenceFieldDetails[];
}>;

export type AgentModelDetails = Readonly<{
  id: string;
  label: string;
  surface: 'video' | 'image';
  availability: string;
  modes: readonly AgentModelModeDetails[];
  guidance: AgentModelGuidance | null;
  links: Readonly<{
    model: string;
    pricing: string;
    examples: string | null;
  }>;
  catalogUpdatedAt: string;
}>;
