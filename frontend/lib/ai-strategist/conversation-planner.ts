import type { AiStrategistNormalizedBrief } from './brief-normalization';
import { AI_STRATEGIST_MODELS } from './model-catalog';
import type {
  AiStrategistModelId,
  AiStrategistRecommendations,
  AiStrategistTierPosition,
  AiStrategistWorkflowId,
} from './types';

export type StrategistConversationAction =
  | 'recommend_models'
  | 'select_tier'
  | 'select_model'
  | 'build_prompt'
  | 'improve_prompt'
  | 'await_prompt_paste'
  | 'product_help'
  | 'navigation_help'
  | 'ask_clarification';

export type StrategistConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type StrategistChatStage =
  | 'collecting_brief'
  | 'recommending_models'
  | 'awaiting_model_choice'
  | 'awaiting_prompt_paste'
  | 'collecting_missing_fields'
  | 'awaiting_confirmation'
  | 'building_prompt'
  | 'prompt_ready';

export type StrategistNavigationSuggestion = {
  label: string;
  href: string;
  reason: string;
};

export type StrategistConversationState = {
  recentTurns?: readonly StrategistConversationTurn[];
  lastNormalizedBrief?: AiStrategistNormalizedBrief;
  lastRecommendations?: AiStrategistRecommendations;
  lastSelectedModel?: AiStrategistModelId;
  lastSelectedTier?: AiStrategistTierPosition;
  lastSelectedWorkflow?: AiStrategistWorkflowId;
  lastFinalPrompt?: string;
  stage?: StrategistChatStage;
  lastBriefCompletion?: StrategistBriefCompletionState;
};

export type StrategistBriefCompletionState = {
  resolvedBrief: string;
  selectedModel?: AiStrategistModelId;
  selectedTier?: AiStrategistTierPosition;
  selectedWorkflow?: AiStrategistWorkflowId;
  missingFields?: readonly string[];
  assumptions?: readonly string[];
  confirmationSummary?: readonly string[];
};

export type StrategistConversationPlan = {
  action: StrategistConversationAction;
  rawUserMessage: string;
  resolvedBrief?: string;
  currentPrompt?: string;
  selectedTier?: AiStrategistTierPosition;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  clarificationQuestion?: string;
  navigationSuggestion?: StrategistNavigationSuggestion;
  shouldUsePreviousBrief: boolean;
  shouldUseCurrentPrompt: boolean;
  confidence: number;
};

export type StrategistConversationPlannerInput = {
  rawUserMessage?: string;
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
};

const modelAliases: readonly { modelId: AiStrategistModelId; aliases: readonly string[] }[] = [
  { modelId: 'seedance-2-0-fast', aliases: ['seedance fast', 'sidance fast', 'seedance 2 fast', 'seedance 2.0 fast'] },
  { modelId: 'seedance-2-0', aliases: ['seedance', 'sidance', 'seedance 2', 'seedance 2.0'] },
  { modelId: 'kling-3-4k', aliases: ['kling 4k', 'kling 3 4k', 'kling 3.0 4k'] },
  { modelId: 'kling-3-pro', aliases: ['kling pro', 'kling 3 pro', 'kling'] },
  { modelId: 'kling-3-standard', aliases: ['kling standard', 'kling 3 standard'] },
  { modelId: 'veo-3-1-fast', aliases: ['veo fast', 'veo 3.1 fast'] },
  { modelId: 'veo-3-1-lite', aliases: ['veo lite', 'veo 3.1 lite'] },
  { modelId: 'veo-3-1', aliases: ['veo', 'veo 3', 'veo 3.1'] },
  { modelId: 'ltx-2-3', aliases: ['ltx', 'ltx 2.3'] },
  { modelId: 'pika', aliases: ['pika', 'pika labs'] },
  { modelId: 'hailuo', aliases: ['hailuo'] },
  { modelId: 'sora', aliases: ['sora'] },
  { modelId: 'happy-horse-1-0', aliases: ['happy horse', 'happyhorse'] },
];

