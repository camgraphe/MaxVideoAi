import type { AiStrategistWorkflowId } from '../types';

export type StrategistKnowledgeSourceId =
  | 'ai_strategist_model_catalog'
  | 'ai_strategist_workflow_rules'
  | 'ai_strategist_prompt_structures'
  | 'engine_catalog'
  | 'maxvideoai_ecosystem_map'
  | 'site_navigation_map'
  | 'examples_catalog'
  | 'project_context'
  | 'docs_rag';

export type StrategistKnowledgeToolName =
  | 'capability_help'
  | 'site_overview'
  | 'model_info'
  | 'model_comparison'
  | 'engine_pricing'
  | 'engine_settings'
  | 'workflow_help'
  | 'navigation_help'
  | 'examples_help'
  | 'prompt_guidance'
  | 'project_context_help'
  | 'docs_search';

export type StrategistKnowledgeSource = {
  id: StrategistKnowledgeSourceId;
  label: string;
  path?: string;
  url?: string;
};

export type StrategistKnowledgeUiAction = {
  type:
    | 'SET_MODEL'
    | 'SET_WORKFLOW'
    | 'SET_PROMPT'
    | 'SET_NEGATIVE_PROMPT'
    | 'SET_ASPECT_RATIO'
    | 'SET_DURATION'
    | 'SET_RESOLUTION';
  value: string;
};

export type StrategistKnowledgeToolResult = {
  toolName: StrategistKnowledgeToolName;
  answer: string;
  sources: StrategistKnowledgeSource[];
  confidence: number;
  limitations: string[];
  warnings: string[];
  uiActions: StrategistKnowledgeUiAction[];
};

export type StrategistKnowledgeToolInput = {
  rawUserMessage: string;
  selectedWorkflow?: AiStrategistWorkflowId;
};
