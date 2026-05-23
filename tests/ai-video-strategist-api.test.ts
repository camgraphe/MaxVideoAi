import assert from 'node:assert/strict';
import test from 'node:test';

import { POST } from '../frontend/app/api/ai-video-strategist/route.ts';

type StrategistResponse = {
  assistantMessage?: string;
  mode?: string;
  workflow?: string | null;
  recommendations?: {
    best?: { model?: { id?: string; label?: string }; reason?: string; warning?: string; matchedSignals?: string[] };
    medium?: { model?: { id?: string; label?: string }; reason?: string; warning?: string; matchedSignals?: string[] };
    value?: { model?: { id?: string; label?: string }; reason?: string; warning?: string; matchedSignals?: string[] };
  };
  alsoConsider?: Array<{ model?: { id?: string; label?: string }; reason?: string }>;
  selectedModel?: { id?: string; label?: string };
  normalizedBrief?: {
    rawUserMessage?: string;
    normalizedBrief?: string;
    intent?: string;
    workflowHint?: string;
    hasVoiceover?: boolean;
    hasVisibleSpeaker?: boolean;
    aspectRatioHint?: string;
    clarificationQuestion?: string;
    confidence?: number;
  };
  normalizationSource?: string;
  normalizationConfidence?: number;
  clarificationQuestion?: string;
  promptGenerationContext?: {
    userBrief?: string;
    currentPrompt?: string;
    selectedModel?: { id?: string; label?: string };
    selectedWorkflow?: string;
    selectedTier?: string;
    modelPagePromptStructure?: { sourcePath?: string; title?: string };
    workflowPromptStructure?: { id?: string; blocks?: Array<{ label?: string }> };
    durationGuidance?: { seconds?: number; label?: string };
    priceEstimate?: { label?: string };
    warnings?: { all?: string[] };
    negativePromptGuidance?: { compiled?: string };
    settingsGuidance?: string[];
    maxVideoAiRules?: string[];
    outputFormatExamples?: string[];
  };
  prompt?: string;
  negativePrompt?: string;
  settings?: string[];
  warnings?: string[];
  uiActions?: Array<{ type?: string; value?: unknown }>;
};