export function planStrategistConversation(input: StrategistConversationPlannerInput): StrategistConversationPlan {
  const rawUserMessage = cleanText(input.rawUserMessage);
  const normalized = normalizeSearchText(rawUserMessage);
  const previousBrief = input.conversationState?.lastBriefCompletion?.resolvedBrief ?? input.conversationState?.lastNormalizedBrief?.normalizedBrief;
  const hasPreviousBrief = Boolean(previousBrief && previousBrief !== 'Unspecified video brief.');
  const selectedTier = resolveTier(normalized, hasPreviousBrief) ?? resolveAdvisorChoiceTier(normalized, hasPreviousBrief);
  const selectedModel = resolveModelId(normalized, input.conversationState?.lastRecommendations);
  const promptRequest = isPromptCreationRequest(normalized);
  const improvementRequest = isPromptImprovementRequest(normalized);
  const existingPromptEditRequest = isExistingPromptEditRequest(normalized);
  const promptShareOffer = isPromptShareOffer(normalized);
  const currentPrompt = cleanText(input.currentPrompt);
  const previousPrompt = cleanText(input.conversationState?.lastFinalPrompt);
  const previousStage = input.conversationState?.stage;
  const lastBriefCompletion = input.conversationState?.lastBriefCompletion;

  if (previousStage === 'awaiting_prompt_paste' && rawUserMessage) {
    const model = input.selectedModel ?? input.conversationState?.lastSelectedModel ?? selectedModel;
    return {
      action: 'improve_prompt',
      rawUserMessage,
      resolvedBrief: model ? `Improve this pasted prompt for ${modelLabel(model)}.` : 'Improve this pasted prompt.',
      currentPrompt: rawUserMessage,
      selectedModel: model,
      selectedWorkflow: input.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
      shouldUsePreviousBrief: false,
      shouldUseCurrentPrompt: true,
      confidence: 0.92,
    };
  }

  if (previousStage === 'awaiting_confirmation' && isPromptConfirmation(normalized)) {
    const resolvedBrief = appendAssumptionsToBrief(lastBriefCompletion?.resolvedBrief ?? previousBrief, lastBriefCompletion?.assumptions);
    if (resolvedBrief) {
      return {
        action: 'build_prompt',
        rawUserMessage,
        resolvedBrief,
        selectedTier: lastBriefCompletion?.selectedTier ?? input.conversationState?.lastSelectedTier,
        selectedModel: lastBriefCompletion?.selectedModel ?? input.selectedModel ?? input.conversationState?.lastSelectedModel,
        selectedWorkflow: input.selectedWorkflow ?? lastBriefCompletion?.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
        shouldUsePreviousBrief: true,
        shouldUseCurrentPrompt: false,
        confidence: 0.94,
      };
    }
  }

  if ((previousStage === 'awaiting_confirmation' || previousStage === 'prompt_ready') && hasPreviousBrief && isContextualBriefRevision(normalized)) {
    const resolvedBrief = mergeBriefRevision(previousBrief, rawUserMessage);
    return {
      action: 'build_prompt',
      rawUserMessage,
      resolvedBrief,
      selectedTier: lastBriefCompletion?.selectedTier ?? input.conversationState?.lastSelectedTier,
      selectedModel: lastBriefCompletion?.selectedModel ?? input.selectedModel ?? input.conversationState?.lastSelectedModel,
      selectedWorkflow: input.selectedWorkflow ?? lastBriefCompletion?.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
      shouldUsePreviousBrief: true,
      shouldUseCurrentPrompt: false,
      confidence: 0.88,
    };
  }

  if ((previousStage === 'collecting_missing_fields' || previousStage === 'awaiting_confirmation') && selectedTier) {
    if (!hasPreviousBrief) {
      return {
        action: 'ask_clarification',
        rawUserMessage,
        selectedTier,
        clarificationQuestion: 'What video brief should I use for that tier?',
        shouldUsePreviousBrief: false,
        shouldUseCurrentPrompt: false,
        confidence: 0.82,
      };
    }

    return {
      action: 'select_tier',
      rawUserMessage,
      resolvedBrief: previousBrief,
      selectedTier,
      selectedModel: input.conversationState?.lastRecommendations?.[selectedTier]?.model.id,
      selectedWorkflow: input.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
      shouldUsePreviousBrief: true,
      shouldUseCurrentPrompt: false,
      confidence: 0.93,
    };
  }

  if ((previousStage === 'collecting_missing_fields' || previousStage === 'awaiting_confirmation') && selectedModel) {
    return {
      action: 'select_model',
      rawUserMessage,
      resolvedBrief: hasPreviousBrief ? previousBrief : undefined,
      selectedModel,
      selectedWorkflow: input.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
      shouldUsePreviousBrief: hasPreviousBrief,
      shouldUseCurrentPrompt: false,
      confidence: 0.92,
    };
  }

  if (previousStage === 'collecting_missing_fields' && hasPreviousBrief) {
    const resolvedBrief = isAssumptionRequest(normalized)
      ? previousBrief
      : `${previousBrief}. Additional direction: ${rawUserMessage}`;
    return {
      action: 'build_prompt',
      rawUserMessage,
      resolvedBrief,
      selectedTier: lastBriefCompletion?.selectedTier ?? input.conversationState?.lastSelectedTier,
      selectedModel: lastBriefCompletion?.selectedModel ?? input.selectedModel ?? input.conversationState?.lastSelectedModel,
      selectedWorkflow: input.selectedWorkflow ?? lastBriefCompletion?.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
      shouldUsePreviousBrief: true,
      shouldUseCurrentPrompt: false,
      confidence: isAssumptionRequest(normalized) ? 0.88 : 0.82,
    };
  }

  if (selectedTier) {
    if (!hasPreviousBrief) {
      return {
        action: 'ask_clarification',
        rawUserMessage,
        selectedTier,
        clarificationQuestion: 'What video brief should I use for that tier?',
        shouldUsePreviousBrief: false,
        shouldUseCurrentPrompt: false,
        confidence: 0.82,
      };
    }

    return {
      action: 'select_tier',
      rawUserMessage,
      resolvedBrief: previousBrief,
      selectedTier,
      selectedModel: input.conversationState?.lastRecommendations?.[selectedTier]?.model.id,
      selectedWorkflow: input.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
      shouldUsePreviousBrief: true,
      shouldUseCurrentPrompt: false,
      confidence: 0.93,
    };
  }

  const navigationSuggestion = resolveNavigationSuggestion(normalized);
  if (navigationSuggestion && !isDirectGenerationExecutionRequest(normalized)) {
    return {
      action: 'navigation_help',
      rawUserMessage,
      navigationSuggestion,
      shouldUsePreviousBrief: false,
      shouldUseCurrentPrompt: false,
      confidence: 0.86,
    };
  }

  if (isProductHelpRequest(normalized)) {
    return {
      action: 'product_help',
      rawUserMessage,
      shouldUsePreviousBrief: false,
      shouldUseCurrentPrompt: false,
      confidence: 0.84,
    };
  }

  if (promptShareOffer || (existingPromptEditRequest && selectedModel && !currentPrompt && !previousPrompt)) {
    return {
      action: 'await_prompt_paste',
      rawUserMessage,
      selectedModel: selectedModel ?? input.selectedModel ?? input.conversationState?.lastSelectedModel,
      selectedWorkflow: input.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
      shouldUsePreviousBrief: false,
      shouldUseCurrentPrompt: false,
      confidence: 0.9,
    };
  }

  if (improvementRequest || existingPromptEditRequest) {
    if (currentPrompt || previousPrompt) {
      return {
        action: 'improve_prompt',
        rawUserMessage,
        resolvedBrief: hasPreviousBrief ? previousBrief : undefined,
        selectedModel: input.selectedModel ?? input.conversationState?.lastSelectedModel,
        selectedWorkflow: input.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
        shouldUsePreviousBrief: hasPreviousBrief,
        shouldUseCurrentPrompt: true,
        confidence: 0.9,
      };
    }

    if (isPromptPasteNeededRequest(normalized)) {
      return {
        action: 'await_prompt_paste',
        rawUserMessage,
        selectedModel: selectedModel ?? input.selectedModel ?? input.conversationState?.lastSelectedModel,
        selectedWorkflow: input.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
        shouldUsePreviousBrief: false,
        shouldUseCurrentPrompt: false,
        confidence: 0.88,
      };
    }

    return {
      action: 'ask_clarification',
      rawUserMessage,
      clarificationQuestion: 'What prompt do you want me to improve?',
      shouldUsePreviousBrief: false,
      shouldUseCurrentPrompt: false,
      confidence: 0.85,
    };
  }

  if (selectedModel) {
    if (hasPreviousBrief) {
      return {
        action: 'select_model',
        rawUserMessage,
        resolvedBrief: previousBrief,
        selectedModel,
        selectedWorkflow: input.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
        shouldUsePreviousBrief: true,
        shouldUseCurrentPrompt: false,
        confidence: 0.92,
      };
    }

    if (promptRequest || isShortModelSelection(normalized)) {
      return {
        action: 'ask_clarification',
        rawUserMessage,
        selectedModel,
        clarificationQuestion: existingPromptEditRequest
          ? 'Paste the prompt you want me to improve.'
          : 'What do you want the video to show?',
        shouldUsePreviousBrief: false,
        shouldUseCurrentPrompt: false,
        confidence: 0.88,
      };
    }
  }

  if (input.selectedModel && promptRequest && !rawUserMessage) {
    return {
      action: 'ask_clarification',
      rawUserMessage,
      selectedModel: input.selectedModel,
      clarificationQuestion: 'What do you want the video to show?',
      shouldUsePreviousBrief: false,
      shouldUseCurrentPrompt: false,
      confidence: 0.82,
    };
  }

  if (promptRequest && hasPreviousBrief) {
    return {
      action: 'build_prompt',
      rawUserMessage,
      resolvedBrief: previousBrief,
      selectedModel: input.selectedModel ?? input.conversationState?.lastSelectedModel,
      selectedWorkflow: input.selectedWorkflow ?? input.conversationState?.lastSelectedWorkflow,
      shouldUsePreviousBrief: true,
      shouldUseCurrentPrompt: false,
      confidence: 0.78,
    };
  }

  if (isAmbiguousFollowUp(normalized) && !hasPreviousBrief && !currentPrompt) {
    return {
      action: 'ask_clarification',
      rawUserMessage,
      clarificationQuestion: 'What video are you trying to create or improve?',
      shouldUsePreviousBrief: false,
      shouldUseCurrentPrompt: false,
      confidence: 0.72,
    };
  }

  return {
    action: 'recommend_models',
    rawUserMessage,
    resolvedBrief: rawUserMessage,
    selectedModel: input.selectedModel,
    selectedWorkflow: input.selectedWorkflow,
    shouldUsePreviousBrief: false,
    shouldUseCurrentPrompt: false,
    confidence: rawUserMessage ? 0.72 : 0.4,
  };
}

