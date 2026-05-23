import { AI_STRATEGIST_MODELS, getAiStrategistModel } from '../model-catalog';
import { AI_STRATEGIST_WORKFLOWS, getAiStrategistWorkflowRule } from '../workflow-rules';
import type { StrategistConversationPlan } from '../conversation-planner';
import type { AiStrategistModelId, AiStrategistWorkflowId } from '../types';
import type { StrategistOrchestratorTask } from './types';

export type StrategistAdvisorToolResult = {
  assistantMessage: string;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  navigationSuggestion?: StrategistConversationPlan['navigationSuggestion'];
  warnings: string[];
  uiActions: { type: 'SET_MODEL' | 'SET_WORKFLOW'; value: string }[];
};

export function isStrategistAdvisorHelpTask(task: StrategistOrchestratorTask): boolean {
  return task === 'site_help' || task === 'site_overview_help' || task === 'capability_help' || task === 'model_info_help' || task === 'examples_help' || task === 'pricing_help' || task === 'navigation_help' || task === 'workflow_help' || task === 'asset_reference_help';
}

export function runStrategistAdvisorHelpTool(input: {
  task: StrategistOrchestratorTask;
  rawUserMessage: string;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  conversationPlan: StrategistConversationPlan;
}): StrategistAdvisorToolResult {
  const text = normalizeSearchText(input.rawUserMessage);
  if (input.task === 'capability_help') return buildCapabilityHelp(text);
  if (input.task === 'site_overview_help') return buildSiteOverviewHelp(text);
  if (input.task === 'pricing_help') return buildPricingHelp(input, text);
  if (input.task === 'workflow_help') return buildWorkflowHelp(input, text);
  if (input.task === 'asset_reference_help') return buildAssetReferenceHelp(input);
  return buildSiteHelp(input, text);
}

function buildCapabilityHelp(text: string): StrategistAdvisorToolResult {
  if (isFrenchText(text)) {
    return {
      assistantMessage: [
        'Je peux t’aider à choisir le bon modèle MaxVideoAI, comparer qualité/coût/vitesse, préparer ou améliorer un prompt, expliquer les workflows, estimer le prix avant génération, et guider l’upload d’images ou de références.',
        'Je peux aussi signaler les risques utiles: logo, texte minuscule, packaging, personne réelle, lip-sync, durée, format et coût probable.',
        'Je ne lance jamais une génération, ne dépense pas de crédits, ne publie rien et n’applique rien au vrai générateur depuis ce playground.',
      ].join('\n'),
      warnings: [],
      uiActions: [],
    };
  }

  return {
    assistantMessage: [
      'I can help you choose the right MaxVideoAI model, compare quality/cost/speed tradeoffs, improve prompts, build model-specific prompts, explain workflows, estimate cost before generation, and guide image/reference uploads.',
      'I can also flag practical risks: logos, tiny text, packaging, real-person references, lip-sync, duration, format, and likely cost.',
      'I will not run generation, spend credits, publish anything, or apply changes to the real generator from this playground.',
    ].join('\n'),
    warnings: [],
    uiActions: [],
  };
}

function buildSiteOverviewHelp(text: string): StrategistAdvisorToolResult {
  if (isFrenchText(text)) {
    return {
      assistantMessage: [
        'MaxVideoAI sert à créer des vidéos IA avec des workflows comme text-to-video, image-to-video, image generation puis animation, ou video-to-video.',
        'Dans le générateur vidéo, tu compares les modèles, prépares ou améliores le prompt, vérifies les warnings, regardes le prix avant génération, puis lances manuellement quand tout est prêt.',
        'Le strategist t’aide à choisir le bon chemin et à préparer le prompt, mais il ne lance pas la génération et ne dépense pas de crédits.',
      ].join('\n'),
      warnings: [],
      uiActions: [],
    };
  }

  return {
    assistantMessage: [
      'MaxVideoAI helps you create AI videos through workflows like text-to-video, image-to-video, text-to-image then image-to-video, and video-to-video.',
      'In the video generator, you compare models, prepare or improve the prompt, check warnings, review the price shown before generation, then launch manually when ready.',
      'The strategist helps choose the route and prepare the prompt, but it does not run generation or spend credits.',
    ].join('\n'),
    warnings: [],
    uiActions: [],
  };
}

