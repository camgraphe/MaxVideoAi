export type AiStrategistTierPosition = 'best' | 'medium' | 'value';

export type AiStrategistWorkflowId =
  | 'text-to-video'
  | 'image-to-video'
  | 'text-to-image-then-image-to-video'
  | 'video-to-video';

export type AiStrategistPromptStructureId =
  | 'product-ad'
  | 'cinematic-scene'
  | 'social-ad'
  | 'character-scene'
  | 'brand-asset';

export type AiStrategistModelId =
  | 'seedance-2-0-fast'
  | 'seedance-2-0'
  | 'kling-3-standard'
  | 'kling-3-pro'
  | 'kling-3-4k'
  | 'veo-3-1-fast'
  | 'veo-3-1-lite'
  | 'veo-3-1'
  | 'happy-horse-1-0'
  | 'ltx-2-3'
  | 'hailuo'
  | 'pika'
  | 'sora';

export type AiStrategistRelativeCostLevel = 'low' | 'medium' | 'high' | 'premium';
export type AiStrategistRelativeSpeedLevel = 'slow' | 'medium' | 'fast' | 'very-fast';
export type AiStrategistQualityLevel = 'draft' | 'standard' | 'high' | 'premium';
export type AiStrategistScore = 1 | 2 | 3 | 4 | 5;

export type AiStrategistBudgetPriority = 'value' | 'balanced' | 'quality';
export type AiStrategistSpeedPriority = 'low' | 'medium' | 'high';
export type AiStrategistQualityPriority = 'draft' | 'balanced' | 'maximum';
export type AiStrategistSourceImageKind =
  | 'product'
  | 'generic'
  | 'uploaded-person'
  | 'uploaded-character'
  | 'generated-person'
  | 'generated-character';
export type AiStrategistPersonImageCompatibility = 'safe' | 'conditional' | 'avoid' | 'experimental';

export interface AiStrategistModelEntry {
  id: AiStrategistModelId;
  label: string;
  tierPosition: AiStrategistTierPosition;
  supportedWorkflows: readonly AiStrategistWorkflowId[];
  bestFor: readonly string[];
  avoidFor: readonly string[];
  strengths: readonly string[];
  weaknesses: readonly string[];
  promptStyle: string;
  recommendedUseCases: readonly AiStrategistPromptStructureId[];
  relativeCostLevel: AiStrategistRelativeCostLevel;
  relativeSpeedLevel: AiStrategistRelativeSpeedLevel;
  qualityLevel: AiStrategistQualityLevel;
  realismScore: AiStrategistScore;
  motionScore: AiStrategistScore;
  productDetailScore: AiStrategistScore;
  socialAdScore: AiStrategistScore;
  promptGuidance: readonly string[];
  negativePromptGuidance: readonly string[];
  appEngineAliases?: readonly string[];
  personImageToVideoCompatibility?: AiStrategistPersonImageCompatibility;
  routingNotes?: readonly string[];
}

export interface AiStrategistWorkflowRule {
  id: AiStrategistWorkflowId;
  label: string;
  description: string;
  bestFor: readonly string[];
  avoidFor: readonly string[];
  recommendedPromptStructures: readonly AiStrategistPromptStructureId[];
  planningSteps: readonly string[];
  tierGuidance: Record<AiStrategistTierPosition, string>;
}

export interface AiStrategistPromptStructure {
  id: AiStrategistPromptStructureId;
  label: string;
  goal: string;
  bestFor: readonly string[];
  requiredInputs: readonly string[];
  sections: readonly AiStrategistPromptSection[];
  modelAdaptationHints: readonly string[];
  negativePromptChecklist: readonly string[];
}

export interface AiStrategistPromptSection {
  label: string;
  instruction: string;
}

export interface AiStrategistBrief {
  goal?: string;
  workflow?: AiStrategistWorkflowId;
  promptStructure?: AiStrategistPromptStructureId;
  budgetPriority?: AiStrategistBudgetPriority;
  speedPriority?: AiStrategistSpeedPriority;
  qualityPriority?: AiStrategistQualityPriority;
  requiredTraits?: readonly string[];
  sourceImageKind?: AiStrategistSourceImageKind;
  sourceImageGeneratedInWorkflow?: boolean;
}

export type AiStrategistBriefInput = string | AiStrategistBrief;

export interface AiStrategistRecommendation {
  model: AiStrategistModelEntry;
  reason: string;
  matchedSignals: readonly string[];
  warning?: string;
  upgradeNote?: string;
}

export interface AiStrategistAlsoConsider {
  model: AiStrategistModelEntry;
  reason: string;
  matchedSignals: readonly string[];
}

export interface AiStrategistRecommendations {
  best: AiStrategistRecommendation;
  medium: AiStrategistRecommendation;
  value: AiStrategistRecommendation;
  alsoConsider?: readonly AiStrategistAlsoConsider[];
}
