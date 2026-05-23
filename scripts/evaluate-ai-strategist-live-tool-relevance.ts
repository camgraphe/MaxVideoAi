import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  runAiStrategistPlaygroundPipeline,
  type AiStrategistPlaygroundInput,
  type AiStrategistPlaygroundResult,
} from '../frontend/lib/ai-strategist/playground-pipeline.ts';
import { runAdvisorQualityJudgeLLM } from '../frontend/lib/ai-strategist/llm-adapter.ts';
import type { StrategistConversationTurn } from '../frontend/lib/ai-strategist/conversation-planner.ts';
import type { StrategistOrchestratorTask, StrategistToolName } from '../frontend/lib/ai-strategist/orchestrator/types.ts';
import type { AiStrategistModelId, AiStrategistTierPosition } from '../frontend/lib/ai-strategist/types.ts';
import type {
  AiStrategistAdvisorQualityJudgeInput,
  AiStrategistLLMValidationIssue,
} from '../frontend/lib/ai-strategist/llm-contracts.ts';

type UploadedAssetMetadata = AiStrategistPlaygroundInput['uploadedAsset'];

type LiveTurn = {
  label: string;
  userMessage: string;
  selectedTier?: AiStrategistTierPosition;
  selectedModel?: AiStrategistModelId;
  currentPrompt?: string;
  uploadedAsset?: UploadedAssetMetadata;
  expect?: {
    task?: StrategistOrchestratorTask;
    stage?: AiStrategistPlaygroundResult['conversationStage'];
    toolCalls?: StrategistToolName[];
    llmBrief?: boolean;
    llmPrompt?: boolean;
    promptReady?: boolean;
    hasRecommendations?: boolean;
    noRecommendations?: boolean;
    selectedModel?: string;
    mustMentionAny?: string[];
    mustNotMention?: string[];
    finalPromptMustMentionAny?: string[];
    finalPromptMustNotMention?: string[];
  };
};

type LiveScenario = {
  id: string;
  label: string;
  turns: LiveTurn[];
};

type LiveTurnReport = {
  label: string;
  userMessage: string;
  assistantMessage: string;
  task: StrategistOrchestratorTask;
  action: string;
  stage: AiStrategistPlaygroundResult['conversationStage'];
  toolCalls: StrategistToolName[];
  workflow: string | null;
  selectedModel: string | null;
  selectedTier: string | undefined;
  llm: AiStrategistPlaygroundResult['llm'];
  normalizedBrief: Pick<
    AiStrategistPlaygroundResult['normalizedBrief'],
    'intent' | 'normalizedBrief' | 'hasVoiceover' | 'hasVisibleSpeaker' | 'hasUploadedReference' | 'confidence'
  >;
  recommendations?: {
    best: string;
    medium: string;
    value: string;
  };
  warnings: string[];
  finalPrompt?: string;
  negativePrompt?: string;
  settings?: unknown;
  uiActions: AiStrategistPlaygroundResult['uiActions'];
  validationIssuesBeforeSanitizer: AiStrategistPlaygroundResult['validationIssuesBeforeSanitizer'];
  validationIssuesAfterSanitizer: AiStrategistPlaygroundResult['validationIssuesAfterSanitizer'];
  elapsedMs: number;
  relevanceScore: number;
  relevanceIssues: string[];
};

type LiveScenarioReport = {
  id: string;
  label: string;
  passed: boolean;
  turns: LiveTurnReport[];
  judge?: LiveScenarioJudgeReport;
};

type EnvFileLoadResult = {
  path: string;
  exists: boolean;
  loaded: boolean;
};

type LiveScenarioJudgeReport = {
  usedLLM: boolean;
  source: 'llm' | 'deterministic_fallback';
  fallbackReason?: string;
  score: number;
  passed: boolean;
  issues: {
    code: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    owner: string;
  }[];
  strengths: string[];
  recommendedFix: string;
  validationIssues: readonly AiStrategistLLMValidationIssue[];
};

type ScriptOptions = {
  model?: string;
  scenarioSet: 'core' | 'expanded';
  limit?: number;
  offset: number;
  llmJudge: boolean;
};

const outputDir = resolve(process.cwd(), '.reports/ai-strategist/live-tool-relevance');
const timeoutMs = Number.parseInt(process.env.AI_STRATEGIST_LIVE_QA_TIMEOUT_MS ?? '60000', 10);

