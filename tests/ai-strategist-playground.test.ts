import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

async function loadPlaygroundModule() {
  try {
    return await import('../frontend/lib/ai-strategist/playground-pipeline.ts');
  } catch (error) {
    assert.fail(`Expected AI Strategist playground pipeline to be importable: ${(error as Error).message}`);
  }
}

function conversationStateFrom(result: {
  normalizedBrief?: unknown;
  recommendations?: unknown;
  workflow?: unknown;
  selectedModel?: unknown;
  selectedTier?: unknown;
  conversationStage?: unknown;
  briefCompletion?: unknown;
  sanitizedFinalOutput?: { finalPrompt?: string };
}) {
  return {
    lastNormalizedBrief: result.normalizedBrief,
    lastRecommendations: result.recommendations,
    lastSelectedWorkflow: result.workflow ?? undefined,
    lastSelectedModel: result.selectedModel ?? undefined,
    lastSelectedTier: result.selectedTier,
    stage: result.conversationStage,
    lastBriefCompletion: result.briefCompletion,
    lastFinalPrompt: result.sanitizedFinalOutput?.finalPrompt,
  };
}

test('AI Strategist playground pipeline exposes deterministic fallback state without generation side effects', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Social-first sneaker ad with voiceover, vertical',
      mode: 'recommend',
    },
    { env: {} }
  );

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'recommend');
  assert.equal(result.orchestrationPlan.task, 'new_video_brief');
  assert.equal(result.orchestrationPlan.llm.briefRefinement, 'cheap');
  assert.equal(result.orchestrationPlan.llm.promptWriter, 'strong');
  assert.equal(result.normalizedBrief.hasVoiceover, true);
  assert.equal(result.normalizedBrief.hasVisibleSpeaker, false);
  assert.equal(result.llm.briefRefinement.used, false);
  assert.equal(result.llm.promptWriter.used, false);
  assert.equal(result.llm.promptWriter.fallbackReason, 'missing_local_llm_config');
  assert.equal(result.safety.autoGeneration, false);
  assert.equal(result.safety.creditSpend, false);
  assert.equal(result.safety.publishing, false);
  assert.equal(result.safety.uiActionsApplied, false);
  assert.ok(result.recommendations?.best.model.id);
  assert.ok(result.promptGenerationContextSummary?.selectedModel);
  assert.ok(result.promptGenerationContextSummary?.durationGuidance.seconds);
  assert.match(result.promptGenerationContextSummary?.priceEstimate.label ?? '', /Estimated price: about \$/);
  assert.ok(result.sanitizedFinalOutput?.finalPrompt);
  assert.match(result.sanitizedFinalOutput?.finalPrompt ?? '', /Duration:\n\d+ seconds/i);
  assert.ok(result.uiActions.every((action: { type?: string; value?: string }) => typeof action.type === 'string' && typeof action.value === 'string'));
  assert.ok(result.uiActions.some((action: { type: string }) => action.type === 'SET_MODEL'));
  assert.ok(result.uiActions.some((action: { type: string }) => action.type === 'SET_WORKFLOW'));
  assert.ok(result.uiActions.some((action: { type: string }) => action.type === 'SET_PROMPT'));
  assert.ok(result.uiActions.some((action: { type: string }) => action.type === 'SET_NEGATIVE_PROMPT'));
  assert.ok(result.uiActions.some((action: { type: string }) => action.type === 'SET_DURATION'));
});

test('AI Strategist playground keeps product help as guide output without prompt writer routing', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Where do I generate a video and how do I choose a model?',
      mode: 'product_help',
    },
    { env: {} }
  );

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'product_help');
  assert.equal(result.orchestrationPlan.task, 'site_help');
  assert.equal(result.orchestrationPlan.llm.briefRefinement, 'none');
  assert.equal(result.workflow, null);
  assert.equal(result.recommendations, undefined);
  assert.equal(result.promptGenerationContext, undefined);
  assert.equal(result.sanitizedFinalOutput, undefined);
  assert.equal(result.uiActions.length, 0);
  assert.match(result.assistantMessage, /open the video generator/i);
});

test('AI Strategist conversation planner uses previous car brief when user selects Seedance', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'une pub de voiture dynamique',
      mode: 'recommend',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'ok seedance',
      mode: 'recommend',
      conversationState: {
        lastNormalizedBrief: first.normalizedBrief,
        lastRecommendations: first.recommendations,
        lastSelectedWorkflow: first.workflow ?? undefined,
      },
    },
    { env: {} }
  );

  assert.equal(first.conversationPlan.action, 'recommend_models');
  assert.equal(second.conversationPlan.action, 'select_model');
  assert.equal(second.orchestrationPlan.task, 'model_or_tier_selection');
  assert.equal(second.orchestrationPlan.llm.briefRefinement, 'none');
  assert.equal(second.llm.briefRefinement.fallbackReason, 'orchestrator_no_brief_llm');
  assert.equal(second.conversationPlan.shouldUsePreviousBrief, true);
  assert.equal(second.mode, 'build_prompt');
  assert.equal(second.selectedModel, 'seedance-2-0');
  assert.match(second.sanitizedFinalOutput?.finalPrompt ?? '', /voiture|car|pub/i);
});

