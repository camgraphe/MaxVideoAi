import { expect, test, type Page, type Route } from '@playwright/test';

type AssistantResponseOverrides = Record<string, unknown>;

test.describe('AI Assistant beta live UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
  });

  test('sidebar launcher opens the assistant and supports drag and resize', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await prepareAppForAssistantTest(page);

    await openAssistantFromSidebar(page);
    const widget = page.getByTestId('app-ai-strategist-widget');
    await expect(widget).toContainText('AI Video Assistant');
    await expect(page.getByPlaceholder('Ask the AI Assistant...')).toBeVisible();

    const beforeDrag = await widget.boundingBox();
    expect(beforeDrag).not.toBeNull();
    await page.mouse.move(beforeDrag!.x + 180, beforeDrag!.y + 28);
    await page.mouse.down();
    await page.mouse.move(beforeDrag!.x + 310, beforeDrag!.y + 92, { steps: 5 });
    await page.mouse.up();
    const afterDrag = await widget.boundingBox();
    expect(afterDrag).not.toBeNull();
    expect(Math.abs(afterDrag!.x - beforeDrag!.x) + Math.abs(afterDrag!.y - beforeDrag!.y)).toBeGreaterThan(40);

    const resizeHandle = page.getByRole('button', { name: 'Resize AI Assistant' });
    const beforeResize = await widget.boundingBox();
    const handleBox = await resizeHandle.boundingBox();
    expect(beforeResize).not.toBeNull();
    expect(handleBox).not.toBeNull();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox!.x + 120, handleBox!.y + 60, { steps: 5 });
    await page.mouse.up();
    const afterResize = await widget.boundingBox();
    expect(afterResize).not.toBeNull();
    expect(afterResize!.width).toBeGreaterThan(beforeResize!.width + 40);
  });

  test('prompt helper opens prompt assistant mode from the generator prompt panel', async ({ page }) => {
    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await prepareAppForAssistantTest(page);
    await generatorPrompt(page).fill('Perfume bottle on marble, cinematic');

    await page.getByRole('button', { name: 'Open AI Assistant prompt helper' }).click();

    const widget = page.getByTestId('app-ai-strategist-widget');
    await expect(widget).toBeVisible();
    await expect(widget).toContainText('Prompt assistant mode');
    await expect(widget).toContainText('current prompt from Generate Video');
  });

  test('recommendation cards are clickable and send the selected tier and model', async ({ page }) => {
    const postedPayloads: unknown[] = [];
    await page.route('**/api/ai-video-strategist/beta', async (route) => {
      const payload = route.request().postDataJSON();
      postedPayloads.push(payload);
      const isChoice = payload?.selectedTier === 'best' || payload?.selectedModel === 'veo-3-1';
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(
          isChoice
            ? buildAssistantResponse({
                assistantMessage: 'Before I build it, quick direction check.',
                conversationStage: 'collecting_missing_fields',
                selectedTier: 'best',
                selectedModel: 'veo-3-1',
                briefCompletion: {
                  resolvedBrief: 'dynamic cinematic car commercial',
                  selectedModel: 'veo-3-1',
                  selectedTier: 'best',
                  selectedWorkflow: 'text-to-video',
                  missingFields: [
                    { id: 'camera', label: 'Camera', question: 'What camera move should I use?' },
                  ],
                  assumptions: [],
                  confirmationSummary: null,
                },
                recommendations: undefined,
              })
            : buildRecommendationResponse()
        ),
      });
    });

    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await prepareAppForAssistantTest(page);
    await openAssistantFromSidebar(page);
    await sendAssistantMessage(page, 'dynamic cinematic car commercial');

    await expect(page.getByRole('button', { name: /Best.*Veo 3\.1/s })).toBeVisible();
    await page.getByRole('button', { name: /Best.*Veo 3\.1/s }).click();

    await expect(page.getByTestId('app-ai-strategist-widget')).toContainText(/quick direction check/i);
    expect(postedPayloads).toHaveLength(2);
    expect(postedPayloads[1]).toMatchObject({ selectedTier: 'best', selectedModel: 'veo-3-1' });
  });

  test('enter submits chat and Apply to generator updates the live prompt without generation', async ({ page }) => {
    const generatedPrompt =
      'Subject: premium glass perfume bottle on black marble\nAction: slow hero reveal with controlled reflections\nCamera: 9:16 slow push-in\nStyle: premium commercial lighting';
    const blockedGenerateCalls: string[] = [];

    await page.route('**/api/generate', async (route) => {
      blockedGenerateCalls.push(route.request().url());
      await route.abort();
    });
    await page.route('**/api/ai-video-strategist/beta', async (route) => {
      await fulfillPromptReady(route, generatedPrompt);
    });

    await page.goto('/app', { waitUntil: 'domcontentloaded' });
    await prepareAppForAssistantTest(page);
    await generatorPrompt(page).fill('Perfume bottle on marble, cinematic');
    await page.getByRole('button', { name: 'Open AI Assistant prompt helper' }).click();
    await sendAssistantMessage(page, 'make it premium with product detail');

    await expect(page.getByText('Prompt ready. Review it below')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply to generator' })).toBeVisible();
    await page.getByRole('button', { name: 'Apply to generator' }).click();

    await expect(generatorPrompt(page)).toHaveValue(generatedPrompt);
    await expect(page.locator('body')).toContainText('Assistant applied the preview to the generator');
    expect(blockedGenerateCalls).toEqual([]);
  });

  test('Apply from another workspace redirects to Generate Video and applies preview actions', async ({ page }) => {
    const generatedPrompt =
      'Subject: cinematic product reveal for a premium video ad\nAction: controlled hero movement with clean reflections\nCamera: 9:16 slow push-in\nStyle: polished commercial lighting';
    const blockedGenerateCalls: string[] = [];

    await page.route('**/api/generate', async (route) => {
      blockedGenerateCalls.push(route.request().url());
      await route.abort();
    });
    await page.route('**/api/ai-video-strategist/beta', async (route) => {
      await fulfillPromptReady(route, generatedPrompt);
    });

    await page.goto('/app/image', { waitUntil: 'domcontentloaded' });
    await prepareAppForAssistantTest(page);
    await openAssistantFromSidebar(page);
    await sendAssistantMessage(page, 'build this as a video ad prompt');

    await expect(page.getByText('Prompt ready. Review it below')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply in generator' })).toBeVisible();
    await page.getByRole('button', { name: 'Apply in generator' }).click();

    await expect(page).toHaveURL(/\/app(?:\?.*)?$/);
    await expect(generatorPrompt(page)).toHaveValue(generatedPrompt, { timeout: 30000 });
    await expect(page.locator('body')).toContainText('Assistant applied the preview to the generator');
    expect(blockedGenerateCalls).toEqual([]);
  });
});

