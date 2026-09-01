import type { AgentApiFailure } from './errors';
import type { CanonicalGenerationMode } from './generation-types';
import type { CanonicalGenerationReferenceRole } from './generation-types';
import type { AgentModelGuidance, AgentModelUseCase } from './model-guidance';
import type { AgentModelPromptingSource } from './model-prompting-sources';
import type { RuntimeModelEntry } from '@/config/model-runtime';

export type AgentApiResult<T> = { ok: true; data: T } | AgentApiFailure;

export type AgentMoney = {
  amountCents: number;
  currency: string;
};

export type AgentDestinationPurpose =
  | 'account_connections'
  | 'billing'
  | 'media_library'
  | 'video_workspace'
  | 'image_workspace'
  | 'support'
  | 'generation'
  | 'reference_upload';

export type AgentOpenUrlDestination = Readonly<{
  type: 'open_url';
  purpose: AgentDestinationPurpose;
  label: string;
  url: string;
}>;

export type AgentAccountDestinations = Readonly<{
  connections: AgentOpenUrlDestination;
  billing: AgentOpenUrlDestination;
  library: AgentOpenUrlDestination;
  videoWorkspace: AgentOpenUrlDestination;
  imageWorkspace: AgentOpenUrlDestination;
  support: AgentOpenUrlDestination;
}>;

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
  destinations: AgentAccountDestinations;
};

export type AgentGenerationMode = CanonicalGenerationMode;

export type AgentModelLifecycle = RuntimeModelEntry['lifecycle'];
export type AgentModelSuccessor = Readonly<{ id: string; slug: string }>;

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
  generationEnabled: boolean;
  lifecycle: AgentModelLifecycle;
  successor: AgentModelSuccessor | null;
  recommendedByDefault: boolean;
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
  limit?: number;
};

export type AgentModelPriority =
  | 'speed'
  | 'highest_resolution'
  | 'native_audio'
  | 'reference_control'
  | 'longer_clips'
  | 'lower_cost';

export type AgentModelRecommendationInput = AgentModelFilter & {
  useCase?: AgentModelUseCase;
  priorities?: readonly AgentModelPriority[];
  preferredModelIds?: readonly string[];
  excludedModelIds?: readonly string[];
  budgetCeilingCents?: number;
};

export type AgentModelRecommendation = {
  rank: number;
  model: AgentModel;
  reasons: string[];
  tradeoffs: string[];
  nextAction: 'calculate_project_budget' | 'discuss_and_choose' | 'clarify_requirements';
};

export type AgentModelRecommendationResult = {
  recommendations: AgentModelRecommendation[];
  nextAction: 'calculate_project_budget' | 'discuss_and_choose' | 'clarify_requirements';
  message?: string;
};

export type AgentModelAudioPolicy = 'unavailable' | 'optional' | 'always_generated';

export type AgentModelDurationDetails = Readonly<{
  options: readonly number[] | null;
  range: Readonly<{ min: number; max: number }> | null;
}>;

export type AgentModelReferenceFieldDetails = Readonly<{
  type: 'image' | 'video' | 'audio';
  roles: readonly CanonicalGenerationReferenceRole[];
  assetRequired: boolean;
  assetRequiredWhen?: Readonly<{
    setting: 'resolution';
    values: readonly string[];
  }>;
  durationSec?: Readonly<{
    min: number | null;
    max: number | null;
    combinedMax: number | null;
  }>;
  required: boolean;
  min: number | null;
  max: number | null;
}>;

export type AgentModelOutputCountDetails = Readonly<{
  min: number;
  max: number;
  default: number;
}>;

export type AgentModelSettingDetails = Readonly<{
  key: string;
  type: 'boolean' | 'number' | 'text' | 'enum';
  required: boolean;
  values: readonly (string | number | boolean)[] | null;
  min: number | null;
  max: number | null;
  default: string | number | boolean | null;
}>;

export type AgentModelModeDetails = Readonly<{
  mode: AgentGenerationMode;
  durationPolicy: 'requested' | 'source_video' | 'source_audio' | 'source_generation';
  duration: AgentModelDurationDetails | null;
  resolutions: readonly string[];
  aspectRatios: readonly string[];
  fps: readonly number[];
  audio: AgentModelAudioPolicy;
  outputCount: AgentModelOutputCountDetails;
  settings: readonly AgentModelSettingDetails[];
  references: readonly AgentModelReferenceFieldDetails[];
}>;

export type AgentModelDetails = Readonly<{
  id: string;
  label: string;
  surface: 'video' | 'image';
  availability: string;
  generationEnabled: boolean;
  lifecycle: AgentModelLifecycle;
  successor: AgentModelSuccessor | null;
  recommendedByDefault: boolean;
  prelaunch: boolean;
  modes: readonly AgentModelModeDetails[];
  guidance: AgentModelGuidance | null;
  promptingSources: readonly AgentModelPromptingSource[];
  links: Readonly<{
    model: string | null;
    pricing: string;
    examples: string | null;
  }>;
  catalogUpdatedAt: string;
}>;
