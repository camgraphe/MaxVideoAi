import { NextResponse } from 'next/server';

import { normalizeStrategistBrief, type AiStrategistNormalizedBrief } from '@/lib/ai-strategist/brief-normalization';
import { AI_STRATEGIST_MODELS } from '@/lib/ai-strategist/model-catalog';
import { buildModelSpecificPrompt, buildPromptGenerationContext } from '@/lib/ai-strategist/prompt-structures';
import { recommendModelsForBrief } from '@/lib/ai-strategist/recommendation-rules';
import type {
  AiStrategistBrief,
  AiStrategistBudgetPriority,
  AiStrategistModelId,
  AiStrategistPromptStructureId,
  AiStrategistQualityPriority,
  AiStrategistRecommendations,
  AiStrategistSourceImageKind,
  AiStrategistSpeedPriority,
  AiStrategistTierPosition,
  AiStrategistWorkflowId,
} from '@/lib/ai-strategist/types';
import { AI_STRATEGIST_PROMPT_STRUCTURES } from '@/lib/ai-strategist/prompt-structures';
import { AI_STRATEGIST_WORKFLOWS } from '@/lib/ai-strategist/workflow-rules';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StrategistMode = 'recommend' | 'build_prompt' | 'improve_prompt' | 'product_help';
type UiActionType =
  | 'SET_MODEL'
  | 'SET_WORKFLOW'
  | 'SET_PROMPT'
  | 'SET_NEGATIVE_PROMPT'
  | 'SET_ASPECT_RATIO'
  | 'SET_DURATION'
  | 'SET_RESOLUTION';

type UploadedAssetMetadata = {
  type?: string;
  hasPerson?: boolean;
  hasProduct?: boolean;
  hasLogo?: boolean;
  hasText?: boolean;
  isReferenceImage?: boolean;
};

type StrategistRequestBody = {
  userMessage?: string;
  mode?: StrategistMode;
  selectedTier?: AiStrategistTierPosition;
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  pageContext?: unknown;
  currentPrompt?: string;
  uploadedAsset?: UploadedAssetMetadata;
};

type UiAction = {
  type: UiActionType;
  value: string;
};

