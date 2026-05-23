import type {
  AiStrategistBriefRefinementConversationContext,
  AiStrategistNormalizedBrief,
} from './brief-normalization';
import {
  assessStrategistBriefCompletion,
  type StrategistBriefCompletionResult,
} from './brief-completion';
import {
  planStrategistConversation,
  type StrategistConversationPlan,
  type StrategistConversationState,
  type StrategistChatStage,
} from './conversation-planner';
import {
  runBriefRefinementLLM,
  runPromptWriterLLM,
  type AiStrategistBriefRefinementLLMResult,
  type AiStrategistLLMRunOptions,
  type AiStrategistPromptWriterLLMResult,
  type AiStrategistPromptWriterOutput,
} from './llm-adapter';
import { AI_STRATEGIST_MODELS } from './model-catalog';
import {
  createStrategistOrchestrationPlan,
  shouldDisableBriefLlm,
  type StrategistOrchestrationPlan,
} from './orchestrator';
import {
  isStrategistAdvisorHelpTask,
  runStrategistAdvisorHelpTool,
} from './orchestrator/advisor-tools';
import {
  runStrategistKnowledgeTool,
} from './knowledge/tool-router';
import type { StrategistKnowledgeToolResult } from './knowledge/types';
import {
  buildPromptGenerationContext,
  type AiStrategistPromptGenerationContext,
} from './prompt-structures';
import { recommendModelsForBrief } from './recommendation-rules';
import type {
  AiStrategistBrief,
  AiStrategistBudgetPriority,
  AiStrategistModelId,
  AiStrategistPromptStructureId,
  AiStrategistQualityPriority,
  AiStrategistRecommendations,
  AiStrategistSourceImageKind,
  AiStrategistSpeedPriority,
  AiStrategistTierPosition,
  AiStrategistWorkflowId,
} from './types';
import { AI_STRATEGIST_WORKFLOWS } from './workflow-rules';

export type AiStrategistPlaygroundMode = 'recommend' | 'build_prompt' | 'improve_prompt' | 'product_help';
export type AiStrategistPlaygroundSurface = 'chat' | 'debug';

export type AiStrategistPlaygroundUploadedAsset = {
  type?: string;
  hasPerson?: boolean;
  hasProduct?: boolean;
  hasLogo?: boolean;
  hasText?: boolean;
  isReferenceImage?: boolean;
};

export type AiStrategistPlaygroundInput = {
  userMessage?: string;
  mode?: AiStrategistPlaygroundMode;
  surface?: AiStrategistPlaygroundSurface;
  selectedTier?: AiStrategistTierPosition;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  pageContext?: unknown;
  currentPrompt?: string;
  uploadedAsset?: AiStrategistPlaygroundUploadedAsset;
  conversationState?: StrategistConversationState;
};

export type AiStrategistPlaygroundPromptContextSummary = {
  selectedModel: string;
  selectedWorkflow: AiStrategistWorkflowId;
  promptStructure: AiStrategistPromptStructureId;
  modelPagePromptStructureSource: string;
  workflowBlocks: string[];
  warnings: string[];
  durationGuidance: AiStrategistPromptGenerationContext['durationGuidance'];
  priceEstimate: AiStrategistPromptGenerationContext['priceEstimate'];
  settingsGuidance: string[];
  maxVideoAiRules: string[];
};

export type AiStrategistPlaygroundResult = {
  ok: true;
  assistantMessage: string;
  mode: AiStrategistPlaygroundMode;
  workflow: AiStrategistWorkflowId | null;
  selectedModel: string | null;
  selectedTier: AiStrategistTierPosition;
  normalizedBrief: AiStrategistNormalizedBrief;
  normalizationSource: AiStrategistBriefRefinementLLMResult['source'];
  normalizationConfidence: number;
  conversationStage: StrategistChatStage;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
  knowledgeToolResults?: StrategistKnowledgeToolResult[];
  briefCompletion?: StrategistBriefCompletionResult;
  clarificationQuestion?: string;
  navigationSuggestion?: StrategistConversationPlan['navigationSuggestion'];
  recommendations?: AiStrategistRecommendations;
  alsoConsider?: AiStrategistRecommendations['alsoConsider'];
  warnings: string[];
  promptGenerationContext?: AiStrategistPromptGenerationContext;
  promptGenerationContextSummary?: AiStrategistPlaygroundPromptContextSummary;
  rawLlmOutput?: unknown;
  sanitizedFinalOutput?: AiStrategistPromptWriterOutput;
  validationIssuesBeforeSanitizer: {
    brief: AiStrategistBriefRefinementLLMResult['validation']['issues'];
    prompt: AiStrategistPromptWriterLLMResult['validationBeforeSanitizer']['issues'];
  };
  validationIssuesAfterSanitizer: {
    brief: AiStrategistBriefRefinementLLMResult['validation']['issues'];
    prompt: AiStrategistPromptWriterLLMResult['validationAfterSanitizer']['issues'];
  };
  uiActions: AiStrategistPromptWriterOutput['uiActions'];
  llm: {
    briefRefinement: {
      used: boolean;
      source: AiStrategistBriefRefinementLLMResult['source'];
      provider?: string;
      model?: string;
      fallbackReason?: string;
      error?: string;
    };
    promptWriter: {
      used: boolean;
      source: AiStrategistPromptWriterLLMResult['source'];
      provider?: string;
      model?: string;
      fallbackReason?: string;
      error?: string;
      sanitizerChangedOutput: boolean;
    };
  };
  safety: {
    autoGeneration: false;
    creditSpend: false;
    publishing: false;
    uiActionsApplied: false;
  };
};

const validModes = new Set<AiStrategistPlaygroundMode>(['recommend', 'build_prompt', 'improve_prompt', 'product_help']);
const validTiers = new Set<AiStrategistTierPosition>(['best', 'medium', 'value']);
const validModelIds = new Set<AiStrategistModelId>(AI_STRATEGIST_MODELS.map((model) => model.id));
const validWorkflowIds = new Set<AiStrategistWorkflowId>(AI_STRATEGIST_WORKFLOWS.map((workflow) => workflow.id));
const validChatStages = new Set<StrategistChatStage>([
  'collecting_brief',
  'recommending_models',
  'awaiting_model_choice',
  'awaiting_prompt_paste',
  'collecting_missing_fields',
  'awaiting_confirmation',
  'building_prompt',
  'prompt_ready',
]);

const productTerms = [
  'product',
  'packshot',
  'packaging',
  'package',
  'ecommerce',
  'perfume',
  'skincare',
  'jewelry',
  'jewellery',
  'sneaker',
  'sneakers',
  'shoe',
  'watch',
  'car',
  'car commercial',
  'voiture',
  'auto',
  'glass',
  'bottle',
  'drink',
  'beverage',
  'can',
  'energy drink',
  'makeup',
  'cosmetic',
] as const;

