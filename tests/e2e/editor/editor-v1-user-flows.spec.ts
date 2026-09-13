import { expect, test, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  canvasNodeControls,
  clickTimelineTrackAtSecond,
  dragTimelineClipEnd,
  hasTimelineOverlap,
  openEditorWorkspace,
  openFreshEditorWorkspace,
  timelineClipState,
  timelineItemCount,
  timelinePixelsPerSecond,
  trackEditorClientErrors,
  type EditorClientErrors,
} from './editor-helpers';

const clientErrorsByPage = new WeakMap<Page, EditorClientErrors>();

const editorBaseUrl = process.env.PLAYWRIGHT_EDITOR_BASE_URL
  ?? `http://${process.env.PLAYWRIGHT_EDITOR_HOST ?? 'localhost'}:${process.env.PLAYWRIGHT_EDITOR_PORT ?? process.env.PORT ?? 3000}`;

test.beforeEach(async ({ page }) => {
  clientErrorsByPage.set(page, trackEditorClientErrors(page));
});

test.afterEach(async ({ page }) => {
  const errors = clientErrorsByPage.get(page);
  expect(errors).toBeDefined();
  if (errors) assertNoEditorClientErrors(errors);
});

for (const locale of ['fr', 'es'] as const) {
  test(`fresh editor startup accepts ${locale} labels`, async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'NEXT_LOCALE',
        value: locale,
        url: editorBaseUrl,
      },
    ]);

    await openFreshEditorWorkspace(page);
  });
}

async function switchWorkspaceMode(page: Page, mode: 'canvas' | 'viewer'): Promise<void> {
  const modeButtons = page.locator('header').locator('button[aria-pressed]');
  await expect(modeButtons).toHaveCount(2);
  const button = modeButtons.nth(mode === 'canvas' ? 0 : 1);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function openBlankEditorWorkspace(page: Page): Promise<void> {
  await page.route('**/api/preflight', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, currency: 'USD', total: 12 }),
    });
  });
  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.timelineRender.v1');
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
    window.localStorage.setItem('maxvideoai.editor.workspace.v1', JSON.stringify({
      nodes: [],
      edges: [],
      projectAssets: [],
      projectMediaFolders: [],
      timelineItems: [],
      activeSequenceId: 'sequence-main',
      activeTemplateId: 'product-ad',
      projectSettings: {
        aspectRatio: '16:9',
        resolution: '1080p',
        fps: 24,
      },
      focusMode: 'canvas',
      audioTrackCount: 2,
      videoTrackCount: 1,
    }));
  });
  await openEditorWorkspace(page);
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  await expect(page.locator('[data-timeline-item]')).toHaveCount(0);
}

async function placeCanvasToolbarBlock({
  page,
  menuLabel,
  blockId,
  xRatio,
  yRatio,
}: {
  page: Page;
  menuLabel: string;
  blockId: string;
  xRatio: number;
  yRatio: number;
}): Promise<string> {
  const existingIds = new Set(await page.locator('.react-flow__node').evaluateAll((nodes) => (
    nodes.map((node) => node.getAttribute('data-id')).filter((id): id is string => Boolean(id))
  )));
  await page.getByRole('button', { name: menuLabel, exact: true }).click();
  const menu = page.getByRole('menu', { name: menuLabel });
  await expect(menu).toBeVisible();
  const block = menu.locator(`[data-canvas-toolbar-block-id="${blockId}"]`);
  await block.scrollIntoViewIfNeeded();
  const blockBox = await block.boundingBox();
  const canvasBox = await page.locator('.react-flow').boundingBox();
  expect(blockBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!blockBox) throw new Error(`Toolbar block ${blockId} is not measurable.`);
  if (!canvasBox) throw new Error('Canvas is not measurable.');
  await page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    canvasBox.x + canvasBox.width * xRatio,
    canvasBox.y + canvasBox.height * yRatio,
    { steps: 12 }
  );
  await page.mouse.up();

  await expect.poll(() => page.locator('.react-flow__node').count()).toBe(existingIds.size + 1);
  const nextIds = await page.locator('.react-flow__node').evaluateAll((nodes) => (
    nodes.map((node) => node.getAttribute('data-id')).filter((id): id is string => Boolean(id))
  ));
  const createdId = nextIds.find((id) => !existingIds.has(id));
  expect(createdId).toBeTruthy();
  if (!createdId) throw new Error(`Toolbar block ${blockId} did not create a node.`);
  return createdId;
}