async function postStrategist(body: Record<string, unknown>) {
  const response = await POST(
    new Request('http://localhost:3000/api/ai-video-strategist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as Parameters<typeof POST>[0]
  );
  const payload = (await response.json()) as StrategistResponse;
  return { response, payload };
}

function actionTypes(payload: StrategistResponse): string[] {
  return payload.uiActions?.map((action) => String(action.type)) ?? [];
}

test('AI video strategist API returns deterministic recommendations', async () => {
  const { response, payload } = await postStrategist({
    mode: 'recommend',
    userMessage: 'Luxury perfume ad on black marble in 9:16 with glossy glass reflections.',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'recommend');
  assert.equal(payload.workflow, 'text-to-image-then-image-to-video');
  assert.equal(payload.recommendations?.best?.model?.id, 'kling-3-pro');
  assert.ok(payload.recommendations?.medium?.model?.id);
  assert.ok(payload.recommendations?.value?.model?.id);
  assert.equal(payload.normalizationSource, 'deterministic');
  assert.equal(payload.normalizedBrief?.intent, 'product_ad');
  assert.equal(payload.normalizationConfidence, payload.normalizedBrief?.confidence);
  assert.match(payload.assistantMessage ?? '', /recommended/i);
  assert.ok(actionTypes(payload).includes('SET_WORKFLOW'));
  assert.ok(!actionTypes(payload).includes('RUN_GENERATION'));
});

test('AI video strategist API builds a model-specific prompt from a selected tier', async () => {
  const { response, payload } = await postStrategist({
    mode: 'build_prompt',
    selectedTier: 'best',
    userMessage: 'Luxury perfume ad on black marble in 9:16 with glossy glass reflections and slow product reveal.',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'build_prompt');
  assert.equal(payload.selectedModel?.id, 'kling-3-pro');
  assert.match(payload.prompt ?? '', /Reference:|Starting image prompt:|Product:/);
  assert.match(payload.negativePrompt ?? '', /text|logo|label/i);
  assert.ok(payload.settings?.some((setting) => /9:16/i.test(setting)));
  assert.ok(actionTypes(payload).includes('SET_MODEL'));
  assert.ok(actionTypes(payload).includes('SET_PROMPT'));
  assert.ok(actionTypes(payload).includes('SET_NEGATIVE_PROMPT'));
});

test('AI video strategist API preserves uploaded person image warnings', async () => {
  const { response, payload } = await postStrategist({
    mode: 'recommend',
    selectedWorkflow: 'image-to-video',
    userMessage: 'Animate an uploaded real person image speaking one short line with stable face identity.',
    uploadedAsset: {
      type: 'image',
      hasPerson: true,
      isReferenceImage: true,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(payload.workflow, 'image-to-video');
  assert.equal(payload.recommendations?.best?.model?.id, 'kling-3-pro');
  assert.match(payload.warnings?.join(' ') ?? '', /Kling or LTX are safer choices/);
  assert.equal(payload.alsoConsider?.[0]?.model?.id, 'happy-horse-1-0');
});

test('AI video strategist API includes Happy Horse as alsoConsider for speech and lip-sync', async () => {
  const { response, payload } = await postStrategist({
    mode: 'recommend',
    userMessage: 'Talking avatar spokesperson video with dialogue, native audio, lip-sync and one short spoken line.',
  });

  assert.equal(response.status, 200);
  assert.notEqual(payload.recommendations?.best?.model?.id, 'happy-horse-1-0');
  assert.equal(payload.alsoConsider?.[0]?.model?.id, 'happy-horse-1-0');
  assert.match(payload.alsoConsider?.[0]?.reason ?? '', /audio\/lip-sync\/spokesperson/);
});

test('AI video strategist API returns product detail warnings for product references', async () => {
  const { response, payload } = await postStrategist({
    mode: 'recommend',
    selectedWorkflow: 'image-to-video',
    userMessage: 'Use a product reference photo and preserve exact packaging, label placement, logo, legal copy, and tiny text.',
    uploadedAsset: {
      type: 'image',
      hasProduct: true,
      hasLogo: true,
      hasText: true,
      isReferenceImage: true,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(payload.workflow, 'image-to-video');
  assert.equal(payload.recommendations?.best?.model?.id, 'kling-3-pro');
  assert.match(payload.warnings?.join(' ') ?? '', /Exact labels, logos, legal copy, packaging details, and tiny text may drift/);
  assert.equal(payload.alsoConsider, undefined);
});

test('AI video strategist product help returns guide copy without model selection', async () => {
  const { response, payload } = await postStrategist({
    mode: 'product_help',
    userMessage: 'Where do I generate a video and how do I choose a model?',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'product_help');
  assert.equal(payload.normalizationSource, 'deterministic');
  assert.equal(payload.normalizedBrief?.intent, 'product_help');
  assert.equal(payload.workflow ?? null, null);
  assert.equal(payload.recommendations, undefined);
  assert.equal(payload.selectedModel, undefined);
  assert.match(payload.assistantMessage ?? '', /open the video generator/i);
  assert.ok(!actionTypes(payload).includes('SET_MODEL'));
  assert.ok(!actionTypes(payload).includes('SET_PROMPT'));
});

test('AI video strategist treats product voiceover as off-camera narration', async () => {
  const { response, payload } = await postStrategist({
    mode: 'build_prompt',
    selectedModel: 'seedance-2-0',
    userMessage: 'Social-first sneaker ad with voiceover, vertical',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.workflow, 'text-to-video');
  assert.equal(payload.normalizedBrief?.intent, 'social_ad');
  assert.equal(payload.normalizedBrief?.hasVoiceover, true);
  assert.equal(payload.normalizedBrief?.hasVisibleSpeaker, false);
  assert.equal(payload.normalizedBrief?.aspectRatioHint, '9:16');
  assert.equal(payload.selectedModel?.id, 'seedance-2-0');
  assert.equal(payload.recommendations, undefined);
  assert.equal(payload.promptGenerationContext?.selectedModel?.id, 'seedance-2-0');
  assert.equal(payload.promptGenerationContext?.selectedWorkflow, 'text-to-video');
  assert.equal(payload.promptGenerationContext?.durationGuidance?.seconds, 8);
  assert.match(payload.promptGenerationContext?.priceEstimate?.label ?? '', /Estimated price: about \$/);
  assert.match(payload.promptGenerationContext?.outputFormatExamples?.join('\n') ?? '', /^Subject:/m);
  assert.ok(!Object.hasOwn(payload.promptGenerationContext ?? {}, 'finalPrompt'));
  assert.match(payload.prompt ?? '', /sneaker/i);
  assert.match(payload.prompt ?? '', /Duration:\n8 seconds/i);
  assert.match(payload.prompt ?? '', /voiceover|off-camera|narration/i);
  assert.doesNotMatch(payload.prompt ?? '', /Starting image prompt:|Video animation prompt:/i);
  assert.doesNotMatch(payload.prompt ?? '', /face movement|medium close-up|restrained gesture|Spoken line|lip-sync/i);
  assert.ok(payload.settings?.some((setting) => /9:16/i.test(setting)));
  assert.ok(payload.settings?.some((setting) => /Duration: 8 seconds/i.test(setting)));
  assert.ok(payload.uiActions?.some((action) => action.type === 'SET_DURATION' && /8 seconds/i.test(action.value)));
  assert.ok(
    payload.uiActions?.every(
      (action) => typeof action === 'object' && typeof action.type === 'string' && Object.hasOwn(action, 'value')
    )
  );
});

test('AI video strategist routes social-first voiceover ads through social speed priorities', async () => {
  const { response, payload } = await postStrategist({
    mode: 'recommend',
    userMessage: 'Social-first sneaker ad with voiceover, vertical',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.workflow, 'text-to-video');
  assert.equal(payload.normalizedBrief?.intent, 'social_ad');
  assert.equal(payload.normalizedBrief?.hasVoiceover, true);
  assert.equal(payload.normalizedBrief?.hasVisibleSpeaker, false);
  assert.equal(payload.recommendations?.best?.model?.id, 'seedance-2-0');
  assert.equal(payload.recommendations?.value?.model?.id, 'seedance-2-0-fast');
});

test('AI video strategist keeps Seedance text-to-image prompt blocks when that workflow is selected', async () => {
  const { response, payload } = await postStrategist({
    mode: 'build_prompt',
    selectedModel: 'seedance-2-0',
    selectedWorkflow: 'text-to-image-then-image-to-video',
    userMessage: 'Social-first sneaker ad with voiceover, vertical',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.workflow, 'text-to-image-then-image-to-video');
  assert.equal(payload.recommendations, undefined);
  assert.equal(payload.promptGenerationContext?.selectedWorkflow, 'text-to-image-then-image-to-video');
  assert.deepEqual(
    payload.promptGenerationContext?.workflowPromptStructure?.blocks?.map((block) => block.label),
    ['Starting image prompt', 'Video animation prompt']
  );
  assert.match(payload.prompt ?? '', /Starting image prompt:/);
  assert.match(payload.prompt ?? '', /Video animation prompt:/);
  assert.doesNotMatch(payload.prompt ?? '', /^Subject:/m);
});

test('AI video strategist improves prompts without copying the instruction text', async () => {
  const { response, payload } = await postStrategist({
    mode: 'improve_prompt',
    currentPrompt: 'Perfume bottle on marble, cinematic',
    userMessage: 'Make this better for a premium product ad',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'improve_prompt');
  assert.equal(payload.workflow, 'text-to-image-then-image-to-video');
  assert.equal(payload.promptGenerationContext?.currentPrompt, 'Perfume bottle on marble, cinematic');
  assert.deepEqual(
    payload.promptGenerationContext?.workflowPromptStructure?.blocks?.map((block) => block.label),
    ['Starting image prompt', 'Video animation prompt']
  );
  assert.match(payload.prompt ?? '', /perfume bottle/i);
  assert.match(payload.prompt ?? '', /premium|product/i);
  assert.match(payload.prompt ?? '', /Starting image prompt:/);
  assert.match(payload.prompt ?? '', /Video animation prompt:/);
  assert.doesNotMatch(payload.prompt ?? '', /Improvement request|Make this better/i);
  assert.equal(new Set(payload.warnings ?? []).size, payload.warnings?.length ?? 0);
  assert.equal((payload.warnings ?? []).filter((warning) => /may drift/i.test(warning)).length, 1);
});

test('AI video strategist keeps cheap social prompt improvements on an intentional fast route', async () => {
  const { response, payload } = await postStrategist({
    mode: 'improve_prompt',
    currentPrompt: 'A fast TikTok sneaker concept',
    userMessage: 'make it cheaper/faster',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'improve_prompt');
  assert.equal(payload.workflow, 'text-to-video');
  assert.equal(payload.promptGenerationContext?.currentPrompt, 'A fast TikTok sneaker concept');
  assert.deepEqual(
    payload.promptGenerationContext?.workflowPromptStructure?.blocks?.map((block) => block.label),
    ['Text-to-video prompt']
  );
});

test('AI video strategist asks one clarification question for ambiguous requests', async () => {
  const { response, payload } = await postStrategist({
    mode: 'recommend',
    userMessage: 'Make it better',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.normalizationSource, 'deterministic');
  assert.equal(payload.normalizedBrief?.intent, 'unknown');
  assert.match(payload.clarificationQuestion ?? '', /What video are you trying to improve/);
  assert.equal(payload.recommendations, undefined);
  assert.equal(payload.workflow ?? null, null);
  assert.deepEqual(payload.uiActions, []);
});