export async function runAiStrategistPlaygroundPipeline(
  input: AiStrategistPlaygroundInput,
  options: AiStrategistLLMRunOptions = {}
): Promise<AiStrategistPlaygroundResult> {
  const initialBody = normalizePlaygroundInput(input);
  const conversationPlan = planStrategistConversation({
    rawUserMessage: initialBody.userMessage,
    currentPrompt: initialBody.currentPrompt,
    selectedModel: initialBody.selectedModel,
    selectedWorkflow: initialBody.selectedWorkflow,
    uploadedAsset: initialBody.uploadedAsset,
    conversationState: initialBody.conversationState,
  });
  const orchestrationPlan = createStrategistOrchestrationPlan({
    rawUserMessage: initialBody.userMessage,
    mode: initialBody.mode,
    surface: initialBody.surface,
    currentPrompt: initialBody.currentPrompt,
    selectedModel: initialBody.selectedModel,
    selectedWorkflow: initialBody.selectedWorkflow,
    uploadedAsset: initialBody.uploadedAsset,
    conversationState: initialBody.conversationState,
    conversationPlan,
  });
  const body = applyConversationPlan(initialBody, conversationPlan);
  const refinement = await runBriefRefinementLLM(
    {
      rawUserMessage: body.userMessage,
      mode: body.mode,
      pageContext: body.pageContext,
      currentPrompt: body.currentPrompt || undefined,
      uploadedAsset: body.uploadedAsset,
      selectedModel: body.selectedModel,
      selectedWorkflow: body.selectedWorkflow,
      conversationContext: buildBriefRefinementConversationContext(initialBody, conversationPlan),
    },
    buildBriefLlmOptions(options, orchestrationPlan)
  );
  const normalizedBrief = refinement.output;
  const effectiveMode = body.mode === 'recommend' && normalizedBrief.intent === 'product_help' && !asksForModelChoice(body)
    ? 'product_help'
    : body.mode;

  if (conversationPlan.action === 'ask_clarification') {
    return buildClarificationResult({ body, refinement, normalizedBrief, effectiveMode, conversationPlan, orchestrationPlan });
  }

  if (isStrategistAdvisorHelpTask(orchestrationPlan.task)) {
    return buildOrchestratedHelpResult({ body, refinement, normalizedBrief, conversationPlan, orchestrationPlan });
  }

  if (conversationPlan.action === 'navigation_help') {
    return buildNavigationHelpResult({ body, refinement, normalizedBrief, conversationPlan, orchestrationPlan });
  }

  if (conversationPlan.action === 'await_prompt_paste') {
    return buildPromptPasteRequestResult({ body, refinement, normalizedBrief, conversationPlan, orchestrationPlan });
  }

  if (shouldAskClarification(normalizedBrief, body)) {
    return buildClarificationResult({ body, refinement, normalizedBrief, effectiveMode, conversationPlan, orchestrationPlan });
  }

  if (effectiveMode === 'product_help' && !asksForModelChoice(body)) {
    return buildProductHelpResult({ body, refinement, normalizedBrief, conversationPlan, orchestrationPlan });
  }

  const workflow = body.selectedWorkflow ?? normalizedBrief.workflowHint ?? inferWorkflow(body, normalizedBrief);
  const promptStructure = inferPromptStructure(body, normalizedBrief);
  const sourceImageKind = inferSourceImageKind(body.uploadedAsset);
  const goal = normalizedBrief.confidence >= 0.55 ? normalizedBrief.normalizedBrief : buildGoal(body);
  const brief: AiStrategistBrief = {
    goal,
    workflow,
    promptStructure,
    sourceImageKind,
    budgetPriority: inferBudgetPriority(normalizedBrief),
    speedPriority: inferSpeedPriority(normalizedBrief),
    qualityPriority: inferQualityPriority(normalizedBrief),
    requiredTraits: buildRequiredTraits(body, normalizedBrief),
  };
  const recommendations = recommendModelsForBrief(brief);
  if (shouldReturnChatRecommendationsOnly({ body, effectiveMode, conversationPlan })) {
    return buildRecommendationOnlyResult({
      body,
      refinement,
      normalizedBrief,
      conversationPlan,
      orchestrationPlan,
      recommendations,
      workflow,
    });
  }

  const selectedTier = body.selectedTier;
  const selectedModelId = body.selectedModel ?? recommendations[selectedTier].model.id;
  const selectedTierForGuidance = conversationPlan.selectedTier ?? (body.selectedModel ? undefined : selectedTier);
  const promptBrief = buildPromptBrief({ body, goal, mode: effectiveMode });
  const promptGenerationContext = buildPromptGenerationContext({
    modelId: selectedModelId,
    promptStructureId: promptStructure,
    brief: promptBrief,
    workflow,
    selectedTier: selectedTierForGuidance,
    sourceImageKind,
    currentPrompt: body.currentPrompt || undefined,
    uploadedAsset: body.uploadedAsset,
  });

  const briefCompletion = assessStrategistBriefCompletion({
    resolvedBrief: promptBrief,
    normalizedBrief,
    promptGenerationContext,
    selectedTier: selectedTierForGuidance,
    allowAssumptions: shouldAllowBriefAssumptions(initialBody),
  });

  if (shouldGateChatPromptGeneration({ body, effectiveMode, initialBody })) {
    if (!isPromptGenerationConfirmed(initialBody)) {
      if (briefCompletion.status === 'needs_info') {
        return buildBriefCompletionResult({
          body,
          refinement,
          normalizedBrief,
          conversationPlan,
          orchestrationPlan,
          recommendations,
          workflow,
          selectedModelId,
          selectedTier,
          promptGenerationContext,
          briefCompletion,
        });
      }

      return buildConfirmationResult({
        body,
        refinement,
        normalizedBrief,
        conversationPlan,
        orchestrationPlan,
        recommendations,
        workflow,
        selectedModelId,
        selectedTier,
        promptGenerationContext,
        briefCompletion,
      });
    }
  }

  const promptWriter = await runPromptWriterLLM(promptGenerationContext, options);
  const uiActions = buildPreviewUiActions({
    output: promptWriter.output,
    selectedModelId,
    workflow,
    durationGuidance: promptGenerationContext.durationGuidance,
  });
  const warnings = uniqueStrings([
    recommendations.best.warning,
    recommendations.medium.warning,
    recommendations.value.warning,
    ...(promptWriter.output.warnings ?? []),
    ...promptGenerationContext.warnings.all,
  ]);

  return {
    ok: true,
    assistantMessage: promptWriter.output.assistantMessage || buildAssistantMessage(effectiveMode, recommendations, selectedModelId),
    mode: effectiveMode,
    workflow,
    selectedModel: selectedModelId,
    selectedTier,
    normalizedBrief,
    normalizationSource: refinement.source,
    normalizationConfidence: normalizedBrief.confidence,
    conversationStage: 'prompt_ready',
    conversationPlan,
    orchestrationPlan,
    briefCompletion,
    ...(normalizedBrief.clarificationQuestion ? { clarificationQuestion: normalizedBrief.clarificationQuestion } : {}),
    recommendations,
    ...(recommendations.alsoConsider ? { alsoConsider: recommendations.alsoConsider } : {}),
    warnings,
    promptGenerationContext,
    promptGenerationContextSummary: summarizePromptGenerationContext(promptGenerationContext),
    rawLlmOutput: toJsonSafe(promptWriter.rawOutput),
    sanitizedFinalOutput: promptWriter.output,
    validationIssuesBeforeSanitizer: {
      brief: refinement.validation.issues,
      prompt: promptWriter.validationBeforeSanitizer.issues,
    },
    validationIssuesAfterSanitizer: {
      brief: refinement.validation.issues,
      prompt: promptWriter.validationAfterSanitizer.issues,
    },
    uiActions,
    llm: buildLlmSummary(refinement, promptWriter),
    safety: playgroundSafety(),
  };
}

export function isAiStrategistPlaygroundEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.AI_STRATEGIST_PLAYGROUND_ENABLED === '1';
}

function buildBriefLlmOptions(
  options: AiStrategistLLMRunOptions,
  orchestrationPlan: StrategistOrchestrationPlan
): AiStrategistLLMRunOptions {
  if (!shouldDisableBriefLlm(orchestrationPlan.llm.briefRefinement)) return options;
  return {
    ...options,
    disableLLM: true,
    disableReason: 'orchestrator_no_brief_llm',
  };
}

function normalizePlaygroundInput(input: AiStrategistPlaygroundInput): Required<Pick<AiStrategistPlaygroundInput, 'mode' | 'selectedTier' | 'userMessage'>> &
  Omit<AiStrategistPlaygroundInput, 'mode' | 'selectedTier' | 'userMessage'> {
  return {
    userMessage: textOrEmpty(input.userMessage),
    mode: normalizeMode(input.mode),
    surface: normalizeSurface(input.surface),
    selectedTier: normalizeTier(input.selectedTier),
    selectedModel: normalizeModelId(input.selectedModel),
    selectedWorkflow: normalizeWorkflow(input.selectedWorkflow),
    pageContext: input.pageContext,
    currentPrompt: textOrEmpty(input.currentPrompt),
    uploadedAsset: normalizeUploadedAsset(input.uploadedAsset),
    conversationState: normalizeConversationState(input.conversationState),
  };
}

function applyConversationPlan(
  body: ReturnType<typeof normalizePlaygroundInput>,
  plan: StrategistConversationPlan
): ReturnType<typeof normalizePlaygroundInput> {
  if (plan.action === 'select_model' || plan.action === 'select_tier' || plan.action === 'build_prompt') {
    return {
      ...body,
      mode: 'build_prompt',
      userMessage: plan.resolvedBrief ?? body.userMessage,
      selectedTier: plan.selectedTier ?? body.selectedTier,
      selectedModel: plan.selectedModel ?? body.selectedModel,
      selectedWorkflow: plan.selectedWorkflow ?? body.selectedWorkflow,
    };
  }

  if (plan.action === 'improve_prompt') {
    return {
      ...body,
      mode: 'improve_prompt',
      userMessage: plan.resolvedBrief ?? (body.userMessage || 'Make this better.'),
      currentPrompt: plan.currentPrompt ?? (body.currentPrompt || body.conversationState?.lastFinalPrompt || ''),
      selectedModel: plan.selectedModel ?? body.selectedModel,
      selectedWorkflow: plan.selectedWorkflow ?? body.selectedWorkflow,
    };
  }

  if (plan.action === 'product_help' || plan.action === 'navigation_help') {
    return {
      ...body,
      mode: 'product_help',
      selectedWorkflow: plan.selectedWorkflow ?? body.selectedWorkflow,
    };
  }

  return {
    ...body,
    userMessage: plan.resolvedBrief ?? body.userMessage,
    selectedModel: plan.selectedModel ?? body.selectedModel,
    selectedWorkflow: plan.selectedWorkflow ?? body.selectedWorkflow,
  };
}

function buildClarificationResult(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  refinement: AiStrategistBriefRefinementLLMResult;
  normalizedBrief: AiStrategistNormalizedBrief;
  effectiveMode: AiStrategistPlaygroundMode;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
}): AiStrategistPlaygroundResult {
  return {
    ok: true,
    assistantMessage: input.conversationPlan.clarificationQuestion ?? input.normalizedBrief.clarificationQuestion ?? 'Can you clarify what video you want to create?',
    mode: input.effectiveMode,
    workflow: null,
    selectedModel: input.conversationPlan.selectedModel ?? input.body.selectedModel ?? null,
    selectedTier: input.body.selectedTier,
    normalizedBrief: input.normalizedBrief,
    normalizationSource: input.refinement.source,
    normalizationConfidence: input.normalizedBrief.confidence,
    conversationStage: 'collecting_brief',
    conversationPlan: input.conversationPlan,
    orchestrationPlan: input.orchestrationPlan,
    ...(input.conversationPlan.clarificationQuestion || input.normalizedBrief.clarificationQuestion
      ? { clarificationQuestion: input.conversationPlan.clarificationQuestion ?? input.normalizedBrief.clarificationQuestion }
      : {}),
    warnings: [],
    validationIssuesBeforeSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    validationIssuesAfterSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    uiActions: [],
    llm: {
      briefRefinement: summarizeBriefLlm(input.refinement),
      promptWriter: {
        used: false,
        source: 'deterministic_fallback',
        fallbackReason: 'clarification_required',
        sanitizerChangedOutput: false,
      },
    },
    safety: playgroundSafety(),
  };
}

function buildProductHelpResult(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  refinement: AiStrategistBriefRefinementLLMResult;
  normalizedBrief: AiStrategistNormalizedBrief;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
}): AiStrategistPlaygroundResult {
  return {
    ok: true,
    assistantMessage: buildProductHelpMessage(input.body),
    mode: 'product_help',
    workflow: input.body.selectedWorkflow ?? null,
    selectedModel: input.body.selectedModel ?? null,
    selectedTier: input.body.selectedTier,
    normalizedBrief: input.normalizedBrief,
    normalizationSource: input.refinement.source,
    normalizationConfidence: input.normalizedBrief.confidence,
    conversationStage: 'collecting_brief',
    conversationPlan: input.conversationPlan,
    orchestrationPlan: input.orchestrationPlan,
    ...(input.normalizedBrief.clarificationQuestion ? { clarificationQuestion: input.normalizedBrief.clarificationQuestion } : {}),
    warnings: [],
    validationIssuesBeforeSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    validationIssuesAfterSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    uiActions: [],
    llm: {
      briefRefinement: summarizeBriefLlm(input.refinement),
      promptWriter: {
        used: false,
        source: 'deterministic_fallback',
        fallbackReason: 'product_help_no_prompt_writer',
        sanitizerChangedOutput: false,
      },
    },
    safety: playgroundSafety(),
  };
}

function buildOrchestratedHelpResult(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  refinement: AiStrategistBriefRefinementLLMResult;
  normalizedBrief: AiStrategistNormalizedBrief;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
}): AiStrategistPlaygroundResult {
  const knowledgeToolResult = runStrategistKnowledgeTool({
    task: input.orchestrationPlan.task,
    toolInput: {
      rawUserMessage: input.body.userMessage,
      selectedWorkflow: input.body.selectedWorkflow,
    },
  });
  const toolResult = runStrategistAdvisorHelpTool({
    task: input.orchestrationPlan.task,
    rawUserMessage: input.body.userMessage,
    selectedModel: input.body.selectedModel,
    selectedWorkflow: input.body.selectedWorkflow,
    conversationPlan: input.conversationPlan,
  });

  return {
    ok: true,
    assistantMessage: knowledgeToolResult?.answer ?? toolResult.assistantMessage,
    mode: 'product_help',
    workflow: null,
    selectedModel: toolResult.selectedModel ?? input.body.selectedModel ?? null,
    selectedTier: input.body.selectedTier,
    normalizedBrief: input.normalizedBrief,
    normalizationSource: input.refinement.source,
    normalizationConfidence: input.normalizedBrief.confidence,
    conversationStage: 'collecting_brief',
    conversationPlan: input.conversationPlan,
    orchestrationPlan: input.orchestrationPlan,
    ...(toolResult.navigationSuggestion ? { navigationSuggestion: toolResult.navigationSuggestion } : {}),
    ...(knowledgeToolResult ? { knowledgeToolResults: [knowledgeToolResult] } : {}),
    warnings: knowledgeToolResult?.warnings ?? toolResult.warnings,
    validationIssuesBeforeSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    validationIssuesAfterSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    uiActions: knowledgeToolResult?.uiActions ?? toolResult.uiActions,
    llm: {
      briefRefinement: summarizeBriefLlm(input.refinement),
      promptWriter: {
        used: false,
        source: 'deterministic_fallback',
        fallbackReason: 'orchestrator_help_tool',
        sanitizerChangedOutput: false,
      },
    },
    safety: playgroundSafety(),
  };
}