function appendAssumptionsToBrief(brief: string | undefined, assumptions: readonly string[] | undefined): string | undefined {
  if (!brief) return undefined;
  if (!assumptions?.length) return brief;
  return `${brief}. Assumed direction: ${assumptions.join('; ')}.`;
}

function mergeBriefRevision(brief: string | undefined, revision: string): string | undefined {
  if (!brief) return undefined;
  const cleanRevision = cleanText(revision);
  if (!cleanRevision) return brief;
  return `${brief}. Revision: ${cleanRevision}.`;
}

function resolveTier(text: string, hasPreviousBrief = false): AiStrategistTierPosition | undefined {
  if (/^(best|use best|choose best|go best)\b/.test(text)) return 'best';
  if (/^(medium|use medium|choose medium|go medium)\b/.test(text)) return 'medium';
  if (/^(value|use value|choose value|go value|budget)\b/.test(text)) return 'value';
  if (hasPreviousBrief && containsAny(text, [
    'cheaper option',
    'less expensive',
    'lower cost',
    'reduce price',
    'too expensive',
    'keep it cheaper',
    'make it cheaper',
    'can we keep it cheaper',
    'actually can we keep it cheaper',
    'cheaper',
    'moins cher',
    'moins chere',
    'trop cher',
    'pas cher',
  ])) {
    return 'value';
  }
  return undefined;
}

