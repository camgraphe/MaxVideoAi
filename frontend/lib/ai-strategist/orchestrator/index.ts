import {
  resolveStrategistStage,
  resolveStrategistTask,
} from './intent-router';
import { selectStrategistLlmRouting } from './cost-router';
import { selectStrategistTools } from './tool-registry';
import type {
  StrategistOrchestrationPlan,
  StrategistOrchestratorInput,
} from './types';

export type {
  StrategistLlmRoutingPlan,
  StrategistLlmTier,
  StrategistOrchestrationPlan,
  StrategistOrchestratorInput,
  StrategistOrchestratorStage,
  StrategistOrchestratorTask,
  StrategistToolName,
} from './types';
export { shouldDisableBriefLlm } from './cost-router';

export function createStrategistOrchestrationPlan(
  input: StrategistOrchestratorInput
): StrategistOrchestrationPlan {
  const task = resolveStrategistTask(input);
  const stage = resolveStrategistStage({
    action: input.conversationPlan.action,
    task,
    surface: input.surface,
  });
  const toolCalls = selectStrategistTools(task);
  const llm = selectStrategistLlmRouting({ task, orchestratorInput: input });

  return {
    task,
    stage,
    rawUserMessage: input.rawUserMessage?.trim() ?? '',
    resolvedBrief: input.conversationPlan.resolvedBrief,
    selectedTier: input.conversationPlan.selectedTier,
    selectedModel: input.conversationPlan.selectedModel ?? input.selectedModel,
    selectedWorkflow: input.conversationPlan.selectedWorkflow ?? input.selectedWorkflow,
    shouldUsePreviousBrief: input.conversationPlan.shouldUsePreviousBrief,
    shouldUseCurrentPrompt: input.conversationPlan.shouldUseCurrentPrompt,
    shouldAskQuestion: input.conversationPlan.action === 'ask_clarification',
    shouldBuildPrompt: task === 'prompt_build' || task === 'prompt_edit' || task === 'model_or_tier_selection',
    shouldShowModelCards: task === 'new_video_brief' || task === 'model_advice',
    toolCalls,
    llm,
    confidence: input.conversationPlan.confidence,
  };
}