function buildNavigationHelpResult(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  refinement: AiStrategistBriefRefinementLLMResult;
  normalizedBrief: AiStrategistNormalizedBrief;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
}): AiStrategistPlaygroundResult {
  const suggestion = input.conversationPlan.navigationSuggestion;
  const assistantMessage = suggestion
    ? `${suggestion.reason} Suggested destination: ${suggestion.label} (${suggestion.href}). I will not navigate automatically.`
    : 'I can suggest where to go in MaxVideoAI, but I will not navigate automatically.';

  return {
    ok: true,
    assistantMessage,
    mode: 'product_help',
    workflow: input.body.selectedWorkflow ?? null,
    selectedModel: input.body.selectedModel ?? null,
    selectedTier: input.body.selectedTier,
    normalizedBrief: input.normalizedBrief,
    normalizationSource: input.refinement.source,
    normalizationConfidence: input.normalizedBrief.confidence,
    conversationStage: 'collecting_brief',
    conversationPlan: input.conversationPlan,
    orchestrationPlan: input.orchestrationPlan,
    ...(suggestion ? { navigationSuggestion: suggestion } : {}),
    warnings: [],
    validationIssuesBeforeSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    validationIssuesAfterSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    uiActions: [],
    llm: {
      briefRefinement: summarizeBriefLlm(input.refinement),
      promptWriter: {
        used: false,
        source: 'deterministic_fallback',
        fallbackReason: 'navigation_help_no_prompt_writer',
        sanitizerChangedOutput: false,
      },
    },
    safety: playgroundSafety(),
  };
}

function buildPromptPasteRequestResult(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  refinement: AiStrategistBriefRefinementLLMResult;
  normalizedBrief: AiStrategistNormalizedBrief;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
}): AiStrategistPlaygroundResult {
  const selectedModelId = input.conversationPlan.selectedModel ?? input.body.selectedModel ?? null;
  const selectedModel = selectedModelId ? AI_STRATEGIST_MODELS.find((model) => model.id === selectedModelId) : undefined;
  const assistantMessage = prefersFrenchResponse(input.body.userMessage)
    ? selectedModel
      ? `Oui, colle ton prompt ici. Je vais le relire pour ${selectedModel.label}, garder ton intention, puis améliorer la structure, la durée, le mouvement, la caméra, l’audio et les warnings utiles. Je ne lance pas de génération et je ne dépense pas de crédits.`
      : 'Oui, colle ton prompt ici. Je vais garder ton intention, puis améliorer la structure, la durée, le mouvement, la caméra, l’audio et les warnings utiles. Je ne lance pas de génération et je ne dépense pas de crédits.'
    : selectedModel
      ? `Paste the prompt here. I’ll review it for ${selectedModel.label}, keep your intent, then improve the structure, duration, motion, camera, audio, and useful warnings. I will not run generation or spend credits.`
      : 'Paste the prompt here. I’ll keep your intent, then improve the structure, duration, motion, camera, audio, and useful warnings. I will not run generation or spend credits.';

  return {
    ok: true,
    assistantMessage,
    mode: 'improve_prompt',
    workflow: input.body.selectedWorkflow ?? null,
    selectedModel: selectedModelId,
    selectedTier: input.body.selectedTier,
    normalizedBrief: input.normalizedBrief,
    normalizationSource: input.refinement.source,
    normalizationConfidence: input.normalizedBrief.confidence,
    conversationStage: 'awaiting_prompt_paste',
    conversationPlan: input.conversationPlan,
    orchestrationPlan: input.orchestrationPlan,
    warnings: [],
    validationIssuesBeforeSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    validationIssuesAfterSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    uiActions: selectedModelId ? [{ type: 'SET_MODEL', value: selectedModelId }] : [],
    llm: {
      briefRefinement: summarizeBriefLlm(input.refinement),
      promptWriter: {
        used: false,
        source: 'deterministic_fallback',
        fallbackReason: 'awaiting_prompt_paste',
        sanitizerChangedOutput: false,
      },
    },
    safety: playgroundSafety(),
  };
}

function prefersFrenchResponse(value: string): boolean {
  const text = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return containsAny(text, ['bonjour', 'salut', 'je ', 'j ai', 'j aimerai', 'peux', 'peut', 'colle', 'partager', 'ameliorer', 'améliorer', 'prompt seedance']);
}

function buildRecommendationOnlyResult(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  refinement: AiStrategistBriefRefinementLLMResult;
  normalizedBrief: AiStrategistNormalizedBrief;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
  recommendations: AiStrategistRecommendations;
  workflow: AiStrategistWorkflowId;
}): AiStrategistPlaygroundResult {
  const warnings = uniqueStrings([
    input.recommendations.best.warning,
    input.recommendations.medium.warning,
    input.recommendations.value.warning,
    ...buildLightweightRoutingWarnings(input.body, input.normalizedBrief),
  ]);

  return {
    ok: true,
    assistantMessage: buildRecommendationAssistantMessage(input.workflow, input.recommendations, input.orchestrationPlan.task),
    mode: 'recommend',
    workflow: input.workflow,
    selectedModel: null,
    selectedTier: input.body.selectedTier,
    normalizedBrief: input.normalizedBrief,
    normalizationSource: input.refinement.source,
    normalizationConfidence: input.normalizedBrief.confidence,
    conversationStage: 'awaiting_model_choice',
    conversationPlan: input.conversationPlan,
    orchestrationPlan: input.orchestrationPlan,
    recommendations: input.recommendations,
    ...(input.recommendations.alsoConsider ? { alsoConsider: input.recommendations.alsoConsider } : {}),
    warnings,
    validationIssuesBeforeSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    validationIssuesAfterSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    uiActions: [],
    llm: {
      briefRefinement: summarizeBriefLlm(input.refinement),
      promptWriter: {
        used: false,
        source: 'deterministic_fallback',
        fallbackReason: 'awaiting_model_choice',
        sanitizerChangedOutput: false,
      },
    },
    safety: playgroundSafety(),
  };
}

function buildLightweightRoutingWarnings(
  body: ReturnType<typeof normalizePlaygroundInput>,
  normalizedBrief: AiStrategistNormalizedBrief
): string[] {
  const text = buildSearchText(body);
  if (normalizedBrief.hasLogoOrTextRisk || containsAny(text, [
    'perfume',
    'bottle',
    'sneaker',
    'shoe',
    'car',
    'voiture',
    'packaging',
    'label',
    'logo',
    'legal copy',
    'tiny text',
    'plate',
    'badge',
  ])) {
    return [
      'Exact labels, logos, legal copy, packaging details, and tiny text may drift and should be checked after generation or added as overlays.',
    ];
  }
  return [];
}

