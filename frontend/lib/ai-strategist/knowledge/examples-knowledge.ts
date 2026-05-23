import {
  getExampleFamilyDescriptor,
  getExampleFamilyVariantLabels,
  resolveExampleFamilyId,
} from '../../model-families';
import { resolveModelId } from './model-knowledge';
import type { StrategistKnowledgeSource, StrategistKnowledgeToolResult } from './types';

const modelIdToFamily: Record<string, string> = {
  'kling-3-standard': 'kling',
  'kling-3-pro': 'kling',
  'kling-3-4k': 'kling',
  'veo-3-1-lite': 'veo',
  'veo-3-1-fast': 'veo',
  'veo-3-1': 'veo',
  'seedance-2-0-fast': 'seedance',
  'seedance-2-0': 'seedance',
  'ltx-2-3': 'ltx',
  'happy-horse-1-0': 'happy-horse',
  pika: 'pika',
  hailuo: 'hailuo',
  sora: 'sora',
};

export function answerExamplesQuestion(input: { rawUserMessage: string }): StrategistKnowledgeToolResult {
  const modelId = resolveModelId(input.rawUserMessage);
  const familyId = resolveFamilyId(input.rawUserMessage, modelId);
  const family = familyId ? getExampleFamilyDescriptor(familyId) : null;

  if (!familyId || !family) {
    return {
      toolName: 'examples_help',
      answer: [
        'Examples hub: /examples.',
        'Use it to inspect real outputs, prompts, settings, and model behavior before choosing a model.',
        'I could not match a specific model family, so I will not invent a family examples page.',
        'I will not navigate automatically, run generation, or spend credits.',
      ].join('\n'),
      sources: examplesSources(),
      confidence: 0.54,
      limitations: ['No exact examples family was resolved from the message.'],
      warnings: [],
      uiActions: [],
    };
  }

  const variantLabels = getExampleFamilyVariantLabels(familyId);
  const familyHref = `/examples/${familyId}`;
  const coveredModels = variantLabels.length ? ` Current examples include: ${variantLabels.slice(0, 4).join(', ')}.` : '';

  return {
    toolName: 'examples_help',
    answer: [
      `${family.label} examples: ${familyHref}.`,
      `Use this page to inspect real outputs, reusable prompts, settings, and model behavior before generating.${coveredModels}`,
      'I will not navigate automatically, run generation, or spend credits.',
    ].join('\n'),
    sources: examplesSources(),
    confidence: 0.88,
    limitations: ['Examples availability follows the public examples family configuration.'],
    warnings: [],
    uiActions: modelId ? [{ type: 'SET_MODEL', value: modelId }] : [],
  };
}

function resolveFamilyId(rawUserMessage: string, modelId?: string): string | null {
  if (modelId && modelIdToFamily[modelId]) return modelIdToFamily[modelId];
  const normalized = normalizeSearchText(rawUserMessage);
  const direct = resolveExampleFamilyId(normalized);
  if (direct) return direct;
  return Object.entries(modelIdToFamily).find(([modelAlias]) => normalized.includes(modelAlias))?.[1] ?? null;
}

function examplesSources(): StrategistKnowledgeSource[] {
  return [
    {
      id: 'examples_catalog',
      label: 'Examples family catalog',
      path: 'frontend/lib/model-families.ts',
    },
    {
      id: 'examples_catalog',
      label: 'Examples page copy',
      path: 'frontend/lib/examples/modelLandingData.en.ts',
    },
  ];
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
