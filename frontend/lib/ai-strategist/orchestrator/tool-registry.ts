import type {
  StrategistOrchestratorTask,
  StrategistToolName,
} from './types';

const toolsByTask: Record<StrategistOrchestratorTask, readonly StrategistToolName[]> = {
  new_video_brief: ['conversation_planner', 'brief_refinement', 'model_recommendation'],
  model_or_tier_selection: ['conversation_planner', 'model_selection', 'brief_refinement', 'prompt_context', 'brief_completion'],
  prompt_edit_intake: ['conversation_planner'],
  prompt_edit: ['conversation_planner', 'brief_refinement', 'prompt_context', 'brief_completion', 'prompt_writer', 'validation'],
  prompt_build: ['conversation_planner', 'brief_refinement', 'prompt_context', 'brief_completion', 'prompt_writer', 'validation'],
  model_advice: ['conversation_planner', 'brief_refinement', 'model_recommendation'],
  model_info_help: ['conversation_planner', 'model_info'],
  examples_help: ['conversation_planner', 'examples_help'],
  pricing_help: ['conversation_planner', 'pricing_help'],
  site_help: ['conversation_planner', 'product_help'],
  site_overview_help: ['conversation_planner', 'site_overview_help'],
  capability_help: ['conversation_planner', 'capability_help'],
  navigation_help: ['conversation_planner', 'navigation_help'],
  workflow_help: ['conversation_planner', 'workflow_help'],
  asset_reference_help: ['conversation_planner', 'asset_reference_help'],
  clarification: ['conversation_planner'],
  unknown: ['conversation_planner'],
};

export function selectStrategistTools(task: StrategistOrchestratorTask): StrategistToolName[] {
  return [...toolsByTask[task]];
}