const validModes = new Set<StrategistMode>(['recommend', 'build_prompt', 'improve_prompt', 'product_help']);
const validTiers = new Set<AiStrategistTierPosition>(['best', 'medium', 'value']);
const validModelIds = new Set<AiStrategistModelId>(AI_STRATEGIST_MODELS.map((model) => model.id));
const validWorkflowIds = new Set<AiStrategistWorkflowId>(AI_STRATEGIST_WORKFLOWS.map((workflow) => workflow.id));
const validPromptStructureIds = new Set<AiStrategistPromptStructureId>(
  AI_STRATEGIST_PROMPT_STRUCTURES.map((structure) => structure.id)
);
const productTerms = [
  'product',
  'packshot',
  'packaging',
  'package',
  'ecommerce',
  'perfume',
  'skincare',
  'jewelry',
  'sneaker',
  'sneakers',
  'car commercial',
  'glass',
];

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const mode = normalizeMode(body.mode);
  const uploadedAsset = normalizeUploadedAsset(body.uploadedAsset);
  const selectedWorkflow = normalizeWorkflow(body.selectedWorkflow);
  const selectedModelId = normalizeModelId(body.selectedModel);
  const normalizedBrief = normalizeStrategistBrief({
    rawUserMessage: textOrEmpty(body.userMessage),
    mode,
    pageContext: body.pageContext,
    currentPrompt: textOrEmpty(body.currentPrompt) || undefined,
    uploadedAsset,
    selectedModel: selectedModelId,
    selectedWorkflow,
  });
  const effectiveMode = mode === 'recommend' && normalizedBrief.intent === 'product_help' && !asksForModelChoice(body)
    ? 'product_help'
    : mode;
  if (shouldAskClarification(normalizedBrief, body, uploadedAsset)) {
    return NextResponse.json({
      assistantMessage: normalizedBrief.clarificationQuestion,
      mode: effectiveMode,
      normalizedBrief,
      normalizationSource: 'deterministic',
      normalizationConfidence: normalizedBrief.confidence,
      clarificationQuestion: normalizedBrief.clarificationQuestion,
      settings: [],
      warnings: [],
      uiActions: [],
    });
  }
  const workflow = selectedWorkflow ?? normalizedWorkflowHint(normalizedBrief) ?? inferWorkflow(body, uploadedAsset);
  const promptStructure = inferPromptStructure(body, uploadedAsset, normalizedBrief);
  const selectedTier = normalizeTier(body.selectedTier);
  const sourceImageKind = inferSourceImageKind(uploadedAsset);
  const goal = normalizedBrief.confidence >= 0.55 ? normalizedBrief.normalizedBrief : buildGoal(body, uploadedAsset);

  if (effectiveMode === 'product_help' && !asksForModelChoice(body)) {
    return NextResponse.json({
      assistantMessage: buildProductHelpMessage(body, uploadedAsset),
      mode: 'product_help',
      normalizedBrief,
      normalizationSource: 'deterministic',
      normalizationConfidence: normalizedBrief.confidence,
      ...(normalizedBrief.clarificationQuestion ? { clarificationQuestion: normalizedBrief.clarificationQuestion } : {}),
      ...(normalizeWorkflow(body.selectedWorkflow) ? { workflow } : {}),
      settings: [],
      warnings: [],
      uiActions: [],
    });
  }

  const brief: AiStrategistBrief = {
    goal,
    workflow,
    promptStructure,
    sourceImageKind,
    budgetPriority: inferBudgetPriority(normalizedBrief),
    speedPriority: inferSpeedPriority(normalizedBrief),
    qualityPriority: inferQualityPriority(normalizedBrief),
    requiredTraits: buildRequiredTraits(body, uploadedAsset, normalizedBrief),
  };
  const recommendations = recommendModelsForBrief(brief);
  const promptBrief = shouldBuildPrompt(effectiveMode) ? buildPromptBrief({ body, brief, mode: effectiveMode }) : undefined;
  const selectedPromptModelId = promptBrief
    ? normalizeModelId(body.selectedModel) ?? recommendations[selectedTier].model.id
    : undefined;
  const promptDraft = promptBrief && selectedPromptModelId
    ? buildModelSpecificPrompt({
        modelId: selectedPromptModelId,
        promptStructureId: promptStructure,
        brief: promptBrief,
        workflow,
        selectedTier,
        sourceImageKind,
      })
    : null;
  const promptGenerationContext = promptBrief && selectedPromptModelId
    ? buildPromptGenerationContext({
        modelId: selectedPromptModelId,
        promptStructureId: promptStructure,
        brief: promptBrief,
        workflow,
        selectedTier: normalizeOptionalTier(body.selectedTier) ?? (normalizeModelId(body.selectedModel) ? undefined : selectedTier),
        sourceImageKind,
        currentPrompt: textOrEmpty(body.currentPrompt) || undefined,
        uploadedAsset,
      })
    : null;
  const selectedModel = promptDraft?.selectedModel;
  const warnings = collectWarnings(recommendations, promptDraft?.warning);
  const includeRecommendations = shouldIncludeRecommendations({ body, mode: effectiveMode });
  const uiActions = buildUiActions({
    mode: effectiveMode,
    prompt: promptDraft?.finalPrompt,
    negativePrompt: promptDraft?.negativePrompt,
    selectedModelId: selectedModel?.id,
    settings: promptDraft?.recommendedSettings ?? [],
    workflow,
  });

  return NextResponse.json({
    assistantMessage: buildAssistantMessage({ mode: effectiveMode, recommendations, selectedModelLabel: selectedModel?.label }),
    mode: effectiveMode,
    workflow,
    normalizedBrief,
    normalizationSource: 'deterministic',
    normalizationConfidence: normalizedBrief.confidence,
    ...(normalizedBrief.clarificationQuestion ? { clarificationQuestion: normalizedBrief.clarificationQuestion } : {}),
    ...(includeRecommendations ? { recommendations } : {}),
    ...(includeRecommendations && recommendations.alsoConsider ? { alsoConsider: recommendations.alsoConsider } : {}),
    ...(selectedModel ? { selectedModel } : {}),
    ...(promptGenerationContext ? { promptGenerationContext } : {}),
    ...(promptDraft ? { prompt: promptDraft.finalPrompt } : {}),
    ...(promptDraft ? { negativePrompt: promptDraft.negativePrompt } : {}),
    settings: promptDraft?.recommendedSettings ?? [],
    warnings,
    uiActions,
  });
}