function resolveAdvisorChoiceTier(text: string, hasPreviousBrief = false): AiStrategistTierPosition | undefined {
  if (!hasPreviousBrief) return undefined;
  if (containsAny(text, [
    'choose for me',
    'pick for me',
    'you choose',
    'you decide',
    'choose the best',
    'pick the best',
    'choisis pour moi',
    'choisi pour moi',
    'tu choisis',
    'tu decides',
    'tu decides pour moi',
    'tu decider',
    'a toi de choisir',
    'à toi de choisir',
    'prends le meilleur',
    'prend le meilleur',
  ])) {
    return 'best';
  }
  return undefined;
}

function resolveModelId(text: string, recommendations?: AiStrategistRecommendations): AiStrategistModelId | undefined {
  const matches = modelAliases.filter((entry) => entry.aliases.some((alias) => includesPhrase(text, alias)));
  if (!matches.length) return undefined;

  const recommendedIds = recommendations
    ? [recommendations.best.model.id, recommendations.medium.model.id, recommendations.value.model.id, ...(recommendations.alsoConsider?.map((entry) => entry.model.id) ?? [])]
    : [];
  const recommendedMatch = matches.find((match) => recommendedIds.includes(match.modelId));
  return recommendedMatch?.modelId ?? matches[0]?.modelId;
}

