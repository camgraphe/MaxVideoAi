import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

const expectedModelIds = [
  'seedance-2-0-fast',
  'seedance-2-0',
  'kling-3-standard',
  'kling-3-pro',
  'kling-3-4k',
  'veo-3-1-fast',
  'veo-3-1-lite',
  'veo-3-1',
  'happy-horse-1-0',
  'ltx-2-3',
  'hailuo',
  'pika',
  'sora',
] as const;

const expectedWorkflowIds = [
  'text-to-video',
  'image-to-video',
  'text-to-image-then-image-to-video',
  'video-to-video',
] as const;

const expectedPromptStructureIds = [
  'product-ad',
  'cinematic-scene',
  'social-ad',
  'character-scene',
  'brand-asset',
] as const;

async function loadStrategistModules() {
  try {
    const [catalog, workflows, prompts, recommendations, normalization, llmContracts, llmAdapter, llmCost] = await Promise.all([
      import('../frontend/lib/ai-strategist/model-catalog.ts'),
      import('../frontend/lib/ai-strategist/workflow-rules.ts'),
      import('../frontend/lib/ai-strategist/prompt-structures.ts'),
      import('../frontend/lib/ai-strategist/recommendation-rules.ts'),
      import('../frontend/lib/ai-strategist/brief-normalization.ts'),
      import('../frontend/lib/ai-strategist/llm-contracts.ts'),
      import('../frontend/lib/ai-strategist/llm-adapter.ts'),
      import('../frontend/lib/ai-strategist/llm-cost.ts'),
    ]);

    return { catalog, workflows, prompts, recommendations, normalization, llmContracts, llmAdapter, llmCost };
  } catch (error) {
    assert.fail(`Expected AI Strategist knowledge modules to be importable: ${(error as Error).message}`);
  }
}

function tierRecommendations(result: { best: unknown; medium: unknown; value: unknown }) {
  return [result.best, result.medium, result.value] as const;
}

function recommendationSetContainsModel(
  result: {
    best: { model: { id: string } };
    medium: { model: { id: string } };
    value: { model: { id: string } };
    alsoConsider?: readonly { model: { id: string } }[];
  },
  modelId: string
) {
  return [
    result.best.model.id,
    result.medium.model.id,
    result.value.model.id,
    ...(result.alsoConsider?.map((entry) => entry.model.id) ?? []),
  ].includes(modelId);
}

test('AI Strategist catalog exposes versioned complete entries for every v1 model', async () => {
  const { catalog } = await loadStrategistModules();

  assert.match(catalog.AI_STRATEGIST_KNOWLEDGE_VERSION, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(
    catalog.AI_STRATEGIST_MODELS.map((model: { id: string }) => model.id),
    expectedModelIds
  );

  for (const model of catalog.AI_STRATEGIST_MODELS) {
    assert.ok(model.label, `${model.id} should have a label`);
    assert.match(model.tierPosition, /^(best|medium|value)$/);
    assert.ok(model.supportedWorkflows.length > 0, `${model.id} should declare supported workflows`);
    assert.ok(model.bestFor.length > 0, `${model.id} should declare bestFor guidance`);
    assert.ok(model.avoidFor.length > 0, `${model.id} should declare avoidFor guidance`);
    assert.ok(model.strengths.length > 0, `${model.id} should declare strengths`);
    assert.ok(model.weaknesses.length > 0, `${model.id} should declare weaknesses`);
    assert.ok(model.promptStyle.length > 20, `${model.id} should describe prompt style`);
    assert.ok(model.recommendedUseCases.length > 0, `${model.id} should declare recommended use cases`);
    assert.match(model.relativeCostLevel, /^(low|medium|high|premium)$/);
    assert.match(model.relativeSpeedLevel, /^(slow|medium|fast|very-fast)$/);
    assert.match(model.qualityLevel, /^(draft|standard|high|premium)$/);

    for (const scoreKey of ['realismScore', 'motionScore', 'productDetailScore', 'socialAdScore'] as const) {
      assert.ok(Number.isInteger(model[scoreKey]), `${model.id} ${scoreKey} should be an integer`);
      assert.ok(model[scoreKey] >= 1 && model[scoreKey] <= 5, `${model.id} ${scoreKey} should use a 1-5 scale`);
    }

    assert.ok(model.promptGuidance.length > 0, `${model.id} should declare positive prompt guidance`);
    assert.ok(model.negativePromptGuidance.length > 0, `${model.id} should declare negative prompt guidance`);
  }

  const happyHorse = catalog.AI_STRATEGIST_MODELS.find((model: { id: string }) => model.id === 'happy-horse-1-0');
  assert.ok(happyHorse, 'Happy Horse should be present in the strategist catalog');
  assert.match(
    [...happyHorse.promptGuidance, ...(happyHorse.routingNotes ?? [])].join(' '),
    /Strong candidate for compatible audio\/lip-sync\/spokesperson workflows/
  );
});

test('AI Strategist workflow and prompt sources cover the requested v1 structures', async () => {
  const { workflows, prompts } = await loadStrategistModules();

  assert.deepEqual(
    workflows.AI_STRATEGIST_WORKFLOWS.map((workflow: { id: string }) => workflow.id),
    expectedWorkflowIds
  );
  assert.deepEqual(
    prompts.AI_STRATEGIST_PROMPT_STRUCTURES.map((structure: { id: string }) => structure.id),
    expectedPromptStructureIds
  );

  const promptDraft = prompts.buildModelSpecificPrompt({
    modelId: 'kling-3-4k',
    promptStructureId: 'product-ad',
    workflow: 'text-to-image-then-image-to-video',
    brief: 'Premium watch product ad on a marble plinth with controlled reflections.',
  });

  assert.equal(promptDraft.selectedModel.label, 'Kling 3 4K');
  assert.equal(promptDraft.workflow, 'text-to-image-then-image-to-video');
  assert.match(promptDraft.modelPagePromptStructure.sourcePath, /content\/models\/en\/kling-3-4k\.json/);
  assert.match(promptDraft.modelPagePromptStructure.title, /Image-to-video master prompt|Final 4K delivery prompt/);
  assert.match(promptDraft.finalPrompt, /Premium watch product ad/);
  assert.match(promptDraft.negativePrompt, /text|logo|clutter|label/i);
  assert.ok(promptDraft.recommendedSettings.length > 0);
});

test('normalizeStrategistBrief extracts social product voiceover intent without visible speaker', async () => {
  const { normalization } = await loadStrategistModules();

  const brief = normalization.normalizeStrategistBrief({
    rawUserMessage: 'Social-first sneaker ad with voiceover, vertical',
  });

  assert.equal(brief.rawUserMessage, 'Social-first sneaker ad with voiceover, vertical');
  assert.equal(brief.intent, 'social_ad');
  assert.equal(brief.hasProduct, true);
  assert.equal(brief.hasVoiceover, true);
  assert.equal(brief.hasVisibleSpeaker, false);
  assert.equal(brief.hasLipSyncIntent, false);
  assert.ok(['text-to-video', 'text-to-image-then-image-to-video'].includes(brief.workflowHint));
  assert.equal(brief.aspectRatioHint, '9:16');
  assert.equal(brief.platformHint, 'ad');
  assert.ok(brief.confidence >= 0.7);
});

test('normalizeStrategistBrief extracts talking avatar speech and lip-sync intent', async () => {
  const { normalization } = await loadStrategistModules();

  const brief = normalization.normalizeStrategistBrief({
    rawUserMessage: 'Talking avatar with a short spoken line',
  });

  assert.equal(brief.intent, 'talking_avatar');
  assert.equal(brief.hasVisibleSpeaker, true);
  assert.equal(brief.hasDialogue, true);
  assert.equal(brief.hasLipSyncIntent, true);
  assert.equal(brief.workflowHint, 'text-to-video');
});

test('normalizeStrategistBrief preserves uploaded person reference app context', async () => {
  const { normalization } = await loadStrategistModules();

  const brief = normalization.normalizeStrategistBrief({
    rawUserMessage: 'Animate this person image speaking to camera',
    uploadedAsset: { hasPerson: true, isReferenceImage: true },
  });

  assert.equal(brief.intent, 'person_reference_i2v');
  assert.equal(brief.workflowHint, 'image-to-video');
  assert.equal(brief.hasPerson, true);
  assert.equal(brief.hasUploadedReference, true);
  assert.equal(brief.hasVisibleSpeaker, true);
  assert.equal(brief.hasDialogue, true);
  assert.equal(brief.hasLipSyncIntent, true);
});

test('normalizeStrategistBrief treats prompt improvement as source concept plus instruction', async () => {
  const { normalization } = await loadStrategistModules();

  const brief = normalization.normalizeStrategistBrief({
    rawUserMessage: 'Make this better for a premium product ad',
    currentPrompt: 'Perfume bottle on marble, cinematic',
  });

  assert.ok(['prompt_improvement', 'product_ad'].includes(brief.intent));
  assert.match(brief.normalizedBrief, /Perfume bottle on marble, cinematic/);
  assert.match(brief.normalizedBrief, /premium product ad/i);
  assert.doesNotMatch(brief.normalizedBrief, /^Make this better/i);
  assert.equal(brief.hasProduct, true);
  assert.equal(brief.hasLogoOrTextRisk, true);
  assert.equal(brief.qualityIntent, 'premium');
});

test('normalizeStrategistBrief detects product help without model routing', async () => {
  const { normalization } = await loadStrategistModules();

  const brief = normalization.normalizeStrategistBrief({
    rawUserMessage: 'Where do I generate a video and how do I choose a model?',
  });

  assert.equal(brief.intent, 'product_help');
  assert.equal(brief.workflowHint, undefined);
  assert.equal(brief.hasProduct, false);
  assert.ok(brief.confidence >= 0.7);
});

test('normalizeStrategistBrief asks one clarification question for ambiguous requests', async () => {
  const { normalization } = await loadStrategistModules();

  const brief = normalization.normalizeStrategistBrief({
    rawUserMessage: 'Make it better',
  });

  assert.equal(brief.intent, 'unknown');
  assert.ok(brief.confidence < 0.55);
  assert.match(brief.clarificationQuestion ?? '', /What video are you trying to improve/);
});

test('buildPromptGenerationContext returns JSON-safe LLM guidance without final creative prompt ownership', async () => {
  const { prompts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'seedance-2-0',
    workflow: 'text-to-image-then-image-to-video',
    promptStructureId: 'social-ad',
    brief: 'Social-first sneaker ad with voiceover, vertical',
    selectedTier: 'medium',
    uploadedAsset: {
      hasProduct: true,
      hasLogo: true,
      hasText: true,
      isReferenceImage: false,
    },
  });

  assert.equal(context.userBrief, 'Social-first sneaker ad with voiceover, vertical');
  assert.equal(context.selectedModel.id, 'seedance-2-0');
  assert.equal(context.selectedWorkflow, 'text-to-image-then-image-to-video');
  assert.equal(context.selectedTier, 'medium');
  assert.match(context.modelPagePromptStructure.sourcePath, /content\/models\/en\/seedance-2-0\.json/);
  assert.equal(context.workflowPromptStructure.id, 'text-to-image-then-image-to-video');
  assert.deepEqual(
    context.workflowPromptStructure.blocks.map((block: { label: string }) => block.label),
    ['Starting image prompt', 'Video animation prompt']
  );
  assert.match(context.outputFormatExamples.join('\n'), /Starting image prompt:/);
  assert.match(context.outputFormatExamples.join('\n'), /Video animation prompt:/);
  assert.match(context.outputFormatExamples.join('\n'), /Duration:/);
  assert.match(context.warnings.all.join(' '), /Exact text, logos, legal copy/);
  assert.match(context.negativePromptGuidance.compiled, /unreadable text/i);
  assert.equal(context.durationGuidance.seconds, 8);
  assert.match(context.durationGuidance.reason, /audio|voiceover/i);
  assert.match(context.priceEstimate.label, /Estimated price: about \$/);
  assert.match(context.priceEstimate.label, /720p|1080p|native 4K/);
  assert.ok(context.settingsGuidance.some((setting: string) => /9:16/i.test(setting)));
  assert.ok(context.settingsGuidance.some((setting: string) => /Duration: 8 seconds/i.test(setting)));
  assert.ok(context.settingsGuidance.some((setting: string) => /Estimated price/i.test(setting)));
  assert.ok(context.maxVideoAiRules.some((rule: string) => /Do not mention Midjourney/i.test(rule)));
  assert.ok(context.maxVideoAiRules.some((rule: string) => /selected duration/i.test(rule)));
  assert.ok(!Object.hasOwn(context, 'finalPrompt'));
  assert.ok(!Object.hasOwn(context, 'prompt'));
  assert.doesNotThrow(() => JSON.stringify(context));
});