test('AI Strategist conversation planner uses previous recommendation when user selects Best tier', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'une pub de voiture dynamique',
      mode: 'recommend',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Best',
      mode: 'recommend',
      conversationState: {
        lastNormalizedBrief: first.normalizedBrief,
        lastRecommendations: first.recommendations,
        lastSelectedWorkflow: first.workflow ?? undefined,
      },
    },
    { env: {} }
  );

  assert.equal(second.conversationPlan.action, 'select_tier');
  assert.equal(second.orchestrationPlan.task, 'model_or_tier_selection');
  assert.equal(second.orchestrationPlan.llm.briefRefinement, 'none');
  assert.equal(second.conversationPlan.selectedTier, 'best');
  assert.equal(second.selectedModel, first.recommendations?.best.model.id);
  assert.equal(second.mode, 'build_prompt');
  assert.ok(second.sanitizedFinalOutput?.finalPrompt);
});

test('AI Strategist conversation planner asks for a brief when only model prompt intent is provided', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'le modèle Seedance, je veux faire un prompt',
      mode: 'recommend',
    },
    { env: {} }
  );

  assert.equal(result.conversationPlan.action, 'ask_clarification');
  assert.equal(result.conversationPlan.selectedModel, 'seedance-2-0');
  assert.equal(result.selectedModel, 'seedance-2-0');
  assert.match(result.assistantMessage, /What do you want the video to show/);
  assert.equal(result.recommendations, undefined);
});

test('AI Strategist chat accepts an existing prompt paste flow for Seedance instead of asking for a new video brief', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'je veux éditer un prompt pour seedance 2 je peux te le partager ?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const pastedPrompt = 'Subject: premium running shoes on wet asphalt. Action: fast reveal with splash and city lights. Camera: vertical tracking push-in. Style: cinematic streetwear ad.';
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: pastedPrompt,
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(first),
    },
    { env: {} }
  );

  assert.equal(first.conversationPlan.action, 'await_prompt_paste');
  assert.equal(first.orchestrationPlan.task, 'prompt_edit_intake');
  assert.equal(first.orchestrationPlan.llm.briefRefinement, 'none');
  assert.equal(first.conversationStage, 'awaiting_prompt_paste');
  assert.equal(first.selectedModel, 'seedance-2-0');
  assert.match(first.assistantMessage, /colle ton prompt ici|paste/i);
  assert.doesNotMatch(first.assistantMessage, /What do you want the video to show/i);
  assert.equal(second.conversationPlan.action, 'improve_prompt');
  assert.equal(second.mode, 'improve_prompt');
  assert.equal(second.selectedModel, 'seedance-2-0');
  assert.equal(second.promptGenerationContext?.currentPrompt, pastedPrompt);
  assert.notEqual(second.conversationStage, 'awaiting_model_choice');
});

test('AI Strategist conversation planner improves when currentPrompt is present', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'make it better',
      mode: 'recommend',
      currentPrompt: 'Perfume bottle on marble, cinematic',
    },
    { env: {} }
  );

  assert.equal(result.conversationPlan.action, 'improve_prompt');
  assert.equal(result.conversationPlan.shouldUseCurrentPrompt, true);
  assert.equal(result.mode, 'improve_prompt');
  assert.match(result.sanitizedFinalOutput?.finalPrompt ?? '', /Perfume bottle on marble/i);
});

test('AI Strategist conversation planner asks what to improve when no prompt context exists', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'make it better',
      mode: 'recommend',
    },
    { env: {} }
  );

  assert.equal(result.conversationPlan.action, 'ask_clarification');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /What prompt do you want me to improve/);
});

test('AI Strategist conversation planner handles upload navigation without model recommendations', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'where do I upload an image?',
      mode: 'recommend',
    },
    { env: {} }
  );

  assert.equal(result.conversationPlan.action, 'navigation_help');
  assert.equal(result.orchestrationPlan.task, 'asset_reference_help');
  assert.equal(result.orchestrationPlan.llm.briefRefinement, 'none');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.equal(result.navigationSuggestion?.href, '/app');
  assert.match(result.assistantMessage, /image-to-video/i);
});

test('AI Strategist keeps messy upload image questions as asset reference help despite uncertainty wording', async () => {
  const playground = await loadPlaygroundModule();

  const cases = [
    'where upload img?? Not sure which model or workflow is best.',
    'how upload prod pic and keep logo?? Not sure which model or workflow is best.',
  ];

  for (const userMessage of cases) {
    const result = await playground.runAiStrategistPlaygroundPipeline(
      {
        userMessage,
        mode: 'recommend',
        surface: 'chat',
      },
      { env: {} }
    );

    assert.equal(result.orchestrationPlan.task, 'asset_reference_help', userMessage);
    assert.equal(result.mode, 'product_help', userMessage);
    assert.equal(result.recommendations, undefined, userMessage);
    assert.match(result.assistantMessage, /upload|image-to-video|reference image/i, userMessage);
    assert.match(result.assistantMessage, /not run generation|spend credits/i, userMessage);
  }
});

