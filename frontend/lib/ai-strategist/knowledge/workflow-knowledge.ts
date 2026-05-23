import { AI_STRATEGIST_MODELS } from '../model-catalog';
import { getAiStrategistWorkflowRule } from '../workflow-rules';
import type { AiStrategistWorkflowId } from '../types';
import type { StrategistKnowledgeToolResult } from './types';

export function answerWorkflowQuestion(input: {
  rawUserMessage: string;
  selectedWorkflow?: AiStrategistWorkflowId;
}): StrategistKnowledgeToolResult {
  const workflowId = input.selectedWorkflow ?? resolveWorkflowId(input.rawUserMessage) ?? 'text-to-video';
  const workflow = getAiStrategistWorkflowRule(workflowId);
  const supportingModels = AI_STRATEGIST_MODELS
    .filter((model) => model.supportedWorkflows.includes(workflowId))
    .map((model) => model.label);

  return {
    toolName: 'workflow_help',
    answer: [
      `${workflow.label} (${workflow.id}): ${workflow.description}`,
      `Use it for: ${workflow.bestFor.slice(0, 3).join(', ')}.`,
      workflowId === 'image-to-video'
        ? 'Start from a reference image, then write a motion prompt that separates what moves from what must stay preserved.'
        : undefined,
      `Models currently listed for ${workflow.id}: ${supportingModels.slice(0, 8).join(', ')}.`,
      `Planning steps: ${workflow.planningSteps.slice(0, 3).join(' ')}`,
    ].filter(Boolean).join('\n'),
    sources: [
      {
        id: 'ai_strategist_workflow_rules',
        label: 'AI Strategist workflow rules',
        path: 'frontend/lib/ai-strategist/workflow-rules.ts',
      },
      {
        id: 'ai_strategist_model_catalog',
        label: 'AI Strategist model catalog',
        path: 'frontend/lib/ai-strategist/model-catalog.ts',
      },
    ],
    confidence: 0.9,
    limitations: ['This answer uses strategist workflow/model catalogs. Exact generator-mode availability and settings will be checked by the engine catalog tool in a later phase.'],
    warnings: workflowId === 'image-to-video'
      ? ['Person or character reference images need compatible image-to-video routing to reduce identity drift.']
      : [],
    uiActions: [{ type: 'SET_WORKFLOW', value: workflowId }],
  };
}

export function resolveWorkflowId(value: string): AiStrategistWorkflowId | undefined {
  const text = normalizeSearchText(value);
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
  return undefined;
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(normalizeSearchText(needle)));
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
