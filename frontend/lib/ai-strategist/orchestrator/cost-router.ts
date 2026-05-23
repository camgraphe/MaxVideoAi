import type { StrategistOrchestratorInput } from './types';
import type {
  StrategistLlmRoutingPlan,
  StrategistLlmTier,
  StrategistOrchestratorTask,
} from './types';

export function selectStrategistLlmRouting(input: {
  task: StrategistOrchestratorTask;
  orchestratorInput: StrategistOrchestratorInput;
}): StrategistLlmRoutingPlan {
  const text = normalizeSearchText(input.orchestratorInput.rawUserMessage);
  const hasPreviousBrief = Boolean(input.orchestratorInput.conversationState?.lastNormalizedBrief?.normalizedBrief);
  const knowledgeSynthesis = selectKnowledgeSynthesisTier(input.task, text);

  if (isDeterministicHelpTask(input.task)) {
    return {
      briefRefinement: 'none',
      promptWriter: 'none',
      knowledgeSynthesis,
      reason: 'Deterministic help/navigation turn; no creative LLM is needed.',
    };
  }

  if (input.task === 'prompt_edit_intake' || input.task === 'clarification' || input.task === 'unknown') {
    return {
      briefRefinement: 'none',
      promptWriter: 'none',
      knowledgeSynthesis,
      reason: 'The assistant is collecting user input before any creative generation step.',
    };
  }

  if (input.task === 'model_or_tier_selection' && hasPreviousBrief) {
    return {
      briefRefinement: 'none',
      promptWriter: 'strong',
      knowledgeSynthesis,
      reason: 'Model/tier selection can reuse the previous normalized brief; reserve LLM budget for the final prompt writer.',
    };
  }

  if (input.task === 'prompt_build' && hasPreviousBrief && isShortSelectionOrConfirmation(text)) {
    return {
      briefRefinement: 'none',
      promptWriter: 'strong',
      knowledgeSynthesis,
      reason: 'The user confirmed an existing direction; reuse state and spend only on the prompt writer if confirmation passes.',
    };
  }

  if (input.task === 'prompt_edit') {
    return {
      briefRefinement: shouldUseCheapBriefRefinement(text, input.orchestratorInput.currentPrompt) ? 'cheap' : 'none',
      promptWriter: 'strong',
      knowledgeSynthesis,
      reason: 'Prompt editing needs the strongest model only for the final rewrite; brief refinement is cheap or deterministic.',
    };
  }

  if (input.task === 'new_video_brief' || input.task === 'model_advice') {
    if (input.orchestratorInput.surface !== 'chat') {
      return {
        briefRefinement: 'cheap',
        promptWriter: 'strong',
        knowledgeSynthesis,
        reason: 'Debug/evaluation surfaces may build the deterministic prompt preview immediately; use cheap brief refinement and strong prompt writing when configured.',
      };
    }

    return {
      briefRefinement: 'cheap',
      promptWriter: 'none',
      knowledgeSynthesis,
      reason: 'A new creative brief benefits from inexpensive normalization before deterministic model routing.',
    };
  }

  return {
    briefRefinement: 'cheap',
    promptWriter: 'none',
    knowledgeSynthesis,
    reason: 'Default to cheap refinement and deterministic routing until prompt writing is required.',
  };
}

export function shouldDisableBriefLlm(tier: StrategistLlmTier): boolean {
  return tier === 'none';
}

function isDeterministicHelpTask(task: StrategistOrchestratorTask): boolean {
  return task === 'site_help' || task === 'site_overview_help' || task === 'capability_help' || task === 'model_info_help' || task === 'examples_help' || task === 'navigation_help' || task === 'pricing_help' || task === 'workflow_help' || task === 'asset_reference_help';
}

function selectKnowledgeSynthesisTier(task: StrategistOrchestratorTask, text: string): StrategistLlmTier {
  if (!isDeterministicHelpTask(task)) return 'none';
  if (isDirectKnowledgeLookup(task)) return 'none';
  return isBroadKnowledgeQuestion(text) ? 'cheap' : 'none';
}

function isDirectKnowledgeLookup(task: StrategistOrchestratorTask): boolean {
  return task === 'pricing_help' || task === 'model_info_help' || task === 'navigation_help' || task === 'capability_help' || task === 'examples_help';
}

function isBroadKnowledgeQuestion(text: string): boolean {
  const signals = ['model', 'models', 'pricing', 'price', 'cost', 'settings', 'examples', 'compare', 'workflow', 'generate', 'upload'];
  return signals.filter((signal) => text.includes(signal)).length >= 2;
}

function isShortSelectionOrConfirmation(text: string): boolean {
  return /^(best|medium|value|ok|okay|yes|yep|go|go ahead|generate prompt|build prompt|confirm|confirmed|continue|vas y|vas-y|use [a-z0-9 .-]+|choose [a-z0-9 .-]+)$/.test(text);
}

function shouldUseCheapBriefRefinement(text: string, currentPrompt?: string): boolean {
  if (currentPrompt?.trim()) return true;
  return text.length > 80 || containsAny(text, ['premium', 'cinematic', 'product', 'social', 'voiceover', 'dialogue']);
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function normalizeSearchText(value: unknown): string {
  return typeof value === 'string'
    ? value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’']/g, ' ')
        .replace(/[^a-z0-9:.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}
