import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = process.cwd();
const betaRoutePath = `${root}/frontend/app/api/ai-video-strategist/beta/route.ts`;
const betaFlagsPath = `${root}/frontend/lib/ai-strategist/beta-flags.ts`;
const betaResponsePath = `${root}/frontend/lib/ai-strategist/beta-response.ts`;
const appSidebarPath = `${root}/frontend/components/AppSidebar.tsx`;
const readyViewPath = `${root}/frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx`;
const composerSurfacePath = `${root}/frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`;
const composerPath = `${root}/frontend/components/Composer.tsx`;
const composerTypesPath = `${root}/frontend/components/composer/composer-types.ts`;
const bridgePath = `${root}/frontend/app/(core)/(workspace)/app/_components/WorkspaceStrategistBetaBridge.tsx`;
const imageWorkspacePath = `${root}/frontend/app/(core)/(workspace)/app/image/ImageWorkspace.tsx`;
const imageBridgePath = `${root}/frontend/app/(core)/(workspace)/app/image/_components/ImageWorkspaceStrategistBetaBridge.tsx`;
const applyFormPath = `${root}/frontend/app/(core)/(workspace)/app/_lib/ai-strategist-apply-form.ts`;
const widgetPath = `${root}/frontend/components/ai-strategist/AiStrategistBetaSidebarWidget.tsx`;
const betaBridgePath = `${root}/frontend/lib/ai-strategist/beta-bridge.ts`;
const applyPhasesPath = `${root}/frontend/lib/ai-strategist/apply-phases.ts`;
const applyActionsPath = `${root}/frontend/lib/ai-strategist/apply-actions.ts`;

async function loadPlaygroundModule() {
  try {
    return await import('../frontend/lib/ai-strategist/playground-pipeline.ts');
  } catch (error) {
    assert.fail(`Expected AI Strategist playground pipeline to be importable: ${(error as Error).message}`);
  }
}

async function loadBetaResponseModule() {
  try {
    return await import('../frontend/lib/ai-strategist/beta-response.ts');
  } catch (error) {
    assert.fail(`Expected AI Strategist beta response helper to be importable: ${(error as Error).message}`);
  }
}

async function loadBetaBridgeModule() {
  try {
    return await import('../frontend/lib/ai-strategist/beta-bridge.ts');
  } catch (error) {
    assert.fail(`Expected AI Strategist beta bridge helper to be importable: ${(error as Error).message}`);
  }
}

async function loadApplyPhasesModule() {
  try {
    return await import('../frontend/lib/ai-strategist/apply-phases.ts');
  } catch (error) {
    assert.fail(`Expected AI Strategist apply phases helper to be importable: ${(error as Error).message}`);
  }
}

async function loadApplyActionsModule() {
  try {
    return await import('../frontend/lib/ai-strategist/apply-actions.ts');
  } catch (error) {
    assert.fail(`Expected AI Strategist apply actions helper to be importable: ${(error as Error).message}`);
  }
}

async function loadApplyFormModule() {
  try {
    return await import('../frontend/app/(core)/(workspace)/app/_lib/ai-strategist-apply-form.ts');
  } catch (error) {
    assert.fail(`Expected AI Strategist apply form helper to be importable: ${(error as Error).message}`);
  }
}

test('AI Strategist beta API is feature-flagged and strips raw debug output', async () => {
  assert.equal(existsSync(betaRoutePath), true);
  assert.equal(existsSync(betaResponsePath), true);

  const routeSource = readFileSync(betaRoutePath, 'utf8');
  const responseSource = readFileSync(betaResponsePath, 'utf8');

  assert.match(routeSource, /isAiStrategistBetaApiEnabled/);
  assert.match(routeSource, /runAiStrategistPlaygroundPipeline/);
  assert.match(routeSource, /toAiStrategistBetaResponse/);
  assert.doesNotMatch(routeSource, /requireAdmin/);
  assert.doesNotMatch(responseSource, /rawLlmOutput:/);
  assert.doesNotMatch(responseSource, /promptGenerationContext:/);

  const playground = await loadPlaygroundModule();
  const beta = await loadBetaResponseModule();
  const result = await playground.runAiStrategistPlaygroundPipeline(
    {
      userMessage: 'Make assumptions and create a TikTok sneaker ad with voiceover',
      mode: 'recommend',
      surface: 'chat',
    },
    { env: {} }
  );
  const response = beta.toAiStrategistBetaResponse(result);

  assert.equal(response.ok, true);
  assert.equal('rawLlmOutput' in response, false);
  assert.equal('promptGenerationContext' in response, false);
  assert.equal(response.llmCost.formattedTotal, '$0.00');
  assert.equal(response.llmCost.liveCallCount, 0);
  assert.equal(response.safety.autoGeneration, false);
  assert.equal(response.safety.creditSpend, false);
  assert.equal(response.safety.publishing, false);
  assert.equal(response.safety.uiActionsApplied, false);
});