function resolveNavigationSuggestion(text: string): StrategistNavigationSuggestion | undefined {
  const examplesSuggestion = resolveExamplesNavigationSuggestion(text);
  if (examplesSuggestion) return examplesSuggestion;

  if (containsAny(text, ['where do i compare', 'where to compare', 'compare models', 'compare engines', 'compare before generating'])) {
    return {
      label: 'Compare',
      href: '/compare',
      reason: 'Open Compare to review models side by side, then use Generate when you are ready to create.',
    };
  }

  if (containsAny(text, ['show me pricing', 'pricing page', 'where is pricing', 'prices', 'tarifs'])) {
    return {
      label: 'Pricing',
      href: '/pricing',
      reason: 'Open pricing to compare plans, credits, and model costs before generating.',
    };
  }

  if (containsAny(text, [
    'where are the model pages',
    'where are model pages',
    'where are the models',
    'where are models',
    'model pages',
  ])) {
    return {
      label: 'Models catalog',
      href: '/models',
      reason: 'Open the model catalog to inspect model strengths, settings, examples, and prompt guidance.',
    };
  }

  if (containsAny(text, ['where do i upload an image', 'where to upload an image', 'where do i upload image', 'upload image', 'uploader une image'])) {
    return {
      label: 'Video generator',
      href: '/app',
      reason: 'Use the video generator, choose image-to-video, then upload or select the reference image.',
    };
  }

  if (containsAny(text, ['where do i paste the prompt', 'where to paste the prompt', 'where paste prompt', 'where do i paste prompt', 'u make prompt then where paste'])) {
    return {
      label: 'Video generator',
      href: '/app',
      reason: 'Paste the finished prompt in the video generator prompt field, then review the model, workflow, duration, and price before launching manually.',
    };
  }

  const modelId = resolveModelId(text);
  if (modelId && /^(where is|show me|open|ou est|où est)/.test(text)) {
    const model = AI_STRATEGIST_MODELS.find((entry) => entry.id === modelId);
    return {
      label: model?.label ?? modelId,
      href: `/models/${modelId}`,
      reason: 'Open the model page to inspect examples, settings, and prompt guidance.',
    };
  }

  return undefined;
}

