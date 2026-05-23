import type {
  StrategistConversationPlan,
  StrategistConversationState,
} from '../conversation-planner';
import type {
  AiStrategistModelId,
  AiStrategistTierPosition,
  AiStrategistWorkflowId,
} from '../types';

export type StrategistOrchestratorTask =
  | 'new_video_brief'
  | 'model_or_tier_selection'
  | 'prompt_edit_intake'
  | 'prompt_edit'
  | 'prompt_build'
  | 'model_advice'
  | 'model_info_help'
  | 'pricing_help'
  | 'site_help'
  | 'site_overview_help'
  | 'capability_help'
  | 'navigation_help'
  | 'workflow_help'
  | 'asset_reference_help'
  | 'clarification'
  | 'unknown';

export type StrategistOrchestratorStage =
  | 'understanding'
  | 'recommending'
  | 'awaiting_choice'
  | 'awaiting_user_input'
  | 'collecting_details'
  | 'confirming'
  | 'writing_prompt'
  | 'answering_help'
  | 'ready';

export type StrategistLlmTier = 'none' | 'cheap' | 'strong';

export type StrategistToolName =
  | 'conversation_planner'
  | 'brief_refinement'
  | 'model_recommendation'
  | 'model_info'
  | 'model_selection'
  | 'prompt_context'
  | 'brief_completion'
  | 'prompt_writer'
  | 'product_help'
  | 'site_overview_help'
  | 'capability_help'
  | 'navigation_help'
  | 'pricing_help'
  | 'workflow_help'
  | 'asset_reference_help'
  | 'validation';

export type StrategistLlmRoutingPlan = {
  briefRefinement: StrategistLlmTier;
  promptWriter: StrategistLlmTier;
  reason: string;
};

export type StrategistOrchestrationPlan = {
  task: StrategistOrchestratorTask;
  stage: StrategistOrchestratorStage;
  rawUserMessage: string;
  resolvedBrief?: string;
  selectedTier?: AiStrategistTierPosition;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  shouldUsePreviousBrief: boolean;
  shouldUseCurrentPrompt: boolean;
  shouldAskQuestion: boolean;
  shouldBuildPrompt: boolean;
  shouldShowModelCards: boolean;
  toolCalls: StrategistToolName[];
  llm: StrategistLlmRoutingPlan;
  confidence: number;
};

export type StrategistOrchestratorInput = {
  rawUserMessage?: string;
  mode?: 'recommend' | 'build_prompt' | 'improve_prompt' | 'product_help';
  surface?: 'chat' | 'debug';
  currentPrompt?: string;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  uploadedAsset?: {
    type?: string;
    hasPerson?: boolean;
    hasProduct?: boolean;
    hasLogo?: boolean;
    hasText?: boolean;
    isReferenceImage?: boolean;
  };
  conversationState?: StrategistConversationState;
  conversationPlan: StrategistConversationPlan;
};