test('workspace sidebar exposes the beta strategist in local/dev while Generate Video provides an apply bridge', () => {
  assert.equal(existsSync(appSidebarPath), true);
  assert.equal(existsSync(readyViewPath), true);
  assert.equal(existsSync(composerSurfacePath), true);
  assert.equal(existsSync(composerPath), true);
  assert.equal(existsSync(composerTypesPath), true);
  assert.equal(existsSync(bridgePath), true);
  assert.equal(existsSync(imageWorkspacePath), true);
  assert.equal(existsSync(imageBridgePath), true);
  assert.equal(existsSync(applyFormPath), true);
  assert.equal(existsSync(widgetPath), true);
  assert.equal(existsSync(betaBridgePath), true);
  assert.equal(existsSync(applyPhasesPath), true);
  assert.equal(existsSync(applyActionsPath), true);

  const appSidebarSource = readFileSync(appSidebarPath, 'utf8');
  const readyViewSource = readFileSync(readyViewPath, 'utf8');
  const composerSurfaceSource = readFileSync(composerSurfacePath, 'utf8');
  const composerSource = readFileSync(composerPath, 'utf8');
  const composerTypesSource = readFileSync(composerTypesPath, 'utf8');
  const bridgeSource = readFileSync(bridgePath, 'utf8');
  const imageWorkspaceSource = readFileSync(imageWorkspacePath, 'utf8');
  const imageBridgeSource = readFileSync(imageBridgePath, 'utf8');
  const applyFormSource = readFileSync(applyFormPath, 'utf8');
  const widgetSource = readFileSync(widgetPath, 'utf8');
  const betaBridgeSource = readFileSync(betaBridgePath, 'utf8');
  const applyPhasesSource = readFileSync(applyPhasesPath, 'utf8');
  const applyActionsSource = readFileSync(applyActionsPath, 'utf8');
  const betaFlagsSource = readFileSync(betaFlagsPath, 'utf8');

  assert.match(appSidebarSource, /AiStrategistBetaSidebarWidget/);
  assert.ok(
    appSidebarSource.indexOf('<AiStrategistBetaSidebarWidget />') < appSidebarSource.indexOf('workspace.sidebar.newModel.label'),
    'Expected the beta strategist launcher to render directly above the New model sidebar card.'
  );
  assert.match(readyViewSource, /import \{ WorkspaceStrategistBetaBridge \} from '\.\/WorkspaceStrategistBetaBridge';/);
  assert.match(readyViewSource, /<WorkspaceStrategistBetaBridge/);
  assert.match(widgetSource, /isAiStrategistBetaWidgetEnabled/);
  assert.match(betaFlagsSource, /NODE_ENV !== 'production'/);
  assert.match(betaFlagsSource, /NEXT_PUBLIC_AI_STRATEGIST_BETA_ENABLED/);
  assert.match(widgetSource, /app-ai-strategist-sidebar-trigger/);
  assert.match(widgetSource, /app-ai-strategist-widget/);
  assert.match(widgetSource, /onMouseDown=\{handleWidgetMouseDown\}/);
  assert.match(widgetSource, /onMouseDown=\{handleWidgetResizeMouseDown\}/);
  assert.match(widgetSource, /clampWidgetPosition/);
  assert.match(widgetSource, /clampWidgetSize/);
  assert.match(widgetSource, /Resize AI Assistant/);
  assert.match(widgetSource, /prompt_assistant/);
  assert.match(widgetSource, /openWidget/);
  assert.match(composerTypesSource, /onOpenPromptAssistant\?: \(\) => void/);
  assert.match(composerSource, /Open AI Assistant prompt helper/);
  assert.match(composerSurfaceSource, /window\.__mvaiAiStrategistBeta\?\.openWidget/);
  assert.match(composerSurfaceSource, /mode: 'prompt_assistant'/);
  assert.match(widgetSource, /Apply to generator/);
  assert.match(widgetSource, /Apply in generator/);
  assert.match(widgetSource, /buildAiStrategistApplyPhases/);
  assert.match(widgetSource, /Est\. assistant LLM/);
  assert.match(widgetSource, /formatConversationLlmCost/);
  assert.match(widgetSource, /storePendingAiStrategistApply/);
  assert.match(widgetSource, /currentPathMatchesApplyTarget/);
  assert.match(widgetSource, /window\.location\.assign/);
  assert.match(betaBridgeSource, /AI_STRATEGIST_PENDING_APPLY_STORAGE_KEY/);
  assert.match(betaBridgeSource, /resolveAiStrategistApplyTarget/);
  assert.match(betaBridgeSource, /consumePendingAiStrategistApply/);
  assert.match(bridgeSource, /consumePendingAiStrategistApply\('video'\)/);
  assert.match(bridgeSource, /hasAiStrategistFormApply/);
  assert.match(bridgeSource, /SET_PROMPT/);
  assert.match(bridgeSource, /SET_NEGATIVE_PROMPT/);
  assert.match(bridgeSource, /buildAiStrategistApplyFormState/);
  assert.match(bridgeSource, /setForm/);
  assert.match(applyFormSource, /coerceFormState/);
  assert.match(applyFormSource, /SET_MODEL/);
  assert.match(applyFormSource, /SET_WORKFLOW/);
  assert.match(applyFormSource, /SET_DURATION/);
  assert.match(applyFormSource, /SET_RESOLUTION/);
  assert.match(applyFormSource, /SET_ASPECT_RATIO/);
  assert.match(imageWorkspaceSource, /ImageWorkspaceStrategistBetaBridge/);
  assert.match(imageBridgeSource, /consumePendingAiStrategistApply\('image'\)/);
  assert.match(imageBridgeSource, /gpt-image-2/);
  assert.match(applyPhasesSource, /Starting image prompt:/);
  assert.match(applyPhasesSource, /Video animation prompt:/);
  assert.match(applyPhasesSource, /Apply image prompt/);
  assert.match(applyPhasesSource, /Apply video prompt/);
  assert.match(applyActionsSource, /appEngineAliases/);
  assert.match(applyActionsSource, /selectedModel/);
  assert.match(applyActionsSource, /SET_MODEL/);
  assert.doesNotMatch(widgetSource, /startRender/);
  assert.doesNotMatch(bridgeSource, /startRender/);
  assert.doesNotMatch(imageBridgeSource, /startRender/);
  assert.doesNotMatch(widgetSource, /\/api\/admin\/ai-strategist-playground/);
});

