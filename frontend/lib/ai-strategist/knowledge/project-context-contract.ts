export type StrategistProjectContext = {
  currentPrompt?: string;
  selectedModel?: string;
  selectedWorkflow?: string;
  selectedSettings?: Record<string, string | number | boolean>;
  uploadedAssetMetadata?: {
    type?: string;
    hasPerson?: boolean;
    hasProduct?: boolean;
    hasLogo?: boolean;
    hasText?: boolean;
    isReferenceImage?: boolean;
  };
};

export type StrategistProjectContextAccessPolicy = {
  userOwnedContextOnly: true;
  explicitAppProvidedContextOnly: true;
  noSilentPrivateProjectReads: true;
  noCrossUserJobsOrPrompts: true;
  noCreditSpend: true;
  noAutoApplyGeneratorActions: true;
};

export const AI_STRATEGIST_PROJECT_CONTEXT_ACCESS_POLICY: StrategistProjectContextAccessPolicy = {
  userOwnedContextOnly: true,
  explicitAppProvidedContextOnly: true,
  noSilentPrivateProjectReads: true,
  noCrossUserJobsOrPrompts: true,
  noCreditSpend: true,
  noAutoApplyGeneratorActions: true,
};