function resolveExamplesNavigationSuggestion(text: string): StrategistNavigationSuggestion | undefined {
  if (!containsAny(text, [
    'example',
    'examples',
    'sample',
    'samples',
    'gallery',
    'galleries',
    'exemple',
    'exemples',
    'see videos made with',
    'videos made with',
    'show me videos made with',
    'outputs from',
    'videos from',
  ])) return undefined;
  const modelId = resolveModelId(text);
  const familySlug = modelId ? modelIdToExampleFamily(modelId) : undefined;
  const label = familySlug ? `${modelLabel(modelId ?? 'seedance-2-0')} examples` : 'Examples';
  return {
    label,
    href: familySlug ? `/examples/${familySlug}` : '/examples',
    reason: familySlug
      ? `Open ${label} to inspect real outputs, prompts, settings, and model behavior before generating.`
      : 'Open Examples to inspect real outputs, prompts, settings, and model behavior before generating.',
  };
}

function modelIdToExampleFamily(modelId: AiStrategistModelId): string | undefined {
  if (modelId.startsWith('kling-')) return 'kling';
  if (modelId.startsWith('veo-')) return 'veo';
  if (modelId.startsWith('seedance-')) return 'seedance';
  if (modelId.startsWith('ltx-')) return 'ltx';
  if (modelId === 'happy-horse-1-0') return 'happy-horse';
  if (modelId === 'pika') return 'pika';
  if (modelId === 'hailuo') return 'hailuo';
  if (modelId === 'sora') return 'sora';
  return undefined;
}

function isProductHelpRequest(text: string): boolean {
  if (containsAny(text, [
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
  ])) {
    return false;
  }

  return containsAny(text, [
    'what should i do first',
    'where should i start',
    'where do i start',
    'landed here from an ad',
    'came from an ad',
    'dont know prompts',
    'don t know prompts',
    'do not know prompts',
    'i dont know prompts',
    'i don t know prompts',
    'can u just generate it',
    'can you just generate it',
    'can you generate it for me',
    'where do i generate',
    'how do i generate',
    'how to generate',
    'how do i use this',
    'how to use this',
    'how does this work',
    'how do i choose a model',
    'how to choose a model',
    'how the site works',
    'credits',
    'credit',
    'cost',
    'price',
    'pricing',
    'how much',
    'how many credits',
    'combien',
    'combien de credits',
    'combien de crédits',
    'moin cher',
    'moins cher',
    'credito',
    'creditos',
    'créditos',
    'devis',
    'estimation',
    'estimate',
    'quote',
    'avant de lancer',
    'before launching',
    'before generation',
    'refund',
    'refunded',
    'refunds',
    'failed generation',
    'failed generations',
    'generation fails',
    'if fail',
    'if it fails',
  ]);
}

function isPromptCreationRequest(text: string): boolean {
  return containsAny(text, [
    'build prompt',
    'create prompt',
    'write prompt',
    'faire un prompt',
    'creer un prompt',
    'créer un prompt',
    'je veux faire un prompt',
    'prompt',
  ]);
}

function isPromptImprovementRequest(text: string): boolean {
  return containsAny(text, [
    'make this better',
    'make it better',
    'improve this',
    'improve it',
    'improve prompt',
    'refine this',
    'refine prompt',
    'more premium',
    'too generic',
    'make it more cinematic',
    'more cinematic',
    'ameliore ce prompt',
    'améliore ce prompt',
    'ameliore',
    'améliore',
  ]);
}

function isExistingPromptEditRequest(text: string): boolean {
  return containsAny(text, [
    'edit prompt',
    'edit a prompt',
    'edit my prompt',
    'edit existing prompt',
    'rewrite prompt',
    'rewrite a prompt',
    'rewrite a bad prompt',
    'fix my prompt',
    'fix prompt',
    'optimize prompt',
    'optimise prompt',
    'prompt to improve',
    'prompt a ameliorer',
    'prompt à améliorer',
    'editer un prompt',
    'éditer un prompt',
    'editer mon prompt',
    'éditer mon prompt',
    'modifier un prompt',
    'modifier mon prompt',
    'retravailler un prompt',
    'optimiser un prompt',
    'corriger un prompt',
    'this prompt is too generic',
    'prompt is too generic',
  ]);
}