const coreScenarios: readonly LiveScenario[] = [
  {
    id: 'site-capability-intake',
    label: 'New visitor asks what the strategist can do',
    turns: [
      {
        label: 'capability question',
        userMessage: 'hi, can you actually help me choose models and prompts here?',
        expect: {
          task: 'capability_help',
          toolCalls: ['conversation_planner', 'capability_help'],
          noRecommendations: true,
          mustMentionAny: ['model', 'prompt', 'price', 'workflow'],
          mustNotMention: ['normalizedBrief', 'orchestration', 'JSON'],
        },
      },
    ],
  },
  {
    id: 'cheapest-model-real-buyer',
    label: 'Budget buyer asks for cheapest video model',
    turns: [
      {
        label: 'cheapest model',
        userMessage: "what's the cheapest model for a quick video test?",
        expect: {
          task: 'pricing_help',
          toolCalls: ['conversation_planner', 'pricing_help'],
          noRecommendations: true,
          mustMentionAny: ['$0.04', 'cheapest', 'quote'],
        },
      },
    ],
  },
  {
    id: 'seedance-audio-knowledge',
    label: 'Model knowledge with audio and lip-sync',
    turns: [
      {
        label: 'Seedance support',
        userMessage: 'Does Seedance 2 support audio and lip sync for short ads?',
        expect: {
          task: 'model_info_help',
          toolCalls: ['conversation_planner', 'model_info'],
          noRecommendations: true,
          mustMentionAny: ['Seedance 2.0', 'audio', 'lip-sync', 'Duration'],
        },
      },
    ],
  },
  {
    id: 'car-seedance-context',
    label: 'French car brief then Seedance selection and prompt',
    turns: [
      {
        label: 'brief',
        userMessage: 'une pub de voiture dynamique',
        expect: {
          task: 'new_video_brief',
          toolCalls: ['conversation_planner', 'brief_refinement', 'model_recommendation'],
          llmBrief: true,
          hasRecommendations: true,
          mustMentionAny: ['route', 'models', 'paths', 'direction'],
        },
      },
      {
        label: 'select Seedance',
        userMessage: 'ok seedance',
        expect: {
          task: 'model_or_tier_selection',
          toolCalls: ['conversation_planner', 'model_selection', 'brief_refinement', 'prompt_context', 'brief_completion'],
          selectedModel: 'seedance-2-0',
          mustMentionAny: ["Here's what I'll build", 'Quick direction check'],
        },
      },
      {
        label: 'confirm',
        userMessage: 'Generate prompt',
        expect: {
          task: 'prompt_build',
          toolCalls: ['conversation_planner', 'brief_refinement', 'prompt_context', 'brief_completion', 'prompt_writer', 'validation'],
          llmPrompt: true,
          promptReady: true,
          selectedModel: 'seedance-2-0',
          finalPromptMustMentionAny: ['car', 'automotive', 'vehicle'],
          finalPromptMustNotMention: ['une pub de voiture'],
        },
      },
    ],
  },
  {
    id: 'premium-perfume-real-result',
    label: 'Premium perfume ad to final prompt',
    turns: [
      {
        label: 'brief',
        userMessage: 'Luxury perfume ad on black marble, 9:16, premium look, slow camera push-in, soft gold reflections',
        expect: {
          task: 'new_video_brief',
          llmBrief: true,
          hasRecommendations: true,
          finalPromptMustNotMention: ['8K', '8k', 'Midjourney', 'Runway'],
        },
      },
      {
        label: 'choose best',
        userMessage: 'Best',
        expect: {
          task: 'model_or_tier_selection',
          mustMentionAny: ["Here's what I'll build", 'Generate the prompt'],
        },
      },
      {
        label: 'generate',
        userMessage: 'Generate prompt',
        expect: {
          task: 'prompt_build',
          llmPrompt: true,
          promptReady: true,
          finalPromptMustMentionAny: ['Starting image prompt', 'Video animation prompt', 'perfume bottle'],
          finalPromptMustNotMention: ['8K', '8k', 'Midjourney', 'Runway', 'DALL-E'],
        },
      },
    ],
  },
  {
    id: 'uploaded-person-spokesperson',
    label: 'Uploaded person image with product and speaking goal',
    turns: [
      {
        label: 'brief with uploaded person',
        userMessage: 'I have one image. Make this person hold my headphones and speak to camera for TikTok.',
        uploadedAsset: { type: 'image', hasPerson: true, hasProduct: true, isReferenceImage: true },
        expect: {
          task: 'new_video_brief',
          llmBrief: true,
          hasRecommendations: true,
          mustMentionAny: ['image-to-video', 'reference', 'person', 'identity'],
        },
      },
      {
        label: 'choose best',
        userMessage: 'choose the safest option',
        expect: {
          task: 'model_or_tier_selection',
          mustMentionAny: ["Here's what I'll build", 'Quick direction check'],
        },
      },
      {
        label: 'details',
        userMessage: '15 seconds, vertical, English influencer line about the headphones looking beautiful and sounding great',
        expect: {
          task: 'prompt_build',
          mustMentionAny: ['15 seconds', 'English', 'lip-sync', 'Generate the prompt'],
        },
      },
      {
        label: 'generate',
        userMessage: 'Generate prompt',
        expect: {
          task: 'prompt_build',
          llmPrompt: true,
          promptReady: true,
          finalPromptMustMentionAny: ['Reference:', 'Preserve:', 'Audio:', 'lip-sync'],
          finalPromptMustNotMention: ['perfect lip-sync', 'precisely', 'ensure no identity drift'],
        },
      },
    ],
  },
  {
    id: 'seedance-prompt-edit',
    label: 'Prompt edit intake then real prompt rewrite',
    turns: [
      {
        label: 'edit intake',
        userMessage: 'I want to edit a prompt for Seedance 2, can I paste it?',
        expect: {
          task: 'prompt_edit_intake',
          toolCalls: ['conversation_planner'],
          mustMentionAny: ['Paste the prompt', 'colle ton prompt'],
          noRecommendations: true,
        },
      },
      {
        label: 'paste prompt',
        userMessage: 'A sneaker spins on concrete, neon lights, fast camera, make it premium',
        expect: {
          task: 'prompt_edit',
          llmBrief: true,
          mustMentionAny: ["Here's what I'll build", 'Quick direction check'],
        },
      },
      {
        label: 'make assumptions',
        userMessage: 'Make assumptions',
        expect: {
          task: 'prompt_build',
          mustMentionAny: ["Here's what I'll build", 'Generate the prompt'],
        },
      },
      {
        label: 'generate',
        userMessage: 'Generate prompt',
        expect: {
          task: 'prompt_build',
          llmPrompt: true,
          promptReady: true,
          finalPromptMustMentionAny: ['sneaker', 'Camera:', 'Audio:'],
        },
      },
    ],
  },
  {
    id: 'ambiguous-real-user',
    label: 'Ambiguous user gets one useful clarification',
    turns: [
      {
        label: 'ambiguous',
        userMessage: 'make it better',
        expect: {
          task: 'clarification',
          stage: 'collecting_brief',
          toolCalls: ['conversation_planner'],
          noRecommendations: true,
          mustMentionAny: ['What prompt', 'what video', 'improve'],
        },
      },
    ],
  },
];