async function connectCanvasHandles({
  page,
  sourceNodeId,
  targetNodeId,
  handleId,
}: {
  page: Page;
  sourceNodeId: string;
  targetNodeId: string;
  handleId: string;
}): Promise<void> {
  await page.getByRole('button', { name: 'Fit canvas' }).click();
  const sourceHandle = page.locator(
    `.react-flow__node[data-id="${sourceNodeId}"] .react-flow__handle[data-handleid="${handleId}"]`
  );
  const targetHandle = page.locator(
    `.react-flow__node[data-id="${targetNodeId}"] .react-flow__handle[data-handleid="${handleId}"]`
  );
  await expect(sourceHandle).toBeVisible();
  await expect(targetHandle).toBeVisible();
  const canvas = page.locator('[data-studio-canvas-shell="true"]');
  await expect.poll(async () => {
    const canvasBox = await canvas.boundingBox();
    const sourceBox = await sourceHandle.boundingBox();
    const targetBox = await targetHandle.boundingBox();
    if (!canvasBox || !sourceBox || !targetBox) return false;
    const containsCenter = (box: { x: number; y: number; width: number; height: number }) => {
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      return centerX >= canvasBox.x && centerX <= canvasBox.x + canvasBox.width &&
        centerY >= canvasBox.y && centerY <= canvasBox.y + canvasBox.height;
    };
    return containsCenter(sourceBox) && containsCenter(targetBox);
  }).toBe(true);
  const sourceBox = await sourceHandle.boundingBox();
  const targetBox = await targetHandle.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !targetBox) throw new Error('Canvas handles are not measurable.');
  await sourceHandle.dragTo(targetHandle);
}

test('blank project creates a connected multi-output image workflow and inserts typed media', async ({ page }) => {
  await openBlankEditorWorkspace(page);

  const promptNodeId = await placeCanvasToolbarBlock({
    page,
    menuLabel: 'Add',
    blockId: 'free-text',
    xRatio: 0.12,
    yRatio: 0.4,
  });
  const promptNode = page.locator(`.react-flow__node[data-id="${promptNodeId}"]`);
  await promptNode.locator('textarea').fill('A clean red studio chair on a white cyclorama.');

  const imageNodeId = await placeCanvasToolbarBlock({
    page,
    menuLabel: 'Add',
    blockId: 'generate-image',
    xRatio: 0.82,
    yRatio: 0.58,
  });
  const imageNode = page.locator(`.react-flow__node[data-id="${imageNodeId}"]`);
  await connectCanvasHandles({
    page,
    sourceNodeId: promptNodeId,
    targetNodeId: imageNodeId,
    handleId: 'prompt',
  });
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);

  const nodeControls = await canvasNodeControls(page, imageNode);
  await nodeControls.locator('[data-canvas-node-inspect-button]').click();
  const inspector = page.locator('[data-studio-canvas-inspector="true"]');
  await expect(inspector).toBeVisible();
  const outputCountSelect = inspector.locator('select:has(option[value="4"])');
  await outputCountSelect.selectOption('4');
  await expect(outputCountSelect).toHaveValue('4');
  await page.locator('[data-canvas-inspector-close]').click();

  const generateButton = imageNode.locator('button:has([data-shot-generate-label="true"])');
  await expect(generateButton).toBeEnabled();
  await generateButton.click();

  const outputNodes = page.locator('.react-flow__node:has([data-timeline-node-drag-kind="image"])');
  await expect(outputNodes).toHaveCount(4);
  const outputNodeIds = await outputNodes.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-id')));
  const outputIdPattern = new RegExp(`^output-${imageNodeId}-[0-9a-f]{16}$`);
  expect(new Set(outputNodeIds).size).toBe(4);
  expect(outputNodeIds.every((outputNodeId) => outputNodeId !== null && outputIdPattern.test(outputNodeId))).toBe(true);

  await switchWorkspaceMode(page, 'viewer');
  const projectAssets = page.locator('[data-project-media-asset-id]');
  await expect(projectAssets).toHaveCount(4);
  const typedAssets = await projectAssets.evaluateAll((assets) => assets.map((asset) => ({
    id: asset.getAttribute('data-project-media-asset-id'),
    kind: asset.getAttribute('data-project-media-drag-kind'),
  })));
  expect(new Set(typedAssets.map((asset) => asset.id)).size).toBe(4);
  expect(typedAssets.every((asset) => asset.kind === 'image')).toBe(true);
  expect(new Set(typedAssets.map((asset) => asset.id))).toEqual(
    new Set(outputNodeIds.map((outputNodeId) => `asset-${outputNodeId}`))
  );

  await projectAssets.first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert at playhead' }).click();
  await expect(page.locator('[data-timeline-item]')).toHaveCount(1);
  await expect(page.locator('[data-timeline-item]')).toHaveAttribute('data-timeline-track-id', 'video');
  await expect.poll(() => hasTimelineOverlap(page, 'video')).toBe(false);
});

