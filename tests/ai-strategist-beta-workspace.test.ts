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
const widgetPath = `${root}/frontend/components/ai-strategist/AiStrategistBetaSidebarWidget.tsx`;
const betaBridgePath = `${root}/frontend/lib/ai-strategist/beta-bridge.ts`;

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
  assert.equal(existsSync(widgetPath), true);
  assert.equal(existsSync(betaBridgePath), true);

  const appSidebarSource = readFileSync(appSidebarPath, 'utf8');
  const readyViewSource = readFileSync(readyViewPath, 'utf8');
  const composerSurfaceSource = readFileSync(composerSurfacePath, 'utf8');
  const composerSource = readFileSync(composerPath, 'utf8');
  const composerTypesSource = readFileSync(composerTypesPath, 'utf8');
  const bridgeSource = readFileSync(bridgePath, 'utf8');
  const widgetSource = readFileSync(widgetPath, 'utf8');
  const betaBridgeSource = readFileSync(betaBridgePath, 'utf8');
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
  assert.match(widgetSource, /Est\. assistant LLM/);
  assert.match(widgetSource, /formatConversationLlmCost/);
  assert.match(widgetSource, /storePendingAiStrategistApply/);
  assert.match(widgetSource, /window\.location\.assign/);
  assert.match(betaBridgeSource, /AI_STRATEGIST_PENDING_APPLY_STORAGE_KEY/);
  assert.match(betaBridgeSource, /resolveAiStrategistApplyTarget/);
  assert.match(betaBridgeSource, /consumePendingAiStrategistApply/);
  assert.match(bridgeSource, /consumePendingAiStrategistApply\('video'\)/);
  assert.match(bridgeSource, /SET_PROMPT/);
  assert.match(bridgeSource, /SET_NEGATIVE_PROMPT/);
  assert.match(bridgeSource, /SET_MODEL/);
  assert.match(bridgeSource, /SET_DURATION/);
  assert.match(bridgeSource, /SET_ASPECT_RATIO/);
  assert.doesNotMatch(widgetSource, /startRender/);
  assert.doesNotMatch(bridgeSource, /startRender/);
  assert.doesNotMatch(widgetSource, /\/api\/admin\/ai-strategist-playground/);
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