test('buildPromptGenerationContext includes person reference compatibility guidance', async () => {
  const { prompts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'kling-3-standard',
    workflow: 'image-to-video',
    promptStructureId: 'character-scene',
    brief: 'Animate this uploaded person image speaking to camera with a short line.',
    sourceImageKind: 'uploaded-person',
    uploadedAsset: {
      type: 'image',
      hasPerson: true,
      isReferenceImage: true,
    },
  });

  assert.equal(context.workflowPromptStructure.id, 'image-to-video');
  assert.deepEqual(
    context.workflowPromptStructure.blocks[0].fields.map((field: { label: string }) => field.label),
    ['Reference', 'Preserve', 'Duration', 'Motion', 'Camera', 'Atmosphere', 'End frame', 'Audio']
  );
  assert.equal(context.durationGuidance.seconds, 8);
  assert.match(context.warnings.person.join(' '), /compatible image-to-video model/);
  assert.match(context.maxVideoAiRules.join(' '), /Kling or LTX are safer choices/);
});

test('buildPromptGenerationContext preserves hyphenated requested durations', async () => {
  const { prompts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'kling-3-standard',
    workflow: 'image-to-video',
    promptStructureId: 'character-scene',
    brief: 'Create a 15-second vertical TikTok influencer video from the uploaded person image.',
    sourceImageKind: 'uploaded-person',
    uploadedAsset: {
      type: 'image',
      hasPerson: true,
      isReferenceImage: true,
    },
  });

  assert.equal(context.durationGuidance.seconds, 15);
  assert.equal(context.durationGuidance.source, 'brief');
  assert.match(context.settingsGuidance.join('\n'), /Duration: 15 seconds/);
});

test('buildPromptGenerationContext clamps Veo requested durations to 8 seconds', async () => {
  const { prompts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'veo-3-1',
    workflow: 'text-to-video',
    promptStructureId: 'cinematic-scene',
    brief: 'Create a 15-second luxury car commercial with cinematic lighting.',
  });

  assert.equal(context.durationGuidance.seconds, 8);
  assert.equal(context.durationGuidance.source, 'brief_adjusted');
  assert.match(context.durationGuidance.reason, /adjusted to the selected model range/i);
  assert.match(context.settingsGuidance.join('\n'), /Duration: 8 seconds/);
});

test('buildPromptGenerationContext carries selected resolution into pricing and rules', async () => {
  const { prompts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'veo-3-1-fast',
    workflow: 'text-to-video',
    promptStructureId: 'cinematic-scene',
    brief: 'Create an 8 second 4K luxury car commercial in 9:16.',
  });

  assert.equal(context.durationGuidance.seconds, 8);
  assert.equal(context.resolutionGuidance.resolution, '4k');
  assert.equal(context.resolutionGuidance.aspectRatio, '9:16');
  assert.match(context.priceEstimate.label, /4K 9:16/);
  assert.match(context.settingsGuidance.join('\n'), /Resolution: 4K 9:16/);
  assert.ok(context.maxVideoAiRules.some((rule: string) => /selected resolution/i.test(rule)));
});

test('buildPromptGenerationContext adjusts unsupported requested resolution', async () => {
  const { prompts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'veo-3-1-lite',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Create an 8 second 4K TikTok product ad.',
  });

  assert.equal(context.resolutionGuidance.resolution, '720p');
  assert.equal(context.resolutionGuidance.source, 'brief_adjusted');
  assert.match(context.resolutionGuidance.warning ?? '', /does not support 4K/i);
  assert.doesNotMatch(context.settingsGuidance.join('\n'), /Resolution: 4K/);
});

test('buildBriefRefinementLLMRequest defines the future normalized brief contract', async () => {
  const { llmContracts } = await loadStrategistModules();

  const request = llmContracts.buildBriefRefinementLLMRequest({
    rawUserMessage: 'Social-first sneaker ad with voiceover, vertical',
    uploadedAsset: {
      type: 'image',
      hasProduct: true,
      hasText: true,
      isReferenceImage: true,
    },
    selectedWorkflow: 'image-to-video',
    conversationContext: {
      currentChatStage: 'awaiting_model_choice',
      currentUserMessage: 'ok seedance',
      lastUserBrief: 'une pub de voiture dynamique',
      enrichedBrief: 'A high-energy cinematic car commercial with dynamic motion.',
      lastSelectedWorkflow: 'text-to-video',
      lastRecommendations: {
        best: {
          modelId: 'kling-3-pro',
          label: 'Kling 3 Pro',
          reason: 'Controlled commercial realism.',
        },
        value: {
          modelId: 'seedance-2-0',
          label: 'Seedance 2.0',
          reason: 'Social-first motion value.',
        },
      },
      recentTurns: [
        { role: 'user', content: 'une pub de voiture dynamique' },
        { role: 'assistant', content: 'Choose Best, Medium, or Value.' },
      ],
    },
  });

  assert.match(request.systemInstructions, /brief refinement/i);
  assert.match(request.systemInstructions, /Do not choose the final model/i);
  assert.match(request.systemInstructions, /Do not write the final video prompt/i);
  assert.match(request.systemInstructions, /Voiceover means off-camera narration/i);
  assert.match(request.systemInstructions, /Hard app context wins/i);
  assert.match(request.systemInstructions, /ok seedance/i);
  assert.equal(request.userPayload.rawUserMessage, 'Social-first sneaker ad with voiceover, vertical');
  assert.equal(request.userPayload.selectedWorkflow, 'image-to-video');
  assert.equal(request.userPayload.uploadedAsset.hasProduct, true);
  assert.equal(request.userPayload.conversationContext.currentChatStage, 'awaiting_model_choice');
  assert.equal(request.userPayload.conversationContext.currentUserMessage, 'ok seedance');
  assert.equal(request.userPayload.conversationContext.enrichedBrief, 'A high-energy cinematic car commercial with dynamic motion.');
  assert.equal(request.userPayload.conversationContext.lastRecommendations.value.modelId, 'seedance-2-0');
  assert.equal(request.expectedJsonSchema.type, 'object');
  assert.ok(request.expectedJsonSchema.required.includes('normalizedBrief'));
  assert.ok(request.expectedJsonSchema.required.includes('intent'));
  assert.ok(request.expectedJsonSchema.required.includes('confidence'));
  assert.deepEqual(request.expectedJsonSchema.properties.intent.enum, [
    'product_ad',
    'social_ad',
    'cinematic_scene',
    'talking_avatar',
    'spokesperson',
    'character_animation',
    'product_reference_i2v',
    'person_reference_i2v',
    'video_to_video',
    'draft_storyboard',
    'product_help',
    'prompt_improvement',
    'unknown',
  ]);
  assert.match(JSON.stringify(request.expectedJsonSchema), /clarificationQuestion/);
  assert.doesNotThrow(() => JSON.stringify(request));
});

test('buildPromptWriterLLMRequest carries selected model workflow and prompt structures', async () => {
  const { prompts, llmContracts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'kling-3-pro',
    workflow: 'text-to-image-then-image-to-video',
    promptStructureId: 'product-ad',
    brief: 'Luxury perfume ad on black marble, 9:16',
    selectedTier: 'best',
    uploadedAsset: {
      hasProduct: true,
      hasLogo: true,
      hasText: true,
    },
  });
  const request = llmContracts.buildPromptWriterLLMRequest(context);

  assert.match(request.systemInstructions, /final MaxVideoAI prompt writer/i);
  assert.match(request.systemInstructions, /Do not auto-run generation/i);
  assert.match(request.systemInstructions, /Do not spend credits/i);
  assert.match(request.systemInstructions, /Do not switch model/i);
  assert.equal(request.userPayload.promptGenerationContext.selectedModel.id, 'kling-3-pro');
  assert.equal(request.userPayload.promptGenerationContext.selectedWorkflow, 'text-to-image-then-image-to-video');
  assert.equal(request.userPayload.promptGenerationContext.durationGuidance.seconds, 6);
  assert.match(request.systemInstructions, /durationGuidance/i);
  assert.match(request.systemInstructions, /shot count, motion beats, voiceover\/dialogue pacing/i);
  assert.deepEqual(
    request.userPayload.promptGenerationContext.workflowPromptStructure.blocks.map((block: { label: string }) => block.label),
    ['Starting image prompt', 'Video animation prompt']
  );
  assert.match(request.userPayload.promptGenerationContext.modelPagePromptStructure.sourcePath, /kling-3-pro/);
  assert.ok(request.expectedJsonSchema.required.includes('assistantMessage'));
  assert.ok(request.expectedJsonSchema.required.includes('finalPrompt'));
  assert.ok(request.expectedJsonSchema.required.includes('uiActions'));
  assert.deepEqual(request.expectedJsonSchema.properties.uiActions.items.required, ['type', 'value']);
  assert.doesNotThrow(() => JSON.stringify(request));
});

test('validatePromptWriterLLMOutput flags unsafe future LLM outputs', async () => {
  const { prompts, llmContracts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'seedance-2-0',
    workflow: 'image-to-video',
    promptStructureId: 'product-ad',
    brief: 'Use a sneaker product reference image with a voiceover only.',
    uploadedAsset: {
      hasProduct: true,
      isReferenceImage: true,
    },
  });

  const validation = llmContracts.validatePromptWriterLLMOutput(
    {
      assistantMessage: 'Perfect output guaranteed.',
      finalPrompt: 'Starting image prompt:\nUse Midjourney style.\nVideo animation prompt:\nAnimate it.',
      negativePrompt: 'no artifacts',
      settings: ['9:16'],
      warnings: ['Check logo.', 'Check logo.'],
      uiActions: ['SET_PROMPT', { type: 'SET_MODEL' }, { type: 'SET_PROMPT', value: 'x' }],
    },
    context
  );

  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'bare_ui_action_string'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'invalid_ui_action_shape'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'external_tool_reference'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'overpromising_language'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'workflow_prompt_structure_mismatch'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'duplicate_warning'));
  assert.deepEqual(validation.dedupedWarnings, ['Check logo.']);
});

test('validatePromptWriterLLMOutput rejects unsupported high-resolution claims', async () => {
  const { prompts, llmContracts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'kling-3-pro',
    workflow: 'text-to-video',
    promptStructureId: 'product-ad',
    brief: 'Perfume bottle on marble, cinematic premium product ad',
  });

  for (const resolutionClaim of ['8k', '8K', '12k', 'ultra-high 8k'] as const) {
    const validation = llmContracts.validatePromptWriterLLMOutput(
      {
        assistantMessage: 'Prepared a prompt.',
        finalPrompt: [
          'Subject: transparent perfume bottle on marble',
          'Action: slow product reveal',
          'Camera: controlled push-in',
          `Style: premium studio lighting, ${resolutionClaim} resolution, crisp reflections`,
        ].join('\n'),
        negativePrompt: 'no unreadable text',
        settings: ['9:16', '1080p'],
        warnings: [],
        uiActions: [{ type: 'SET_PROMPT', value: 'Subject: perfume bottle' }],
      },
      context
    );

    assert.equal(validation.ok, false, `${resolutionClaim} should be rejected`);
    assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'unsupported_resolution_claim'));
  }
});