test('creator generates a fixture shot in mock mode and sends its output to the timeline', async ({ page }) => {
  await openEditorWorkspace(page);
  await page.evaluate(() => {
    window.localStorage.removeItem('maxvideoai.editor.workspace.v1');
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
  });
  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Start Product Ad/ }).click();
  await expect(page).toHaveURL(/\/app\/studio\/workspace\/project_/);

  const shotNode = page.locator('.react-flow__node[data-id="shot-01"]');
  const generateButton = shotNode.locator('button:has([data-shot-generate-label="true"])');

  await expect(generateButton).toBeEnabled();
  await generateButton.click();
  await expect(page.locator('[data-editor-status="true"]')).toContainText('Seedance 2.0');
  const outputNode = page.locator('.react-flow__node[data-id^="output-shot-01-"]');
  await expect(outputNode).toHaveCount(1);
  const sendToTimelineButton = outputNode.getByRole('button', { name: 'Insert at playhead' });
  await expect(sendToTimelineButton).toBeEnabled();

  await switchWorkspaceMode(page, 'viewer');
  const initialTimelineItems = await timelineItemCount(page);
  await clickTimelineTrackAtSecond(page, 'video', 13);

  await switchWorkspaceMode(page, 'canvas');
  await sendToTimelineButton.click();

  await switchWorkspaceMode(page, 'viewer');
  const timeline = page.getByLabel(/Video timeline|Timeline vidéo|Línea de tiempo de vídeo/i);
  await expect.poll(() => timelineItemCount(page)).toBeGreaterThan(initialTimelineItems);
  await expect(timeline.locator('[data-timeline-item][data-selected="true"]')).toHaveCount(1);
  await expect.poll(() => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect(page.getByRole('complementary', { name: /Project media library|Bibliothèque des médias du projet|Biblioteca de medios del proyecto/i })).toBeVisible();
});

test('editor trims linked fixture clips and verifies active-sequence export readiness', async ({ page }) => {
  await openFreshEditorWorkspace(page);
  await switchWorkspaceMode(page, 'viewer');

  const videoClip = page.locator('[data-timeline-item="timeline-output-02"]');
  const audioClip = page.locator('[data-timeline-item="timeline-output-02-audio"]');
  await expect(videoClip).toHaveAttribute('data-linked-group', 'timeline-output-02');
  await expect(audioClip).toHaveAttribute('data-linked-group', 'timeline-output-02');
  const initialDuration = (await timelineClipState(page, 'timeline-output-02')).duration;
  expect(initialDuration).toBeGreaterThan(2);

  await dragTimelineClipEnd(page, 'timeline-output-02', -2 * await timelinePixelsPerSecond(page));
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(initialDuration - 2);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).duration).toBe(initialDuration - 2);
  await expect.poll(() => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(() => hasTimelineOverlap(page, 'audio')).toBe(false);

  const timeline = page.getByLabel(/Video timeline|Timeline vidéo|Línea de tiempo de vídeo/i);
  await timeline.getByRole('button', { name: /Open export dialog|Ouvrir la boîte de dialogue d’exportation|Abrir diálogo de exportación/i }).click();
  const exportDialog = page.getByRole('dialog', { name: /Export sequence|Exporter la séquence|Exportar secuencia/i });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.locator('[data-status="pass"]')).toHaveCount(4);
  await expect(exportDialog.locator('[data-status="blocking"]')).toHaveCount(0);
  await expect(exportDialog.getByRole('button', { name: /Export video|Exporter la vidéo|Exportar vídeo/i })).toBeEnabled();
});
