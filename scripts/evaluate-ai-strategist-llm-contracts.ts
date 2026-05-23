import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';

import { runBriefRefinementLLM, runPromptWriterLLM } from '../frontend/lib/ai-strategist/llm-adapter.ts';
import { buildPromptGenerationContext } from '../frontend/lib/ai-strategist/prompt-structures.ts';
import { recommendModelsForBrief } from '../frontend/lib/ai-strategist/recommendation-rules.ts';
import type { AiStrategistNormalizedBrief } from '../frontend/lib/ai-strategist/brief-normalization.ts';
import type {
  AiStrategistBrief,
  AiStrategistPromptStructureId,
  AiStrategistSourceImageKind,
  AiStrategistWorkflowId,
} from '../frontend/lib/ai-strategist/types.ts';

type UploadedAssetMetadata = {
  type?: string;
  hasPerson?: boolean;
  hasProduct?: boolean;
  hasLogo?: boolean;
  hasText?: boolean;
  isReferenceImage?: boolean;
};

type EvalCase = {
  label: string;
  mode?: 'recommend' | 'build_prompt' | 'improve_prompt' | 'product_help';
  rawUserMessage: string;
  currentPrompt?: string;
  uploadedAsset?: UploadedAssetMetadata;
};

type EnvFileLoadResult = {
  path: string;
  exists: boolean;
  loaded: boolean;
};

const cases: readonly EvalCase[] = [
  {
    label: 'Social sneaker voiceover',
    rawUserMessage: 'Social-first sneaker ad with voiceover, vertical',
  },
  {
    label: 'Uploaded person speaking',
    rawUserMessage: 'Make this person speak to camera',
    uploadedAsset: { type: 'image', hasPerson: true, isReferenceImage: true },
  },
  {
    label: 'Perfume prompt improvement',
    mode: 'improve_prompt',
    rawUserMessage: 'Make this better for a premium product ad',
    currentPrompt: 'Perfume bottle on marble, cinematic',
  },
  {
    label: 'Talking avatar dialogue',
    rawUserMessage: 'Talking avatar with a short spoken line for a SaaS ad',
  },
];

async function main() {
  const envLoadResults = loadLocalEnvFiles();
  const selectedCases = filterEvalCases(cases);
  console.log('AI Strategist LLM Contract Evaluation');
  console.log('RAG connected: no');
  console.log('Frontend UI connected: no');
  console.log('Auto-generation/credit spend/publish: no');
  console.log(
    `Env files: ${envLoadResults
      .map((result) => `${relative(process.cwd(), result.path) || result.path}=${result.loaded ? 'loaded' : result.exists ? 'present-not-loaded' : 'missing'}`)
      .join('; ')}`
  );
  console.log(`GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: ${process.env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON ? 'present' : 'missing'}`);
  console.log(`Vertex env complete: ${hasVertexEnv(process.env) ? 'yes' : 'no'}`);
  console.log(`Cases: ${selectedCases.map((item) => item.label).join('; ')}`);
  console.log('');

  await runPhase('deterministic fallback mode (forced empty env)', {}, selectedCases);

  if (hasVertexEnv(process.env)) {
    await runPhase('live local Vertex Gemini mode', process.env, selectedCases);
  } else {
    console.log('Live local Vertex Gemini mode skipped: missing AI_STRATEGIST_LLM_PROVIDER, AI_STRATEGIST_LLM_MODEL, GOOGLE_VERTEX_PROJECT_ID, GOOGLE_VERTEX_LOCATION, or GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON.');
    console.log('');
  }
}

function filterEvalCases(allCases: readonly EvalCase[]): readonly EvalCase[] {
  const filters = process.argv
    .slice(2)
    .flatMap((arg, index, args) => {
      if (arg === '--case') return args[index + 1] ? [args[index + 1]] : [];
      if (arg.startsWith('--case=')) return [arg.slice('--case='.length)];
      return [];
    })
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (filters.length === 0) return allCases;

  const filtered = allCases.filter((item) => {
    const label = item.label.toLowerCase();
    return filters.some((filter) => label.includes(filter));
  });

  if (filtered.length === 0) {
    throw new Error(`No AI Strategist eval cases matched: ${filters.join(', ')}`);
  }

  return filtered;
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
    if (!fileExists) {
      return { path, exists: false, loaded: false };
    }

    const result = dotenv.config({ path, override: false, quiet: true });
    return {
      path,
      exists: true,
      loaded: !result.error,
    };
  });
}