test('validatePromptWriterLLMOutput rejects 4K when strategist selected a lower resolution', async () => {
  const { prompts, llmContracts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'veo-3-1-fast',
    workflow: 'text-to-video',
    promptStructureId: 'cinematic-scene',
    brief: 'Fast cinematic car ad, 9:16, premium look.',
  });

  assert.equal(context.resolutionGuidance.resolution, '1080p');

  const validation = llmContracts.validatePromptWriterLLMOutput(
    {
      assistantMessage: 'Prepared a prompt.',
      finalPrompt: [
        'Subject: luxury car at night',
        'Duration: 8 seconds',
        'Camera: vertical tracking shot',
        'Style: cinematic lighting, 4K output',
      ].join('\n'),
      negativePrompt: 'no unreadable text',
      settings: ['9:16', '4K', '8 seconds'],
      warnings: [],
      uiActions: [{ type: 'SET_PROMPT', value: 'Subject: luxury car' }],
    },
    context
  );

  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'unsupported_resolution_claim'));
});

test('validatePromptWriterLLMOutput rejects aspect ratio mismatches against context', async () => {
  const { prompts, llmContracts } = await loadStrategistModules();

  const context = prompts.buildPromptGenerationContext({
    modelId: 'kling-3-pro',
    workflow: 'text-to-image-then-image-to-video',
    promptStructureId: 'product-ad',
    brief: 'Luxury perfume ad on black marble, 9:16, premium look',
  });

  const validation = llmContracts.validatePromptWriterLLMOutput(
    {
      assistantMessage: 'Prepared a prompt.',
      finalPrompt: [
        'Starting image prompt:',
        'Product/subject: perfume bottle on black marble',
        'Composition: 16:9 centered product frame',
        'Video animation prompt:',
        'Duration: 6 seconds',
        'Camera: 16:9 slow push-in',
      ].join('\n'),
      negativePrompt: 'no unreadable text',
      settings: ['Aspect Ratio: 16:9', 'Duration: 6 seconds'],
      warnings: [],
      uiActions: [{ type: 'SET_PROMPT', value: 'x' }],
    },
    context
  );

  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'aspect_ratio_mismatch'));
});

test('validateBriefRefinementLLMOutput flags model selection and invalid clarification behavior', async () => {
  const { llmContracts } = await loadStrategistModules();

  const validation = llmContracts.validateBriefRefinementLLMOutput({
    normalizedBrief: 'Make it better',
    intent: 'unknown',
    hasProduct: false,
    hasPerson: false,
    hasCharacter: false,
    hasUploadedReference: false,
    hasVisibleSpeaker: false,
    hasVoiceover: false,
    hasDialogue: false,
    hasLipSyncIntent: false,
    hasLogoOrTextRisk: false,
    qualityIntent: 'balanced',
    platformHint: 'unknown',
    styleHints: [],
    constraints: [],
    confidence: 0.3,
    clarificationQuestion: 'Which exact model, workflow, style, platform, duration, camera, lighting, brand, and audience should I use?',
    selectedModel: 'kling-3-pro',
    finalPrompt: 'Subject: product',
  });

  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'brief_refinement_selected_model'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'brief_refinement_final_prompt'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'clarification_too_long'));
});

test('runBriefRefinementLLM falls back deterministically when local env is missing', async () => {
  const { llmAdapter } = await loadStrategistModules();
  let callCount = 0;

  const result = await llmAdapter.runBriefRefinementLLM(
    {
      rawUserMessage: 'Social-first sneaker ad with voiceover, vertical',
    },
    {
      env: {},
      completionClient: async () => {
        callCount += 1;
        return {};
      },
    }
  );

  assert.equal(callCount, 0);
  assert.equal(result.usedLLM, false);
  assert.equal(result.source, 'deterministic_fallback');
  assert.equal(result.fallbackReason, 'missing_local_llm_config');
  assert.equal(result.output.intent, 'social_ad');
  assert.equal(result.output.hasVoiceover, true);
  assert.equal(result.validation.ok, true);
});

test('AI Strategist LLM cost estimates use provider token metadata when available', async () => {
  const { prompts, llmAdapter, llmCost } = await loadStrategistModules();

  const usage = llmCost.extractGeminiUsageMetadata({
    usageMetadata: {
      promptTokenCount: 1000,
      candidatesTokenCount: 200,
      totalTokenCount: 1200,
      cachedContentTokenCount: 25,
    },
  });
  assert.equal(usage?.inputTokens, 1000);
  assert.equal(usage?.outputTokens, 200);
  assert.equal(usage?.totalTokens, 1200);
  assert.equal(usage?.cachedInputTokens, 25);

  const context = prompts.buildPromptGenerationContext({
    modelId: 'seedance-2-0',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Social-first sneaker ad with voiceover, vertical',
  });

  const result = await llmAdapter.runPromptWriterLLM(context, {
    env: {
      AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
      AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
      GOOGLE_VERTEX_PROJECT_ID: 'test-project',
      GOOGLE_VERTEX_LOCATION: 'global',
      GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
    },
    completionClient: async () => ({
      output: {
        assistantMessage: 'Prompt ready.',
        finalPrompt: [
          'Subject:',
          'vertical sneaker product ad',
          'Action:',
          'fast reveal and product close-up',
          'Camera:',
          '9:16 tracking push-in',
          'Style:',
          'clean social lighting',
          'Audio:',
          'Voiceover: [customer-provided line], energetic reveal SFX.',
          'Duration:',
          '8 seconds',
        ].join('\n'),
        negativePrompt: 'blurry product, warped shoe, unreadable text',
        settings: ['Aspect ratio: 9:16', 'Duration: 8 seconds', 'Resolution: 720p'],
        warnings: [],
        uiActions: [{ type: 'SET_PROMPT', value: 'prompt' }],
      },
      providerUsage: usage,
    }),
  });

  assert.equal(result.usedLLM, true);
  assert.equal(result.costEstimate.liveCall, true);
  assert.equal(result.costEstimate.acceptedOutput, true);
  assert.equal(result.costEstimate.usage.source, 'provider');
  assert.equal(result.costEstimate.usage.inputTokens, 1000);
  assert.equal(result.costEstimate.usage.outputTokens, 200);
  assert.equal(result.costEstimate.pricing.source, 'default_table');
  assert.equal(result.costEstimate.estimatedCostUsd, 0.00055);
  assert.match(result.costEstimate.formattedCost, /\$0\.0006/);
});

test('AI Strategist LLM cost estimates support env price overrides and unpriced models', async () => {
  const { llmCost, llmContracts } = await loadStrategistModules();
  const request = llmContracts.buildBriefRefinementLLMRequest({
    rawUserMessage: 'Luxury perfume ad on black marble',
  });

  const priced = llmCost.buildLlmCallCostEstimate({
    stage: 'brief_refinement',
    request,
    output: { normalizedBrief: 'Luxury perfume ad on black marble' },
    provider: 'google-vertex-gemini',
    model: 'custom-local-model',
    providerUsage: { inputTokens: 500, outputTokens: 100, totalTokens: 600 },
    liveCall: true,
    acceptedOutput: true,
    env: {
      AI_STRATEGIST_LLM_INPUT_USD_PER_1M: '1',
      AI_STRATEGIST_LLM_OUTPUT_USD_PER_1M: '2',
    },
  });
  const unpriced = llmCost.buildLlmCallCostEstimate({
    stage: 'brief_refinement',
    request,
    output: { normalizedBrief: 'Luxury perfume ad on black marble' },
    provider: 'google-vertex-gemini',
    model: 'custom-local-model',
    providerUsage: { inputTokens: 500, outputTokens: 100, totalTokens: 600 },
    liveCall: true,
    acceptedOutput: true,
    env: {},
  });

  assert.equal(priced.pricing.source, 'env');
  assert.equal(priced.estimatedCostUsd, 0.0007);
  assert.equal(unpriced.pricing.source, 'not_configured');
  assert.equal(unpriced.estimatedCostUsd, null);
  assert.match(unpriced.warnings.join(' '), /No LLM price is configured/);
});

test('runBriefRefinementLLM uses valid local LLM output and falls back on invalid output', async () => {
  const { llmAdapter } = await loadStrategistModules();
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const valid = await llmAdapter.runBriefRefinementLLM(
    {
      rawUserMessage: 'Talking avatar with a short spoken line',
    },
    {
      env,
      completionClient: async () => ({
        rawUserMessage: 'Talking avatar with a short spoken line',
        normalizedBrief: 'Talking avatar with a short spoken line',
        intent: 'talking_avatar',
        workflowHint: 'text-to-video',
        hasProduct: false,
        hasPerson: false,
        hasCharacter: true,
        hasUploadedReference: false,
        hasVisibleSpeaker: true,
        hasVoiceover: false,
        hasDialogue: true,
        hasLipSyncIntent: true,
        hasLogoOrTextRisk: false,
        qualityIntent: 'balanced',
        platformHint: 'unknown',
        styleHints: [],
        constraints: [],
        confidence: 0.86,
      }),
    }
  );

  assert.equal(valid.usedLLM, true);
  assert.equal(valid.source, 'llm');
  assert.equal(valid.output.intent, 'talking_avatar');

  const invalid = await llmAdapter.runBriefRefinementLLM(
    {
      rawUserMessage: 'Talking avatar with a short spoken line',
    },
    {
      env,
      completionClient: async () => ({
        selectedModel: 'happy-horse-1-0',
        finalPrompt: 'Subject: avatar',
      }),
    }
  );

  assert.equal(invalid.usedLLM, false);
  assert.equal(invalid.source, 'deterministic_fallback');
  assert.equal(invalid.fallbackReason, 'validation_failed');
  assert.ok(invalid.validation.issues.some((issue: { code: string }) => issue.code === 'brief_refinement_selected_model'));
});

test('runBriefRefinementLLM applies uploaded person reference hard-context override', async () => {
  const { llmAdapter } = await loadStrategistModules();
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runBriefRefinementLLM(
    {
      rawUserMessage: 'Make this person speak to camera',
      uploadedAsset: { hasPerson: true, isReferenceImage: true },
    },
    {
      env,
      completionClient: async () => ({
        rawUserMessage: 'Make this person speak to camera',
        normalizedBrief: 'Make this person speak to camera',
        intent: 'talking_avatar',
        workflowHint: 'text-to-video',
        hasProduct: false,
        hasPerson: false,
        hasCharacter: false,
        hasUploadedReference: false,
        hasVisibleSpeaker: true,
        hasVoiceover: false,
        hasDialogue: true,
        hasLipSyncIntent: true,
        hasLogoOrTextRisk: false,
        qualityIntent: 'balanced',
        platformHint: 'unknown',
        styleHints: [],
        constraints: [],
        confidence: 0.91,
      }),
    }
  );

  assert.equal(result.usedLLM, true);
  assert.equal(result.output.intent, 'person_reference_i2v');
  assert.equal(result.output.workflowHint, 'image-to-video');
  assert.equal(result.output.hasPerson, true);
  assert.equal(result.output.hasUploadedReference, true);
});

