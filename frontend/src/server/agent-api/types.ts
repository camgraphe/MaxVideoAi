import type { AgentApiFailure } from './errors';

export type AgentApiResult<T> = { ok: true; data: T } | AgentApiFailure;

export type AgentMoney = {
  amountCents: number;
  currency: string;
};

export type AgentAccountStatus = {
  accountId: string;
  emailVerified: boolean;
  clientId: string | null;
  wallet: AgentMoney & { pendingCents: number };
  trial: { status: 'disabled' };
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