async function openAssistantFromSidebar(page: Page) {
  const trigger = page.getByTestId('app-ai-strategist-sidebar-trigger');
  await expect(trigger).toBeVisible();
  await trigger.scrollIntoViewIfNeeded();
  const widget = page.getByTestId('app-ai-strategist-widget');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await trigger.click();
    if (await widget.isVisible().catch(() => false)) break;
    await page.waitForTimeout(250);
  }
  await expect(widget).toBeVisible();
}

async function sendAssistantMessage(page: Page, message: string) {
  const chatInput = page.getByPlaceholder('Ask the AI Assistant...');
  await expect(chatInput).toBeVisible();
  await chatInput.fill(message);
  await chatInput.press('Enter');
}

function generatorPrompt(page: Page) {
  return page.locator('main textarea').first();
}

async function prepareAppForAssistantTest(page: Page) {
  await expect(generatorPrompt(page)).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: /reject all|accept all/i }).first().click({ timeout: 1000 }).catch(() => {});
}

async function fulfillPromptReady(route: Route, finalPrompt: string) {
  await route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(
      buildAssistantResponse({
        mode: 'build_prompt',
        assistantMessage: 'Prompt ready.',
        conversationStage: 'prompt_ready',
        selectedModel: 'kling-3-pro',
        selectedTier: 'best',
        workflow: 'text-to-image-then-image-to-video',
        sanitizedFinalOutput: {
          assistantMessage: 'Prompt ready.',
          finalPrompt,
          negativePrompt: 'blurry product, warped bottle, unreadable label, shaky camera',
          settings: ['Aspect ratio: 9:16', 'Duration: 8 seconds', 'Resolution: 1080p'],
          warnings: ['Exact labels, logos, legal copy, and tiny text may drift and should be checked after generation or added as overlays.'],
          uiActions: [
            { type: 'SET_MODEL', value: 'kling-3-pro' },
            { type: 'SET_PROMPT', value: finalPrompt },
            { type: 'SET_NEGATIVE_PROMPT', value: 'blurry product, warped bottle, unreadable label, shaky camera' },
            { type: 'SET_ASPECT_RATIO', value: '9:16' },
            { type: 'SET_DURATION', value: '8' },
            { type: 'SET_RESOLUTION', value: '1080p' },
          ],
        },
        uiActions: [
          { type: 'SET_MODEL', value: 'kling-3-pro' },
          { type: 'SET_PROMPT', value: finalPrompt },
          { type: 'SET_NEGATIVE_PROMPT', value: 'blurry product, warped bottle, unreadable label, shaky camera' },
          { type: 'SET_ASPECT_RATIO', value: '9:16' },
          { type: 'SET_DURATION', value: '8' },
          { type: 'SET_RESOLUTION', value: '1080p' },
        ],
      })
    ),
  });
}