test('runBriefRefinementLLM keeps product references distinct from person references', async () => {
  const { llmAdapter } = await loadStrategistModules();
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runBriefRefinementLLM(
    {
      rawUserMessage: 'Animate this product photo with a premium commercial reveal',
      uploadedAsset: { hasProduct: true, isReferenceImage: true },
    },
    {
      env,
      completionClient: async () => ({
        rawUserMessage: 'Animate this product photo with a premium commercial reveal',
        normalizedBrief: 'Animate this product photo with a premium commercial reveal',
        intent: 'product_ad',
        workflowHint: 'text-to-video',
        hasProduct: false,
        hasPerson: false,
        hasCharacter: false,
        hasUploadedReference: false,
        hasVisibleSpeaker: false,
        hasVoiceover: false,
        hasDialogue: false,
        hasLipSyncIntent: false,
        hasLogoOrTextRisk: false,
        qualityIntent: 'premium',
        platformHint: 'ad',
        styleHints: [],
        constraints: [],
        confidence: 0.9,
      }),
    }
  );

  assert.equal(result.usedLLM, true);
  assert.equal(result.output.intent, 'product_reference_i2v');
  assert.notEqual(result.output.intent, 'person_reference_i2v');
  assert.equal(result.output.workflowHint, 'image-to-video');
  assert.equal(result.output.hasProduct, true);
  assert.equal(result.output.hasPerson, false);
  assert.equal(result.output.hasUploadedReference, true);
});

test('runBriefRefinementLLM preserves selected workflow over hard-context inference', async () => {
  const { llmAdapter } = await loadStrategistModules();
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runBriefRefinementLLM(
    {
      rawUserMessage: 'Animate this person image speaking to camera',
      uploadedAsset: { hasPerson: true, isReferenceImage: true },
      selectedWorkflow: 'video-to-video',
    },
    {
      env,
      completionClient: async () => ({
        rawUserMessage: 'Animate this person image speaking to camera',
        normalizedBrief: 'Animate this person image speaking to camera',
        intent: 'talking_avatar',
        workflowHint: 'text-to-video',
        hasProduct: false,
        hasPerson: true,
        hasCharacter: false,
        hasUploadedReference: true,
        hasVisibleSpeaker: true,
        hasVoiceover: false,
        hasDialogue: true,
        hasLipSyncIntent: true,
        hasLogoOrTextRisk: false,
        qualityIntent: 'balanced',
        platformHint: 'unknown',
        styleHints: [],
        constraints: [],
        confidence: 0.9,
      }),
    }
  );

  assert.equal(result.usedLLM, true);
  assert.equal(result.output.intent, 'person_reference_i2v');
  assert.equal(result.output.workflowHint, 'video-to-video');
});

test('runBriefRefinementLLM preserves explicit aspect ratio from raw brief when LLM omits it', async () => {
  const { llmAdapter } = await loadStrategistModules();
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runBriefRefinementLLM(
    {
      rawUserMessage: 'Luxury perfume ad on black marble, 9:16, premium look',
    },
    {
      env,
      completionClient: async () => ({
        rawUserMessage: 'Luxury perfume ad on black marble, 9:16, premium look',
        normalizedBrief: 'A luxury perfume bottle on black marble with premium lighting.',
        intent: 'product_ad',
        workflowHint: 'text-to-image-then-image-to-video',
        hasProduct: true,
        hasPerson: false,
        hasCharacter: false,
        hasUploadedReference: false,
        hasVisibleSpeaker: false,
        hasVoiceover: false,
        hasDialogue: false,
        hasLipSyncIntent: false,
        hasLogoOrTextRisk: true,
        qualityIntent: 'premium',
        platformHint: 'ad',
        styleHints: ['luxury', 'black marble'],
        constraints: [],
        confidence: 0.9,
      }),
    }
  );

  assert.equal(result.usedLLM, true);
  assert.equal(result.output.aspectRatioHint, '9:16');

  const followUp = await llmAdapter.runBriefRefinementLLM(
    {
      rawUserMessage: 'A luxury perfume bottle on black marble with premium lighting.',
      conversationContext: {
        lastUserBrief: 'Luxury perfume ad on black marble, 9:16, premium look',
        enrichedBrief: 'A luxury perfume bottle on black marble with premium lighting.',
      },
    },
    {
      env,
      completionClient: async () => ({
        rawUserMessage: 'A luxury perfume bottle on black marble with premium lighting.',
        normalizedBrief: 'A luxury perfume bottle on black marble with premium lighting.',
        intent: 'product_ad',
        workflowHint: 'text-to-image-then-image-to-video',
        hasProduct: true,
        hasPerson: false,
        hasCharacter: false,
        hasUploadedReference: false,
        hasVisibleSpeaker: false,
        hasVoiceover: false,
        hasDialogue: false,
        hasLipSyncIntent: false,
        hasLogoOrTextRisk: true,
        qualityIntent: 'premium',
        platformHint: 'ad',
        styleHints: ['luxury', 'black marble'],
        constraints: [],
        confidence: 0.9,
      }),
    }
  );

  assert.equal(followUp.output.aspectRatioHint, '9:16');

  const fallbackFollowUp = await llmAdapter.runBriefRefinementLLM(
    {
      rawUserMessage: 'A luxury perfume bottle on black marble with premium lighting.',
      conversationContext: {
        lastUserBrief: 'Luxury perfume ad on black marble, 9:16, premium look',
      },
    },
    { env: {} }
  );

  assert.equal(fallbackFollowUp.usedLLM, false);
  assert.equal(fallbackFollowUp.output.aspectRatioHint, '9:16');
});

test('runBriefRefinementLLM prefers starting-image workflow for premium product prompt improvements', async () => {
  const { llmAdapter } = await loadStrategistModules();
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runBriefRefinementLLM(
    {
      mode: 'improve_prompt',
      rawUserMessage: 'Make this better for a premium product ad',
      currentPrompt: 'Perfume bottle on marble, cinematic',
    },
    {
      env,
      completionClient: async () => ({
        rawUserMessage: 'Make this better for a premium product ad',
        normalizedBrief: 'Perfume bottle on marble, cinematic. Premium product ad treatment.',
        intent: 'product_ad',
        workflowHint: 'text-to-video',
        hasProduct: true,
        hasPerson: false,
        hasCharacter: false,
        hasUploadedReference: false,
        hasVisibleSpeaker: false,
        hasVoiceover: false,
        hasDialogue: false,
        hasLipSyncIntent: false,
        hasLogoOrTextRisk: true,
        qualityIntent: 'premium',
        platformHint: 'ad',
        styleHints: ['cinematic', 'premium'],
        constraints: [],
        confidence: 0.94,
      }),
    }
  );

  assert.equal(result.usedLLM, true);
  assert.equal(result.output.intent, 'product_ad');
  assert.equal(result.output.workflowHint, 'text-to-image-then-image-to-video');
});

test('runBriefRefinementLLM keeps explicit text-to-video workflow for product prompt improvements', async () => {
  const { llmAdapter } = await loadStrategistModules();
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runBriefRefinementLLM(
    {
      mode: 'improve_prompt',
      rawUserMessage: 'Make this better for a premium product ad but keep it pure text-to-video',
      currentPrompt: 'Perfume bottle on marble, cinematic',
    },
    {
      env,
      completionClient: async () => ({
        rawUserMessage: 'Make this better for a premium product ad but keep it pure text-to-video',
        normalizedBrief: 'Perfume bottle on marble, cinematic. Premium product ad treatment.',
        intent: 'product_ad',
        workflowHint: 'text-to-video',
        hasProduct: true,
        hasPerson: false,
        hasCharacter: false,
        hasUploadedReference: false,
        hasVisibleSpeaker: false,
        hasVoiceover: false,
        hasDialogue: false,
        hasLipSyncIntent: false,
        hasLogoOrTextRisk: true,
        qualityIntent: 'premium',
        platformHint: 'ad',
        styleHints: ['cinematic', 'premium'],
        constraints: [],
        confidence: 0.94,
      }),
    }
  );

  assert.equal(result.usedLLM, true);
  assert.equal(result.output.workflowHint, 'text-to-video');
});

test('runPromptWriterLLM validates local LLM output and falls back safely', async () => {
  const { prompts, llmAdapter } = await loadStrategistModules();
  const context = prompts.buildPromptGenerationContext({
    modelId: 'seedance-2-0',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Social-first sneaker ad with voiceover, vertical',
  });
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const valid = await llmAdapter.runPromptWriterLLM(context, {
    env,
    completionClient: async () => ({
      assistantMessage: 'Prepared a Seedance prompt.',
      finalPrompt: [
        'Subject: sneakers with crisp silhouette in vertical social framing',
        'Duration: 8 seconds total',
        'Action: fast product reveal with one voiceover beat',
        'Camera: handheld-style push-in, vertical 9:16',
        'Style: bright creator ad lighting, clean studio texture',
        'Audio: off-camera voiceover with light sneaker impact SFX',
      ].join('\n'),
      negativePrompt: 'no unreadable text, no warped shoe shape',
      settings: ['9:16', 'Duration: 8 seconds'],
      warnings: ['Exact logos and tiny text may drift.'],
      uiActions: [{ type: 'SET_PROMPT', value: 'Subject: sneakers' }],
    }),
  });

  assert.equal(valid.usedLLM, true);
  assert.equal(valid.source, 'llm');
  assert.match(valid.output.finalPrompt, /^Subject:/);

  const invalid = await llmAdapter.runPromptWriterLLM(context, {
    env,
    completionClient: async () => ({
      assistantMessage: 'Perfect.',
      finalPrompt: 'Starting image prompt:\nUse Midjourney.\nVideo animation prompt:\nAnimate.',
      negativePrompt: 'none',
      settings: [],
      warnings: ['Check text.', 'Check text.'],
      uiActions: ['SET_PROMPT'],
    }),
  });

  assert.equal(invalid.usedLLM, false);
  assert.equal(invalid.source, 'deterministic_fallback');
  assert.equal(invalid.fallbackReason, 'validation_failed');
  assert.ok(invalid.validation.issues.some((issue: { code: string }) => issue.code === 'bare_ui_action_string'));
  assert.match(invalid.output.finalPrompt, /^Subject:/m);
  assert.ok(invalid.output.uiActions.every((action: { type?: unknown; value?: unknown }) => typeof action.type === 'string' && typeof action.value === 'string'));
});

test('parseStrategistLlmJsonText accepts a first valid JSON object with trailing model text', async () => {
  const { llmAdapter } = await loadStrategistModules();

  const parsed = llmAdapter.parseStrategistLlmJsonText(
    [
      '{',
      '  "assistantMessage": "Ready",',
      '  "finalPrompt": "Subject: perfume bottle with a brace-like reflection } inside the text",',
      '  "negativePrompt": "none",',
      '  "settings": ["9:16"],',
      '  "warnings": [],',
      '  "uiActions": [{"type":"SET_PROMPT","value":"Subject: perfume"}]',
      '}',
      'Note: I followed the requested schema.',
    ].join('\n')
  );

  assert.equal((parsed as { assistantMessage?: string }).assistantMessage, 'Ready');
  assert.match((parsed as { finalPrompt?: string }).finalPrompt ?? '', /brace-like reflection/);
});

test('runPromptWriterLLM retries transient local LLM errors before falling back', async () => {
  const { prompts, llmAdapter } = await loadStrategistModules();
  const context = prompts.buildPromptGenerationContext({
    modelId: 'seedance-2-0',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Social-first sneaker ad with voiceover, vertical',
  });
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    AI_STRATEGIST_LLM_MAX_RETRIES: '1',
    AI_STRATEGIST_LLM_RETRY_BASE_MS: '0',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };
  let attempts = 0;

  const result = await llmAdapter.runPromptWriterLLM(context, {
    env,
    completionClient: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('Vertex Gemini request failed with status 429: RESOURCE_EXHAUSTED');
      }
      return {
        assistantMessage: 'Prepared a Seedance prompt.',
        finalPrompt: [
          'Subject: sneakers with crisp silhouette in vertical social framing',
          'Duration: 8 seconds total',
          'Action: fast product reveal with one voiceover beat',
          'Camera: handheld-style push-in, vertical 9:16',
          'Style: bright creator ad lighting, clean studio texture',
          'Audio: off-camera voiceover with light sneaker impact SFX',
        ].join('\n'),
        negativePrompt: 'no unreadable text, no warped shoe shape',
        settings: ['9:16', 'Duration: 8 seconds'],
        warnings: ['Exact logos and tiny text may drift.'],
        uiActions: [{ type: 'SET_PROMPT', value: 'Subject: sneakers' }],
      };
    },
  });

  assert.equal(attempts, 2);
  assert.equal(result.usedLLM, true);
  assert.equal(result.source, 'llm');
  assert.match(result.output.finalPrompt, /^Subject:/);
});

