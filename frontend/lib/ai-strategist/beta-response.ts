import type { AiStrategistPlaygroundResult } from './playground-pipeline';

export type AiStrategistBetaResponse = {
  ok: true;
  assistantMessage: AiStrategistPlaygroundResult['assistantMessage'];
  mode: AiStrategistPlaygroundResult['mode'];
  workflow: AiStrategistPlaygroundResult['workflow'];
  selectedModel: AiStrategistPlaygroundResult['selectedModel'];
  selectedTier: AiStrategistPlaygroundResult['selectedTier'];
  normalizedBrief: AiStrategistPlaygroundResult['normalizedBrief'];
  normalizationSource: AiStrategistPlaygroundResult['normalizationSource'];
  normalizationConfidence: AiStrategistPlaygroundResult['normalizationConfidence'];
  conversationStage: AiStrategistPlaygroundResult['conversationStage'];
  conversationPlan: AiStrategistPlaygroundResult['conversationPlan'];
  orchestrationPlan: AiStrategistPlaygroundResult['orchestrationPlan'];
  briefCompletion?: AiStrategistPlaygroundResult['briefCompletion'];
  clarificationQuestion?: AiStrategistPlaygroundResult['clarificationQuestion'];
  navigationSuggestion?: AiStrategistPlaygroundResult['navigationSuggestion'];
  recommendations?: AiStrategistPlaygroundResult['recommendations'];
  alsoConsider?: AiStrategistPlaygroundResult['alsoConsider'];
  warnings: AiStrategistPlaygroundResult['warnings'];
  promptGenerationContextSummary?: AiStrategistPlaygroundResult['promptGenerationContextSummary'];
  sanitizedFinalOutput?: AiStrategistPlaygroundResult['sanitizedFinalOutput'];
  uiActions: AiStrategistPlaygroundResult['uiActions'];
  llm: {
    briefRefinementUsed: boolean;
    promptWriterUsed: boolean;
    promptWriterFallbackReason?: string;
    sanitizerChangedOutput: boolean;
  };
  llmCost: AiStrategistPlaygroundResult['llmCost'];
  safety: AiStrategistPlaygroundResult['safety'];
};

export function toAiStrategistBetaResponse(result: AiStrategistPlaygroundResult): AiStrategistBetaResponse {
  return {
    ok: true,
    assistantMessage: result.assistantMessage,
    mode: result.mode,
    workflow: result.workflow,
    selectedModel: result.selectedModel,
    selectedTier: result.selectedTier,
    normalizedBrief: result.normalizedBrief,
    normalizationSource: result.normalizationSource,
    normalizationConfidence: result.normalizationConfidence,
    conversationStage: result.conversationStage,
    conversationPlan: result.conversationPlan,
    orchestrationPlan: result.orchestrationPlan,
    ...(result.briefCompletion ? { briefCompletion: result.briefCompletion } : {}),
    ...(result.clarificationQuestion ? { clarificationQuestion: result.clarificationQuestion } : {}),
    ...(result.navigationSuggestion ? { navigationSuggestion: result.navigationSuggestion } : {}),
    ...(result.recommendations ? { recommendations: result.recommendations } : {}),
    ...(result.alsoConsider ? { alsoConsider: result.alsoConsider } : {}),
    warnings: result.warnings,
    ...(result.promptGenerationContextSummary
      ? { promptGenerationContextSummary: result.promptGenerationContextSummary }
      : {}),
    ...(result.sanitizedFinalOutput ? { sanitizedFinalOutput: result.sanitizedFinalOutput } : {}),
    uiActions: result.uiActions,
    llm: {
      briefRefinementUsed: result.llm.briefRefinement.used,
      promptWriterUsed: result.llm.promptWriter.used,
      ...(result.llm.promptWriter.fallbackReason
        ? { promptWriterFallbackReason: result.llm.promptWriter.fallbackReason }
        : {}),
      sanitizerChangedOutput: result.llm.promptWriter.sanitizerChangedOutput,
    },
    llmCost: result.llmCost,
    safety: result.safety,
  };
}