function buildBriefCompletionResult(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  refinement: AiStrategistBriefRefinementLLMResult;
  normalizedBrief: AiStrategistNormalizedBrief;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
  recommendations: AiStrategistRecommendations;
  workflow: AiStrategistWorkflowId;
  selectedModelId: AiStrategistModelId;
  selectedTier: AiStrategistTierPosition;
  promptGenerationContext: AiStrategistPromptGenerationContext;
  briefCompletion: StrategistBriefCompletionResult;
}): AiStrategistPlaygroundResult {
  return buildStoppedBeforePromptResult({
    ...input,
    stage: 'collecting_missing_fields',
    assistantMessage: input.briefCompletion.assistantMessage,
    promptWriterFallbackReason: 'brief_completion_required',
  });
}

function buildConfirmationResult(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  refinement: AiStrategistBriefRefinementLLMResult;
  normalizedBrief: AiStrategistNormalizedBrief;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
  recommendations: AiStrategistRecommendations;
  workflow: AiStrategistWorkflowId;
  selectedModelId: AiStrategistModelId;
  selectedTier: AiStrategistTierPosition;
  promptGenerationContext: AiStrategistPromptGenerationContext;
  briefCompletion: StrategistBriefCompletionResult;
}): AiStrategistPlaygroundResult {
  return buildStoppedBeforePromptResult({
    ...input,
    stage: 'awaiting_confirmation',
    assistantMessage: input.briefCompletion.assistantMessage,
    promptWriterFallbackReason: 'awaiting_prompt_confirmation',
  });
}

function buildStoppedBeforePromptResult(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  refinement: AiStrategistBriefRefinementLLMResult;
  normalizedBrief: AiStrategistNormalizedBrief;
  conversationPlan: StrategistConversationPlan;
  orchestrationPlan: StrategistOrchestrationPlan;
  recommendations: AiStrategistRecommendations;
  workflow: AiStrategistWorkflowId;
  selectedModelId: AiStrategistModelId;
  selectedTier: AiStrategistTierPosition;
  promptGenerationContext: AiStrategistPromptGenerationContext;
  briefCompletion: StrategistBriefCompletionResult;
  stage: StrategistChatStage;
  assistantMessage: string;
  promptWriterFallbackReason: string;
}): AiStrategistPlaygroundResult {
  const warnings = uniqueStrings([
    input.recommendations.best.warning,
    input.recommendations.medium.warning,
    input.recommendations.value.warning,
    ...input.promptGenerationContext.warnings.all,
  ]);

  return {
    ok: true,
    assistantMessage: input.assistantMessage,
    mode: input.body.mode,
    workflow: input.workflow,
    selectedModel: input.selectedModelId,
    selectedTier: input.selectedTier,
    normalizedBrief: input.normalizedBrief,
    normalizationSource: input.refinement.source,
    normalizationConfidence: input.normalizedBrief.confidence,
    conversationStage: input.stage,
    conversationPlan: input.conversationPlan,
    orchestrationPlan: input.orchestrationPlan,
    briefCompletion: input.briefCompletion,
    recommendations: input.recommendations,
    ...(input.recommendations.alsoConsider ? { alsoConsider: input.recommendations.alsoConsider } : {}),
    warnings,
    promptGenerationContext: input.promptGenerationContext,
    promptGenerationContextSummary: summarizePromptGenerationContext(input.promptGenerationContext),
    validationIssuesBeforeSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    validationIssuesAfterSanitizer: {
      brief: input.refinement.validation.issues,
      prompt: [],
    },
    uiActions: [
      { type: 'SET_MODEL', value: input.selectedModelId },
      { type: 'SET_WORKFLOW', value: input.workflow },
      { type: 'SET_DURATION', value: `${input.promptGenerationContext.durationGuidance.seconds}s` },
    ],
    llm: {
      briefRefinement: summarizeBriefLlm(input.refinement),
      promptWriter: {
        used: false,
        source: 'deterministic_fallback',
        fallbackReason: input.promptWriterFallbackReason,
        sanitizerChangedOutput: false,
      },
    },
    safety: playgroundSafety(),
  };
}

function buildLlmSummary(
  refinement: AiStrategistBriefRefinementLLMResult,
  promptWriter: AiStrategistPromptWriterLLMResult
): AiStrategistPlaygroundResult['llm'] {
  return {
    briefRefinement: summarizeBriefLlm(refinement),
    promptWriter: {
      used: promptWriter.usedLLM,
      source: promptWriter.source,
      provider: promptWriter.provider,
      model: promptWriter.model,
      fallbackReason: promptWriter.fallbackReason,
      error: promptWriter.error,
      sanitizerChangedOutput: promptWriter.sanitizerChangedOutput,
    },
  };
}

function summarizeBriefLlm(refinement: AiStrategistBriefRefinementLLMResult): AiStrategistPlaygroundResult['llm']['briefRefinement'] {
  return {
    used: refinement.usedLLM,
    source: refinement.source,
    provider: refinement.provider,
    model: refinement.model,
    fallbackReason: refinement.fallbackReason,
    error: refinement.error,
  };
}

function summarizePromptGenerationContext(
  context: AiStrategistPromptGenerationContext
): AiStrategistPlaygroundPromptContextSummary {
  return {
    selectedModel: context.selectedModel.id,
    selectedWorkflow: context.selectedWorkflow,
    promptStructure: context.promptStructure.id,
    modelPagePromptStructureSource: context.modelPagePromptStructure.sourcePath,
    workflowBlocks: context.workflowPromptStructure.blocks.map((block) => block.label),
    warnings: context.warnings.all,
    durationGuidance: context.durationGuidance,
    priceEstimate: context.priceEstimate,
    settingsGuidance: context.settingsGuidance,
    maxVideoAiRules: context.maxVideoAiRules,
  };
}

function shouldAskClarification(
  normalizedBrief: AiStrategistNormalizedBrief,
  body: ReturnType<typeof normalizePlaygroundInput>
): boolean {
  if (!normalizedBrief.clarificationQuestion) return false;
  if (asksForModelChoice(body)) return false;
  if (body.selectedModel || body.selectedWorkflow) return false;
  if (body.currentPrompt || body.uploadedAsset?.isReferenceImage || body.uploadedAsset?.hasPerson || body.uploadedAsset?.hasProduct) return false;
  if (shouldAllowBriefAssumptions(body)) return false;
  if (normalizedBrief.intent !== 'unknown') return false;
  if (hasUsableCreativeBrief(body, normalizedBrief)) return false;
  return normalizedBrief.confidence < 0.55;
}

function shouldReturnChatRecommendationsOnly(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  effectiveMode: AiStrategistPlaygroundMode;
  conversationPlan: StrategistConversationPlan;
}): boolean {
  return (
    input.body.surface === 'chat' &&
    input.effectiveMode === 'recommend' &&
    input.conversationPlan.action === 'recommend_models' &&
    !input.body.selectedModel
  );
}

function shouldGateChatPromptGeneration(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  effectiveMode: AiStrategistPlaygroundMode;
  initialBody: ReturnType<typeof normalizePlaygroundInput>;
}): boolean {
  if (input.body.surface !== 'chat') return false;
  if (input.effectiveMode !== 'build_prompt' && input.effectiveMode !== 'improve_prompt') return false;
  if (input.initialBody.conversationState?.stage === 'prompt_ready') return false;
  return true;
}