test('runPromptWriterLLM falls back when the LLM claims unsupported 8K resolution', async () => {
  const { prompts, llmAdapter } = await loadStrategistModules();
  const context = prompts.buildPromptGenerationContext({
    modelId: 'kling-3-pro',
    workflow: 'text-to-video',
    promptStructureId: 'product-ad',
    brief: 'Perfume bottle on marble, cinematic premium product ad',
  });
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runPromptWriterLLM(context, {
    env,
    completionClient: async () => ({
      assistantMessage: 'Prepared a product prompt.',
      finalPrompt: [
        'Subject: transparent perfume bottle on marble',
        'Action: slow commercial reveal',
        'Camera: controlled push-in',
        'Style: premium lighting, 8K resolution, crisp reflections',
      ].join('\n'),
      negativePrompt: 'no unreadable text',
      settings: ['9:16', '8K'],
      warnings: [],
      uiActions: [{ type: 'SET_PROMPT', value: 'Subject: perfume bottle' }],
    }),
  });

  assert.equal(result.usedLLM, false);
  assert.equal(result.fallbackReason, 'validation_failed');
  assert.ok(result.validation.issues.some((issue: { code: string }) => issue.code === 'unsupported_resolution_claim'));
  assert.doesNotMatch(result.output.finalPrompt, /\b8\s*k\b/i);
});

test('runPromptWriterLLM flags and sanitizes invented voiceover lines', async () => {
  const { prompts, llmAdapter } = await loadStrategistModules();
  const context = prompts.buildPromptGenerationContext({
    modelId: 'seedance-2-0',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Social-first sneaker ad with voiceover, vertical',
  });
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runPromptWriterLLM(context, {
    env,
    completionClient: async () => ({
      assistantMessage: 'Prepared a sneaker prompt.',
      finalPrompt: [
        'Subject: modern athletic sneakers',
        'Duration: 8 seconds total',
        'Action: fast product reveal',
        'Camera: vertical 9:16 tracking shot',
        'Style: bright social ad lighting',
        "Audio: crisp off-camera voiceover narrating: 'Engineered for the streets, built for your pace.'",
      ].join('\n'),
      negativePrompt: 'no unreadable text',
      settings: ['9:16', '1080p', 'Duration: 8 seconds'],
      warnings: [],
      uiActions: [{ type: 'SET_PROMPT', value: 'Subject: sneakers' }],
    }),
  });

  assert.equal(result.usedLLM, true);
  assert.equal(result.sanitizerChangedOutput, true);
  assert.ok(result.validationBeforeSanitizer.issues.some((issue: { code: string }) => issue.code === 'invented_spoken_line'));
  assert.ok(!result.validationAfterSanitizer.issues.some((issue: { code: string }) => issue.code === 'invented_spoken_line'));
  assert.doesNotMatch(result.output.finalPrompt, /Engineered for the streets/i);
  assert.match(result.output.finalPrompt, /\[customer-provided line\]/i);
});

test('runPromptWriterLLM softens over-strong lip-sync and precision wording', async () => {
  const { prompts, llmAdapter } = await loadStrategistModules();
  const context = prompts.buildPromptGenerationContext({
    modelId: 'kling-3-pro',
    workflow: 'image-to-video',
    promptStructureId: 'character-scene',
    brief: 'Make this person speak to camera',
    sourceImageKind: 'uploaded-person',
    uploadedAsset: { type: 'image', hasPerson: true, isReferenceImage: true },
  });
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runPromptWriterLLM(context, {
    env,
    completionClient: async () => ({
      assistantMessage: 'Prepared a person prompt.',
      finalPrompt: [
        'Reference: Use the uploaded reference image.',
        "Preserve: Maintain exact facial structure, the person's exact facial structure, and maintain the exact facial identity. Ensure no identity drift or wardrobe changes occur during speech.",
        'Duration: 8 seconds total.',
        'Motion: Match mouth movements precisely to the provided dialogue with perfect lip-sync. The lip-sync should be fluid and natural, matching the provided audio. Realistic lip-syncing for the dialogue. Realistic lip-sync for the dialogue. Simple, readable lip-syncing to match the provided dialogue.',
        'Camera: Medium close-up, perfectly centered, with focus on lip-sync accuracy.',
        'Atmosphere: soft studio lighting.',
        'End frame: composed pose.',
        "Audio: Lip-sync enabled to match the provided dialogue, lip-sync enabled for the provided audio track, lip-syncing enabled for the provided audio track, exactly synchronized dialogue. Lip-sync enabled; the subject should speak the provided content with natural cadence and mouth movement. Lip-sync to the provided dialogue. The character's mouth movements should match the provided audio track.",
      ].join('\n'),
      negativePrompt: 'no face warping',
      settings: ['1080p', 'Duration: 8 seconds'],
      warnings: [],
      uiActions: [{ type: 'SET_PROMPT', value: 'Reference: person' }],
    }),
  });

  assert.equal(result.usedLLM, true);
  assert.equal(result.sanitizerChangedOutput, true);
  assert.ok(result.validationBeforeSanitizer.issues.some((issue: { code: string }) => issue.code === 'over_strong_prompt_wording'));
  assert.ok(!result.validationAfterSanitizer.issues.some((issue: { code: string }) => issue.code === 'over_strong_prompt_wording'));
  assert.doesNotMatch(result.output.finalPrompt, /perfectly|precisely|perfect lip-sync|realistic lip-sync(?:ing)?|lip-sync accuracy|exactly synchronized|matching the provided audio|mouth movements should match|lip-sync(?:ing)? to match|lip-sync to the provided|ensure no identity drift|exact facial identity|exact facial structure|lip-sync(?:ing)? enabled/i);
  assert.doesNotMatch(result.output.finalPrompt, /Reduce identity drift or wardrobe changes occur/i);
  assert.match(result.output.finalPrompt, /sync mouth movement as closely as possible|reduce identity drift and wardrobe changes|cleanly centered|keep lip-sync simple and readable/i);
});

test('runPromptWriterLLM avoids generated readable label typography without a label asset', async () => {
  const { prompts, llmAdapter } = await loadStrategistModules();
  const context = prompts.buildPromptGenerationContext({
    modelId: 'kling-3-pro',
    workflow: 'text-to-image-then-image-to-video',
    promptStructureId: 'product-ad',
    brief: 'Perfume bottle on marble, cinematic. Premium product ad treatment.',
  });
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };

  const result = await llmAdapter.runPromptWriterLLM(context, {
    env,
    completionClient: async () => ({
      assistantMessage: 'Prepared a perfume prompt.',
      finalPrompt: [
        'Starting image prompt:',
        'Product/subject: glass perfume bottle with a readable label area, minimalist label, and elegant label with serif typography.',
        'Composition: centered on marble.',
        'Lighting: cinematic studio lighting.',
        'Preserve for video: bottle shape and label readability.',
        '',
        'Video animation prompt:',
        'Reference: use the starting image.',
        'Preserve: product identity and label readability.',
        'Duration: 6 seconds total.',
        'Motion: slow reveal.',
        'Camera: slow push-in.',
        'Atmosphere: luxury.',
        'End frame: hero frame.',
      ].join('\n'),
      negativePrompt: 'no unreadable text',
      settings: ['16:9', '1080p', 'Duration: 6 seconds'],
      warnings: ['Exact labels, logos, legal copy, packaging details, and tiny text may drift and should be checked after generation or added as overlays.'],
      uiActions: [{ type: 'SET_PROMPT', value: 'Starting image prompt:' }],
    }),
  });

  assert.equal(result.usedLLM, true);
  assert.equal(result.sanitizerChangedOutput, true);
  assert.ok(result.validationBeforeSanitizer.issues.some((issue: { code: string }) => issue.code === 'generated_label_typography'));
  assert.ok(!result.validationAfterSanitizer.issues.some((issue: { code: string }) => issue.code === 'generated_label_typography'));
  assert.doesNotMatch(result.output.finalPrompt, /serif typography|label readability/i);
  assert.doesNotMatch(result.output.finalPrompt, /clean label area area/i);
  assert.match(result.output.finalPrompt, /clean label area, no readable text required/i);
});

test('buildModelSpecificPrompt mirrors model-page prompting structures for strategist scenarios', async () => {
  const { prompts } = await loadStrategistModules();

  const seedanceFast = prompts.buildModelSpecificPrompt({
    modelId: 'seedance-2-0-fast',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Fast TikTok sneaker ad, vertical hook, quick product reveal, creator-style pacing.',
  });
  assert.match(seedanceFast.modelPagePromptStructure.sourcePath, /content\/models\/en\/seedance-2-0-fast\.json/);
  assert.match(seedanceFast.modelPagePromptStructure.title, /Text-to-video test prompt/);
  assert.match(seedanceFast.finalPrompt, /Subject:\nSneakers/i);
  assert.doesNotMatch(seedanceFast.finalPrompt, /Midjourney|DALL-E|Runway/i);

  const ltxStoryboard = prompts.buildModelSpecificPrompt({
    modelId: 'ltx-2-3',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Cheap storyboard draft for an ad concept with three simple timing beats.',
  });
  assert.match(ltxStoryboard.modelPagePromptStructure.sourcePath, /content\/models\/en\/ltx-2-3-fast\.json/);
  assert.match(ltxStoryboard.modelPagePromptStructure.title, /Storyboard prompt/);
  assert.match(ltxStoryboard.finalPrompt, /Shot 1:/);
  assert.match(ltxStoryboard.finalPrompt, /Shot 2:/);
  assert.match(ltxStoryboard.finalPrompt, /Shot 3:/);

  const personReference = prompts.buildModelSpecificPrompt({
    modelId: 'kling-3-standard',
    workflow: 'image-to-video',
    promptStructureId: 'character-scene',
    brief: 'Animate an uploaded character reference image with stable face identity and a calm spokesperson pose.',
    sourceImageKind: 'uploaded-character',
  });
  assert.match(personReference.modelPagePromptStructure.sourcePath, /content\/models\/en\/kling-3-standard\.json/);
  assert.match(personReference.finalPrompt, /@Element1/);
  assert.match(personReference.warning ?? '', /Kling or LTX are safer choices/);

  const pikaEffect = prompts.buildModelSpecificPrompt({
    modelId: 'pika',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Playful before-and-after transformation effect for a vertical social post.',
  });
  assert.match(pikaEffect.modelPagePromptStructure.sourcePath, /content\/models\/en\/pika-text-to-video\.json/);
  assert.match(pikaEffect.negativePrompt, /text|logos|extra limbs/i);

  const veoLiteBudget = prompts.buildModelSpecificPrompt({
    modelId: 'veo-3-1-lite',
    workflow: 'text-to-video',
    promptStructureId: 'cinematic-scene',
    brief: 'Budget realistic 9:16 creator-style product demo with native audio ambience and one simple camera move.',
  });
  assert.match(veoLiteBudget.modelPagePromptStructure.sourcePath, /content\/models\/en\/veo-3-1-lite\.json/);
  assert.match(veoLiteBudget.modelPagePromptStructure.title, /Structured prompt|Text-to-video prompt/i);
  assert.match(veoLiteBudget.finalPrompt, /^Subject \+ action \+ context:/m);
  assert.match(veoLiteBudget.finalPrompt, /^Sound:/m);
  assert.equal(veoLiteBudget.resolutionGuidance.resolution, '720p');
  assert.ok(veoLiteBudget.recommendedSettings.some((setting: string) => /Resolution: 720p/i.test(setting)));
  assert.ok(!veoLiteBudget.recommendedSettings.some((setting: string) => /4K/i.test(setting)));

  const happyHorseLipSync = prompts.buildModelSpecificPrompt({
    modelId: 'happy-horse-1-0',
    workflow: 'text-to-video',
    promptStructureId: 'character-scene',
    brief: 'Talking avatar spokesperson clip with one short spoken line, native audio, lip-sync, clean studio light.',
  });
  assert.match(happyHorseLipSync.modelPagePromptStructure.sourcePath, /content\/models\/en\/happy-horse-1-0\.json/);
  assert.match(happyHorseLipSync.finalPrompt, /^Subject:/m);
  assert.match(happyHorseLipSync.finalPrompt, /^Spoken line:/m);
  assert.match(happyHorseLipSync.finalPrompt, /^Audio:/m);
  assert.match(happyHorseLipSync.finalPrompt, /native synchronized audio/i);
});