test('AI Strategist orchestrator answers model pricing help without creative routing', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'How much does Seedance 2 cost for 8 seconds?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'pricing_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.equal(result.promptGenerationContext, undefined);
  assert.equal(result.llm.briefRefinement.used, false);
  assert.equal(result.llm.promptWriter.used, false);
  assert.match(result.assistantMessage, /Seedance 2\.0/i);
  assert.match(result.assistantMessage, /8 seconds/i);
  assert.match(result.assistantMessage, /Estimated price: about \$1\.44/i);
  assert.match(result.assistantMessage, /final generator quote/i);
});

test('AI Strategist answers cheapest model questions from the engine catalog', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'quelle est le model le moins cher sur le site ?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'pricing_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.ok(result.knowledgeToolResults?.length);
  assert.equal(result.knowledgeToolResults[0].toolName, 'engine_pricing');
  assert.match(result.assistantMessage, /moins cher|cheapest/i);
  assert.match(result.assistantMessage, /LTX 2\.3 Fast|Pika 2\.2|LTX Video 2\.0 Fast/i);
  assert.match(result.assistantMessage, /\$0\.04|4 cents/i);
  assert.doesNotMatch(result.assistantMessage, /open the video generator, choose the workflow/i);
});

test('AI Strategist answers Spanish cheapest video model questions as pricing help', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'cuál es el modelo más barato para video? pls, no credits spent yet',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'pricing_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /cheapest|barato|least expensive|\$0\.04/i);
});

test('AI Strategist routes model cost comparisons to pricing help even when draft language is present', async () => {
  const playground = await loadPlaygroundModule();

  const cases = [
    "I'm comparing tools before signup. Is Veo Lite cheaper than regular Veo for a draft?",
    'Before I spend credits, Is Veo Lite cheaper than regular Veo for a draft?',
  ];

  for (const userMessage of cases) {
    const result = await playground.runAiStrategistPlaygroundPipeline(
      {
        userMessage,
        mode: 'recommend',
        surface: 'chat',
      },
      { env: {} }
    );

    assert.equal(result.orchestrationPlan.task, 'pricing_help', userMessage);
    assert.equal(result.mode, 'product_help', userMessage);
    assert.equal(result.recommendations, undefined, userMessage);
    assert.match(result.assistantMessage, /Veo|price|cost|cheaper|estimate|quote/i, userMessage);
  }
});

test('AI Strategist orchestrator explains workflow help without generating a prompt', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Explain image-to-video workflow',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'workflow_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.workflow, null);
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /reference image/i);
  assert.match(result.assistantMessage, /motion prompt/i);
  assert.match(result.assistantMessage, /does not run generation/i);
});

test('AI Strategist orchestrator points model navigation to the model page without recommendations', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Where is Seedance?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'navigation_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.equal(result.navigationSuggestion?.href, '/models/seedance-2-0');
  assert.match(result.assistantMessage, /Seedance 2\.0/i);
  assert.match(result.assistantMessage, /\/models\/seedance-2-0/i);
});

test('AI Strategist orchestrator explains its own capabilities without creative routing', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'What can you do?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'capability_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.equal(result.promptGenerationContext, undefined);
  assert.equal(result.llm.briefRefinement.used, false);
  assert.equal(result.llm.promptWriter.used, false);
  assert.match(result.assistantMessage, /choose the right MaxVideoAI model/i);
  assert.match(result.assistantMessage, /improve prompts/i);
  assert.match(result.assistantMessage, /estimate cost/i);
  assert.match(result.assistantMessage, /I will not run generation/i);
});

test('AI Strategist treats acquisition handoff greetings as capability guidance', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'I just landed on MaxVideoAI and need direction. hi',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'capability_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
});

test('AI Strategist recommends models for creative briefs even when user is unsure about model or workflow', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'premium headphones product ad, black background, blue rim light, 15 seconds Not sure which model or workflow is best.',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'new_video_brief');
  assert.ok(result.recommendations);
});

test('AI Strategist keeps expanded hesitant creative briefs as briefs', async () => {
  const playground = await loadPlaygroundModule();

  const cases = [
    'arcade fighting inspired scene, two stylized fighters, rooftop at night Not sure which model or workflow is best.',
    'use my uploaded headshot and make me speak to camera Not sure which model or workflow is best.',
    'premium jewelry video, gold ring on velvet, slow macro camera Not sure which model or workflow is best.',
    'realistic human office scene with subtle camera movement Not sure which model or workflow is best.',
    'fantasy creature animation breathing fire in a dark cave Not sure which model or workflow is best.',
    'I have a reference image of a person, but I only need subtle silent movement Not sure which model or workflow is best.',
  ];

  for (const userMessage of cases) {
    const result = await playground.runAiStrategistPlaygroundPipeline(
      {
        userMessage,
        mode: 'recommend',
        surface: 'chat',
      },
      { env: {} }
    );

    assert.equal(result.orchestrationPlan.task, 'new_video_brief', userMessage);
    assert.ok(result.recommendations, userMessage);
  }
});

