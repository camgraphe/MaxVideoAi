import { AI_STRATEGIST_MODELS, getAiStrategistModel } from '../model-catalog';
import type { AiStrategistModelId } from '../types';
import type { StrategistKnowledgeToolResult } from './types';

const modelAliases: readonly { modelId: AiStrategistModelId; aliases: readonly string[] }[] = [
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

export function answerModelInfoQuestion(input: { rawUserMessage: string }): StrategistKnowledgeToolResult | null {
  const modelId = resolveModelId(input.rawUserMessage);
  if (!modelId) return null;

  const model = getAiStrategistModel(modelId);
  const warnings = model.personImageToVideoCompatibility === 'avoid' || model.personImageToVideoCompatibility === 'conditional'
    ? [`${model.label} has ${model.personImageToVideoCompatibility} person/reference image compatibility. Use stricter routing when preserving uploaded people or characters.`]
    : [];

  return {
    toolName: 'model_info',
    answer: [
      `${model.label} is a ${model.qualityLevel} quality, ${model.relativeSpeedLevel} speed, ${model.relativeCostLevel} cost MaxVideoAI model.`,
      `Best for: ${model.bestFor.slice(0, 4).join(', ')}.`,
      `Avoid for: ${model.avoidFor.slice(0, 3).join(', ')}.`,
      `Supported workflows: ${model.supportedWorkflows.join(', ')}.`,
      `Prompt style: ${model.promptStyle}`,
      'Use this as model guidance only.',
    ].join('\n'),
    sources: [
      {
        id: 'ai_strategist_model_catalog',
        label: 'AI Strategist model catalog',
        path: 'frontend/lib/ai-strategist/model-catalog.ts',
      },
    ],
    confidence: 0.92,
    limitations: ['This answer uses the AI Strategist catalog. Engine-specific settings and live generator availability are handled by the engine catalog tool in a later phase.'],
    warnings,
    uiActions: [{ type: 'SET_MODEL', value: model.id }],
  };
}

export function resolveModelId(value: string): AiStrategistModelId | undefined {
  const text = normalizeSearchText(value);
  const directId = AI_STRATEGIST_MODELS.find((model) => text.includes(model.id))?.id;
  if (directId) return directId;
  return modelAliases.find((entry) => entry.aliases.some((alias) => includesPhrase(text, alias)))?.modelId;
}

function includesPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(?:^|\\b)${escapeRegExp(normalizeSearchText(phrase))}(?:\\b|$)`).test(text);
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