test('buildModelSpecificPrompt returns filled model-specific field templates', async () => {
  const { prompts } = await loadStrategistModules();

  const kling4k = prompts.buildModelSpecificPrompt({
    modelId: 'kling-3-4k',
    workflow: 'text-to-image-then-image-to-video',
    promptStructureId: 'product-ad',
    brief: 'Luxury perfume ad on black marble in 9:16, glossy glass reflections, premium studio light, slow product reveal.',
  });
  assert.match(kling4k.finalPrompt, /^Starting image prompt:\n/m);
  assert.match(kling4k.finalPrompt, /^Video animation prompt:\n/m);
  assert.match(kling4k.finalPrompt, /^Source image role:/m);
  assert.match(kling4k.finalPrompt, /^Keep:/m);
  assert.doesNotMatch(kling4k.finalPrompt, /\[[^\]]+\]/);

  const seedance = prompts.buildModelSpecificPrompt({
    modelId: 'seedance-2-0',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Fast vertical sneaker ad with one clean reveal, creator-style pacing, bright palette and crisp product silhouette.',
  });
  for (const field of ['Subject:', 'Action:', 'Camera:', 'Style:', 'Audio:']) {
    assert.match(seedance.finalPrompt, new RegExp(`^${field}`, 'm'));
  }
  assert.doesNotMatch(seedance.finalPrompt, /\[[^\]]+\]/);

  const klingI2v = prompts.buildModelSpecificPrompt({
    modelId: 'kling-3-pro',
    workflow: 'image-to-video',
    promptStructureId: 'product-ad',
    brief: 'Use the product photo to create a smooth tabletop commercial move while preserving packaging, shape, color and label placement.',
  });
  for (const field of ['Reference:', 'Preserve:', 'Motion:', 'Camera:', 'Atmosphere:', 'End frame:']) {
    assert.match(klingI2v.finalPrompt, new RegExp(`^${field}`, 'm'));
  }

  const klingProPersonI2v = prompts.buildModelSpecificPrompt({
    modelId: 'kling-3-pro',
    workflow: 'image-to-video',
    promptStructureId: 'character-scene',
    brief: 'Animate this uploaded person image speaking to camera with stable face identity.',
    sourceImageKind: 'uploaded-person',
  });
  assert.match(klingProPersonI2v.finalPrompt, /^Reference:\nUse a reference image in MaxVideoAI as the uploaded person\/character anchor\./m);
  assert.match(klingProPersonI2v.finalPrompt, /stable face identity/i);
  assert.doesNotMatch(klingProPersonI2v.finalPrompt, /product photo|hero product reference|Packaging shape/i);

  const ltxStoryboard = prompts.buildModelSpecificPrompt({
    modelId: 'ltx-2-3',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Cheap storyboard draft for an ad concept with three simple timing beats before a premium render.',
  });
  for (const field of ['Shot 1:', 'Shot 2:', 'Shot 3:', 'Look:', 'Audio:']) {
    assert.match(ltxStoryboard.finalPrompt, new RegExp(`^${field}`, 'm'));
  }

  const pikaTransformation = prompts.buildModelSpecificPrompt({
    modelId: 'pika',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Playful before-and-after transformation effect for a vertical social post with one clean visual change.',
  });
  for (const field of ['Start state:', 'Transformation:', 'End state:', 'Camera:', 'Style:', 'Loop/ending:']) {
    assert.match(pikaTransformation.finalPrompt, new RegExp(`^${field}`, 'm'));
  }
});

test('buildModelSpecificPrompt follows brief-specific settings and active audio guidance', async () => {
  const { prompts } = await loadStrategistModules();

  const kling4k = prompts.buildModelSpecificPrompt({
    modelId: 'kling-3-4k',
    workflow: 'text-to-image-then-image-to-video',
    promptStructureId: 'product-ad',
    brief: 'Luxury perfume ad on black marble in 9:16, glossy glass reflections, premium studio light, slow product reveal.',
  });
  assert.match(kling4k.finalPrompt, /^Product: transparent glass perfume bottle with metallic cap/m);
  assert.doesNotMatch(kling4k.finalPrompt, /^Product: Luxury perfume ad/m);
  assert.match(kling4k.finalPrompt, /native 4K/i);
  assert.deepEqual(kling4k.recommendedSettings.slice(0, 2), ['9:16', 'Resolution: native 4K 9:16']);
  assert.ok(!kling4k.recommendedSettings.some((setting: string) => /or 16:9/i.test(setting)));

  const seedanceFast = prompts.buildModelSpecificPrompt({
    modelId: 'seedance-2-0-fast',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Fast TikTok sneaker ad, vertical hook, quick product reveal, creator-style pacing, energetic but readable motion.',
  });
  assert.match(seedanceFast.finalPrompt, /^Audio:\nEnergetic whoosh SFX on the reveal, light sneaker impact sound, upbeat social ad rhythm, no dialogue\.$/m);
  assert.deepEqual(seedanceFast.recommendedSettings[0], '9:16');

  const speakingReference = prompts.buildModelSpecificPrompt({
    modelId: 'kling-3-standard',
    workflow: 'image-to-video',
    promptStructureId: 'character-scene',
    brief: 'Animate an uploaded spokesperson reference image speaking one short line with stable face identity and subtle hand movement.',
    sourceImageKind: 'uploaded-character',
  });
  assert.match(speakingReference.finalPrompt, /^Spoken line:\nUse one short customer-provided line for the spokesperson\.$/m);
  assert.match(speakingReference.finalPrompt, /compatible lip-sync\/audio workflow/);
  assert.match(speakingReference.finalPrompt, /keep the line short for more reliable lip-sync/);
  assert.match(speakingReference.warning ?? '', /Kling or LTX are safer choices/);

  const ltxStoryboard = prompts.buildModelSpecificPrompt({
    modelId: 'ltx-2-3',
    workflow: 'text-to-video',
    promptStructureId: 'social-ad',
    brief: 'Cheap storyboard draft for an ad concept with three simple timing beats before a premium render.',
  });
  assert.match(ltxStoryboard.finalPrompt, /^Audio:\nSimple ambience plus one timing cue; keep dialogue short if lip-sync is needed\.$/m);

  const ltxSpeakingReference = prompts.buildModelSpecificPrompt({
    modelId: 'ltx-2-3',
    workflow: 'image-to-video',
    promptStructureId: 'character-scene',
    brief: 'Animate an uploaded spokesperson reference image speaking one short line with subtle hand movement.',
    sourceImageKind: 'uploaded-character',
  });
  assert.match(ltxSpeakingReference.finalPrompt, /^Spoken line:\nUse one short customer-provided line for the spokesperson\.$/m);
  assert.match(ltxSpeakingReference.finalPrompt, /compatible lip-sync\/audio workflow/);
});

test('buildModelSpecificPrompt adds product-detail warnings and avoids external-tool leakage', async () => {
  const { prompts } = await loadStrategistModules();
  const scenarios = [
    {
      modelId: 'kling-3-4k',
      workflow: 'text-to-image-then-image-to-video',
      promptStructureId: 'product-ad',
      brief: 'Luxury perfume bottle ad with label, tiny legal copy, logo, black marble, and reflective packaging.',
      expectProductWarning: true,
    },
    {
      modelId: 'seedance-2-0-fast',
      workflow: 'text-to-video',
      promptStructureId: 'social-ad',
      brief: 'Fast TikTok sneaker ad with a logo badge and quick product reveal.',
      expectProductWarning: true,
    },
    {
      modelId: 'kling-3-pro',
      workflow: 'image-to-video',
      promptStructureId: 'product-ad',
      brief: 'Use a product photo and preserve packaging, label placement, and logo position.',
      expectProductWarning: true,
    },
    {
      modelId: 'kling-3-standard',
      workflow: 'image-to-video',
      promptStructureId: 'character-scene',
      brief: 'Animate an uploaded character reference image with stable face identity and a calm spokesperson pose.',
      sourceImageKind: 'uploaded-character',
    },
    {
      modelId: 'pika',
      workflow: 'text-to-video',
      promptStructureId: 'social-ad',
      brief: 'Playful before-and-after transformation effect for a vertical social post.',
    },
  ] as const;

  for (const scenario of scenarios) {
    const result = prompts.buildModelSpecificPrompt(scenario);
    const outputText = [
      result.reason,
      result.finalPrompt,
      result.negativePrompt,
      result.recommendedSettings.join(' '),
      result.warning ?? '',
    ].join('\n');

    assert.doesNotMatch(outputText, /\b(flawless|perfect|guaranteed|always)\b/i);
    assert.doesNotMatch(outputText, /Midjourney|DALL-E|Runway/i);
    if (scenario.modelId !== 'pika') {
      assert.doesNotMatch(outputText, /Pika Labs/i);
    }
    if ('expectProductWarning' in scenario && scenario.expectProductWarning) {
      assert.match(result.warning ?? '', /Exact text, logos, legal copy, badges, plates, labels, packaging details, and tiny text may drift/);
      assert.match(result.warning ?? '', /overlays or check them after generation/);
    }
  }
});

test('recommendModelsForBrief returns best, medium, and value recommendations with short reasons', async () => {
  const { recommendations } = await loadStrategistModules();

  const cinematic = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'cinematic-scene',
    goal: 'A realistic cinematic scene with natural camera movement, character emotion, and premium lighting.',
    qualityPriority: 'maximum',
  });

  assert.equal(cinematic.best.model.id, 'veo-3-1');
  assert.equal(cinematic.medium.model.tierPosition, 'medium');
  assert.equal(cinematic.value.model.tierPosition, 'value');

  const productAd = recommendations.recommendModelsForBrief({
    workflow: 'text-to-image-then-image-to-video',
    promptStructure: 'product-ad',
    goal: 'High-end ecommerce product ad with fine material detail, exact packaging, and glossy social cutdowns.',
    qualityPriority: 'maximum',
    budgetPriority: 'balanced',
  });

  assert.equal(productAd.best.model.id, 'kling-3-pro');
  assert.ok(['kling-3-standard', 'veo-3-1-fast', 'seedance-2-0'].includes(productAd.medium.model.id));
  assert.ok(['kling-3-standard', 'seedance-2-0', 'seedance-2-0-fast'].includes(productAd.value.model.id));
  assert.notEqual(productAd.best.model.id, 'kling-3-4k');
  assert.match(productAd.best.upgradeNote ?? '', /Use Kling 3 4K if final 4K product detail is required/);

  for (const recommendation of tierRecommendations(productAd)) {
    assert.ok(recommendation.reason.length > 20, 'reason should explain the choice');
    assert.ok(recommendation.reason.length <= 180, 'reason should stay short enough for UI cards');
  }
});