test('AI Strategist keeps noisy cheapest-model questions as pricing help', async () => {
  const playground = await loadPlaygroundModule();

  const cases = [
    'whats cheapest vid model?? Not sure which model or workflow is best.',
    'whats cheapest vid model?? pls, make smart assumptions if needed',
    "I'm testing MaxVideoAI for a campaign. whats cheapest vid model??",
  ];

  for (const userMessage of cases) {
    const result = await playground.runAiStrategistPlaygroundPipeline(
      {
        userMessage,
        mode: 'recommend',
        surface: 'chat',
      },
      { env: {} }
    );

    assert.equal(result.orchestrationPlan.task, 'pricing_help', userMessage);
    assert.equal(result.mode, 'product_help', userMessage);
    assert.equal(result.recommendations, undefined, userMessage);
    assert.match(result.assistantMessage, /cheapest|least expensive|\$0\.04/i, userMessage);
  }
});

test('AI Strategist keeps multilingual cheap ad briefs as creative recommendations', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'quiero un anuncio TikTok barato para probar un producto Not sure which model or workflow is best.',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'new_video_brief');
  assert.ok(result.recommendations);
  assert.doesNotMatch(result.assistantMessage, /cheapest engines in the local catalog/i);
});

test('AI Strategist treats premium without burning credits as model tradeoff advice', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: "I need something that looks premium but I don't want to burn credits pls, no credits spent yet",
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'model_advice');
  assert.ok(result.recommendations);
  assert.match(result.assistantMessage, /cost-aware|balanced|value|credits/i);
});

test('AI Strategist keeps noisy model comparisons as model advice', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'I saw Veo on the site. Is it better than Seedance for ads? Not sure which model or workflow is best.',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'model_advice');
  assert.ok(result.recommendations);
});

test('AI Strategist keeps French model comparisons as model advice', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'pour une scene humaine premium avec dialogue, tu conseilles plutot veo ou kling ?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'model_advice');
  assert.ok(result.recommendations);
});

test('AI Strategist keeps noisy best-model questions as model advice', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: "What's the best model for TikTok ads with fast motion? Not sure which model or workflow is best.",
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'model_advice');
  assert.ok(result.recommendations);
});

test('AI Strategist routes 4K necessity questions as model advice even with workflow uncertainty', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Do I really need 4K for a TikTok product ad? Not sure which model or workflow is best.',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'model_advice');
  assert.ok(result.recommendations);
  assert.match(result.assistantMessage, /4K|product|TikTok|model/i);
});

test('AI Strategist routes model location questions to navigation help even with acquisition wording', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'I need proof before choosing. where is Veo Lite?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'navigation_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /veo|model|examples|\/models|\/examples/i);
});

test('AI Strategist routes generic model-page location questions to navigation help despite uncertainty wording', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'where are the model pages? Not sure which model or workflow is best.',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'navigation_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /\/models|model catalog|models catalog/i);
});

test('AI Strategist keeps multilingual creative briefs as briefs when model or workflow is uncertain', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'une pub de voiture dynamique Not sure which model or workflow is best.',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'new_video_brief');
  assert.ok(result.recommendations);
});

test('AI Strategist preserves model info routing when a support question mentions workflow uncertainty', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Which Veo models support 4K? Not sure which model or workflow is best.',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'model_info_help');
  assert.equal(result.recommendations, undefined);
});

test('AI Strategist keeps product-control still-image questions as workflow help', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: "I'm trying to pick the right workflow. Should I generate a still image first for better product control?",
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'workflow_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /text-to-image|still image|image-to-video|workflow/i);
});

test('AI Strategist orchestrator explains MaxVideoAI site capabilities in French', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Tu peux faire quoi sur MaxVideoAI ?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'capability_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /mod[eè]le MaxVideoAI/i);
  assert.match(result.assistantMessage, /workflow/i);
  assert.match(result.assistantMessage, /prix/i);
  assert.match(result.assistantMessage, /cr[eé]dits/i);
});

test('AI Strategist orchestrator answers general site overview without model cards', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'How does MaxVideoAI work?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'site_overview_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.match(result.assistantMessage, /video generator/i);
  assert.match(result.assistantMessage, /compare models/i);
  assert.match(result.assistantMessage, /price shown before generation/i);
});

test('AI Strategist knowledge answers include grounded sources and no prompt writer', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'What can Seedance 2 do?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.equal(result.llm.briefRefinement.used, false);
  assert.equal(result.llm.promptWriter.used, false);
  assert.ok(result.knowledgeToolResults?.length);
  assert.match(result.knowledgeToolResults[0].answer, /Seedance 2\.0/i);
  assert.ok(result.knowledgeToolResults[0].sources.some((source: { id: string }) => source.id === 'ai_strategist_model_catalog'));
});

test('AI Strategist knowledge answers workflow support from structured catalogs', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Which models support image-to-video?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'workflow_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.ok(result.knowledgeToolResults?.length);
  assert.match(result.assistantMessage, /image-to-video/i);
  assert.match(result.assistantMessage, /Kling/i);
  assert.ok(result.knowledgeToolResults[0].sources.some((source: { id: string }) => source.id === 'ai_strategist_model_catalog'));
  assert.ok(result.knowledgeToolResults[0].sources.some((source: { id: string }) => source.id === 'ai_strategist_workflow_rules'));
});