async function runPhase(label: string, env: NodeJS.ProcessEnv | Record<string, string | undefined>, phaseCases: readonly EvalCase[]) {
  console.log(`=== ${label} ===`);
  for (const item of phaseCases) {
    const refinement = await runBriefRefinementLLM(
      {
        rawUserMessage: item.rawUserMessage,
        mode: item.mode,
        currentPrompt: item.currentPrompt,
        uploadedAsset: item.uploadedAsset,
      },
      { env }
    );
    const routing = buildRouting(refinement.output, item);
    const recommendations = recommendModelsForBrief(routing.brief);
    const selectedModel = recommendations.best.model.id;
    const promptGenerationContext = buildPromptGenerationContext({
      modelId: selectedModel,
      promptStructureId: routing.promptStructure,
      workflow: routing.workflow,
      brief: refinement.output.normalizedBrief,
      selectedTier: 'best',
      sourceImageKind: routing.sourceImageKind,
      currentPrompt: item.currentPrompt,
      uploadedAsset: item.uploadedAsset,
    });
    const promptWriter = await runPromptWriterLLM(promptGenerationContext, { env });

    console.log(`${item.label}`);
    console.log(`Mode: ${item.mode ?? 'recommend'}`);
    console.log(`Brief LLM used: ${refinement.usedLLM ? 'yes' : `no (${refinement.fallbackReason ?? 'fallback'})`}`);
    console.log(`Prompt LLM used: ${promptWriter.usedLLM ? 'yes' : `no (${promptWriter.fallbackReason ?? 'fallback'})`}`);
    console.log(`Normalized brief: ${JSON.stringify(summarizeNormalizedBrief(refinement.output))}`);
    console.log(
      `Recommendations: best=${recommendations.best.model.id}; medium=${recommendations.medium.model.id}; value=${recommendations.value.model.id}`
    );
    if (recommendations.alsoConsider?.length) {
      console.log(`Also consider: ${recommendations.alsoConsider.map((entry) => entry.model.id).join(', ')}`);
    }
    console.log(`PromptGenerationContext: ${JSON.stringify({
      selectedModel: promptGenerationContext.selectedModel.id,
      selectedWorkflow: promptGenerationContext.selectedWorkflow,
      promptStructure: promptGenerationContext.promptStructure.id,
      workflowBlocks: promptGenerationContext.workflowPromptStructure.blocks.map((block) => block.label),
      warnings: promptGenerationContext.warnings.all,
    })}`);
    console.log(`Raw prompt output: ${extractRawFinalPrompt(promptWriter.rawOutput) ?? '[not available]'}`);
    console.log(`Sanitized final prompt output: ${promptWriter.output.finalPrompt}`);
    console.log(`Sanitizer changed output: ${promptWriter.sanitizerChangedOutput ? 'yes' : 'no'}`);
    console.log(`Validation issues before sanitizer: ${JSON.stringify({
      brief: refinement.validation.issues,
      prompt: promptWriter.validationBeforeSanitizer.issues,
    })}`);
    console.log(`Validation issues after sanitizer: ${JSON.stringify({
      brief: refinement.validation.issues,
      prompt: promptWriter.validationAfterSanitizer.issues,
    })}`);
    console.log('');
  }
}