test('recommendModelsForBrief keeps Sora out of default social and generic fantasy best picks', async () => {
  const { recommendations } = await loadStrategistModules();

  const social = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'social-ad',
    goal: 'Fast TikTok sneaker ad with a vertical hook, playful motion, and product reveal.',
    budgetPriority: 'value',
    speedPriority: 'high',
  });

  assert.notEqual(social.best.model.id, 'sora');
  assert.equal(social.value.model.id, 'seedance-2-0-fast');

  const fantasy = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'cinematic-scene',
    goal: 'Fantasy creature animation in a forest with magical atmosphere and expressive creature movement.',
    qualityPriority: 'maximum',
  });

  assert.notEqual(fantasy.best.model.id, 'sora');

  const explicitSora = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'cinematic-scene',
    goal: 'Use Sora for a surreal conceptual dream sequence with impossible architecture and narrative continuity.',
    qualityPriority: 'maximum',
  });

  assert.equal(explicitSora.best.model.id, 'sora');
});

test('recommendModelsForBrief treats draft and storyboard briefs as fast low-cost testing', async () => {
  const { recommendations } = await loadStrategistModules();

  const storyboard = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'social-ad',
    goal: 'Cheap draft storyboard for an ad concept, quick test, rough concept, and low cost iteration.',
    budgetPriority: 'value',
    speedPriority: 'high',
    qualityPriority: 'draft',
  });

  assert.ok(
    ['ltx-2-3', 'seedance-2-0-fast', 'seedance-2-0'].includes(storyboard.best.model.id),
    `draft best pick should be a fast testing model, got ${storyboard.best.model.id}`
  );
  assert.notEqual(storyboard.best.model.id, 'sora');
  assert.notEqual(storyboard.best.model.id, 'veo-3-1');
  assert.equal(storyboard.value.model.id, 'ltx-2-3');
});

test('recommendModelsForBrief uses intent-specific value options', async () => {
  const { recommendations } = await loadStrategistModules();

  const transformation = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'social-ad',
    goal: 'Playful social media transformation effect with before-and-after motion and experimental visual change.',
    budgetPriority: 'value',
    speedPriority: 'high',
  });

  assert.equal(transformation.value.model.id, 'pika');

  const product = recommendations.recommendModelsForBrief({
    workflow: 'text-to-image-then-image-to-video',
    promptStructure: 'product-ad',
    goal: 'Premium 4K product shot with glass, reflections, luxury packaging, and controlled highlights.',
    qualityPriority: 'maximum',
    budgetPriority: 'quality',
  });

  assert.equal(product.best.model.id, 'kling-3-4k');
  assert.equal(product.medium.model.id, 'kling-3-pro');
  assert.equal(product.value.model.id, 'kling-3-standard');
});

test('recommendModelsForBrief keeps Kling 3 Pro as default best for premium product unless 4K is explicit', async () => {
  const { recommendations } = await loadStrategistModules();

  const luxuryPerfume = recommendations.recommendModelsForBrief({
    workflow: 'text-to-image-then-image-to-video',
    promptStructure: 'product-ad',
    goal: 'Luxury perfume ad on black marble in 9:16, glossy reflections, premium lighting, slow push-in, elegant brand mood.',
    qualityPriority: 'maximum',
    budgetPriority: 'quality',
    speedPriority: 'low',
    requiredTraits: ['product', 'premium', 'reflections'],
  });

  assert.equal(luxuryPerfume.best.model.id, 'kling-3-pro');
  assert.equal(luxuryPerfume.medium.model.id, 'kling-3-standard');
  assert.equal(luxuryPerfume.value.model.id, 'seedance-2-0');
  assert.notEqual(luxuryPerfume.best.model.id, 'kling-3-4k');
  assert.match(luxuryPerfume.best.upgradeNote ?? '', /Use Kling 3 4K if final 4K product detail is required/);
  assert.match(luxuryPerfume.best.warning ?? '', /Exact labels, logos, legal copy, packaging details, and tiny text may drift/);
  assert.notEqual(luxuryPerfume.best.reason, luxuryPerfume.medium.reason);
  assert.notEqual(luxuryPerfume.medium.reason, luxuryPerfume.value.reason);

  const premium4k = recommendations.recommendModelsForBrief({
    workflow: 'text-to-image-then-image-to-video',
    promptStructure: 'product-ad',
    goal: 'Premium 4K product shot with glass, reflections, transparent material, controlled highlights, luxury ecommerce hero video.',
    qualityPriority: 'maximum',
    budgetPriority: 'quality',
    speedPriority: 'low',
    requiredTraits: ['4K', 'product', 'reflections', 'premium'],
  });

  assert.equal(premium4k.best.model.id, 'kling-3-4k');
  assert.equal(premium4k.medium.model.id, 'kling-3-pro');
  assert.equal(premium4k.value.model.id, 'kling-3-standard');
});

test('recommendModelsForBrief keeps Seedance viable for product reference image-to-video', async () => {
  const { recommendations } = await loadStrategistModules();

  const socialProductReference = recommendations.recommendModelsForBrief({
    workflow: 'image-to-video',
    promptStructure: 'product-ad',
    goal: 'Product reference image-to-video for a social-first 9:16 skincare ad with dynamic product motion and cost-efficient iteration; exact tiny text fidelity is less important.',
    sourceImageKind: 'product',
    qualityPriority: 'balanced',
    budgetPriority: 'value',
    speedPriority: 'high',
    requiredTraits: ['product reference', 'social-first', 'dynamic motion', 'vertical'],
  });

  assert.equal(socialProductReference.best.model.id, 'kling-3-pro');
  assert.equal(socialProductReference.medium.model.id, 'seedance-2-0');
  assert.equal(socialProductReference.value.model.id, 'seedance-2-0-fast');
  assert.match(socialProductReference.medium.reason, /social-first product ads, dynamic motion, and vertical content/);
  assert.match(socialProductReference.value.reason, /quick low-cost testing and fast vertical ad iteration/);

  const strictProductReference = recommendations.recommendModelsForBrief({
    workflow: 'image-to-video',
    promptStructure: 'product-ad',
    goal: 'Product photo image-to-video with exact packaging, label placement, SKU accuracy, legal copy, logo position, and fine text preservation.',
    sourceImageKind: 'product',
    qualityPriority: 'maximum',
    budgetPriority: 'balanced',
    speedPriority: 'medium',
    requiredTraits: ['product reference', 'strict packaging', 'label placement', 'fine text'],
  });

  assert.equal(strictProductReference.best.model.id, 'kling-3-pro');
  assert.equal(strictProductReference.medium.model.id, 'kling-3-standard');
  assert.equal(strictProductReference.value.model.id, 'seedance-2-0');
  assert.match(strictProductReference.value.warning ?? '', /Exact labels, logos, legal copy, packaging details, and tiny text may drift/);
  assert.match(strictProductReference.value.reason, /exact label\/text fidelity is less critical/);
});

test('recommendModelsForBrief applies person-reference image-to-video compatibility rules', async () => {
  const { recommendations } = await loadStrategistModules();

  const uploadedPerson = recommendations.recommendModelsForBrief({
    workflow: 'image-to-video',
    promptStructure: 'character-scene',
    goal: 'Uploaded real person photo for image-to-video, preserve face, identity, spokesperson look, and subtle hand movement.',
    sourceImageKind: 'uploaded-person',
    qualityPriority: 'maximum',
  });

  for (const recommendation of tierRecommendations(uploadedPerson)) {
    assert.notEqual(recommendation.model.id, 'seedance-2-0');
    assert.notEqual(recommendation.model.id, 'seedance-2-0-fast');
    assert.notEqual(recommendation.model.id, 'sora');
  }
  assert.ok(['kling-3-pro', 'kling-3-standard', 'ltx-2-3', 'veo-3-1-fast'].includes(uploadedPerson.best.model.id));
  assert.notEqual(uploadedPerson.best.model.id, 'happy-horse-1-0');
  assert.match(uploadedPerson.best.warning ?? '', /Kling or LTX are safer choices/);

  const generatedPerson = recommendations.recommendModelsForBrief({
    workflow: 'image-to-video',
    promptStructure: 'character-scene',
    goal: 'Character image generated first with Seedream text-to-image, then animate the generated person with stable identity.',
    sourceImageKind: 'generated-person',
    sourceImageGeneratedInWorkflow: true,
    qualityPriority: 'balanced',
  });

  const generatedIds = tierRecommendations(generatedPerson).map((recommendation) => recommendation.model.id);
  assert.ok(generatedIds.includes('seedance-2-0'), 'Seedance should be allowed for compatible generated-person workflows');
});

test('recommendModelsForBrief keeps dialogue routing balanced and Veo 3.1 Lite for budget Veo drafts', async () => {
  const { recommendations } = await loadStrategistModules();

  const spokesperson = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'character-scene',
    goal: 'Talking avatar spokesperson video with native audio, lip-sync, one short spoken line, clean studio background, and creator-style delivery.',
    qualityPriority: 'balanced',
    budgetPriority: 'balanced',
    requiredTraits: ['native audio', 'lip-sync', 'spokesperson'],
  });

  assert.notEqual(spokesperson.best.model.id, 'happy-horse-1-0');
  assert.ok(
    ['seedance-2-0', 'veo-3-1', 'kling-3-pro', 'ltx-2-3'].includes(spokesperson.best.model.id),
    `dialogue best pick should stay competitive across Seedance, Veo, Kling, or LTX, got ${spokesperson.best.model.id}`
  );
  assert.equal(spokesperson.best.warning, undefined);
  assert.equal(spokesperson.alsoConsider?.[0]?.model.id, 'happy-horse-1-0');
  assert.match(spokesperson.alsoConsider?.[0]?.reason ?? '', /compatible audio\/lip-sync\/spokesperson workflows/);

  const budgetVeo = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'cinematic-scene',
    goal: 'Budget Veo-style realistic 9:16 social clip with native audio ambience, natural camera movement, and lower-cost iteration.',
    qualityPriority: 'balanced',
    budgetPriority: 'value',
    speedPriority: 'high',
    requiredTraits: ['veo', 'native audio', 'budget'],
  });

  assert.equal(budgetVeo.value.model.id, 'veo-3-1-lite');
  assert.match(budgetVeo.value.reason, /lower-cost|budget|value/i);
});