async function readBody(request: Request): Promise<StrategistRequestBody | null> {
  try {
    const body = (await request.json()) as unknown;
    return isRecord(body) ? (body as StrategistRequestBody) : null;
  } catch {
    return null;
  }
}

function normalizeMode(mode: unknown): StrategistMode {
  return typeof mode === 'string' && validModes.has(mode as StrategistMode) ? (mode as StrategistMode) : 'recommend';
}

function normalizeTier(tier: unknown): AiStrategistTierPosition {
  return typeof tier === 'string' && validTiers.has(tier as AiStrategistTierPosition)
    ? (tier as AiStrategistTierPosition)
    : 'best';
}

function normalizeOptionalTier(tier: unknown): AiStrategistTierPosition | undefined {
  return typeof tier === 'string' && validTiers.has(tier as AiStrategistTierPosition)
    ? (tier as AiStrategistTierPosition)
    : undefined;
}

function normalizeWorkflow(workflow: unknown): AiStrategistWorkflowId | undefined {
  return typeof workflow === 'string' && validWorkflowIds.has(workflow as AiStrategistWorkflowId)
    ? (workflow as AiStrategistWorkflowId)
    : undefined;
}

function normalizeModelId(modelId: unknown): AiStrategistModelId | undefined {
  return typeof modelId === 'string' && validModelIds.has(modelId as AiStrategistModelId)
    ? (modelId as AiStrategistModelId)
    : undefined;
}

function normalizeUploadedAsset(asset: unknown): UploadedAssetMetadata | undefined {
  if (!isRecord(asset)) return undefined;
  return {
    type: typeof asset.type === 'string' ? asset.type : undefined,
    hasPerson: asset.hasPerson === true,
    hasProduct: asset.hasProduct === true,
    hasLogo: asset.hasLogo === true,
    hasText: asset.hasText === true,
    isReferenceImage: asset.isReferenceImage === true,
  };
}