function isDirectGenerationExecutionRequest(text: string): boolean {
  return containsAny(text, [
    'can u just generate it',
    'can you just generate it',
    'can you generate it for me',
    'just generate it',
    'run generation for me',
  ]);
}

function isPromptPasteNeededRequest(text: string): boolean {
  return containsAny(text, [
    'improve this prompt',
    'improve my prompt',
    'improve prompt',
    'edit a prompt',
    'edit my prompt',
    'optimize prompt',
    'rewrite prompt',
    'rewrite a prompt',
    'rewrite a bad prompt',
    'fix my prompt',
    'fix prompt',
    'this prompt is too generic',
    'prompt is too generic',
    'too generic',
    'prompt for',
  ]);
}

function isPromptShareOffer(text: string): boolean {
  return containsAny(text, [
    'can i share it',
    'can i paste it',
    'can i paste my prompt',
    'can i paste the prompt',
    'can i share my prompt',
    'i can share it',
    'i have a prompt',
    'i have an existing prompt',
    'i already have a prompt',
    'i want to share my prompt',
    'here is my prompt',
    'voici mon prompt',
    'je peux te le partager',
    'peux te le partager',
    'je peux le partager',
    'je peux partager mon prompt',
    'je te partage mon prompt',
    'te partager mon prompt',
    'te le partager',
    'g deja un prompt',
    'j ai deja un prompt',
    'j ai déjà un prompt',
    'jai deja un prompt',
    'jai déjà un prompt',
    'deja un prompt',
    'déjà un prompt',
  ]);
}

function modelLabel(modelId: AiStrategistModelId): string {
  return AI_STRATEGIST_MODELS.find((model) => model.id === modelId)?.label ?? modelId;
}

function isAmbiguousFollowUp(text: string): boolean {
  return (
    /\b(?:make it better|make this better|improve it|go ahead)\b/.test(text) ||
    /^(?:better|ok|yes|go|continue)$/.test(text)
  );
}

function isAssumptionRequest(text: string): boolean {
  return containsAny(text, ['make assumptions', 'smart assumptions', 'go ahead', 'continue', 'vas y', 'vas-y', 'assume', 'assumptions']);
}

function isPromptConfirmation(text: string): boolean {
  return (
    /^(yes|yep|ok|okay|go|go ahead|generate|generate prompt|build prompt|confirm|confirmed|do it|continue|vas y|vas-y)\b/.test(text) ||
    containsAny(text, ['generate prompt', 'build prompt', 'go ahead', 'do it', 'continue'])
  );
}

function isContextualBriefRevision(text: string): boolean {
  if (!text) return false;
  if (isProductHelpRequest(text) || resolveNavigationSuggestion(text)) return false;
  if (/\b(?:change|choose|switch|select|use|prendre|choisir|changer)\s+(?:the\s+)?(?:model|engine|tier|best|medium|value|modele|modèle)\b/.test(text)) return false;
  return (
    /\b(?:duration|seconds?|secs?|secondes?|dure|durer|15s|10s|8s|6s)\b/.test(text) ||
    /\b(?:9:16|16:9|1:1|vertical|landscape|portrait|format)\b/.test(text) ||
    /\b(?:change|modify|update|adjust|revise|make it|make this|mets|mettre|modifie|modifier|change|changer|ajoute|ajouter|enleve|enlever)\b/.test(text) ||
    /\b(?:more|less|plus|moins|premium|cinematic|social|tiktok|influencer|english|anglais|french|francais|français)\b/.test(text) ||
    /\b(?:voiceover|dialogue|spoken|speaking|lip-sync|audio|sfx|music|dit|disent|dire)\b/.test(text) ||
    /\b(?:camera|close-up|wide|push-in|handheld|orbit|lighting|style|mood|background)\b/.test(text) ||
    /\b(?:prompt|brief)\b/.test(text)
  );
}

function isShortModelSelection(text: string): boolean {
  return text.split(/\s+/).filter(Boolean).length <= 4;
}

function includesPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(?:^|\\b)${escapeRegExp(normalizeSearchText(phrase))}(?:\\b|$)`).test(text);
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(normalizeSearchText(needle)));
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9:.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