function shouldAllowBriefAssumptions(body: ReturnType<typeof normalizePlaygroundInput>): boolean {
  const text = [
    buildSearchText(body),
    body.conversationState?.lastNormalizedBrief?.rawUserMessage,
    body.conversationState?.lastNormalizedBrief?.normalizedBrief,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (body.currentPrompt && containsAny(text, ['improve', 'make it better', 'make this better', 'more premium', 'premium', 'ameliore', 'améliore'])) {
    return true;
  }
  return body.conversationState?.stage === 'collecting_missing_fields' || body.conversationState?.stage === 'awaiting_confirmation' || containsAny(text, [
    'revision:',
    'duration:',
    'make assumptions',
    'smart assumptions',
    'go ahead',
    'continue',
    'assume',
    'you decide',
    'just make it',
    'vas y',
    'vas-y',
  ]);
}

function hasUsableCreativeBrief(
  body: ReturnType<typeof normalizePlaygroundInput>,
  normalizedBrief: AiStrategistNormalizedBrief
): boolean {
  const text = buildSearchText(body);
  const hasSubject = normalizedBrief.hasProduct || normalizedBrief.hasPerson || normalizedBrief.hasCharacter || containsAny(text, productTerms) || containsAny(text, [
    'fighter',
    'fight',
    'combat',
    'avatar',
    'person',
    'scene',
  ]);
  const hasGoalOrStyle =
    normalizedBrief.styleHints.length > 0 ||
    normalizedBrief.platformHint !== 'unknown' ||
    normalizedBrief.aspectRatioHint !== undefined ||
    containsAny(text, [
      'ad',
      'advert',
      'commercial',
      'pub',
      'cinematic',
      'premium',
      'luxury',
      'dynamic',
      'dynamique',
      'tiktok',
      'voiceover',
      'push-in',
      'reflections',
      'create',
      'movement',
      'motion',
      'subtle',
      'silent',
    ]);
  return hasSubject && hasGoalOrStyle;
}

function isPromptGenerationConfirmed(body: ReturnType<typeof normalizePlaygroundInput>): boolean {
  const text = buildSearchText(body);
  return body.conversationState?.stage === 'awaiting_confirmation' && containsAny(text, [
    'generate prompt',
    'build prompt',
    'confirm',
    'confirmed',
    'yes',
    'yep',
    'ok',
    'okay',
    'go',
    'go ahead',
    'do it',
    'continue',
    'vas y',
    'vas-y',
  ]);
}

function inferWorkflow(
  body: ReturnType<typeof normalizePlaygroundInput>,
  normalizedBrief: AiStrategistNormalizedBrief
): AiStrategistWorkflowId {
  const text = buildSearchText(body);
  if (containsAny(text, ['source video', 'video-to-video', 'restyle'])) return 'video-to-video';
  if (body.uploadedAsset?.isReferenceImage || containsAny(text, ['reference image', 'image-to-video', 'uploaded image'])) {
    return 'image-to-video';
  }
  if (!body.uploadedAsset && isSocialFirstTextToVideoBrief(text)) return 'text-to-video';
  if (normalizedBrief.intent === 'product_ad' || normalizedBrief.intent === 'product_reference_i2v' || normalizedBrief.intent === 'prompt_improvement') {
    return 'text-to-image-then-image-to-video';
  }
  if (containsAny(text, [...productTerms, 'brand asset'])) return 'text-to-image-then-image-to-video';
  return 'text-to-video';
}

function inferPromptStructure(
  body: ReturnType<typeof normalizePlaygroundInput>,
  normalizedBrief: AiStrategistNormalizedBrief
): AiStrategistPromptStructureId {
  const text = buildSearchText(body);
  if (normalizedBrief.intent === 'social_ad' || normalizedBrief.intent === 'draft_storyboard') return 'social-ad';
  if (
    normalizedBrief.intent === 'talking_avatar' ||
    normalizedBrief.intent === 'spokesperson' ||
    normalizedBrief.intent === 'character_animation' ||
    normalizedBrief.intent === 'person_reference_i2v'
  ) {
    return 'character-scene';
  }
  if (
    normalizedBrief.intent === 'product_ad' ||
    normalizedBrief.intent === 'product_reference_i2v' ||
    body.uploadedAsset?.hasProduct ||
    containsAny(text, productTerms)
  ) {
    return 'product-ad';
  }
  if (containsAny(text, ['brand', 'logo', 'launch asset', 'hero asset'])) return 'brand-asset';
  if (containsAny(text, ['character', 'person', 'founder', 'avatar', 'emotion'])) return 'character-scene';
  return 'cinematic-scene';
}

function inferSourceImageKind(uploadedAsset?: AiStrategistPlaygroundUploadedAsset): AiStrategistSourceImageKind {
  if (uploadedAsset?.hasPerson) return 'uploaded-person';
  if (uploadedAsset?.hasProduct) return 'product';
  return 'generic';
}

function buildGoal(body: ReturnType<typeof normalizePlaygroundInput>): string {
  return [
    body.userMessage,
    body.currentPrompt ? `Current prompt: ${body.currentPrompt}` : '',
    pageContextSummary(body.pageContext),
    ...assetHints(body.uploadedAsset),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

function buildPromptBrief(input: {
  body: ReturnType<typeof normalizePlaygroundInput>;
  goal: string;
  mode: AiStrategistPlaygroundMode;
}): string {
  return input.mode === 'improve_prompt' && input.body.currentPrompt
    ? buildImprovedPromptBrief(input.body.currentPrompt, input.body.userMessage)
    : input.goal || input.body.userMessage;
}

function buildRequiredTraits(
  body: ReturnType<typeof normalizePlaygroundInput>,
  normalizedBrief: AiStrategistNormalizedBrief
): string[] {
  const traits = new Set<string>();
  for (const value of assetHints(body.uploadedAsset)) traits.add(value);
  if (body.currentPrompt) traits.add('existing prompt');
  if (normalizedBrief.hasProduct) traits.add('product');
  if (normalizedBrief.hasPerson) traits.add('person');
  if (normalizedBrief.hasCharacter) traits.add('character');
  if (normalizedBrief.hasUploadedReference) traits.add('reference image');
  if (normalizedBrief.hasVisibleSpeaker) traits.add('visible speaker');
  if (normalizedBrief.hasVoiceover) traits.add('voiceover');
  if (normalizedBrief.hasDialogue) traits.add('dialogue');
  if (normalizedBrief.hasLipSyncIntent) traits.add('lip-sync');
  if (normalizedBrief.hasLogoOrTextRisk) traits.add('label text risk');
  if (normalizedBrief.aspectRatioHint) traits.add(normalizedBrief.aspectRatioHint);
  for (const hint of normalizedBrief.styleHints) traits.add(hint);
  return Array.from(traits);
}

function inferBudgetPriority(normalizedBrief: AiStrategistNormalizedBrief): AiStrategistBudgetPriority {
  if (normalizedBrief.intent === 'draft_storyboard' || normalizedBrief.qualityIntent === 'draft' || normalizedBrief.qualityIntent === 'value') {
    return 'value';
  }
  return normalizedBrief.qualityIntent === 'premium' ? 'quality' : 'balanced';
}

function inferSpeedPriority(normalizedBrief: AiStrategistNormalizedBrief): AiStrategistSpeedPriority {
  if (
    normalizedBrief.intent === 'social_ad' ||
    normalizedBrief.intent === 'draft_storyboard' ||
    normalizedBrief.platformHint === 'tiktok' ||
    normalizedBrief.platformHint === 'instagram' ||
    normalizedBrief.styleHints.includes('vertical')
  ) {
    return 'high';
  }
  return 'medium';
}

function inferQualityPriority(normalizedBrief: AiStrategistNormalizedBrief): AiStrategistQualityPriority {
  if (normalizedBrief.intent === 'draft_storyboard' || normalizedBrief.qualityIntent === 'draft') return 'draft';
  return normalizedBrief.qualityIntent === 'premium' ? 'maximum' : 'balanced';
}

function buildAssistantMessage(
  mode: AiStrategistPlaygroundMode,
  recommendations: AiStrategistRecommendations,
  selectedModelId: AiStrategistModelId
): string {
  const selected = AI_STRATEGIST_MODELS.find((model) => model.id === selectedModelId);
  if (mode === 'build_prompt') return `Built a MaxVideoAI prompt preview for ${selected?.label ?? selectedModelId}.`;
  if (mode === 'improve_prompt') return `Improved the prompt preview for ${selected?.label ?? selectedModelId}.`;
  return `Previewed routing with ${recommendations.best.model.label} as Best, ${recommendations.medium.model.label} as Medium, and ${recommendations.value.model.label} as Value.`;
}

function buildRecommendationAssistantMessage(
  workflow: AiStrategistWorkflowId,
  recommendations: AiStrategistRecommendations,
  task: StrategistOrchestrationPlan['task']
): string {
  const routeLine = task === 'model_advice'
    ? `I’m showing three possible paths below: ${recommendations.best.model.label} is my first pick, ${recommendations.medium.model.label} is the balanced route, and ${recommendations.value.model.label} keeps the test more cost-aware.`
    : 'I’m showing three possible paths below: the strongest quality route, a balanced route, and a faster/value route.';

  return [
    `I’d route this as ${workflow}.`,
    routeLine,
    'Choose the direction that fits the job, then I’ll check the missing creative details before writing the prompt.',
    'No generation or credits are used here.',
  ].join('\n');
}

function buildProductHelpMessage(body: ReturnType<typeof normalizePlaygroundInput>): string {
  const text = buildSearchText(body);
  if (containsAny(text, ['upload', 'image', 'reference image'])) {
    return 'To animate an image, open the video generator, choose image-to-video, upload or select the reference image in MaxVideoAI, enter the motion prompt, compare suggested models, check the price shown before generation, then launch the render.';
  }
  if (containsAny(text, ['pricing', 'price', 'credits', 'cost'])) {
    return 'To manage cost, choose the workflow and model in the video generator, review the price shown before generation, and launch only when the settings look right. The strategist does not spend credits or start generation by itself.';
  }
  return 'To generate a video, open the video generator, choose the workflow, enter or improve your prompt, compare the suggested models, check the price shown before generation, then launch the render.';
}

function buildPreviewUiActions(input: {
  output: AiStrategistPromptWriterOutput;
  selectedModelId: AiStrategistModelId;
  workflow: AiStrategistWorkflowId;
  durationGuidance: AiStrategistPromptGenerationContext['durationGuidance'];
}): AiStrategistPromptWriterOutput['uiActions'] {
  const actions = new Map<AiStrategistPromptWriterOutput['uiActions'][number]['type'], string>();

  for (const action of input.output.uiActions) {
    if (action.type && action.value) actions.set(action.type, action.value);
  }

  actions.set('SET_MODEL', input.selectedModelId);
  actions.set('SET_WORKFLOW', input.workflow);
  if (input.output.finalPrompt) actions.set('SET_PROMPT', input.output.finalPrompt);
  if (input.output.negativePrompt) actions.set('SET_NEGATIVE_PROMPT', input.output.negativePrompt);

  const settingsText = input.output.settings.join('\n');
  if (!actions.has('SET_ASPECT_RATIO')) {
    const aspectRatio = settingsText.match(/\b\d+:\d+\b/)?.[0];
    if (aspectRatio) actions.set('SET_ASPECT_RATIO', aspectRatio);
  }
  if (!actions.has('SET_DURATION')) {
    const duration = settingsText.match(/\b\d+(?:-\d+)?\s*(?:seconds|second|s)\b/i)?.[0];
    actions.set('SET_DURATION', duration ?? `${input.durationGuidance.seconds}s`);
  }
  if (!actions.has('SET_RESOLUTION')) {
    const resolution = settingsText.match(/\b(?:native\s+)?(?:4K|1080p|720p)\b/i)?.[0];
    if (resolution) actions.set('SET_RESOLUTION', resolution);
  }

  return Array.from(actions, ([type, value]) => ({ type, value }));
}

function asksForModelChoice(body: ReturnType<typeof normalizePlaygroundInput>): boolean {
  const text = buildSearchText(body);
  if (containsAny(text, ['how do i choose a model', 'how to choose a model', 'how should i choose a model'])) {
    return false;
  }
  return containsAny(text, [
    'which model should i use',
    'which engine should i use',
    'which engine is safest',
    'what model should i use',
    'what engine should i use',
    'recommend a model',
    'recommend models',
    'best model for',
    'best engine for',
    'which model for',
    'which engine for',
    'what model for',
    'what engine for',
    'premium but not the most expensive',
    'premium but cheap',
    'premium but low cost',
    'premium but cheaper',
    'not the most expensive model',
    'burn credits',
    'need 4k',
    'really need 4k',
    'do i need 4k',
    'better than',
    'difference between',
    'idk model',
    'dont know model',
    'don t know model',
    'safest model',
    'safest engine',
  ]);
}

function buildImprovedPromptBrief(currentPrompt: string, userMessage: string): string {
  const source = currentPrompt.trim();
  const request = userMessage.toLowerCase();
  const treatment: string[] = [];
  if (containsAny(request, ['premium', 'luxury', 'commercial', 'product ad', 'product'])) {
    treatment.push('premium product ad treatment', 'polished commercial lighting', 'controlled reflections', 'clean hero framing', 'one smooth reveal');
  }
  if (containsAny(request, ['social', 'tiktok', 'reels', 'vertical'])) {
    treatment.push('vertical social pacing', 'strong first-second visual hook');
  }
  if (containsAny(request, ['cinematic', 'film', 'story'])) {
    treatment.push('cinematic camera movement', 'grounded lighting');
  }
  return `${source}. Refine as ${treatment.length ? Array.from(new Set(treatment)).join(', ') : 'clearer subject, action, camera, style and final frame'}.`;
}

function normalizeMode(mode: unknown): AiStrategistPlaygroundMode {
  return typeof mode === 'string' && validModes.has(mode as AiStrategistPlaygroundMode)
    ? (mode as AiStrategistPlaygroundMode)
    : 'recommend';
}

function normalizeSurface(surface: unknown): AiStrategistPlaygroundSurface {
  return surface === 'chat' ? 'chat' : 'debug';
}

function normalizeTier(tier: unknown): AiStrategistTierPosition {
  return typeof tier === 'string' && validTiers.has(tier as AiStrategistTierPosition)
    ? (tier as AiStrategistTierPosition)
    : 'best';
}

function normalizeModelId(modelId: unknown): AiStrategistModelId | undefined {
  return typeof modelId === 'string' && validModelIds.has(modelId as AiStrategistModelId)
    ? (modelId as AiStrategistModelId)
    : undefined;
}

function normalizeOptionalTier(tier: unknown): AiStrategistTierPosition | undefined {
  return typeof tier === 'string' && validTiers.has(tier as AiStrategistTierPosition)
    ? (tier as AiStrategistTierPosition)
    : undefined;
}

function normalizeWorkflow(workflow: unknown): AiStrategistWorkflowId | undefined {
  return typeof workflow === 'string' && validWorkflowIds.has(workflow as AiStrategistWorkflowId)
    ? (workflow as AiStrategistWorkflowId)
    : undefined;
}

function normalizeUploadedAsset(asset: unknown): AiStrategistPlaygroundUploadedAsset | undefined {
  if (!isRecord(asset)) return undefined;
  return {
    type: typeof asset.type === 'string' ? asset.type : undefined,
    hasPerson: asset.hasPerson === true,
    hasProduct: asset.hasProduct === true,
    hasLogo: asset.hasLogo === true,
    hasText: asset.hasText === true,
    isReferenceImage: asset.isReferenceImage === true,
  };
}

function normalizeConversationState(state: unknown): StrategistConversationState | undefined {
  if (!isRecord(state)) return undefined;
  const recentTurns = Array.isArray(state.recentTurns)
    ? state.recentTurns
        .filter(isRecord)
        .map((turn) => ({
          role: turn.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: textOrEmpty(turn.content).slice(0, 1000),
        }))
        .filter((turn) => turn.content)
        .slice(-8)
    : undefined;
  const lastSelectedModel = normalizeModelId(state.lastSelectedModel);
  const lastSelectedTier = normalizeOptionalTier(state.lastSelectedTier);
  const lastSelectedWorkflow = normalizeWorkflow(state.lastSelectedWorkflow);
  const stage = normalizeChatStage(state.stage);

  return {
    ...(recentTurns?.length ? { recentTurns } : {}),
    ...(isRecord(state.lastNormalizedBrief) ? { lastNormalizedBrief: state.lastNormalizedBrief as AiStrategistNormalizedBrief } : {}),
    ...(isRecord(state.lastRecommendations) ? { lastRecommendations: state.lastRecommendations as AiStrategistRecommendations } : {}),
    ...(lastSelectedModel ? { lastSelectedModel } : {}),
    ...(lastSelectedTier ? { lastSelectedTier } : {}),
    ...(lastSelectedWorkflow ? { lastSelectedWorkflow } : {}),
    ...(textOrEmpty(state.lastFinalPrompt) ? { lastFinalPrompt: textOrEmpty(state.lastFinalPrompt) } : {}),
    ...(stage ? { stage } : {}),
    ...(isRecord(state.lastBriefCompletion) ? { lastBriefCompletion: state.lastBriefCompletion as StrategistConversationState['lastBriefCompletion'] } : {}),
  };
}

function buildBriefRefinementConversationContext(
  body: ReturnType<typeof normalizePlaygroundInput>,
  plan: StrategistConversationPlan
): AiStrategistBriefRefinementConversationContext | undefined {
  const state = body.conversationState;
  const context: AiStrategistBriefRefinementConversationContext = {
    ...(state?.stage ? { currentChatStage: state.stage } : {}),
    ...(plan.rawUserMessage ? { currentUserMessage: plan.rawUserMessage } : {}),
    ...(state?.lastNormalizedBrief?.rawUserMessage ? { lastUserBrief: state.lastNormalizedBrief.rawUserMessage } : {}),
    ...(state?.lastNormalizedBrief?.normalizedBrief ? { enrichedBrief: state.lastNormalizedBrief.normalizedBrief } : {}),
    ...(state?.lastRecommendations ? { lastRecommendations: summarizeRecommendationsForRefinement(state.lastRecommendations) } : {}),
    ...(state?.lastSelectedModel || plan.selectedModel ? { lastSelectedModel: plan.selectedModel ?? state?.lastSelectedModel } : {}),
    ...(state?.lastSelectedTier || plan.selectedTier ? { lastSelectedTier: plan.selectedTier ?? state?.lastSelectedTier } : {}),
    ...(state?.lastSelectedWorkflow || plan.selectedWorkflow ? { lastSelectedWorkflow: plan.selectedWorkflow ?? state?.lastSelectedWorkflow } : {}),
    ...(state?.recentTurns?.length ? { recentTurns: state.recentTurns.slice(-6) } : {}),
  };

  return Object.keys(context).length ? context : undefined;
}

function summarizeRecommendationsForRefinement(
  recommendations: AiStrategistRecommendations
): NonNullable<AiStrategistBriefRefinementConversationContext['lastRecommendations']> {
  return {
    best: summarizeRecommendationForRefinement(recommendations.best),
    medium: summarizeRecommendationForRefinement(recommendations.medium),
    value: summarizeRecommendationForRefinement(recommendations.value),
    ...(recommendations.alsoConsider?.length
      ? { alsoConsider: recommendations.alsoConsider.map(summarizeRecommendationForRefinement).slice(0, 3) }
      : {}),
  };
}

function summarizeRecommendationForRefinement(
  recommendation: AiStrategistRecommendations['best']
): NonNullable<AiStrategistBriefRefinementConversationContext['lastRecommendations']>['best'] {
  return {
    modelId: recommendation.model.id,
    label: recommendation.model.label,
    reason: recommendation.reason,
    ...(recommendation.warning ? { warning: recommendation.warning } : {}),
  };
}

function normalizeChatStage(stage: unknown): StrategistChatStage | undefined {
  return typeof stage === 'string' && validChatStages.has(stage as StrategistChatStage)
    ? (stage as StrategistChatStage)
    : undefined;
}

function buildSearchText(body: ReturnType<typeof normalizePlaygroundInput>): string {
  return [body.userMessage, body.currentPrompt, pageContextSummary(body.pageContext), ...assetHints(body.uploadedAsset)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function assetHints(uploadedAsset?: AiStrategistPlaygroundUploadedAsset): string[] {
  if (!uploadedAsset) return [];
  const hints: string[] = [];
  if (uploadedAsset.isReferenceImage) hints.push('reference image');
  if (uploadedAsset.hasPerson) hints.push('uploaded human image', 'preserve face');
  if (uploadedAsset.hasProduct) hints.push('product reference image');
  if (uploadedAsset.hasLogo) hints.push('logo position');
  if (uploadedAsset.hasText) hints.push('tiny text', 'label placement');
  return hints;
}

function pageContextSummary(pageContext: unknown): string {
  if (!pageContext) return '';
  if (typeof pageContext === 'string') return `Page context: ${pageContext}`;
  try {
    return `Page context: ${JSON.stringify(pageContext).slice(0, 500)}`;
  } catch {
    return '';
  }
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function isSocialFirstTextToVideoBrief(text: string): boolean {
  return (
    containsAny(text, ['social-first', 'social first', 'tiktok', 'reels', 'ugc', 'vertical', 'fast social', 'quick social']) &&
    !containsAny(text, ['uploaded image', 'reference image', 'product photo', 'packshot', 'exact packaging', 'label placement'])
  );
}

function uniqueStrings(values: ReadonlyArray<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function playgroundSafety(): AiStrategistPlaygroundResult['safety'] {
  return {
    autoGeneration: false,
    creditSpend: false,
    publishing: false,
    uiActionsApplied: false,
  };
}
