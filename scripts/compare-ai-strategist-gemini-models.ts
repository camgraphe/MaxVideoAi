import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  runAiStrategistPlaygroundPipeline,
  type AiStrategistPlaygroundInput,
  type AiStrategistPlaygroundResult,
} from '../frontend/lib/ai-strategist/playground-pipeline.ts';
import type { StrategistConversationTurn } from '../frontend/lib/ai-strategist/conversation-planner.ts';

type EnvFileLoadResult = {
  path: string;
  exists: boolean;
  loaded: boolean;
};

type ScenarioKey = 'car_seedance' | 'perfume' | 'sneaker_voiceover' | 'arcade_fight';

type Scenario = {
  key: ScenarioKey;
  label: string;
  firstMessage: string;
  selectionMessage: string;
};

type TurnSummary = {
  userMessage: string;
  plannerAction: string;
  stage: string;
  workflow: string | null;
  selectedModel: string | null;
  assistantMessage: string;
  clarificationQuestion?: string;
  elapsedMs: number;
  briefLlmUsed: boolean;
  promptLlmUsed: boolean;
  promptFallbackReason?: string;
};

type ScenarioRun = {
  model: string;
  caseKey: ScenarioKey;
  fallbackUsed: boolean;
  totalLatencyMs: number;
  tokenUsage: string;
  turns: TurnSummary[];
  plannerAction: string;
  normalizedBrief: string;
  clarificationQuestions: string[];
  workflow: string | null;
  selectedModel: string | null;
  recommendations: string;
  finalPromptPreview: string;
  promptWriterQualityNotes: string[];
  validatorIssues: string[];
  errors: string[];
};

const scenarios: readonly Scenario[] = [
  {
    key: 'car_seedance',
    label: 'French car brief -> ok seedance',
    firstMessage: 'une pub de voiture dynamique',
    selectionMessage: 'ok seedance',
  },
  {
    key: 'perfume',
    label: 'Luxury perfume product ad',
    firstMessage: 'Luxury perfume ad on black marble, 9:16, premium look, slow camera push-in, soft gold reflections',
    selectionMessage: 'Best',
  },
  {
    key: 'sneaker_voiceover',
    label: 'Fast TikTok sneaker voiceover',
    firstMessage: 'Make assumptions and create a TikTok sneaker ad with voiceover',
    selectionMessage: 'Best',
  },
  {
    key: 'arcade_fight',
    label: 'Street Fighter style fight',
    firstMessage: 'I want a Street Fighter style fight',
    selectionMessage: 'Best',
  },
];

const defaultModels = ['gemini-3.1-flash-lite', 'gemini-3.1-flash', 'gemini-2.5-pro'] as const;
const turnTimeoutMs = Number.parseInt(process.env.AI_STRATEGIST_MODEL_COMPARE_TIMEOUT_MS ?? '45000', 10);

async function main() {
  const envLoadResults = loadLocalEnvFiles();
  const models = selectedModels();

  console.log('AI Strategist Gemini Model Comparison');
  console.log('RAG connected: no');
  console.log('Frontend UI changed: no');
  console.log('Auto-generation/credit spend/publish: no MaxVideoAI generation, no MaxVideoAI credits, no publishing');
  console.log(
    `Env files: ${envLoadResults
      .map((result) => `${relative(process.cwd(), result.path) || result.path}=${result.loaded ? 'loaded' : result.exists ? 'present-not-loaded' : 'missing'}`)
      .join('; ')}`
  );
  console.log(`GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: ${process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON ? 'present' : 'missing'}`);
  console.log(`Vertex base env complete: ${hasVertexBaseEnv(process.env) ? 'yes' : 'no'}`);
  console.log(`Models: ${models.join(', ')}`);
  console.log('');

  if (!hasVertexBaseEnv(process.env)) {
    console.log('Skipping live comparison: missing provider/project/location/service-account env.');
    return;
  }

  const runs: ScenarioRun[] = [];
  for (const model of models) {
    for (const scenario of scenarios) {
      console.log(`Running ${model} / ${scenario.label}...`);
      runs.push(await runScenario(model, scenario));
    }
  }

  console.log('');
  printComparison(runs);
}