function buildRecommendationResponse() {
  return buildAssistantResponse({
    assistantMessage: 'I understand this as: dynamic cinematic car commercial.',
    conversationStage: 'awaiting_model_choice',
    workflow: 'text-to-video',
    recommendations: {
      best: recommendation('veo-3-1', 'Veo 3.1', 'Premium cinematic realism and polished motion.'),
      medium: recommendation('seedance-2-0', 'Seedance 2.0', 'Balanced motion and social-friendly speed.'),
      value: recommendation('seedance-2-0-fast', 'Seedance 2.0 Fast', 'Fast value option for quick iteration.'),
    },
  });
}

function buildAssistantResponse(overrides: AssistantResponseOverrides = {}) {
  const base = {
    ok: true,
    assistantMessage: 'I can help with that.',
    mode: 'recommend',
    workflow: 'text-to-video',
    selectedModel: null,
    selectedTier: null,
    normalizedBrief: {
      rawUserMessage: 'dynamic cinematic car commercial',
      normalizedBrief: 'dynamic cinematic car commercial',
      intent: 'cinematic_scene',
      workflowHint: 'text-to-video',
      hasProduct: true,
      hasPerson: false,
      hasCharacter: false,
      hasUploadedReference: false,
      hasVisibleSpeaker: false,
      hasVoiceover: false,
      hasDialogue: false,
      hasLipSyncIntent: false,
      hasLogoOrTextRisk: false,
      aspectRatioHint: '16:9',
      qualityIntent: 'premium',
      platformHint: 'ad',
      styleHints: ['cinematic'],
      constraints: [],
      confidence: 0.92,
    },
    normalizationSource: 'deterministic',
    normalizationConfidence: 0.92,
    conversationStage: 'awaiting_model_choice',
    conversationPlan: {
      action: 'recommend_models',
      rawUserMessage: 'dynamic cinematic car commercial',
      shouldUsePreviousBrief: false,
      shouldUseCurrentPrompt: false,
      confidence: 0.9,
    },
    orchestrationPlan: {
      task: 'creative_advisor',
      stage: 'awaiting_model_choice',
      costPolicy: 'deterministic_first',
      requiresPromptWriter: false,
    },
    warnings: [],
    uiActions: [],
    llm: {
      briefRefinementUsed: false,
      promptWriterUsed: false,
      sanitizerChangedOutput: false,
    },
    safety: {
      autoGeneration: false,
      creditSpend: false,
      publishing: false,
      uiActionsApplied: false,
    },
  };
  return { ...base, ...overrides };
}

function recommendation(id: string, label: string, reason: string) {
  return {
    model: {
      id,
      label,
      relativeCostLevel: id.includes('fast') ? 'low' : 'medium',
      relativeSpeedLevel: id.includes('fast') ? 'very-fast' : 'fast',
      qualityLevel: id === 'veo-3-1' ? 'premium' : 'high',
    },
    reason,
  };
}