test('AI Strategist playground answers engine pricing from engine catalog when available', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'How much is Kling 3 Pro for 10 seconds with audio?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'pricing_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.ok(result.knowledgeToolResults?.length);
  assert.equal(result.knowledgeToolResults[0].toolName, 'engine_pricing');
  assert.ok(result.knowledgeToolResults[0].sources.some((source: { id: string }) => source.id === 'engine_catalog'));
  assert.match(result.assistantMessage, /Kling 3 Pro/i);
  assert.match(result.assistantMessage, /10 seconds/i);
});

test('AI Strategist playground answers engine settings from engine catalog', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'What settings does Kling 3 4K support?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'model_info_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.ok(result.knowledgeToolResults?.length);
  assert.equal(result.knowledgeToolResults[0].toolName, 'engine_settings');
  assert.match(result.assistantMessage, /Kling 3 4K/i);
  assert.match(result.assistantMessage, /Resolutions/i);
});

test('AI Strategist routes example questions to examples pages without auto-navigation', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Show me Kling examples',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'examples_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.ok(result.knowledgeToolResults?.length);
  assert.equal(result.knowledgeToolResults[0].toolName, 'examples_help');
  assert.match(result.assistantMessage, /Kling examples/i);
  assert.match(result.assistantMessage, /\/examples\/kling/i);
  assert.equal(result.safety.uiActionsApplied, false);
});

test('AI Strategist explains where to compare models and where to generate', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Where do I compare models before generating?',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.orchestrationPlan.task, 'navigation_help');
  assert.equal(result.mode, 'product_help');
  assert.equal(result.recommendations, undefined);
  assert.ok(result.knowledgeToolResults?.length);
  assert.equal(result.knowledgeToolResults[0].toolName, 'navigation_help');
  assert.match(result.assistantMessage, /Compare/i);
  assert.match(result.assistantMessage, /Generate/i);
  assert.match(result.assistantMessage, /\/compare/i);
  assert.match(result.assistantMessage, /\/app/i);
});

test('AI Strategist chat recommendation cards trigger tier and model selection without generating immediately', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'I want a Street Fighter style fight',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const selected = first.recommendations?.best;
  assert.ok(selected);

  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Choose best',
      mode: 'recommend',
      surface: 'chat',
      selectedTier: 'best',
      selectedModel: selected.model.id,
      conversationState: {
        lastNormalizedBrief: first.normalizedBrief,
        lastRecommendations: first.recommendations,
        lastSelectedWorkflow: first.workflow ?? undefined,
        stage: first.conversationStage,
      },
    },
    { env: {} }
  );

  assert.equal(first.conversationStage, 'awaiting_model_choice');
  assert.equal(second.conversationPlan.action, 'select_tier');
  assert.equal(second.selectedModel, selected.model.id);
  assert.equal(second.sanitizedFinalOutput, undefined);
  assert.match(['collecting_missing_fields', 'awaiting_confirmation'].join('|'), new RegExp(second.conversationStage));
});

test('AI Strategist chat asks targeted missing-field questions before prompt generation', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'I want a Street Fighter style fight',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Choose best',
      mode: 'recommend',
      surface: 'chat',
      selectedTier: 'best',
      selectedModel: first.recommendations?.best.model.id,
      conversationState: {
        lastNormalizedBrief: first.normalizedBrief,
        lastRecommendations: first.recommendations,
        lastSelectedWorkflow: first.workflow ?? undefined,
        stage: first.conversationStage,
      },
    },
    { env: {} }
  );

  assert.equal(second.conversationStage, 'collecting_missing_fields');
  assert.equal(second.sanitizedFinalOutput, undefined);
  assert.ok((second.briefCompletion?.missingFields.length ?? 0) > 0);
  assert.match(second.assistantMessage, /Quick direction check/i);
  assert.match(second.assistantMessage, /one fighter, two fighters/i);
});

test('AI Strategist chat can make assumptions, confirm direction, then generate a final prompt', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'I want a Street Fighter style fight',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Choose best',
      mode: 'recommend',
      surface: 'chat',
      selectedTier: 'best',
      selectedModel: first.recommendations?.best.model.id,
      conversationState: {
        lastNormalizedBrief: first.normalizedBrief,
        lastRecommendations: first.recommendations,
        lastSelectedWorkflow: first.workflow ?? undefined,
        stage: first.conversationStage,
      },
    },
    { env: {} }
  );
  const third = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'go ahead, make smart assumptions',
      mode: 'recommend',
      surface: 'chat',
      conversationState: {
        lastNormalizedBrief: second.normalizedBrief,
        lastRecommendations: second.recommendations,
        lastSelectedWorkflow: second.workflow ?? undefined,
        lastSelectedModel: second.selectedModel ?? undefined,
        lastSelectedTier: second.selectedTier,
        stage: second.conversationStage,
        lastBriefCompletion: second.briefCompletion,
      },
    },
    { env: {} }
  );
  const fourth = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Generate prompt',
      mode: 'recommend',
      surface: 'chat',
      conversationState: {
        lastNormalizedBrief: third.normalizedBrief,
        lastRecommendations: third.recommendations,
        lastSelectedWorkflow: third.workflow ?? undefined,
        lastSelectedModel: third.selectedModel ?? undefined,
        lastSelectedTier: third.selectedTier,
        stage: third.conversationStage,
        lastBriefCompletion: third.briefCompletion,
      },
    },
    { env: {} }
  );

  assert.equal(third.conversationStage, 'awaiting_confirmation');
  assert.equal(third.sanitizedFinalOutput, undefined);
  assert.match(third.assistantMessage, /Here.s what I.ll build/i);
  assert.match(third.assistantMessage, /Duration:/i);
  assert.match(third.assistantMessage, /Estimated price:/i);
  assert.match(third.assistantMessage, /Generate the prompt/i);
  assert.ok(third.uiActions.some((action: { type: string }) => action.type === 'SET_DURATION'));
  assert.equal(fourth.conversationStage, 'prompt_ready');
  assert.match(fourth.assistantMessage, /prompt is ready|review|copy|adjust/i);
  assert.match(fourth.assistantMessage, /no generation|credits/i);
  assert.ok(fourth.sanitizedFinalOutput?.finalPrompt);
  assert.match(fourth.sanitizedFinalOutput.finalPrompt, /Duration:\n\d+ seconds/i);
  assert.match(fourth.sanitizedFinalOutput.finalPrompt, /arcade fighting|stylized combat|Assumed direction|16:9/i);
  assert.doesNotMatch(fourth.sanitizedFinalOutput.finalPrompt, /Street Fighter/i);
});