function selectedModels(): string[] {
  const cliModels = process.argv
    .slice(2)
    .flatMap((arg, index, args) => {
      if (arg === '--model') return args[index + 1] ? [args[index + 1]] : [];
      if (arg.startsWith('--model=')) return [arg.slice('--model='.length)];
      return [];
    })
    .map((value) => value.trim())
    .filter(Boolean);
  return cliModels.length ? Array.from(new Set(cliModels)) : [...defaultModels];
}

function loadLocalEnvFiles(): readonly EnvFileLoadResult[] {
  const requireFromFrontend = createRequire(resolve(process.cwd(), 'frontend/package.json'));
  const dotenv = requireFromFrontend('dotenv') as {
    config: (options: { path: string; override?: boolean; quiet?: boolean }) => { parsed?: Record<string, string>; error?: unknown };
  };
  const envPaths = [
    resolve(process.cwd(), 'frontend/.env.local'),
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), 'frontend/.env'),
    resolve(process.cwd(), '.env'),
  ];

  return envPaths.map((path) => {
    const fileExists = existsSync(path);
    if (!fileExists) return { path, exists: false, loaded: false };
    const result = dotenv.config({ path, override: false, quiet: true });
    return { path, exists: true, loaded: !result.error };
  });
}

async function runScenario(model: string, scenario: Scenario): Promise<ScenarioRun> {
  const env = {
    ...process.env,
    AI_STRATEGIST_LLM_MODEL: model,
  };
  const messages: StrategistConversationTurn[] = [];
  const turns: TurnSummary[] = [];
  const errors: string[] = [];
  let lastResult: AiStrategistPlaygroundResult | undefined;
  let totalLatencyMs = 0;

  async function send(userMessage: string, extra: Partial<AiStrategistPlaygroundInput> = {}) {
    const input: AiStrategistPlaygroundInput = {
      surface: 'chat',
      userMessage,
      conversationState: buildConversationState(lastResult, messages),
      ...extra,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), turnTimeoutMs);
    const startedAt = performance.now();
    try {
      const result = await runAiStrategistPlaygroundPipeline(input, { env, signal: controller.signal });
      const elapsedMs = Math.round(performance.now() - startedAt);
      totalLatencyMs += elapsedMs;
      turns.push(summarizeTurn(userMessage, result, elapsedMs));
      messages.push({ role: 'user', content: userMessage });
      messages.push({ role: 'assistant', content: result.assistantMessage });
      lastResult = result;
      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    await send(scenario.firstMessage);
    await send(scenario.selectionMessage);
    await advanceToPrompt();
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  async function advanceToPrompt() {
    for (let index = 0; index < 4; index += 1) {
      if (!lastResult || lastResult.conversationStage === 'prompt_ready') return;
      if (lastResult.conversationStage === 'collecting_missing_fields') {
        await send('Make assumptions');
        continue;
      }
      if (lastResult.conversationStage === 'awaiting_confirmation') {
        await send('Generate prompt');
        continue;
      }
      if (lastResult.conversationStage === 'awaiting_model_choice') {
        await send(scenario.selectionMessage);
        continue;
      }
      return;
    }
  }

  const finalResult = lastResult;
  const validatorIssues = collectValidatorIssues(turns, finalResult);
  const fallbackUsed = turns.some((turn) => !turn.briefLlmUsed || !turn.promptLlmUsed && turn.stage === 'prompt_ready');

  return {
    model,
    caseKey: scenario.key,
    fallbackUsed,
    totalLatencyMs,
    tokenUsage: 'not available from current adapter response',
    turns,
    plannerAction: turns.map((turn) => `${turn.userMessage} -> ${turn.plannerAction}/${turn.stage}`).join(' | '),
    normalizedBrief: finalResult?.normalizedBrief.normalizedBrief ?? '[no result]',
    clarificationQuestions: turns.map((turn) => turn.clarificationQuestion).filter((value): value is string => Boolean(value)),
    workflow: finalResult?.workflow ?? null,
    selectedModel: finalResult?.selectedModel ?? null,
    recommendations: formatRecommendations(finalResult),
    finalPromptPreview: compact(finalResult?.sanitizedFinalOutput?.finalPrompt ?? '', 700),
    promptWriterQualityNotes: buildQualityNotes(scenario, finalResult),
    validatorIssues,
    errors,
  };
}

function buildConversationState(
  lastResult: AiStrategistPlaygroundResult | undefined,
  messages: readonly StrategistConversationTurn[]
): AiStrategistPlaygroundInput['conversationState'] {
  return {
    recentTurns: messages.slice(-8),
    ...(lastResult?.normalizedBrief ? { lastNormalizedBrief: lastResult.normalizedBrief } : {}),
    ...(lastResult?.recommendations ? { lastRecommendations: lastResult.recommendations } : {}),
    ...(lastResult?.selectedModel ? { lastSelectedModel: lastResult.selectedModel } : {}),
    ...(lastResult?.selectedTier ? { lastSelectedTier: lastResult.selectedTier } : {}),
    ...(lastResult?.workflow ? { lastSelectedWorkflow: lastResult.workflow } : {}),
    ...(lastResult?.sanitizedFinalOutput?.finalPrompt ? { lastFinalPrompt: lastResult.sanitizedFinalOutput.finalPrompt } : {}),
    ...(lastResult?.conversationStage ? { stage: lastResult.conversationStage } : {}),
    ...(lastResult?.briefCompletion ? { lastBriefCompletion: lastResult.briefCompletion } : {}),
  };
}

function summarizeTurn(userMessage: string, result: AiStrategistPlaygroundResult, elapsedMs: number): TurnSummary {
  return {
    userMessage,
    plannerAction: result.conversationPlan.action,
    stage: result.conversationStage,
    workflow: result.workflow,
    selectedModel: result.selectedModel,
    assistantMessage: compact(result.assistantMessage, 280),
    ...(result.clarificationQuestion ? { clarificationQuestion: result.clarificationQuestion } : {}),
    elapsedMs,
    briefLlmUsed: result.llm.briefRefinement.used,
    promptLlmUsed: result.llm.promptWriter.used,
    ...(result.llm.promptWriter.fallbackReason ? { promptFallbackReason: result.llm.promptWriter.fallbackReason } : {}),
  };
}

function collectValidatorIssues(
  turns: readonly TurnSummary[],
  finalResult: AiStrategistPlaygroundResult | undefined
): string[] {
  const issues = [
    ...(finalResult?.validationIssuesBeforeSanitizer.brief ?? []),
    ...(finalResult?.validationIssuesBeforeSanitizer.prompt ?? []),
    ...(finalResult?.validationIssuesAfterSanitizer.brief ?? []),
    ...(finalResult?.validationIssuesAfterSanitizer.prompt ?? []),
  ].map((issue) => `${issue.severity}:${issue.code}`);
  const fallbackReasons = turns
    .map((turn) => turn.promptFallbackReason)
    .filter((reason): reason is string =>
      Boolean(reason) &&
      reason !== 'awaiting_model_choice' &&
      reason !== 'awaiting_prompt_confirmation' &&
      reason !== 'brief_completion_required'
    );
  return Array.from(new Set([...issues, ...fallbackReasons.map((reason) => `fallback:${reason}`)]));
}

function buildQualityNotes(scenario: Scenario, result: AiStrategistPlaygroundResult | undefined): string[] {
  if (!result) return ['No final result.'];
  const prompt = result.sanitizedFinalOutput?.finalPrompt ?? '';
  const notes: string[] = [];
  if (scenario.key === 'car_seedance') {
    notes.push(result.selectedModel === 'seedance-2-0' ? 'Selected Seedance from prior recommendations.' : `Expected Seedance, got ${result.selectedModel ?? 'none'}.`);
    notes.push(/voiture|une pub/i.test(prompt) ? 'Problem: final prompt still contains raw French.' : 'Final prompt avoids raw French subject text.');
    notes.push(/car|automotive|vehicle/i.test(`${result.normalizedBrief.normalizedBrief}\n${prompt}`) ? 'Car brief reused/enriched.' : 'Problem: car brief not visible.');
  }
  if (scenario.key === 'perfume') {
    notes.push(result.conversationPlan.action === 'ask_clarification' ? 'Problem: asked generic clarification.' : 'No generic clarification.');
    notes.push(result.workflow === 'text-to-image-then-image-to-video' ? 'Uses controlled starting-image workflow.' : `Workflow is ${result.workflow}.`);
    notes.push(result.warnings.some((warning) => /labels|logos|tiny text|legal copy/i.test(warning)) ? 'Product text/logo warning present.' : 'Problem: product warning missing.');
  }
  if (scenario.key === 'sneaker_voiceover') {
    notes.push(result.normalizedBrief.hasVoiceover ? 'Voiceover detected.' : 'Problem: voiceover not detected.');
    notes.push(!result.normalizedBrief.hasVisibleSpeaker ? 'Voiceover remains off-camera.' : 'Problem: treated voiceover as visible speaker.');
    notes.push(result.clarificationQuestion ? 'Problem: asked clarification despite fast-path assumptions.' : 'Fast path avoided clarification.');
  }
  if (scenario.key === 'arcade_fight') {
    notes.push(/Street Fighter/i.test(prompt) ? 'Problem: final prompt still uses trademark.' : 'Final prompt avoids literal trademark wording.');
    notes.push(/arcade fighting|stylized combat|martial artists|combat/i.test(prompt) ? 'Uses descriptive arcade combat language.' : 'Problem: combat direction is weak.');
  }
  notes.push(result.sanitizedFinalOutput?.finalPrompt ? 'Prompt writer produced final prompt.' : 'Prompt writer did not produce final prompt.');
  return notes;
}

function formatRecommendations(result: AiStrategistPlaygroundResult | undefined): string {
  if (!result?.recommendations) return '[none]';
  return [
    `Best=${result.recommendations.best.model.label}`,
    `Medium=${result.recommendations.medium.model.label}`,
    `Value=${result.recommendations.value.model.label}`,
  ].join('; ');
}

function printComparison(runs: readonly ScenarioRun[]) {
  for (const scenario of scenarios) {
    console.log(`## ${scenario.label}`);
    for (const run of runs.filter((item) => item.caseKey === scenario.key)) {
      console.log(`### ${run.model}`);
      console.log(`Planner action: ${run.plannerAction}`);
      console.log(`Normalized/enriched brief: ${run.normalizedBrief}`);
      console.log(`Questions asked: ${run.clarificationQuestions.length ? run.clarificationQuestions.join(' | ') : 'none'}`);
      console.log(`Selected workflow: ${run.workflow ?? 'none'}`);
      console.log(`Recommendations: ${run.recommendations}`);
      console.log(`Selected model: ${run.selectedModel ?? 'none'}`);
      console.log(`Prompt writer quality notes: ${run.promptWriterQualityNotes.join(' ')}`);
      console.log(`Validator issues: ${run.validatorIssues.length ? run.validatorIssues.join(', ') : 'none'}`);
      console.log(`Fallback used: ${run.fallbackUsed ? 'yes' : 'no'}`);
      console.log(`Rough latency: ${run.totalLatencyMs}ms`);
      console.log(`Rough token usage: ${run.tokenUsage}`);
      if (run.errors.length) console.log(`Errors: ${run.errors.join(' | ')}`);
      console.log(`Final prompt preview: ${run.finalPromptPreview || '[not generated]'}`);
      console.log('');
    }
  }
}

function hasVertexBaseEnv(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.AI_STRATEGIST_LLM_PROVIDER &&
      env.GOOGLE_VERTEX_PROJECT_ID &&
      env.GOOGLE_VERTEX_LOCATION &&
      env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON
  );
}

function compact(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  return oneLine.length > maxLength ? `${oneLine.slice(0, maxLength - 1)}…` : oneLine;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
