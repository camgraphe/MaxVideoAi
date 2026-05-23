import type { StrategistOrchestratorTask } from '../orchestrator';
import type { StrategistKnowledgeToolInput, StrategistKnowledgeToolName, StrategistKnowledgeToolResult } from './types';
import { answerEnginePricingQuestion, answerEngineSettingsQuestion } from './engine-catalog-knowledge';
import { answerExamplesQuestion } from './examples-knowledge';
import { answerModelInfoQuestion } from './model-knowledge';
import { answerSiteNavigationQuestion } from './site-navigation-knowledge';
import { answerWorkflowQuestion } from './workflow-knowledge';

export function selectStrategistKnowledgeTool(task: StrategistOrchestratorTask, message: string): StrategistKnowledgeToolName | null {
  const text = normalizeSearchText(message);
  if (task === 'capability_help') return 'capability_help';
  if (task === 'site_overview_help') return 'site_overview';
  if (task === 'pricing_help') return 'engine_pricing';
  if (task === 'examples_help') return 'examples_help';
  if (task === 'workflow_help') return 'workflow_help';
  if (task === 'navigation_help' || task === 'asset_reference_help') return 'navigation_help';
  if (/\b(search (?:your )?docs|search docs|docs search|rag|knowledge base)\b/.test(text)) return 'docs_search';
  if (/\b(example|examples|sample|gallery|exemples?)\b/.test(text)) return 'examples_help';
  if (/\b(settings?|resolution|duration|audio|lip sync|lip-sync|mode)\b/.test(text)) return 'engine_settings';
  if (task === 'model_info_help') return 'model_info';
  if (/\b(model|seedance|kling|veo|ltx|pika|hailuo|sora|happy horse)\b/.test(text)) return 'model_info';
  return null;
}

export function runStrategistKnowledgeTool(input: {
  task: StrategistOrchestratorTask;
  toolInput: StrategistKnowledgeToolInput;
}): StrategistKnowledgeToolResult | null {
  const toolName = selectStrategistKnowledgeTool(input.task, input.toolInput.rawUserMessage);
  if (toolName === 'engine_pricing') return answerEnginePricingQuestion(input.toolInput);
  if (toolName === 'engine_settings') return answerEngineSettingsQuestion(input.toolInput);
  if (toolName === 'examples_help') return answerExamplesQuestion(input.toolInput);
  if (toolName === 'navigation_help') return answerSiteNavigationQuestion(input.toolInput);
  if (toolName === 'docs_search') return answerDocsSearchDisabledQuestion();
  if (toolName === 'model_info') return answerModelInfoQuestion(input.toolInput);
  if (toolName === 'workflow_help') return answerWorkflowQuestion(input.toolInput);
  return null;
}

function answerDocsSearchDisabledQuestion(): StrategistKnowledgeToolResult {
  return {
    toolName: 'docs_search',
    answer: [
      'Docs/RAG search is not connected yet.',
      'I can still answer from available structured MaxVideoAI sources: model catalog, workflow rules, prompt structures, engine catalog, examples routes, and site navigation.',
      'I will not search private projects, run generation, or spend credits.',
    ].join('\n'),
    sources: [
      {
        id: 'docs_rag',
        label: 'AI Strategist RAG boundary',
        path: 'docs/ai-strategist/knowledge-sources.md',
      },
    ],
    confidence: 0.82,
    limitations: ['RAG is disabled until explicitly connected in a later implementation.'],
    warnings: [],
    uiActions: [],
  };
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