function buildPricingHelp(
  input: Parameters<typeof runStrategistAdvisorHelpTool>[0],
  text: string
): StrategistAdvisorToolResult {
  const modelId = input.selectedModel ?? resolveModelId(text);
  const durationSeconds = resolveDurationSeconds(text) ?? 8;
  if (modelId) {
    const model = getAiStrategistModel(modelId);
    const estimatedAmountCents = Math.max(25, Math.round(durationSeconds * estimatedCentsPerSecond(modelId)));
    return {
      assistantMessage: [
        `${model.label} is a ${model.relativeCostLevel} cost model in the strategist catalog.`,
        `Estimated price: about ${formatUsd(estimatedAmountCents)} for ${durationSeconds} seconds.`,
        'Use this preview to choose the model and duration in the generator before you launch manually.',
        'Treat this as guidance only: the final generator quote shown before rendering is authoritative, and I will not run generation or spend credits.',
      ].join('\n'),
      selectedModel: modelId,
      warnings: ['Preview pricing is approximate. The MaxVideoAI generator quote shown before rendering is authoritative.'],
      uiActions: [{ type: 'SET_MODEL', value: modelId }],
    };
  }

  return {
    assistantMessage: [
      'Price depends mainly on model, workflow, duration, resolution, and audio settings.',
      'Give me a model and duration, for example “Seedance 2 for 8 seconds”, and I can give a strategist preview estimate.',
      'The generator quote shown before rendering remains the source of truth, and I will not spend credits.',
    ].join('\n'),
    warnings: ['Preview pricing is approximate. The MaxVideoAI generator quote shown before rendering is authoritative.'],
    uiActions: [],
  };
}

function buildWorkflowHelp(
  input: Parameters<typeof runStrategistAdvisorHelpTool>[0],
  text: string
): StrategistAdvisorToolResult {
  const workflowId = input.selectedWorkflow ?? resolveWorkflowId(text) ?? 'text-to-video';
  const workflow = getAiStrategistWorkflowRule(workflowId);
  const firstPlanningStep = workflow.planningSteps[0] ?? 'Write a clear prompt before choosing settings.';
  const workflowSpecificTip = workflowId === 'image-to-video'
    ? 'Start from a reference image, then describe the motion prompt: what moves, what stays preserved, camera movement, atmosphere, and end frame.'
    : undefined;
  return {
    assistantMessage: [
      `${workflow.label}: ${workflow.description}`,
      `Use it when: ${workflow.bestFor.slice(0, 2).join(', ')}.`,
      workflowSpecificTip,
      `Good first step: ${firstPlanningStep}`,
      'This is guidance only; the strategist does not run generation or spend credits.',
    ].filter(Boolean).join('\n'),
    selectedWorkflow: workflowId,
    warnings: [],
    uiActions: [{ type: 'SET_WORKFLOW', value: workflowId }],
  };
}

function buildAssetReferenceHelp(
  input: Parameters<typeof runStrategistAdvisorHelpTool>[0]
): StrategistAdvisorToolResult {
  const suggestion = input.conversationPlan.navigationSuggestion ?? {
    label: 'Video generator',
    href: '/app',
    reason: 'Open the video generator, choose image-to-video, then upload or select the reference image.',
  };
  return {
    assistantMessage: [
      'For a reference image, open the video generator, choose image-to-video, upload or select the image in MaxVideoAI, then write a motion prompt.',
      'If the image contains a real person or character, use a compatible image-to-video model and keep identity preservation expectations realistic.',
      `Suggested destination: ${suggestion.label} (${suggestion.href}). I will not navigate automatically.`,
    ].join('\n'),
    selectedWorkflow: 'image-to-video',
    navigationSuggestion: suggestion,
    warnings: ['Person or character reference images need compatible image-to-video routing to reduce identity drift.'],
    uiActions: [{ type: 'SET_WORKFLOW', value: 'image-to-video' }],
  };
}

function buildSiteHelp(
  input: Parameters<typeof runStrategistAdvisorHelpTool>[0],
  text: string
): StrategistAdvisorToolResult {
  const suggestion = input.conversationPlan.navigationSuggestion ?? resolveModelNavigation(text);
  if (suggestion) {
    return {
      assistantMessage: `${suggestion.reason} Suggested destination: ${suggestion.label} (${suggestion.href}). I will not navigate automatically.`,
      navigationSuggestion: suggestion,
      warnings: [],
      uiActions: [],
    };
  }

  return {
    assistantMessage: [
      'I can help with model choice, prompt improvement, workflow setup, reference-image guidance, and pricing previews.',
      'To generate, open the video generator, choose the workflow, enter or improve your prompt, compare models, check the price shown before generation, then launch manually.',
      'I will not run generation, spend credits, publish, or apply changes to the real generator from this playground.',
    ].join('\n'),
    warnings: [],
    uiActions: [],
  };
}