test('AI Strategist apply builds the Generate Video form with matching engine and settings', async () => {
  const applyForm = await loadApplyFormModule();
  const engines = [
    {
      id: 'seedance-2-0',
      label: 'Seedance 2.0',
      provider: 'ByteDance',
      status: 'live',
      latencyTier: 'fast',
      modes: ['t2v'],
      maxDurationSec: 10,
      resolutions: ['720p'],
      aspectRatios: ['16:9'],
      fps: [24],
      audio: true,
      upscale4k: false,
      extend: false,
    },
    {
      id: 'kling-3-pro',
      label: 'Kling 3 Pro',
      provider: 'Kling',
      status: 'live',
      latencyTier: 'standard',
      modes: ['t2v', 'i2v'],
      maxDurationSec: 12,
      resolutions: ['720p', '1080p'],
      aspectRatios: ['16:9', '9:16'],
      fps: [24],
      audio: true,
      upscale4k: false,
      extend: false,
      modeCaps: {
        i2v: {
          modes: ['i2v'],
          duration: { options: [5, 10, 12], default: 5 },
          resolution: ['1080p'],
          aspectRatio: ['16:9', '9:16'],
          fps: 24,
          audioToggle: true,
        },
      },
    },
  ];
  const currentForm = {
    engineId: 'seedance-2-0',
    mode: 't2v',
    durationSec: 5,
    durationOption: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    iterations: 1,
    audio: true,
    extraInputValues: {},
  };

  const next = applyForm.buildAiStrategistApplyFormState({
    currentForm,
    engines,
    selectedEngine: engines[0],
    activeMode: 't2v',
    result: {
      selectedModel: 'kling-3-pro',
      workflow: 'image-to-video',
      uiActions: [
        { type: 'SET_WORKFLOW', value: 'image-to-video' },
        { type: 'SET_DURATION', value: '12 seconds' },
        { type: 'SET_RESOLUTION', value: '1080p 16:9' },
        { type: 'SET_ASPECT_RATIO', value: '9:16' },
      ],
    },
  });

  assert.equal(next.engineId, 'kling-3-pro');
  assert.equal(next.mode, 'i2v');
  assert.equal(next.durationSec, 12);
  assert.equal(next.resolution, '1080p');
  assert.equal(next.aspectRatio, '9:16');
});