test('AI Strategist chat applies duration changes during confirmation without returning to model choice', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'j aimerai un spokesperson avec mon produit dans les mains, j ai juste une image',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Choose best',
      mode: 'recommend',
      surface: 'chat',
      selectedTier: 'best',
      selectedModel: first.recommendations?.best.model.id,
      conversationState: conversationStateFrom(first),
    },
    { env: {} }
  );
  const third = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'un casque audio. je veux qu ils disent que c est beau et que le son est top, c est pour tiktok en mode influencer en anglais',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(second),
    },
    { env: {} }
  );
  const fourth = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'je veux que ca dure 15 secondes',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(third),
    },
    { env: {} }
  );

  assert.equal(third.conversationStage, 'awaiting_confirmation');
  assert.equal(fourth.conversationPlan.action, 'build_prompt');
  assert.notEqual(fourth.conversationStage, 'awaiting_model_choice');
  assert.equal(fourth.selectedModel, third.selectedModel);
  assert.equal(fourth.workflow, third.workflow);
  assert.equal(fourth.recommendations?.best.model.id, third.recommendations?.best.model.id);
  assert.match(fourth.assistantMessage, /Duration: 15 seconds/i);
  assert.match(fourth.briefCompletion?.resolvedBrief ?? '', /15 secondes/i);

  const fifth = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Generate prompt',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(fourth),
    },
    { env: {} }
  );
  const sixth = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'modifie le prompt pour une duree de 12 secondes',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(fifth),
    },
    { env: {} }
  );

  assert.equal(fifth.conversationStage, 'prompt_ready');
  assert.equal(sixth.conversationPlan.action, 'build_prompt');
  assert.notEqual(sixth.conversationStage, 'awaiting_model_choice');
  assert.equal(sixth.selectedModel, fifth.selectedModel);
  assert.match(sixth.sanitizedFinalOutput?.finalPrompt ?? '', /Duration:\n12 seconds/i);
});

test('AI Strategist chat treats keep-it-cheaper follow-ups as value selection after a model choice', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'premium perfume bottle video pls, make smart assumptions if needed',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'best',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(first),
    },
    { env: {} }
  );
  const third = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'actually can we keep it cheaper?',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(second),
    },
    { env: {} }
  );

  assert.equal(third.orchestrationPlan.task, 'model_or_tier_selection');
  assert.equal(third.selectedTier, 'value');
  assert.ok(third.selectedModel);
  assert.notEqual(third.conversationStage, 'awaiting_model_choice');
  assert.doesNotMatch(third.assistantMessage, /For video, the cheapest engines/i);
});

test('AI Strategist chat treats explicit model switch during missing-field collection as model selection', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'cinematic car commercial at night, premium reflections',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Choose best',
      mode: 'recommend',
      surface: 'chat',
      selectedTier: 'best',
      selectedModel: first.recommendations?.best.model.id,
      conversationState: conversationStateFrom(first),
    },
    { env: {} }
  );
  const third = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'change model to seedance',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(second),
    },
    { env: {} }
  );

  assert.equal(second.conversationStage, 'collecting_missing_fields');
  assert.equal(third.conversationPlan.action, 'select_model');
  assert.equal(third.selectedModel, 'seedance-2-0');
  assert.notEqual(third.conversationStage, 'awaiting_model_choice');
});

test('AI Strategist chat treats safest-option follow-ups as selecting the recommended best route', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'I have one image. Make this person hold my headphones and speak to camera for TikTok.',
      mode: 'recommend',
      surface: 'chat',
      uploadedAsset: { type: 'image', hasPerson: true, hasProduct: true, isReferenceImage: true },
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'choose the safest option',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(first),
    },
    { env: {} }
  );

  assert.equal(second.orchestrationPlan.task, 'model_or_tier_selection');
  assert.equal(second.conversationPlan.action, 'select_tier');
  assert.equal(second.selectedTier, 'best');
  assert.equal(second.selectedModel, first.recommendations?.best.model.id);
  assert.notEqual(second.conversationStage, 'awaiting_model_choice');
});