function resolveModelNavigation(text: string): StrategistConversationPlan['navigationSuggestion'] | undefined {
  const modelId = resolveModelId(text);
  if (!modelId) return undefined;
  const model = getAiStrategistModel(modelId);
  return {
    label: model.label,
    href: `/models/${model.id}`,
    reason: `Open the ${model.label} model page to inspect examples, settings, prompt guidance, and workflow fit.`,
  };
}

function resolveModelId(text: string): AiStrategistModelId | undefined {
  const aliases: readonly { modelId: AiStrategistModelId; aliases: readonly string[] }[] = [
    { modelId: 'seedance-2-0-fast', aliases: ['seedance fast', 'sidance fast', 'seedance 2 fast', 'seedance 2.0 fast'] },
    { modelId: 'seedance-2-0', aliases: ['seedance', 'sidance', 'seedance 2', 'seedance 2.0'] },
    { modelId: 'kling-3-4k', aliases: ['kling 4k', 'kling 3 4k'] },
    { modelId: 'kling-3-pro', aliases: ['kling pro', 'kling 3 pro', 'kling'] },
    { modelId: 'kling-3-standard', aliases: ['kling standard', 'kling 3 standard'] },
    { modelId: 'veo-3-1-fast', aliases: ['veo fast', 'veo 3.1 fast'] },
    { modelId: 'veo-3-1-lite', aliases: ['veo lite', 'veo 3.1 lite'] },
    { modelId: 'veo-3-1', aliases: ['veo', 'veo 3', 'veo 3.1'] },
    { modelId: 'ltx-2-3', aliases: ['ltx', 'ltx 2.3'] },
    { modelId: 'happy-horse-1-0', aliases: ['happy horse', 'happyhorse'] },
    { modelId: 'pika', aliases: ['pika'] },
    { modelId: 'hailuo', aliases: ['hailuo'] },
    { modelId: 'sora', aliases: ['sora'] },
  ];
  const directId = AI_STRATEGIST_MODELS.find((model) => text.includes(model.id))?.id;
  if (directId) return directId;
  return aliases.find((entry) => entry.aliases.some((alias) => includesPhrase(text, alias)))?.modelId;
}

function resolveWorkflowId(text: string): AiStrategistWorkflowId | undefined {
  if (containsAny(text, [
    'text to image then image to video',
    'text-to-image-then-image-to-video',
    'starting image',
    'still image first',
    'generate a still image first',
    'better product control',
    'product control',
  ])) return 'text-to-image-then-image-to-video';
  if (containsAny(text, ['image to video', 'image-to-video', 'i2v', 'reference image'])) return 'image-to-video';
  if (containsAny(text, ['video to video', 'video-to-video', 'v2v', 'restyle'])) return 'video-to-video';
  if (containsAny(text, ['text to video', 'text-to-video', 't2v'])) return 'text-to-video';
  return AI_STRATEGIST_WORKFLOWS.find((workflow) => text.includes(workflow.id))?.id;
}

function resolveDurationSeconds(text: string): number | undefined {
  const match = text.match(/\b(\d{1,3})\s*(?:seconds?|secs?|s|secondes?)\b/);
  if (!match) return undefined;
  const value = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(value)) return undefined;
  return Math.min(Math.max(value, 1), 60);
}

function estimatedCentsPerSecond(modelId: AiStrategistModelId): number {
  const model = getAiStrategistModel(modelId);
  if (model.id === 'kling-3-4k') return 58;
  if (model.id === 'veo-3-1') return 44;
  if (model.id === 'veo-3-1-fast' || model.id === 'kling-3-pro') return 30;
  if (model.id === 'happy-horse-1-0') return 24;
  if (model.id === 'veo-3-1-lite' || model.id === 'ltx-2-3' || model.id === 'seedance-2-0-fast') return 12;
  if (model.id === 'kling-3-standard') return 16;
  if (model.id === 'seedance-2-0') return 18;
  if (model.relativeCostLevel === 'premium') return 44;
  if (model.relativeCostLevel === 'high') return 30;
  if (model.relativeCostLevel === 'medium') return 18;
  return 12;
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function includesPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(?:^|\\b)${escapeRegExp(normalizeSearchText(phrase))}(?:\\b|$)`).test(text);
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(normalizeSearchText(needle)));
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

function isFrenchText(text: string): boolean {
  const frenchTokens = text.match(/\b(?:tu|peux|quoi|comment|fonctionne|marche|aide|capacites|modele|modeles|generer|creer|prix)\b/g) ?? [];
  if (frenchTokens.length === 0) return false;

  const englishTokens = text.match(/\b(?:can|you|help|choose|models|prompts|what|how|here)\b/g) ?? [];
  return !(englishTokens.length >= 2 && frenchTokens.length <= 1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