function extractRawFinalPrompt(rawOutput: unknown): string | undefined {
  return isRecord(rawOutput) && typeof rawOutput.finalPrompt === 'string' ? rawOutput.finalPrompt : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildRouting(normalized: AiStrategistNormalizedBrief, item: EvalCase): {
  workflow: AiStrategistWorkflowId;
  promptStructure: AiStrategistPromptStructureId;
  sourceImageKind: AiStrategistSourceImageKind;
  brief: AiStrategistBrief;
} {
  const workflow = normalized.workflowHint ?? inferWorkflow(normalized, item.uploadedAsset);
  const promptStructure = inferPromptStructure(normalized);
  const sourceImageKind = inferSourceImageKind(item.uploadedAsset);
  return {
    workflow,
    promptStructure,
    sourceImageKind,
    brief: {
      goal: normalized.normalizedBrief,
      workflow,
      promptStructure,
      sourceImageKind,
      budgetPriority: normalized.qualityIntent === 'draft' || normalized.qualityIntent === 'value' ? 'value' : normalized.qualityIntent === 'premium' ? 'quality' : 'balanced',
      speedPriority: normalized.intent === 'social_ad' || normalized.styleHints.includes('vertical') ? 'high' : 'medium',
      qualityPriority: normalized.qualityIntent === 'draft' ? 'draft' : normalized.qualityIntent === 'premium' ? 'maximum' : 'balanced',
      requiredTraits: [
        normalized.hasProduct ? 'product' : '',
        normalized.hasPerson ? 'person' : '',
        normalized.hasCharacter ? 'character' : '',
        normalized.hasVoiceover ? 'voiceover' : '',
        normalized.hasDialogue ? 'dialogue' : '',
        normalized.hasLipSyncIntent ? 'lip-sync' : '',
        normalized.aspectRatioHint ?? '',
        ...normalized.styleHints,
      ].filter(Boolean),
    },
  };
}

function inferWorkflow(normalized: AiStrategistNormalizedBrief, uploadedAsset?: UploadedAssetMetadata): AiStrategistWorkflowId {
  if (uploadedAsset?.isReferenceImage) return 'image-to-video';
  if (normalized.intent === 'video_to_video') return 'video-to-video';
  if (normalized.intent === 'product_ad' || normalized.intent === 'prompt_improvement') return 'text-to-image-then-image-to-video';
  return 'text-to-video';
}

function inferPromptStructure(normalized: AiStrategistNormalizedBrief): AiStrategistPromptStructureId {
  if (normalized.intent === 'product_ad' || normalized.intent === 'product_reference_i2v' || normalized.intent === 'prompt_improvement') {
    return 'product-ad';
  }
  if (normalized.intent === 'social_ad' || normalized.intent === 'draft_storyboard') return 'social-ad';
  if (
    normalized.intent === 'talking_avatar' ||
    normalized.intent === 'spokesperson' ||
    normalized.intent === 'character_animation' ||
    normalized.intent === 'person_reference_i2v'
  ) {
    return 'character-scene';
  }
  return 'cinematic-scene';
}

function inferSourceImageKind(uploadedAsset?: UploadedAssetMetadata): AiStrategistSourceImageKind {
  if (uploadedAsset?.hasPerson) return 'uploaded-person';
  if (uploadedAsset?.hasProduct) return 'product';
  return 'generic';
}

function summarizeNormalizedBrief(brief: AiStrategistNormalizedBrief) {
  return {
    intent: brief.intent,
    workflowHint: brief.workflowHint,
    hasProduct: brief.hasProduct,
    hasPerson: brief.hasPerson,
    hasUploadedReference: brief.hasUploadedReference,
    hasVisibleSpeaker: brief.hasVisibleSpeaker,
    hasVoiceover: brief.hasVoiceover,
    hasDialogue: brief.hasDialogue,
    hasLipSyncIntent: brief.hasLipSyncIntent,
    qualityIntent: brief.qualityIntent,
    confidence: brief.confidence,
    clarificationQuestion: brief.clarificationQuestion,
  };
}

function hasVertexEnv(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.AI_STRATEGIST_LLM_PROVIDER &&
      env.AI_STRATEGIST_LLM_MODEL &&
      env.GOOGLE_VERTEX_PROJECT_ID &&
      env.GOOGLE_VERTEX_LOCATION &&
      env.GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