test('AI Strategist apply resolves catalog model ids and labels to real Generate Video engines', async () => {
  const applyActions = await loadApplyActionsModule();
  const engines = [
    { id: 'kling-3-pro', label: 'Kling 3 Pro' },
    { id: 'veo-3-1-lite', label: 'Google Veo 3.1 Lite' },
    { id: 'seedance-2-0', label: 'Seedance 2.0' },
  ];

  assert.equal(
    applyActions.resolveAiStrategistApplyEngineId({
      engines,
      result: {
        selectedModel: 'veo-3-1-lite',
        uiActions: [],
      },
    }),
    'veo-3-1-lite'
  );

  assert.equal(
    applyActions.resolveAiStrategistApplyEngineId({
      engines,
      result: {
        selectedModel: null,
        uiActions: [{ type: 'SET_MODEL', value: 'Kling 3 Pro' }],
      },
    }),
    'kling-3-pro'
  );

  assert.equal(
    applyActions.resolveAiStrategistApplyEngineId({
      engines,
      result: {
        selectedModel: 'seedance',
        uiActions: [{ type: 'SET_MODEL', value: 'Seedance' }],
      },
    }),
    'seedance-2-0'
  );
});

test('AI Strategist pending apply routes video prompt outputs back to Generate Video', async () => {
  const betaBridge = await loadBetaBridgeModule();
  const target = betaBridge.resolveAiStrategistApplyTarget(
    {
      workflow: 'text-to-image-then-image-to-video',
      uiActions: [{ type: 'SET_PROMPT', value: 'Prompt' }],
    },
    '/app/image'
  );

  assert.equal(target, 'video');
  assert.equal(betaBridge.getAiStrategistApplyHref(target), '/app');
});

test('AI Strategist split start-image workflow exposes image-first and video-second apply phases', async () => {
  const applyPhases = await loadApplyPhasesModule();
  const betaBridge = await loadBetaBridgeModule();
  const result = {
    ok: true,
    workflow: 'text-to-image-then-image-to-video',
    selectedModel: 'kling-3-pro',
    uiActions: [
      { type: 'SET_MODEL', value: 'kling-3-pro' },
      { type: 'SET_WORKFLOW', value: 'text-to-image-then-image-to-video' },
      { type: 'SET_PROMPT', value: 'Starting image prompt:\nProduct: sauce bottle on stone.\n\nVideo animation prompt:\nReference: use the MaxVideoAI starting image.\nMotion: slow pour.' },
      { type: 'SET_NEGATIVE_PROMPT', value: 'No unreadable text.' },
      { type: 'SET_DURATION', value: '12s' },
      { type: 'SET_RESOLUTION', value: '1080p' },
      { type: 'SET_ASPECT_RATIO', value: '16:9' },
    ],
    sanitizedFinalOutput: {
      assistantMessage: 'Prompt ready.',
      finalPrompt: 'Starting image prompt:\nProduct: sauce bottle on stone.\n\nVideo animation prompt:\nReference: use the MaxVideoAI starting image.\nMotion: slow pour.',
      negativePrompt: 'No unreadable text.',
      settings: ['12 seconds', '1080p 16:9'],
      warnings: [],
      uiActions: [],
    },
  };

  const phases = applyPhases.buildAiStrategistApplyPhases(result);

  assert.equal(phases.length, 2);
  assert.equal(phases[0].target, 'image');
  assert.equal(phases[0].label, 'Apply image prompt');
  assert.equal(phases[0].result.selectedModel, 'gpt-image-2');
  assert.equal(phases[0].result.uiActions.find((action: { type: string }) => action.type === 'SET_MODEL')?.value, 'gpt-image-2');
  assert.match(phases[0].result.uiActions.find((action: { type: string }) => action.type === 'SET_PROMPT')?.value ?? '', /Product: sauce bottle/);
  assert.doesNotMatch(phases[0].result.uiActions.map((action: { type: string }) => action.type).join(' '), /SET_DURATION|SET_WORKFLOW/);
  assert.equal(betaBridge.resolveAiStrategistApplyTarget(phases[0].result, '/app'), 'image');

  assert.equal(phases[1].target, 'video');
  assert.equal(phases[1].label, 'Apply video prompt');
  assert.equal(phases[1].result.workflow, 'image-to-video');
  assert.equal(phases[1].result.uiActions.find((action: { type: string }) => action.type === 'SET_WORKFLOW')?.value, 'image-to-video');
  assert.match(phases[1].result.uiActions.find((action: { type: string }) => action.type === 'SET_PROMPT')?.value ?? '', /Reference: use the MaxVideoAI starting image/);
  assert.equal(betaBridge.resolveAiStrategistApplyTarget(phases[1].result, '/app/image'), 'video');
});