function buildGoal(body: StrategistRequestBody, uploadedAsset?: UploadedAssetMetadata): string {
  return [
    textOrEmpty(body.userMessage),
    body.currentPrompt ? `Current prompt: ${body.currentPrompt}` : '',
    pageContextSummary(body.pageContext),
    ...assetHints(uploadedAsset),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

function inferWorkflow(body: StrategistRequestBody, uploadedAsset?: UploadedAssetMetadata): AiStrategistWorkflowId {
  const text = buildSearchText(body, uploadedAsset);
  if (containsAny(text, ['source video', 'video-to-video', 'restyle'])) return 'video-to-video';
  if (uploadedAsset?.isReferenceImage || containsAny(text, ['reference image', 'image-to-video', 'uploaded image'])) {
    return 'image-to-video';
  }
  if (!uploadedAsset && isSocialFirstTextToVideoBrief(text)) {
    return 'text-to-video';
  }
  if (containsAny(text, [...productTerms, 'brand asset'])) {
    return 'text-to-image-then-image-to-video';
  }
  return 'text-to-video';
}

function normalizedWorkflowHint(normalizedBrief: AiStrategistNormalizedBrief): AiStrategistWorkflowId | undefined {
  return normalizedBrief.confidence >= 0.55 ? normalizedBrief.workflowHint : undefined;
}

function shouldAskClarification(
  normalizedBrief: AiStrategistNormalizedBrief,
  body: StrategistRequestBody,
  uploadedAsset?: UploadedAssetMetadata
): boolean {
  if (!normalizedBrief.clarificationQuestion) return false;
  if (normalizeModelId(body.selectedModel) || normalizeWorkflow(body.selectedWorkflow)) return false;
  if (body.currentPrompt || uploadedAsset?.isReferenceImage || uploadedAsset?.hasPerson || uploadedAsset?.hasProduct) return false;
  return normalizedBrief.confidence < 0.55;
}

function inferPromptStructure(
  body: StrategistRequestBody,
  uploadedAsset?: UploadedAssetMetadata,
  normalizedBrief?: AiStrategistNormalizedBrief
): AiStrategistPromptStructureId {
  const text = buildSearchText(body, uploadedAsset);
  let promptStructure: AiStrategistPromptStructureId = 'cinematic-scene';
  if (normalizedBrief?.intent === 'social_ad') {
    promptStructure = 'social-ad';
  } else if (
    normalizedBrief?.intent === 'talking_avatar' ||
    normalizedBrief?.intent === 'spokesperson' ||
    normalizedBrief?.intent === 'character_animation' ||
    normalizedBrief?.intent === 'person_reference_i2v'
  ) {
    promptStructure = 'character-scene';
  } else if (
    normalizedBrief?.intent === 'product_ad' ||
    normalizedBrief?.intent === 'product_reference_i2v' ||
    uploadedAsset?.hasProduct ||
    containsAny(text, productTerms)
  ) {
    promptStructure = 'product-ad';
  } else if (containsAny(text, ['brand', 'logo', 'launch asset', 'hero asset'])) {
    promptStructure = 'brand-asset';
  } else if (containsAny(text, ['tiktok', 'reels', 'social', 'ugc', 'ad variant'])) {
    promptStructure = 'social-ad';
  } else if (uploadedAsset?.hasPerson || containsAny(text, ['character', 'person', 'founder', 'avatar', 'emotion'])) {
    promptStructure = 'character-scene';
  }

  return validPromptStructureIds.has(promptStructure) ? promptStructure : 'cinematic-scene';
}

function inferSourceImageKind(uploadedAsset?: UploadedAssetMetadata): AiStrategistSourceImageKind {
  if (uploadedAsset?.hasPerson) return 'uploaded-person';
  if (uploadedAsset?.hasProduct) return 'product';
  return 'generic';
}

function buildRequiredTraits(
  body: StrategistRequestBody,
  uploadedAsset?: UploadedAssetMetadata,
  normalizedBrief?: AiStrategistNormalizedBrief
): string[] {
  const traits = new Set<string>();
  for (const value of assetHints(uploadedAsset)) traits.add(value);
  if (body.currentPrompt) traits.add('existing prompt');
  for (const value of normalizedTraitHints(normalizedBrief)) traits.add(value);
  return Array.from(traits);
}

function normalizedTraitHints(normalizedBrief?: AiStrategistNormalizedBrief): string[] {
  if (!normalizedBrief) return [];

  const traits: string[] = [];
  if (normalizedBrief.hasProduct) traits.push('product');
  if (normalizedBrief.hasPerson) traits.push('person');
  if (normalizedBrief.hasCharacter) traits.push('character');
  if (normalizedBrief.hasUploadedReference) traits.push('reference image');
  if (normalizedBrief.hasVisibleSpeaker) traits.push('visible speaker');
  if (normalizedBrief.hasVoiceover) traits.push('voiceover');
  if (normalizedBrief.hasDialogue) traits.push('dialogue');
  if (normalizedBrief.hasLipSyncIntent) traits.push('lip-sync');
  if (normalizedBrief.hasLogoOrTextRisk) traits.push('label text risk');
  if (normalizedBrief.aspectRatioHint) traits.push(normalizedBrief.aspectRatioHint);
  traits.push(...normalizedBrief.styleHints);

  return traits;
}

function inferBudgetPriority(normalizedBrief: AiStrategistNormalizedBrief): AiStrategistBudgetPriority {
  if (normalizedBrief.intent === 'draft_storyboard' || normalizedBrief.qualityIntent === 'draft' || normalizedBrief.qualityIntent === 'value') {
    return 'value';
  }

  if (normalizedBrief.qualityIntent === 'premium') {
    return 'quality';
  }

  return 'balanced';
}

function inferSpeedPriority(normalizedBrief: AiStrategistNormalizedBrief): AiStrategistSpeedPriority {
  if (
    normalizedBrief.intent === 'social_ad' ||
    normalizedBrief.intent === 'draft_storyboard' ||
    normalizedBrief.platformHint === 'tiktok' ||
    normalizedBrief.platformHint === 'instagram' ||
    normalizedBrief.styleHints.includes('vertical')
  ) {
    return 'high';
  }

  return 'medium';
}

function inferQualityPriority(normalizedBrief: AiStrategistNormalizedBrief): AiStrategistQualityPriority {
  if (normalizedBrief.intent === 'draft_storyboard' || normalizedBrief.qualityIntent === 'draft') {
    return 'draft';
  }

  if (normalizedBrief.qualityIntent === 'premium') {
    return 'maximum';
  }

  return 'balanced';
}

function assetHints(uploadedAsset?: UploadedAssetMetadata): string[] {
  if (!uploadedAsset) return [];

  const hints: string[] = [];
  if (uploadedAsset.isReferenceImage) hints.push('reference image');
  if (uploadedAsset.hasPerson) hints.push('uploaded human image', 'preserve face');
  if (uploadedAsset.hasProduct) hints.push('product reference image');
  if (uploadedAsset.hasLogo) hints.push('logo position');
  if (uploadedAsset.hasText) hints.push('tiny text', 'label placement');
  return hints;
}

function buildPromptBrief(input: {
  body: StrategistRequestBody;
  brief: AiStrategistBrief;
  mode: StrategistMode;
}): string {
  return input.mode === 'improve_prompt' && input.body.currentPrompt
    ? buildImprovedPromptBrief(input.body.currentPrompt, input.body.userMessage)
    : input.brief.goal ?? textOrEmpty(input.body.userMessage);
}

function shouldBuildPrompt(mode: StrategistMode): boolean {
  return mode === 'build_prompt' || mode === 'improve_prompt';
}

function shouldIncludeRecommendations(input: { body: StrategistRequestBody; mode: StrategistMode }): boolean {
  if (input.mode === 'recommend') return true;
  if (input.mode === 'product_help') return asksForModelChoice(input.body);
  if (input.mode === 'build_prompt' && normalizeModelId(input.body.selectedModel)) return false;
  return shouldBuildPrompt(input.mode);
}

function buildAssistantMessage(input: {
  mode: StrategistMode;
  recommendations: AiStrategistRecommendations;
  selectedModelLabel?: string;
}): string {
  if (input.mode === 'build_prompt') {
    return `Built a MaxVideoAI prompt for ${input.selectedModelLabel ?? input.recommendations.best.model.label}.`;
  }
  if (input.mode === 'improve_prompt') {
    return `Improved the prompt for ${input.selectedModelLabel ?? input.recommendations.best.model.label}.`;
  }
  if (input.mode === 'product_help') {
    return `Use ${input.recommendations.best.model.label} as the primary route, with ${input.recommendations.medium.model.label} and ${input.recommendations.value.model.label} as tradeoffs.`;
  }
  return `Recommended ${input.recommendations.best.model.label} as Best, ${input.recommendations.medium.model.label} as Medium, and ${input.recommendations.value.model.label} as Value.`;
}

function collectWarnings(recommendations: AiStrategistRecommendations, promptWarning?: string): string[] {
  return uniqueStrings([
    recommendations.best.warning,
    recommendations.medium.warning,
    recommendations.value.warning,
    promptWarning,
  ].map(normalizeWarning));
}

function buildUiActions(input: {
  mode: StrategistMode;
  workflow: AiStrategistWorkflowId;
  selectedModelId?: AiStrategistModelId;
  prompt?: string;
  negativePrompt?: string;
  settings: readonly string[];
}): UiAction[] {
  const actions: UiAction[] = [{ type: 'SET_WORKFLOW', value: input.workflow }];
  if (input.mode === 'recommend' || input.mode === 'product_help') return actions;

  if (input.selectedModelId) actions.push({ type: 'SET_MODEL', value: input.selectedModelId });
  if (input.prompt) actions.push({ type: 'SET_PROMPT', value: input.prompt });
  if (input.negativePrompt) actions.push({ type: 'SET_NEGATIVE_PROMPT', value: input.negativePrompt });

  const aspectRatio = input.settings.find((setting) => /\b\d+:\d+\b/.test(setting));
  const duration = input.settings.find((setting) => /\b\d+(?:-\d+)?\s*(?:seconds|second|s)\b/i.test(setting));
  const resolution = input.settings.find((setting) => /\b(?:native\s+)?(?:4K|1080p|720p)\b/i.test(setting));
  if (aspectRatio) actions.push({ type: 'SET_ASPECT_RATIO', value: aspectRatio });
  if (duration) actions.push({ type: 'SET_DURATION', value: duration });
  if (resolution) actions.push({ type: 'SET_RESOLUTION', value: resolution });

  return actions;
}

function pageContextSummary(pageContext: unknown): string {
  if (!pageContext) return '';
  if (typeof pageContext === 'string') return `Page context: ${pageContext}`;
  try {
    return `Page context: ${JSON.stringify(pageContext).slice(0, 500)}`;
  } catch {
    return '';
  }
}

function buildSearchText(body: StrategistRequestBody, uploadedAsset?: UploadedAssetMetadata): string {
  return [body.userMessage, body.currentPrompt, pageContextSummary(body.pageContext), ...assetHints(uploadedAsset)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function isSocialFirstTextToVideoBrief(text: string): boolean {
  return (
    containsAny(text, ['social-first', 'social first', 'tiktok', 'reels', 'ugc', 'vertical', 'fast social', 'quick social']) &&
    !containsAny(text, ['uploaded image', 'reference image', 'product photo', 'packshot', 'exact packaging', 'label placement'])
  );
}

function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function buildImprovedPromptBrief(currentPrompt: string, userMessage: unknown): string {
  const source = currentPrompt.trim();
  const request = textOrEmpty(userMessage).toLowerCase();
  const treatment: string[] = [];

  if (containsAny(request, ['premium', 'luxury', 'commercial', 'product ad', 'product'])) {
    treatment.push('premium product ad treatment');
    treatment.push('polished commercial lighting');
    treatment.push('controlled reflections');
    treatment.push('clean hero framing');
    treatment.push('one smooth reveal');
  }
  if (containsAny(request, ['social', 'tiktok', 'reels', 'vertical'])) {
    treatment.push('vertical social pacing');
    treatment.push('strong first-second visual hook');
  }
  if (containsAny(request, ['cinematic', 'film', 'story'])) {
    treatment.push('cinematic camera movement');
    treatment.push('grounded lighting');
  }

  const suffix = treatment.length > 0
    ? Array.from(new Set(treatment)).join(', ')
    : 'clearer subject, action, camera, style and final frame';

  return `${source}. Refine as ${suffix}.`;
}

function asksForModelChoice(body: StrategistRequestBody): boolean {
  const text = buildSearchText(body);
  if (containsAny(text, ['how do i choose a model', 'how to choose a model', 'how should i choose a model'])) {
    return false;
  }

  return containsAny(text, [
    'which model should i use',
    'what model should i use',
    'recommend a model',
    'recommend models',
    'best model for',
    'which model for',
    'what model for',
  ]);
}

function buildProductHelpMessage(body: StrategistRequestBody, uploadedAsset?: UploadedAssetMetadata): string {
  const text = buildSearchText(body, uploadedAsset);
  if (containsAny(text, ['upload', 'image', 'reference image'])) {
    return 'To animate an image, open the video generator, choose image-to-video, upload or select the reference image in MaxVideoAI, enter the motion prompt, compare suggested models, check the price shown before generation, then launch the render.';
  }

  if (containsAny(text, ['pricing', 'price', 'credits', 'cost'])) {
    return 'To manage cost, choose the workflow and model in the video generator, review the price shown before generation, and launch only when the settings look right. The strategist should not spend credits or start generation by itself.';
  }

  return 'To generate a video, open the video generator, choose the workflow, enter or improve your prompt, compare the suggested models, check the price shown before generation, then launch the render.';
}

function normalizeWarning(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/exact .*labels?.*logos?.*legal copy/i.test(value) || /exact text.*logos?.*legal copy/i.test(value)) {
    return 'Exact labels, logos, legal copy, packaging details, and tiny text may drift and should be checked after generation or added as overlays.';
  }
  return value;
}

function uniqueStrings(values: ReadonlyArray<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