test('recommendModelsForBrief handles Happy Horse limits for focused audio and person-reference cases', async () => {
  const { recommendations } = await loadStrategistModules();

  const silentCharacterReference = recommendations.recommendModelsForBrief({
    workflow: 'image-to-video',
    promptStructure: 'character-scene',
    goal: 'Silent uploaded character reference image-to-video, preserve face identity and costume, no dialogue, calm camera move.',
    sourceImageKind: 'uploaded-character',
    qualityPriority: 'maximum',
  });

  assert.ok(
    ['kling-3-pro', 'kling-3-standard', 'ltx-2-3'].includes(silentCharacterReference.best.model.id),
    `silent reference I2V should prefer Kling or LTX, got ${silentCharacterReference.best.model.id}`
  );
  assert.notEqual(silentCharacterReference.best.model.id, 'happy-horse-1-0');
  assert.match(silentCharacterReference.best.warning ?? '', /Kling or LTX are safer choices/);
  assert.equal(silentCharacterReference.alsoConsider, undefined);

  const uploadedSpokesperson = recommendations.recommendModelsForBrief({
    workflow: 'image-to-video',
    promptStructure: 'character-scene',
    goal: 'Spokesperson from uploaded real person image, one short spoken line, lip-sync, preserve face identity.',
    sourceImageKind: 'uploaded-person',
    qualityPriority: 'maximum',
    requiredTraits: ['lip-sync', 'spokesperson', 'face preservation'],
  });

  assert.ok(
    ['kling-3-pro', 'kling-3-standard', 'ltx-2-3'].includes(uploadedSpokesperson.best.model.id),
    `uploaded real-person I2V should not route Best to Happy Horse, got ${uploadedSpokesperson.best.model.id}`
  );
  assert.notEqual(uploadedSpokesperson.best.model.id, 'happy-horse-1-0');
  assert.match(uploadedSpokesperson.best.warning ?? '', /Happy Horse remains limited for real-person image-to-video preservation/);
  assert.equal(uploadedSpokesperson.alsoConsider?.[0]?.model.id, 'happy-horse-1-0');
  assert.match(uploadedSpokesperson.alsoConsider?.[0]?.reason ?? '', /lip-sync\/audio performance is more important than strict visual preservation/);

  const cinematicHuman = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'cinematic-scene',
    goal: 'Simple cinematic human scene with natural window light, subtle camera movement, realistic acting, no dialogue.',
    qualityPriority: 'maximum',
    budgetPriority: 'balanced',
  });

  assert.ok(
    ['veo-3-1', 'seedance-2-0'].includes(cinematicHuman.best.model.id),
    `non-dialogue cinematic human scene should prefer Veo or Seedance, got ${cinematicHuman.best.model.id}`
  );
  assert.notEqual(cinematicHuman.best.model.id, 'happy-horse-1-0');
  assert.equal(cinematicHuman.best.warning, undefined);

  const productVoiceover = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'product-ad',
    goal: 'Social-first product ad with voiceover, 9:16, energetic sound design, dynamic product motion, no uploaded person image.',
    budgetPriority: 'balanced',
    speedPriority: 'high',
    requiredTraits: ['product', 'voiceover', 'dynamic motion'],
  });

  assert.ok(
    tierRecommendations(productVoiceover).some((recommendation) => recommendation.model.id === 'seedance-2-0'),
    'Seedance 2.0 should stay viable for product ads with audio when no problematic person image is involved'
  );
  assert.notEqual(productVoiceover.best.model.id, 'happy-horse-1-0');
  assert.ok(
    recommendationSetContainsModel(productVoiceover, 'veo-3-1-lite') || recommendationSetContainsModel(productVoiceover, 'veo-3-1-fast'),
    'Veo Lite/Fast should stay visible as a realistic audio-ready product ad route'
  );

  const productVoiceoverOnly = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'product-ad',
    goal: 'Social-first product ad with voiceover only, no visible talking person, 9:16, energetic sound design, dynamic product motion.',
    budgetPriority: 'balanced',
    speedPriority: 'high',
    requiredTraits: ['product', 'voiceover', 'dynamic motion'],
  });

  assert.equal(Boolean(productVoiceoverOnly.alsoConsider?.some((entry) => entry.model.id === 'happy-horse-1-0')), false);
  assert.ok(
    recommendationSetContainsModel(productVoiceoverOnly, 'veo-3-1-lite'),
    'Veo 3.1 Lite should stay visible for lower-cost social product ads with off-camera voiceover'
  );

  const storyboard = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'social-ad',
    goal: 'Cheap draft storyboard for an ad concept, quick test, rough concept, low cost iteration, compare Veo 3.1 Lite vs LTX 2.3 vs Seedance 2.0 Fast.',
    budgetPriority: 'value',
    speedPriority: 'high',
    qualityPriority: 'draft',
  });

  assert.equal(storyboard.best.model.id, 'seedance-2-0-fast');
  assert.equal(storyboard.medium.model.id, 'veo-3-1-lite');
  assert.equal(storyboard.value.model.id, 'ltx-2-3');

  const cheapLipSyncDraft = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'social-ad',
    goal: 'Cheap lip-sync test draft for a talking product founder concept, quick test, rough storyboard, low cost iteration, one short spoken line.',
    budgetPriority: 'value',
    speedPriority: 'high',
    qualityPriority: 'draft',
    requiredTraits: ['cheap', 'lip-sync', 'draft'],
  });

  assert.equal(cheapLipSyncDraft.best.model.id, 'seedance-2-0-fast');
  assert.equal(cheapLipSyncDraft.medium.model.id, 'veo-3-1-lite');
  assert.equal(cheapLipSyncDraft.value.model.id, 'ltx-2-3');
  assert.equal(cheapLipSyncDraft.alsoConsider?.[0]?.model.id, 'happy-horse-1-0');
  assert.match(cheapLipSyncDraft.alsoConsider?.[0]?.reason ?? '', /testing dedicated lip-sync\/spokesperson workflows/);

  const socialSpeakingAd = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'social-ad',
    goal: 'Social-first speaking ad for a creator-style app demo, 9:16, short dialogue hook, native audio, quick visual beats, cost-efficient variants.',
    budgetPriority: 'balanced',
    speedPriority: 'high',
    requiredTraits: ['speaking', 'social-first', 'dialogue', 'creator-style'],
  });

  assert.equal(socialSpeakingAd.best.model.id, 'seedance-2-0');
  assert.equal(socialSpeakingAd.medium.model.id, 'veo-3-1-fast');
  assert.equal(socialSpeakingAd.value.model.id, 'veo-3-1-lite');
  assert.notEqual(socialSpeakingAd.best.model.id, 'happy-horse-1-0');
  assert.equal(socialSpeakingAd.alsoConsider?.[0]?.model.id, 'happy-horse-1-0');
  assert.match(socialSpeakingAd.alsoConsider?.[0]?.reason ?? '', /compatible audio\/lip-sync\/spokesperson workflows/);

  const cinematicDialogue = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'cinematic-scene',
    goal: 'Cinematic human scene with natural performance, polished lighting, subtle camera move, one short spoken line and clean lip-sync.',
    qualityPriority: 'maximum',
    budgetPriority: 'quality',
    requiredTraits: ['cinematic realism', 'natural performance', 'spoken line'],
  });

  assert.equal(cinematicDialogue.best.model.id, 'veo-3-1');
  assert.equal(cinematicDialogue.medium.model.id, 'veo-3-1-fast');
  assert.notEqual(cinematicDialogue.best.model.id, 'happy-horse-1-0');
  assert.equal(cinematicDialogue.alsoConsider?.[0]?.model.id, 'happy-horse-1-0');

  const premiumSpokenCommercial = recommendations.recommendModelsForBrief({
    workflow: 'text-to-video',
    promptStructure: 'cinematic-scene',
    goal: 'Premium cinematic commercial with a human actor, polished camera, luxury lighting, ad-quality storytelling, one short spoken line with lip-sync.',
    qualityPriority: 'maximum',
    budgetPriority: 'quality',
    requiredTraits: ['premium', 'cinematic', 'spoken line'],
  });

  assert.equal(premiumSpokenCommercial.best.model.id, 'veo-3-1');
  assert.equal(premiumSpokenCommercial.medium.model.id, 'veo-3-1-fast');
  assert.notEqual(premiumSpokenCommercial.best.model.id, 'happy-horse-1-0');
  assert.equal(premiumSpokenCommercial.alsoConsider?.[0]?.model.id, 'happy-horse-1-0');

  const r2vReference = recommendations.recommendModelsForBrief(
    'R2V reference-to-video from an uploaded character reference with one short spoken line and stable identity.'
  );

  assert.ok(r2vReference.best.matchedSignals.includes('image-to-video'));
  assert.notEqual(r2vReference.best.model.id, 'happy-horse-1-0');
  assert.equal(r2vReference.alsoConsider?.[0]?.model.id, 'happy-horse-1-0');

  const v2vRestyle = recommendations.recommendModelsForBrief({
    workflow: 'video-to-video',
    promptStructure: 'character-scene',
    goal: 'Video-to-video restyle of a person speaking to camera, preserve performance timing, synchronized speech, natural face motion, updated lighting style.',
    qualityPriority: 'balanced',
    requiredTraits: ['video-to-video', 'person', 'synchronized speech'],
  });

  for (const recommendation of tierRecommendations(v2vRestyle)) {
    assert.notEqual(recommendation.model.id, 'veo-3-1-lite', 'Veo 3.1 Lite should stay extend-only for source-video workflows');
  }
  assert.equal(v2vRestyle.alsoConsider?.[0]?.model.id, 'happy-horse-1-0');
});

test('RAG-friendly AI Strategist docs exist for models, workflows, prompt structures, and decision rules', () => {
  for (const id of expectedModelIds) {
    const path = join(root, 'docs/ai-strategist/models', `${id}.md`);
    assert.ok(existsSync(path), `${id} model doc should exist`);
    const source = readFileSync(path, 'utf8');
    assert.match(source, /Source of truth: `frontend\/lib\/ai-strategist\/model-catalog\.ts`/);
    assert.match(source, new RegExp(`id: ${id}`));
    assert.match(source, /## Prompt Guidance/);
    assert.match(source, /## Negative Prompt Guidance/);
  }

  for (const id of expectedWorkflowIds) {
    const path = join(root, 'docs/ai-strategist/workflows', `${id}.md`);
    assert.ok(existsSync(path), `${id} workflow doc should exist`);
    assert.match(readFileSync(path, 'utf8'), /Source of truth: `frontend\/lib\/ai-strategist\/workflow-rules\.ts`/);
  }

  for (const id of expectedPromptStructureIds) {
    const path = join(root, 'docs/ai-strategist/prompt-structures', `${id}.md`);
    assert.ok(existsSync(path), `${id} prompt structure doc should exist`);
    assert.match(readFileSync(path, 'utf8'), /Source of truth: `frontend\/lib\/ai-strategist\/prompt-structures\.ts`/);
  }

  const decisionRulesPath = join(root, 'docs/ai-strategist/decision-rules/best-medium-value.md');
  assert.ok(existsSync(decisionRulesPath), 'best/medium/value decision doc should exist');
  assert.match(readFileSync(decisionRulesPath, 'utf8'), /recommendModelsForBrief/);
});

test('AI Strategist RAG boundary is documented but disabled', async () => {
  const rag = await import('../frontend/lib/ai-strategist/knowledge/rag-contract.ts');
  const sourceDocPath = join(root, 'docs/ai-strategist/knowledge-sources.md');
  const sourceDoc = readFileSync(sourceDocPath, 'utf8');

  assert.equal(rag.AI_STRATEGIST_RAG_ENABLED, false);
  assert.ok(rag.AI_STRATEGIST_ALLOWED_RAG_SOURCE_IDS.includes('ai-strategist-model-docs'));
  assert.match(sourceDoc, /RAG is not connected yet/);
  assert.match(sourceDoc, /Private user projects/);
  assert.match(sourceDoc, /Credentials, provider secrets/);
});

test('AI Strategist does not call RAG while RAG is disabled', async () => {
  const playground = await import('../frontend/lib/ai-strategist/playground-pipeline.ts');
  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Search your docs for Seedance lip sync limits',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.notEqual(result.orchestrationPlan.task, 'docs_search');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.ok(result.knowledgeToolResults?.length);
  assert.equal(result.knowledgeToolResults[0].toolName, 'docs_search');
  assert.match(result.assistantMessage, /not connected|available structured/i);
  assert.equal(result.llm.promptWriter.used, false);
});

test('AI Strategist project context contract forbids silent private access', async () => {
  const projectContext = await import('../frontend/lib/ai-strategist/knowledge/project-context-contract.ts');

  assert.equal(projectContext.AI_STRATEGIST_PROJECT_CONTEXT_ACCESS_POLICY.userOwnedContextOnly, true);
  assert.equal(projectContext.AI_STRATEGIST_PROJECT_CONTEXT_ACCESS_POLICY.explicitAppProvidedContextOnly, true);
  assert.equal(projectContext.AI_STRATEGIST_PROJECT_CONTEXT_ACCESS_POLICY.noSilentPrivateProjectReads, true);
  assert.equal(projectContext.AI_STRATEGIST_PROJECT_CONTEXT_ACCESS_POLICY.noCrossUserJobsOrPrompts, true);
  assert.equal(projectContext.AI_STRATEGIST_PROJECT_CONTEXT_ACCESS_POLICY.noCreditSpend, true);
  assert.equal(projectContext.AI_STRATEGIST_PROJECT_CONTEXT_ACCESS_POLICY.noAutoApplyGeneratorActions, true);
});