test('AI Strategist chat routes uploaded creative references to recommendations instead of upload help', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Animate this person image speaking to camera',
      mode: 'recommend',
      surface: 'chat',
      uploadedAsset: { type: 'image', hasPerson: true, isReferenceImage: true },
    },
    { env: {} }
  );

  assert.equal(result.normalizedBrief.intent, 'person_reference_i2v');
  assert.equal(result.workflow, 'image-to-video');
  assert.ok(result.recommendations);
  assert.notEqual(result.orchestrationPlan.task, 'asset_reference_help');
  assert.match(result.warnings.join('\n'), /person|character|reference|Kling|LTX/i);
});

test('AI Strategist chat can advance current prompt improvements with smart assumptions', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'make it more premium',
      currentPrompt: 'Perfume bottle on marble, cinematic',
      selectedModel: 'kling-3-pro',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.equal(result.conversationPlan.action, 'improve_prompt');
  assert.equal(result.workflow, 'text-to-image-then-image-to-video');
  assert.equal(result.conversationStage, 'awaiting_confirmation');
  assert.match(result.assistantMessage, /Here.s what I.ll build/i);
  assert.match(result.assistantMessage, /Generate the prompt/i);
});

test('AI Strategist chat does not ask generic clarification for a clear perfume product brief', async () => {
  const playground = await loadPlaygroundModule();

  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Luxury perfume ad on black marble, 9:16, premium look, slow camera push-in, soft gold reflections',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );

  assert.notEqual(result.conversationPlan.action, 'ask_clarification');
  assert.notEqual(result.assistantMessage, 'What video are you trying to create or improve?');
  assert.ok(result.recommendations);
  assert.match(result.assistantMessage, /three possible paths/i);
  assert.doesNotMatch(result.assistantMessage, /Best:|Medium:|Value:/i);
  assert.doesNotMatch(result.assistantMessage, /Kling|Seedance|Veo|LTX/i);
  assert.match(result.warnings.join('\n'), /Exact labels, logos, legal copy/i);
});

test('AI Strategist chat treats fast-path sneaker voiceover as clear off-camera narration', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Make assumptions and create a TikTok sneaker ad with voiceover',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Choose best',
      mode: 'recommend',
      surface: 'chat',
      selectedTier: 'best',
      selectedModel: first.recommendations?.best.model.id,
      conversationState: conversationStateFrom(first),
    },
    { env: {} }
  );

  assert.notEqual(first.conversationPlan.action, 'ask_clarification');
  assert.ok(first.recommendations);
  assert.equal(first.normalizedBrief.hasVoiceover, true);
  assert.equal(first.normalizedBrief.hasVisibleSpeaker, false);
  assert.equal(second.conversationStage, 'awaiting_confirmation');
  assert.equal(second.briefCompletion?.missingFields.length, 0);
  assert.match(second.assistantMessage, /off-camera voiceover/i);
  assert.match(second.assistantMessage, /Duration: 8 seconds/i);
  assert.match(second.assistantMessage, /Estimated price:/i);
});

test('AI Strategist chat sanitizes protected game references in summaries and final prompts', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'I want a Street Fighter style fight',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Choose best',
      mode: 'recommend',
      surface: 'chat',
      selectedTier: 'best',
      selectedModel: first.recommendations?.best.model.id,
      conversationState: conversationStateFrom(first),
    },
    { env: {} }
  );
  const third = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'go ahead, make smart assumptions',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(second),
    },
    { env: {} }
  );
  const fourth = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Generate prompt',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(third),
    },
    { env: {} }
  );

  assert.match(second.assistantMessage, /one fighter, two fighters/i);
  assert.match(third.assistantMessage, /arcade fighting|stylized combat/i);
  assert.doesNotMatch(third.assistantMessage, /Street Fighter/i);
  assert.match(fourth.sanitizedFinalOutput?.finalPrompt ?? '', /arcade fighting|stylized combat/i);
  assert.doesNotMatch(fourth.sanitizedFinalOutput?.finalPrompt ?? '', /Street Fighter/i);
});

test('AI Strategist chat reuses enriched English car brief when Seedance is selected after French brief', async () => {
  const playground = await loadPlaygroundModule();

  const first = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'une pub de voiture dynamique',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const second = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'ok seedance',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(first),
    },
    { env: {} }
  );
  const third = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Generate prompt',
      mode: 'recommend',
      surface: 'chat',
      conversationState: conversationStateFrom(second),
    },
    { env: {} }
  );

  assert.equal(second.selectedModel, 'seedance-2-0');
  assert.match(first.normalizedBrief.normalizedBrief, /car commercial|automotive/i);
  assert.match(second.assistantMessage, /car|automotive/i);
  assert.doesNotMatch(third.sanitizedFinalOutput?.finalPrompt ?? '', /une pub de voiture dynamique/i);
  assert.match(third.sanitizedFinalOutput?.finalPrompt ?? '', /car|automotive/i);
});