const expandedOnlyScenarios: readonly LiveScenario[] = [
  {
    id: 'greeting-to-brief',
    label: 'Casual visitor greeting before creative request',
    turns: [
      {
        label: 'greeting',
        userMessage: 'hey there',
        expect: {
          task: 'capability_help',
          toolCalls: ['conversation_planner', 'capability_help'],
          noRecommendations: true,
          mustMentionAny: ['create', 'prompt', 'model', 'help'],
        },
      },
      {
        label: 'rough brief',
        userMessage: 'I need something cool for a new coffee brand launch',
        expect: {
          task: 'new_video_brief',
          hasRecommendations: true,
          mustMentionAny: ['coffee', 'brand', 'models', 'routes'],
        },
      },
    ],
  },
  {
    id: 'duration-edit-after-summary',
    label: 'Small duration edit should preserve selected model and brief',
    turns: [
      {
        label: 'brief',
        userMessage: 'TikTok influencer holding headphones and speaking to camera, I only have one image',
        uploadedAsset: { type: 'image', hasPerson: true, hasProduct: true, isReferenceImage: true },
        expect: {
          task: 'new_video_brief',
          hasRecommendations: true,
        },
      },
      {
        label: 'choose best',
        userMessage: 'Best',
        expect: {
          task: 'model_or_tier_selection',
          mustMentionAny: ["Here's what I'll build", 'Quick direction check'],
        },
      },
      {
        label: 'details',
        userMessage: 'English influencer vibe, say the headphones look beautiful and sound great',
        expect: {
          task: 'prompt_build',
          mustMentionAny: ['Generate the prompt', 'English', 'headphones'],
        },
      },
      {
        label: 'duration edit',
        userMessage: 'make it 15 seconds',
        expect: {
          task: 'prompt_build',
          noRecommendations: true,
          mustMentionAny: ['15 seconds', 'Generate the prompt'],
        },
      },
    ],
  },
  {
    id: 'price-objection-after-recommendation',
    label: 'Buyer asks for cheaper route after recommendations',
    turns: [
      {
        label: 'premium product brief',
        userMessage: 'Premium jewelry product ad on reflective black glass, luxury look',
        expect: {
          task: 'new_video_brief',
          hasRecommendations: true,
          mustMentionAny: ['jewelry', 'models', 'routes'],
        },
      },
      {
        label: 'price concern',
        userMessage: 'that sounds expensive, what is the cheaper option?',
        expect: {
          task: 'pricing_help',
          toolCalls: ['conversation_planner', 'pricing_help'],
          noRecommendations: true,
          mustMentionAny: ['cheaper', 'value', 'quote', 'credits'],
        },
      },
    ],
  },
  {
    id: 'uploaded-product-logo-risk',
    label: 'Product reference with logo and label risk',
    turns: [
      {
        label: 'product reference brief',
        userMessage: 'animate this skincare bottle for an Instagram ad, keep the logo visible',
        uploadedAsset: { type: 'image', hasProduct: true, hasLogo: true, hasText: true, isReferenceImage: true },
        expect: {
          task: 'new_video_brief',
          hasRecommendations: true,
          mustMentionAny: ['logo', 'text', 'drift', 'overlay'],
        },
      },
      {
        label: 'choose value',
        userMessage: 'Value',
        expect: {
          task: 'model_or_tier_selection',
          mustMentionAny: ["Here's what I'll build", 'logo', 'text'],
        },
      },
    ],
  },
  {
    id: 'video-to-video-person-restyle',
    label: 'Video-to-video restyle with a person',
    turns: [
      {
        label: 'v2v brief',
        userMessage: 'I have a short clip of a founder talking. Can you restyle it into a polished ad while keeping the person recognizable?',
        uploadedAsset: { type: 'video', hasPerson: true, isReferenceImage: false },
        expect: {
          task: 'new_video_brief',
          hasRecommendations: true,
          mustMentionAny: ['video-to-video', 'person', 'recognizable'],
        },
      },
    ],
  },
  {
    id: 'choose-for-me',
    label: 'User asks the strategist to choose the model',
    turns: [
      {
        label: 'brief',
        userMessage: 'Make a cinematic SaaS launch video, polished lighting, 16:9, with a short founder voiceover',
        expect: {
          task: 'new_video_brief',
          hasRecommendations: true,
        },
      },
      {
        label: 'choose for me',
        userMessage: 'you decide, pick the best fit',
        expect: {
          task: 'model_or_tier_selection',
          mustMentionAny: ["Here's what I'll build", 'Generate the prompt'],
        },
      },
    ],
  },
  {
    id: 'messy-english-social-ad',
    label: 'Messy spelling social ad request',
    turns: [
      {
        label: 'messy brief',
        userMessage: 'need vid for tiktoc shooes, fast flashy but no weird faces, cheep test',
        expect: {
          task: 'new_video_brief',
          hasRecommendations: true,
          mustMentionAny: ['TikTok', 'shoes', 'budget', 'routes'],
        },
      },
    ],
  },
  {
    id: 'spanish-product-ad',
    label: 'Spanish brief should route and answer naturally',
    turns: [
      {
        label: 'spanish brief',
        userMessage: 'quiero un anuncio vertical para un perfume, elegante, con reflejos dorados',
        expect: {
          task: 'new_video_brief',
          hasRecommendations: true,
          mustMentionAny: ['perfume', 'vertical', 'models', 'routes'],
        },
      },
    ],
  },
  {
    id: 'navigation-upload-help',
    label: 'Upload navigation help should not recommend models',
    turns: [
      {
        label: 'upload help',
        userMessage: 'where do I upload an image before generating?',
        expect: {
          task: 'navigation_help',
          toolCalls: ['conversation_planner', 'navigation_help'],
          noRecommendations: true,
          mustMentionAny: ['upload', 'image', 'generator', 'reference'],
        },
      },
    ],
  },
  {
    id: 'street-fighter-sanitize',
    label: 'Trademark style brief should be sanitized before prompt',
    turns: [
      {
        label: 'brief',
        userMessage: 'I want a Street Fighter style fight',
        expect: {
          task: 'new_video_brief',
          hasRecommendations: true,
          mustMentionAny: ['arcade', 'combat', 'models'],
          mustNotMention: ['Street Fighter style'],
        },
      },
      {
        label: 'choose best',
        userMessage: 'Best',
        expect: {
          task: 'model_or_tier_selection',
          mustMentionAny: ["Here's what I'll build", 'Quick direction check'],
          mustNotMention: ['Street Fighter style'],
        },
      },
      {
        label: 'make assumptions',
        userMessage: 'Make assumptions',
        expect: {
          task: 'prompt_build',
          mustMentionAny: ['Generate the prompt', 'arcade', 'stylized'],
          mustNotMention: ['Street Fighter style'],
        },
      },
      {
        label: 'generate',
        userMessage: 'Generate prompt',
        expect: {
          task: 'prompt_build',
          promptReady: true,
          finalPromptMustMentionAny: ['arcade fighting', 'stylized combat'],
          finalPromptMustNotMention: ['Street Fighter'],
        },
      },
    ],
  },
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envLoadResults = loadLocalEnvFiles();
  const scenarios = selectScenarios(options);
  const env = {
    ...process.env,
    ...(options.model ? { AI_STRATEGIST_LLM_MODEL: options.model } : {}),
  };
  const liveReady = hasVertexEnv(env);

  console.log('AI Strategist Live Tool + Relevance QA');
  console.log('RAG connected: no');
  console.log('Frontend UI changed: no');
  console.log('Auto-generation/credit spend/publish: no');
  console.log(
    `Env files: ${envLoadResults
      .map((result) => `${relative(process.cwd(), result.path) || result.path}=${result.loaded ? 'loaded' : result.exists ? 'present-not-loaded' : 'missing'}`)
      .join('; ')}`
  );
  console.log(`GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: ${env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON ? 'present' : 'missing'}`);
  console.log(`Vertex env complete: ${liveReady ? 'yes' : 'no'}`);
  console.log(`LLM model: ${env.AI_STRATEGIST_LLM_MODEL ?? '[missing]'}`);
  console.log(`Scenario set: ${options.scenarioSet}; selected scenarios: ${scenarios.length}`);
  console.log(`LLM judge: ${options.llmJudge ? 'enabled' : 'disabled'}`);
  console.log('');

  const reports: LiveScenarioReport[] = [];
  for (const scenario of scenarios) {
    console.log(`Running: ${scenario.label}`);
    reports.push(await runScenario(scenario, liveReady ? env : {}, { llmJudge: options.llmJudge && liveReady }));
  }

  const summary = summarizeReports(reports);
  mkdirSync(outputDir, { recursive: true });
  const jsonPath = resolve(outputDir, `live-tool-relevance-${Date.now()}.json`);
  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        liveReady,
        model: env.AI_STRATEGIST_LLM_MODEL ?? null,
        scenarioSet: options.scenarioSet,
        llmJudge: options.llmJudge,
        summary,
        reports,
      },
      null,
      2
    )}\n`
  );

  printReport(summary, reports, jsonPath);
  if (summary.failedTurns > 0 || summary.judgeFailedScenarios > 0) process.exitCode = 1;
}

function parseArgs(args: readonly string[]): ScriptOptions {
  return {
    model: stringArg(args, '--model'),
    scenarioSet: stringArg(args, '--scenario-set') === 'expanded' ? 'expanded' : 'core',
    limit: numberArg(args, '--limit'),
    offset: numberArg(args, '--offset') ?? 0,
    llmJudge: args.includes('--llm-judge'),
  };
}

function selectScenarios(options: ScriptOptions): readonly LiveScenario[] {
  const source = options.scenarioSet === 'expanded' ? [...coreScenarios, ...expandedOnlyScenarios] : [...coreScenarios];
  const offset = Math.max(0, options.offset);
  const limited = options.limit === undefined ? source.slice(offset) : source.slice(offset, offset + Math.max(0, options.limit));
  return limited;
}

function stringArg(args: readonly string[], key: string): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg === key) return args[index + 1];
    if (arg.startsWith(`${key}=`)) return arg.slice(key.length + 1);
  }
  return undefined;
}

function numberArg(args: readonly string[], key: string): number | undefined {
  const raw = stringArg(args, key);
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function loadLocalEnvFiles(): readonly EnvFileLoadResult[] {
  const requireFromFrontend = createRequire(resolve(process.cwd(), 'frontend/package.json'));
  const dotenv = requireFromFrontend('dotenv') as {
    config: (options: { path: string; override?: boolean; quiet?: boolean }) => { error?: unknown };
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

function hasVertexEnv(env: NodeJS.ProcessEnv | Record<string, string | undefined>): boolean {
  return Boolean(
    env.AI_STRATEGIST_LLM_PROVIDER &&
      env.AI_STRATEGIST_LLM_MODEL &&
      env.GOOGLE_VERTEX_PROJECT_ID &&
      env.GOOGLE_VERTEX_LOCATION &&
      env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON
  );
}

async function runScenario(
  scenario: LiveScenario,
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  options: { llmJudge: boolean }
): Promise<LiveScenarioReport> {
  let previous: AiStrategistPlaygroundResult | undefined;
  const recentTurns: StrategistConversationTurn[] = [];
  const reports: LiveTurnReport[] = [];

  async function executeTurn(turn: LiveTurn) {
    const selectedModel =
      turn.selectedModel ??
      (turn.selectedTier && previous?.recommendations ? previous.recommendations[turn.selectedTier].model.id : undefined);
    const input: AiStrategistPlaygroundInput = {
      surface: 'chat',
      userMessage: turn.userMessage,
      selectedTier: turn.selectedTier,
      selectedModel,
      currentPrompt: turn.currentPrompt,
      uploadedAsset: turn.uploadedAsset,
      conversationState: buildConversationState(previous, recentTurns),
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = performance.now();
    try {
      const result = await runAiStrategistPlaygroundPipeline(input, {
        env,
        signal: controller.signal,
      });
      const elapsedMs = Math.round(performance.now() - startedAt);
      const report = buildTurnReport(turn, result, elapsedMs);
      reports.push(report);
      recentTurns.push({ role: 'user', content: turn.userMessage });
      recentTurns.push({ role: 'assistant', content: result.assistantMessage });
      previous = result;
    } catch (error) {
      reports.push(buildErrorTurnReport(turn, previous, Math.round(performance.now() - startedAt), error));
    } finally {
      clearTimeout(timeout);
    }
  }

  for (const turn of scenario.turns) {
    if (isGeneratePromptTurn(turn) && previous?.conversationStage === 'collecting_missing_fields') {
      await executeTurn({
        label: `${turn.label} / auto assumptions`,
        userMessage: 'Make assumptions',
        expect: {
          task: 'prompt_build',
          mustMentionAny: ["Here's what I'll build", 'Generate the prompt'],
        },
      });
    }
    await executeTurn(turn);
  }

  const judge = options.llmJudge ? await runScenarioJudge(scenario, reports, env) : undefined;
  const judgeFailure = judge?.source === 'llm' && !judge.passed;
  return {
    id: scenario.id,
    label: scenario.label,
    passed: reports.every((report) => report.relevanceIssues.length === 0) && !judgeFailure,
    turns: reports,
    ...(judge ? { judge } : {}),
  };
}

async function runScenarioJudge(
  scenario: LiveScenario,
  reports: readonly LiveTurnReport[],
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): Promise<LiveScenarioJudgeReport> {
  const result = await runAdvisorQualityJudgeLLM(buildJudgeInput(scenario, reports), { env });
  return {
    usedLLM: result.usedLLM,
    source: result.source,
    fallbackReason: result.fallbackReason,
    score: result.output.score,
    passed: result.output.passed,
    issues: result.output.issues,
    strengths: result.output.strengths,
    recommendedFix: result.output.recommendedFix,
    validationIssues: result.validation.issues,
  };
}

function buildJudgeInput(
  scenario: LiveScenario,
  reports: readonly LiveTurnReport[]
): AiStrategistAdvisorQualityJudgeInput {
  return {
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    userGoal: scenario.turns.map((turn) => turn.userMessage).join(' -> '),
    expectedExperience: scenario.turns.flatMap((turn) => buildExpectedExperience(turn)),
    hardRules: {
      noAutoGeneration: true,
      noCreditSpend: true,
      noPublishing: true,
      noUiActionsApplied: true,
    },
    turns: reports.map((turn) => ({
      userMessage: turn.userMessage,
      assistantMessage: compact(turn.assistantMessage, 1200),
      task: turn.task,
      stage: turn.stage,
      toolCalls: turn.toolCalls,
      workflow: turn.workflow,
      selectedModel: turn.selectedModel,
      usedBriefLlm: turn.llm.briefRefinement.used,
      usedPromptLlm: turn.llm.promptWriter.used,
      warnings: turn.warnings,
      ...(turn.finalPrompt ? { finalPrompt: compact(turn.finalPrompt, 1600) } : {}),
      heuristicIssues: turn.relevanceIssues,
    })),
  };
}

function buildExpectedExperience(turn: LiveTurn): string[] {
  const expectations: string[] = [];
  if (turn.expect?.task) expectations.push(`Planner task should be ${turn.expect.task}.`);
  if (turn.expect?.hasRecommendations) expectations.push('Show model recommendations with a conversational acknowledgement.');
  if (turn.expect?.noRecommendations) expectations.push('Do not show Best / Medium / Value recommendations.');
  if (turn.expect?.promptReady) expectations.push('Produce a final sanitized MaxVideoAI prompt only after confirmation.');
  if (turn.expect?.selectedModel) expectations.push(`Preserve selected model ${turn.expect.selectedModel}.`);
  if (turn.expect?.mustMentionAny?.length) expectations.push(`Assistant should address at least one of: ${turn.expect.mustMentionAny.join(', ')}.`);
  if (turn.expect?.mustNotMention?.length) expectations.push(`Assistant should avoid: ${turn.expect.mustNotMention.join(', ')}.`);
  if (turn.expect?.finalPromptMustMentionAny?.length) expectations.push(`Final prompt should include one of: ${turn.expect.finalPromptMustMentionAny.join(', ')}.`);
  if (turn.expect?.finalPromptMustNotMention?.length) expectations.push(`Final prompt should avoid: ${turn.expect.finalPromptMustNotMention.join(', ')}.`);
  return expectations.length ? expectations : ['Respond naturally and move the MaxVideoAI workflow forward.'];
}

function isGeneratePromptTurn(turn: LiveTurn): boolean {
  return normalize(turn.userMessage) === 'generate prompt';
}

function buildConversationState(
  previous: AiStrategistPlaygroundResult | undefined,
  recentTurns: readonly StrategistConversationTurn[]
): AiStrategistPlaygroundInput['conversationState'] {
  return {
    recentTurns: recentTurns.slice(-10),
    ...(previous?.normalizedBrief ? { lastNormalizedBrief: previous.normalizedBrief } : {}),
    ...(previous?.recommendations ? { lastRecommendations: previous.recommendations } : {}),
    ...(previous?.selectedModel ? { lastSelectedModel: previous.selectedModel } : {}),
    ...(previous?.selectedTier ? { lastSelectedTier: previous.selectedTier } : {}),
    ...(previous?.workflow ? { lastSelectedWorkflow: previous.workflow } : {}),
    ...(previous?.briefCompletion ? { lastBriefCompletion: previous.briefCompletion } : {}),
    ...(previous?.sanitizedFinalOutput?.finalPrompt ? { lastFinalPrompt: previous.sanitizedFinalOutput.finalPrompt } : {}),
    ...(previous?.conversationStage ? { stage: previous.conversationStage } : {}),
  };
}

function buildTurnReport(turn: LiveTurn, result: AiStrategistPlaygroundResult, elapsedMs: number): LiveTurnReport {
  const relevanceIssues = evaluateRelevance(turn, result);
  return {
    label: turn.label,
    userMessage: turn.userMessage,
    assistantMessage: result.assistantMessage,
    task: result.orchestrationPlan.task,
    action: result.conversationPlan.action,
    stage: result.conversationStage,
    toolCalls: result.orchestrationPlan.toolCalls,
    workflow: result.workflow,
    selectedModel: result.selectedModel,
    selectedTier: result.selectedTier,
    llm: result.llm,
    normalizedBrief: {
      intent: result.normalizedBrief.intent,
      normalizedBrief: result.normalizedBrief.normalizedBrief,
      hasVoiceover: result.normalizedBrief.hasVoiceover,
      hasVisibleSpeaker: result.normalizedBrief.hasVisibleSpeaker,
      hasUploadedReference: result.normalizedBrief.hasUploadedReference,
      confidence: result.normalizedBrief.confidence,
    },
    ...(result.recommendations
      ? {
          recommendations: {
            best: result.recommendations.best.model.label,
            medium: result.recommendations.medium.model.label,
            value: result.recommendations.value.model.label,
          },
        }
      : {}),
    warnings: result.warnings,
    ...(result.sanitizedFinalOutput?.finalPrompt ? { finalPrompt: result.sanitizedFinalOutput.finalPrompt } : {}),
    ...(result.sanitizedFinalOutput?.negativePrompt ? { negativePrompt: result.sanitizedFinalOutput.negativePrompt } : {}),
    ...(result.sanitizedFinalOutput?.settings ? { settings: result.sanitizedFinalOutput.settings } : {}),
    uiActions: result.uiActions,
    validationIssuesBeforeSanitizer: result.validationIssuesBeforeSanitizer,
    validationIssuesAfterSanitizer: result.validationIssuesAfterSanitizer,
    elapsedMs,
    relevanceScore: Math.max(0, 5 - relevanceIssues.length),
    relevanceIssues,
  };
}

function buildErrorTurnReport(
  turn: LiveTurn,
  previous: AiStrategistPlaygroundResult | undefined,
  elapsedMs: number,
  error: unknown
): LiveTurnReport {
  const message = error instanceof Error ? error.message : String(error);
  return {
    label: turn.label,
    userMessage: turn.userMessage,
    assistantMessage: `[error] ${message}`,
    task: previous?.orchestrationPlan.task ?? 'unknown',
    action: previous?.conversationPlan.action ?? 'ask_clarification',
    stage: previous?.conversationStage ?? 'collecting_brief',
    toolCalls: previous?.orchestrationPlan.toolCalls ?? [],
    workflow: previous?.workflow ?? null,
    selectedModel: previous?.selectedModel ?? null,
    selectedTier: previous?.selectedTier,
    llm: previous?.llm ?? {
      briefRefinement: { used: false, source: 'deterministic_fallback', fallbackReason: 'error' },
      promptWriter: { used: false, source: 'deterministic_fallback', fallbackReason: 'error', sanitizerChangedOutput: false },
    },
    normalizedBrief: {
      intent: previous?.normalizedBrief.intent ?? 'unknown',
      normalizedBrief: previous?.normalizedBrief.normalizedBrief ?? '',
      hasVoiceover: previous?.normalizedBrief.hasVoiceover,
      hasVisibleSpeaker: previous?.normalizedBrief.hasVisibleSpeaker,
      hasUploadedReference: previous?.normalizedBrief.hasUploadedReference,
      confidence: previous?.normalizedBrief.confidence ?? 0,
    },
    warnings: previous?.warnings ?? [],
    uiActions: previous?.uiActions ?? [],
    validationIssuesBeforeSanitizer: previous?.validationIssuesBeforeSanitizer ?? { brief: [], prompt: [] },
    validationIssuesAfterSanitizer: previous?.validationIssuesAfterSanitizer ?? { brief: [], prompt: [] },
    elapsedMs,
    relevanceScore: 0,
    relevanceIssues: [`runtime_error: ${message}`],
  };
}

function evaluateRelevance(turn: LiveTurn, result: AiStrategistPlaygroundResult): string[] {
  const expect = turn.expect;
  const issues: string[] = [];
  const assistant = normalize(result.assistantMessage);
  const finalPrompt = normalize(result.sanitizedFinalOutput?.finalPrompt ?? '');

  if (!expect) return issues;
  if (expect.task && result.orchestrationPlan.task !== expect.task) {
    issues.push(`task expected ${expect.task}, got ${result.orchestrationPlan.task}`);
  }
  if (expect.stage && result.conversationStage !== expect.stage) {
    issues.push(`stage expected ${expect.stage}, got ${result.conversationStage}`);
  }
  if (expect.toolCalls) {
    const missing = expect.toolCalls.filter((tool) => !result.orchestrationPlan.toolCalls.includes(tool));
    if (missing.length) issues.push(`missing tool calls: ${missing.join(', ')}`);
  }
  if (expect.llmBrief !== undefined && result.llm.briefRefinement.used !== expect.llmBrief) {
    issues.push(`brief LLM expected ${expect.llmBrief ? 'used' : 'not used'}, got ${result.llm.briefRefinement.used ? 'used' : 'not used'}`);
  }
  if (expect.llmPrompt !== undefined && result.llm.promptWriter.used !== expect.llmPrompt) {
    issues.push(`prompt LLM expected ${expect.llmPrompt ? 'used' : 'not used'}, got ${result.llm.promptWriter.used ? 'used' : 'not used'}`);
  }
  if (expect.promptReady && !result.sanitizedFinalOutput?.finalPrompt) {
    issues.push('expected final prompt output');
  }
  if (expect.hasRecommendations && !result.recommendations) {
    issues.push('expected model recommendations');
  }
  if (expect.noRecommendations && result.recommendations) {
    issues.push('expected no model recommendations');
  }
  if (expect.selectedModel && result.selectedModel !== expect.selectedModel) {
    issues.push(`selected model expected ${expect.selectedModel}, got ${result.selectedModel ?? 'none'}`);
  }
  if (expect.mustMentionAny?.length && !expect.mustMentionAny.some((needle) => assistant.includes(normalize(needle)))) {
    issues.push(`assistant did not mention any of: ${expect.mustMentionAny.join(', ')}`);
  }
  for (const needle of expect.mustNotMention ?? []) {
    if (assistant.includes(normalize(needle))) issues.push(`assistant mentioned disallowed text: ${needle}`);
  }
  if (expect.finalPromptMustMentionAny?.length && !expect.finalPromptMustMentionAny.some((needle) => finalPrompt.includes(normalize(needle)))) {
    issues.push(`final prompt did not mention any of: ${expect.finalPromptMustMentionAny.join(', ')}`);
  }
  for (const needle of expect.finalPromptMustNotMention ?? []) {
    if (finalPrompt.includes(normalize(needle))) issues.push(`final prompt mentioned disallowed text: ${needle}`);
  }
  if (!result.safety || result.safety.autoGeneration || result.safety.creditSpend || result.safety.publishing || result.safety.uiActionsApplied) {
    issues.push('safety flags indicate side effects');
  }
  if (assistant.includes('normalizedbrief') || assistant.includes('orchestrationplan') || assistant.includes('rawllmoutput')) {
    issues.push('assistant exposed internal debug wording');
  }
  if (result.validationIssuesAfterSanitizer.prompt.some((issue) => issue.severity === 'error')) {
    issues.push('prompt validation has sanitizer-after error');
  }

  return issues;
}

function summarizeReports(reports: readonly LiveScenarioReport[]) {
  const turns = reports.flatMap((scenario) => scenario.turns);
  const failedTurns = turns.filter((turn) => turn.relevanceIssues.length > 0);
  const promptTurns = turns.filter((turn) => turn.finalPrompt);
  const judges = reports.flatMap((scenario) => (scenario.judge ? [scenario.judge] : []));
  return {
    scenarios: reports.length,
    passedScenarios: reports.filter((scenario) => scenario.passed).length,
    turns: turns.length,
    passedTurns: turns.length - failedTurns.length,
    failedTurns: failedTurns.length,
    averageRelevanceScore: turns.length
      ? Number((turns.reduce((sum, turn) => sum + turn.relevanceScore, 0) / turns.length).toFixed(2))
      : 0,
    briefLlmUsedTurns: turns.filter((turn) => turn.llm.briefRefinement.used).length,
    promptLlmUsedTurns: turns.filter((turn) => turn.llm.promptWriter.used).length,
    promptReadyTurns: promptTurns.length,
    sanitizerChangedTurns: turns.filter((turn) => turn.llm.promptWriter.sanitizerChangedOutput).length,
    judgeRuns: judges.length,
    judgeLlmRuns: judges.filter((judge) => judge.usedLLM).length,
    averageJudgeScore: judges.length
      ? Number((judges.reduce((sum, judge) => sum + judge.score, 0) / judges.length).toFixed(2))
      : 0,
    judgeFailedScenarios: reports.filter((scenario) => scenario.judge?.source === 'llm' && !scenario.judge.passed).length,
  };
}

function printReport(summary: ReturnType<typeof summarizeReports>, reports: readonly LiveScenarioReport[], jsonPath: string) {
  console.log('');
  console.log('Live Tool + Relevance Summary');
  console.log(`Scenarios: ${summary.passedScenarios}/${summary.scenarios} passed`);
  console.log(`Turns: ${summary.passedTurns}/${summary.turns} passed`);
  console.log(`Average relevance score: ${summary.averageRelevanceScore}/5`);
  console.log(`Brief LLM used turns: ${summary.briefLlmUsedTurns}`);
  console.log(`Prompt LLM used turns: ${summary.promptLlmUsedTurns}`);
  console.log(`Prompt-ready turns: ${summary.promptReadyTurns}`);
  console.log(`Sanitizer changed turns: ${summary.sanitizerChangedTurns}`);
  if (summary.judgeRuns) {
    console.log(`LLM judge runs: ${summary.judgeLlmRuns}/${summary.judgeRuns}`);
    console.log(`Average judge score: ${summary.averageJudgeScore}/5`);
    console.log(`Judge-failed scenarios: ${summary.judgeFailedScenarios}`);
  }
  console.log(`JSON report: ${relative(process.cwd(), jsonPath)}`);
  console.log('');

  for (const scenario of reports) {
    const last = scenario.turns.at(-1);
    console.log(`## ${scenario.passed ? 'PASS' : 'FAIL'} ${scenario.label}`);
    for (const turn of scenario.turns) {
      console.log(`- ${turn.label}: task=${turn.task}; stage=${turn.stage}; tools=${turn.toolCalls.join(', ') || 'none'}; briefLLM=${turn.llm.briefRefinement.used ? 'yes' : 'no'}; promptLLM=${turn.llm.promptWriter.used ? 'yes' : 'no'}; score=${turn.relevanceScore}/5`);
      if (turn.relevanceIssues.length) console.log(`  issues=${turn.relevanceIssues.join(' | ')}`);
    }
    if (scenario.judge) {
      console.log(
        `  judge=${scenario.judge.source}${scenario.judge.usedLLM ? '' : `:${scenario.judge.fallbackReason ?? 'fallback'}`}; score=${scenario.judge.score}/5; passed=${scenario.judge.passed ? 'yes' : 'no'}`
      );
      for (const issue of scenario.judge.issues.slice(0, 3)) {
        console.log(`  judgeIssue=${issue.severity}:${issue.owner}:${issue.message}`);
      }
      if (scenario.judge.recommendedFix) console.log(`  judgeFix=${scenario.judge.recommendedFix}`);
    }
    if (last?.finalPrompt) {
      console.log(`  finalPrompt=${compact(last.finalPrompt, 520)}`);
    } else {
      console.log(`  assistant=${compact(last?.assistantMessage ?? '', 360)}`);
    }
    console.log('');
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value: string, maxLength: number): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  return oneLine.length > maxLength ? `${oneLine.slice(0, maxLength - 1)}…` : oneLine;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