test('AI Strategist playground admin route and page stay internal-only', () => {
  const routeSource = readFileSync(join(root, 'frontend/app/api/admin/ai-strategist-playground/route.ts'), 'utf8');
  const pageSource = readFileSync(join(root, 'frontend/app/(core)/admin/ai-strategist-playground/page.tsx'), 'utf8');
  const chatSource = readFileSync(join(root, 'frontend/app/(core)/admin/ai-strategist-playground/_components/AiStrategistChatClient.tsx'), 'utf8');
  const navigationSource = readFileSync(join(root, 'frontend/lib/admin/navigation.ts'), 'utf8');

  assert.match(routeSource, /requireAdmin\(req\)/);
  assert.match(routeSource, /isAiStrategistPlaygroundEnabled\(\)/);
  assert.match(pageSource, /isAiStrategistPlaygroundEnabled\(\)/);
  assert.match(pageSource, /AiStrategistChatClient/);
  assert.match(pageSource, /Technical Debug Playground/);
  assert.match(chatSource, /ai-strategist-overlay-preview/);
  assert.match(chatSource, /ai-strategist-launcher/);
  assert.match(chatSource, /paste a prompt to improve/);
  assert.match(chatSource, /setIsWidgetOpen/);
  assert.match(chatSource, /aria-expanded/);
  assert.match(chatSource, /Minimize AI Strategist/);
  assert.match(chatSource, /Close AI Strategist/);
  assert.match(chatSource, /Best/);
  assert.match(chatSource, /Medium/);
  assert.match(chatSource, /Value/);
  assert.match(chatSource, /conversationState/);
  assert.match(chatSource, /onChooseRecommendation/);
  assert.match(chatSource, /Generate prompt/);
  assert.match(chatSource, /Make assumptions/);
  assert.match(chatSource, /Copy/);
  assert.match(chatSource, /knowledgeToolResults/);
  assert.match(chatSource, /Sources:/);
  assert.match(chatSource, /buildAdvisorRecommendationReply/);
  assert.match(chatSource, /I understand this as/);
  assert.doesNotMatch(chatSource, /Got it\. I recommend these models/);
  assert.doesNotMatch(chatSource, /Optional context/);
  assert.doesNotMatch(chatSource, /Debug details/);
  assert.doesNotMatch(chatSource, /<details[^>]*open/);
  assert.doesNotMatch(navigationSource, /ai-strategist-playground/);
});

test('AI Strategist technical source details stay secondary', () => {
  const chatSource = readFileSync(join(root, 'frontend/app/(core)/admin/ai-strategist-playground/_components/AiStrategistChatClient.tsx'), 'utf8');
  const debugSource = readFileSync(join(root, 'frontend/app/(core)/admin/ai-strategist-playground/_components/AiStrategistPlaygroundClient.tsx'), 'utf8');
  const pageSource = readFileSync(join(root, 'frontend/app/(core)/admin/ai-strategist-playground/page.tsx'), 'utf8');

  assert.match(chatSource, /SourceChips/);
  assert.match(debugSource, /Knowledge tools and source details/);
  assert.match(debugSource, /knowledgeToolResults/);
  assert.match(debugSource, /sourcesUsed/);
  assert.match(pageSource, /Open technical debug form/);
  assert.doesNotMatch(chatSource, /<details[^>]*open/);
  assert.doesNotMatch(pageSource, /<details[^>]*open/);
});

test('AI Strategist conversation eval scenarios are versioned and broad enough for regression passes', () => {
  const scenariosPath = join(root, 'docs/ai-strategist/evals/conversation-scenarios.json');
  const parsed = JSON.parse(readFileSync(scenariosPath, 'utf8')) as {
    version?: number;
    scenarios?: Array<{
      id?: string;
      label?: string;
      category?: string;
      turns?: Array<{
        label?: string;
        userMessage?: string;
        expect?: Record<string, unknown>;
      }>;
    }>;
  };

  assert.equal(parsed.version, 1);
  assert.ok(Array.isArray(parsed.scenarios));
  assert.ok(parsed.scenarios.length >= 20);

  const categories = new Set<string>();
  for (const scenario of parsed.scenarios) {
    assert.equal(typeof scenario.id, 'string');
    assert.equal(typeof scenario.label, 'string');
    assert.equal(typeof scenario.category, 'string');
    assert.ok(Array.isArray(scenario.turns));
    assert.ok(scenario.turns.length > 0);
    categories.add(scenario.category);

    for (const turn of scenario.turns) {
      assert.equal(typeof turn.label, 'string');
      assert.equal(typeof turn.userMessage, 'string');
      assert.ok(turn.expect && Object.keys(turn.expect).length > 0);
    }
  }

  for (const requiredCategory of [
    'pricing_or_catalog_gap',
    'site_or_navigation_help',
    'state_memory_error',
    'prompt_generation_issue',
    'model_recommendation_issue',
    'asset_reference_routing',
    'language_issue',
    'safety_or_funnel',
  ]) {
    assert.ok(categories.has(requiredCategory), `Expected category ${requiredCategory}`);
  }

  const qualityScenarioCount = parsed.scenarios.filter((scenario) =>
    scenario.turns?.some((turn) => Boolean((turn.expect as { quality?: unknown } | undefined)?.quality))
  ).length;
  assert.ok(qualityScenarioCount >= 5, 'Expected at least 5 scenarios with qualitative advisor checks');
});
