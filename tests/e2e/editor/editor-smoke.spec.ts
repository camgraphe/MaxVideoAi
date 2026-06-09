import { expect, test, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  canvasNodeCount,
  dropProjectMediaAssetOnTimelineTrack,
  openEditorWorkspace,
  openFreshEditorWorkspace,
  switchEditorFocus,
  timelineItemCount,
  trackEditorClientErrors,
} from './editor-helpers';

type LocalFileDropFixture = {
  name: string;
  type: string;
  content: string;
};

async function dropLocalFileOnCanvas(
  page: Page,
  fixture: LocalFileDropFixture,
  targetSelector = '.react-flow',
  ratio = { x: 0.5, y: 0.42 }
): Promise<void> {
  const target = page.locator(targetSelector).first();
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await target.evaluate(
    (element, { clientX, clientY, file }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([file.content], file.name, { type: file.type }));
      element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    },
    {
      clientX: box.x + box.width * ratio.x,
      clientY: box.y + box.height * ratio.y,
      file: fixture,
    }
  );
}

async function pasteTextOnCanvas(page: Page, text: string): Promise<void> {
  await page.locator('.react-flow').evaluate((element, pastedText) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', pastedText);
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer }));
  }, text);
}

async function mockStudioPersistenceApi(page: Page): Promise<void> {
  await page.route('**/api/studio/canvas-templates', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as { template?: Record<string, unknown> } | null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, template: payload?.template ?? {} }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, templates: [] }),
    });
  });
  await page.route('**/api/studio/canvas-templates/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route('**/api/studio/projects', async (route) => {
    if (route.request().method() === 'POST') {
      const now = new Date().toISOString();
      const payload = route.request().postDataJSON() as { project?: Record<string, unknown> } | null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          project: {
            createdAt: now,
            updatedAt: now,
            ...payload?.project,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, projects: [] }),
    });
  });
  await page.route('**/api/studio/projects/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false }),
    });
  });
}

async function dismissCookieBanner(page: Page): Promise<void> {
  for (const label of ['Reject all', 'Accept all']) {
    const consentButton = page.getByRole('button', { name: label }).first();
    await consentButton.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
    if (await consentButton.isVisible().catch(() => false)) {
      await consentButton.click();
      return;
    }
  }
}

test.beforeEach(async ({ page }) => {
  await mockStudioPersistenceApi(page);
});

test('MaxVideoAI editor loads canvas, viewer, and timeline without client errors', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  const initialTimelineItems = await timelineItemCount(page);
  expect(initialTimelineItems).toBeGreaterThan(0);
  await expect(page.getByLabel('Studio account status')).toBeVisible();
  await expect(page.getByLabel(/Studio wallet balance/)).toBeVisible();
  await expect(page.getByText('Block templates')).toBeVisible();
  await expect(page.getByText('Canvas templates', { exact: true })).toBeVisible();

  await switchEditorFocus(page, 'Viewer');
  await expect(page.getByRole('complementary', { name: 'Project media library' })).toBeVisible();
  await expect(page.getByText('Project media')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import media' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New folder' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New sequence' })).toBeVisible();
  await expect(page.getByText('Block templates')).toHaveCount(0);
  await expect(page.getByText('Canvas templates', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('editor-video-viewer')).toBeVisible();
  await expect(page.getByTestId('editor-program-monitor')).toBeVisible();
  await expect(page.getByTestId('editor-program-frame')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play timeline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blade / Cut tool' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle snapping' })).toBeVisible();
  expect(await timelineItemCount(page)).toBe(initialTimelineItems);

  await switchEditorFocus(page, 'Canvas');
  await expect(page.getByText('Block templates')).toBeVisible();
  await expect(page.getByText('Canvas templates', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Project media library' })).toHaveCount(0);
  expect(await timelineItemCount(page)).toBe(initialTimelineItems);

  assertNoEditorClientErrors(errors);
});

test('viewer mode can create and switch between multiple sequences', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const initialTimelineItems = await timelineItemCount(page);
  expect(initialTimelineItems).toBeGreaterThan(0);
  await expect(page.locator('[data-project-sequence-id]')).toHaveCount(1);
  await expect(page.locator('[data-project-sequence-id="sequence-main"]')).toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-project-sequence-create="true"]').click();

  await expect(page.locator('[data-project-sequence-id]')).toHaveCount(2);
  const secondSequence = page.locator('[data-project-sequence-id]', { hasText: 'Sequence 2' });
  await expect(secondSequence).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timelineItemCount(page)).toBe(0);

  await page.locator('[data-project-sequence-id="sequence-main"]').click();
  await expect(page.locator('[data-project-sequence-id="sequence-main"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems);

  await secondSequence.click();
  await expect(secondSequence).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timelineItemCount(page)).toBe(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByText('MaxVideoAI Editor')).toBeVisible();
  await switchEditorFocus(page, 'Viewer');
  await expect(page.locator('[data-project-sequence-id]')).toHaveCount(2);
  await expect(page.locator('[data-project-sequence-id]', { hasText: 'Sequence 2' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => timelineItemCount(page)).toBe(0);

  await page.locator('[data-project-sequence-id="sequence-main"]').click();
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems);

  assertNoEditorClientErrors(errors);
});

test('viewer project media import inserts a library asset into the timeline', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/media-library/assets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        assets: [
          {
            id: 'client-board',
            url: '/storyboard/examples/storyboarder-product-reference.jpg',
            thumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
            kind: 'image',
            width: 2048,
            height: 2048,
            source: 'upload',
          },
        ],
      }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const initialTimelineItems = await timelineItemCount(page);
  await page.getByRole('button', { name: 'Import media' }).click();
  await expect(page.getByRole('dialog', { name: 'Import project media' })).toBeVisible();
  await page.getByRole('button', { name: 'Use storyboarder-product-reference.jpg' }).click();
  await expect(page.getByText('storyboarder-product-reference.jpg imported into Project media.')).toBeVisible();

  const importedCard = page.locator('[data-project-media-asset-id]', { hasText: 'storyboarder-product-reference.jpg' });
  await expect(importedCard).toBeVisible();
  await importedCard.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Insert at playhead' }).click();

  await expect(page.getByText('storyboarder-product-reference.jpg inserted at the playhead')).toBeVisible();
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems + 1);
  await expect(page.getByRole('button', { name: 'Viewer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  assertNoEditorClientErrors(errors);
});

test('viewer project media can be dragged into a compatible timeline track', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/media-library/assets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        assets: [
          {
            durationSec: 8,
            id: 'client-drag-video',
            mediaType: 'asset-video',
            mimeType: 'video/mp4',
            thumbUrl: '/assets/marketing/reference-workflow-final-video.webp',
            url: '/assets/gallery/aerial-road.mp4',
            width: 1920,
            height: 1080,
            source: 'upload',
          },
        ],
      }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const initialTimelineItems = await timelineItemCount(page);
  await page.getByRole('button', { name: 'Add video track' }).click();
  await page.getByRole('button', { name: 'Import media' }).click();
  await page.getByRole('button', { name: 'Use aerial-road.mp4' }).click();
  await expect(page.getByText('aerial-road.mp4 imported into Project media.')).toBeVisible();

  const importedVideoCard = page.locator('[data-project-media-asset-id]', { hasText: 'aerial-road.mp4' }).first();
  await expect(importedVideoCard).toHaveAttribute('data-project-media-drag-kind', 'video');
  await expect(importedVideoCard).toHaveAttribute('data-project-media-duration-sec', '8');
  const videoLane = page.locator('[data-timeline-track="video-2"]');
  const videoLaneBox = await videoLane.boundingBox();
  expect(videoLaneBox).not.toBeNull();
  if (videoLaneBox) {
    await videoLane.evaluate((target, { clientX, clientY }) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('application/x-maxvideoai-timeline-node', JSON.stringify({
        assetId: 'client-drag-video',
        durationSec: 8,
        mediaKind: 'video',
        title: 'aerial-road.mp4',
      }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    }, {
      clientX: videoLaneBox.x + 120,
      clientY: videoLaneBox.y + videoLaneBox.height / 2,
    });
    const dropGhost = page.locator('[data-timeline-external-drop-ghost="true"]');
    await expect(dropGhost).toHaveAttribute('data-timeline-external-drop-kind', 'video');
    await expect(dropGhost).toHaveAttribute('data-timeline-external-drop-duration', '8');
    await expect(dropGhost).toContainText('aerial-road.mp4');
    await expect(dropGhost).toContainText('0:08');
  }

  await dropProjectMediaAssetOnTimelineTrack(page, 'aerial-road.mp4', 'video-2', 1);

  await expect(page.getByText('aerial-road.mp4 dropped on video-2')).toBeVisible();
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems + 2);
  assertNoEditorClientErrors(errors);
});

test('viewer project media upload imports local audio into the project bin', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.route('**/api/uploads/audio', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        asset: {
          id: 'uploaded-local-audio',
          url: '/studio/demo-ambient.wav',
          kind: 'audio',
          mime: 'audio/wav',
          durationSec: 11,
          source: 'upload',
        },
      }),
    });
  });

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const initialTimelineItems = await timelineItemCount(page);
  await page.getByRole('button', { name: 'Add audio track' }).click();
  const targetAudioTrack = await page.locator('[data-timeline-track]').evaluateAll((tracks) => {
    const audioTracks = tracks
      .map((track) => track.getAttribute('data-timeline-track'))
      .filter((track): track is string => Boolean(track?.startsWith('audio')));
    return audioTracks[audioTracks.length - 1] ?? 'audio';
  });

  await page.getByRole('button', { name: 'Import media' }).click();
  await expect(page.getByRole('dialog', { name: 'Import project media' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible();
  await page.locator('input[accept="image/*,video/*,audio/*"]').setInputFiles({
    name: 'voiceover.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF0000WAVEfmt '),
  });

  await expect(page.getByText('demo-ambient.wav imported into Project media.')).toBeVisible();
  await dropProjectMediaAssetOnTimelineTrack(page, 'demo-ambient.wav', targetAudioTrack, 1);

  await expect(page.getByText(`demo-ambient.wav dropped on ${targetAudioTrack}`)).toBeVisible();
  await expect.poll(() => timelineItemCount(page)).toBe(initialTimelineItems + 1);
  assertNoEditorClientErrors(errors);
});

test('studio projects page creates a project-scoped clean workspace', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
  });
  await page.goto('/app/studio/projects', { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  await expect(page.getByRole('heading', { name: 'Studio projects' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible();
  const createProjectButton = page.getByRole('button', { name: 'New project' });
  await expect(createProjectButton).toBeEnabled();
  await page.getByLabel('Project name').fill('Client Cut');
  await page.getByLabel('Ratio').selectOption('9:16');
  await page.getByLabel('Resolution').selectOption('720p');
  await page.getByLabel('FPS').selectOption('24');
  await page.getByLabel('Canvas template').selectOption('dev-blocks');
  await createProjectButton.click();

  await expect(page).toHaveURL(/\/app\/studio\/workspace\/project_/);
  await expect(page.locator('header').getByText('MaxVideoAI Editor')).toBeVisible();
  await expect(page.getByText('Client Cut project loaded with a clean sequence.')).toBeVisible();
  await expect.poll(() => timelineItemCount(page)).toBe(0);
  await expect(page.locator('.react-flow__node', { hasText: 'Dev Image Block' })).toBeVisible();

  await switchEditorFocus(page, 'Viewer');
  await expect(page.locator('[data-project-media-card="sequence:sequence-main"]')).toContainText('00:00 • 0 clips • 9:16');
  await expect(page.getByText('9:16 · 720x1280 · 24 fps')).toBeVisible();
  assertNoEditorClientErrors(errors);
});

test('canvas templates can be saved and applied without changing the timeline', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const initialTimelineItems = await timelineItemCount(page);
  const savedNodeCount = await canvasNodeCount(page);
  await page.getByLabel('Canvas template name').fill('Saved graph');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved graph saved as a canvas template.')).toBeVisible();
  const savedTemplateButton = page.locator('[class*="myCanvasTemplateMain"]', { hasText: 'Saved graph' });
  await expect(savedTemplateButton).toBeVisible();

  const promptTemplate = page.locator('[data-block-template-kind="text-prompt"]');
  const canvas = page.locator('.react-flow');
  const templateBox = await promptTemplate.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(templateBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!templateBox || !canvasBox) return;

  await page.mouse.move(templateBox.x + templateBox.width / 2, templateBox.y + templateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.58, canvasBox.y + canvasBox.height * 0.35, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => canvasNodeCount(page)).toBe(savedNodeCount + 1);

  await savedTemplateButton.click();
  await expect.poll(() => canvasNodeCount(page)).toBe(savedNodeCount);
  expect(await timelineItemCount(page)).toBe(initialTimelineItems);
  assertNoEditorClientErrors(errors);
});

test('canvas map stays a full graph miniature while zooming the canvas', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const map = page.locator('[data-canvas-miniature-map="true"]');
  const canvasNodes = await canvasNodeCount(page);
  await expect(map).toBeVisible();
  await expect(map).toHaveAttribute('data-node-count', String(canvasNodes));
  expect(await map.locator('[data-canvas-mini-node]').count()).toBe(canvasNodes);
  expect(Number(await map.getAttribute('data-edge-count'))).toBeGreaterThan(0);
  expect(Math.abs(Number(await map.getAttribute('data-content-center-x')) - 82)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(Number(await map.getAttribute('data-content-center-y')) - 41)).toBeLessThanOrEqual(1.5);
  await expect(map.locator('[data-canvas-mini-edge]').first()).toBeVisible();
  await expect(map.locator('[data-canvas-mini-viewport="true"]')).toBeVisible();
  await expect(page.locator('.react-flow__minimap')).toHaveCount(0);

  await page.getByRole('button', { name: 'Zoom in canvas' }).click();
  await page.getByRole('button', { name: 'Zoom in canvas' }).click();

  await expect(map).toHaveAttribute('data-node-count', String(canvasNodes));
  expect(await map.locator('[data-canvas-mini-node]').count()).toBe(canvasNodes);
  await expect(map.locator('[data-canvas-mini-viewport="true"]')).toBeVisible();

  const flowViewport = page.locator('.react-flow__viewport');
  const beforeTransform = await flowViewport.evaluate((element) => getComputedStyle(element).transform);
  const mapBox = await map.boundingBox();
  const viewportBox = await map.locator('[data-canvas-mini-viewport="true"]').boundingBox();
  expect(mapBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  if (!mapBox || !viewportBox) return;

  const startX = viewportBox.x + viewportBox.width / 2;
  const startY = viewportBox.y + viewportBox.height / 2;
  const deltaX = startX < mapBox.x + mapBox.width / 2 ? 34 : -34;
  const deltaY = startY < mapBox.y + mapBox.height / 2 ? 18 : -18;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => flowViewport.evaluate((element) => getComputedStyle(element).transform)).not.toBe(beforeTransform);
  assertNoEditorClientErrors(errors);
});

test('audio block connector drag does not start a timeline block drag', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const audioConnector = page.locator('.react-flow__node[data-id="audio-music-01"] .react-flow__handle[data-handleid="audio"]');
  await expect(audioConnector).toBeVisible();

  const dragResult = await audioConnector.evaluate((handle) => {
    const dataTransfer = new DataTransfer();
    const event = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });
    handle.dispatchEvent(event);
    return {
      defaultPrevented: event.defaultPrevented,
      timelinePayload: dataTransfer.getData('application/x-maxvideoai-timeline-node'),
    };
  });

  expect(dragResult).toEqual({
    defaultPrevented: true,
    timelinePayload: '',
  });
  assertNoEditorClientErrors(errors);
});

test('video block template uses custom drag and clears the ghost after the mouse moves', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const videoTemplate = page.locator('[data-block-template-kind="asset-video"]');
  await expect(videoTemplate).toBeVisible();
  await expect(videoTemplate).not.toHaveAttribute('draggable', 'true');
  const nodeCountBeforeClick = await canvasNodeCount(page);
  await videoTemplate.click();
  expect(await canvasNodeCount(page)).toBe(nodeCountBeforeClick);

  const canvas = page.locator('.react-flow');
  await expect(canvas).toBeVisible();
  const templateBox = await videoTemplate.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(templateBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!templateBox || !canvasBox) return;

  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.mouse.move(templateBox.x + templateBox.width / 2, templateBox.y + templateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.44, canvasBox.y + canvasBox.height * 0.38, { steps: 12 });
  await page.mouse.up();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.78, canvasBox.y + canvasBox.height * 0.18, { steps: 8 });

  await expect.poll(() => canvasNodeCount(page)).toBe(nodeCountBeforeClick + 1);
  await expect(page.locator('.react-flow__node', { hasText: 'Video Reference' })).toHaveCount(1);
  await expect(page.locator('[class*="workspaceGhostNode"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  assertNoEditorClientErrors(errors);
});

test('block template ghost clears when native drag ends without mouseup', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const canvas = page.locator('.react-flow');
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  if (!canvasBox) return;

  await page.evaluate(({ clientX, clientY }) => {
    window.dispatchEvent(
      new CustomEvent('maxvideoai:palette-drag-start', {
        detail: {
          kind: 'shot',
          clientX,
          clientY,
        },
      })
    );
  }, {
    clientX: canvasBox.x + canvasBox.width * 0.48,
    clientY: canvasBox.y + canvasBox.height * 0.28,
  });

  await expect(page.locator('[class*="workspaceGhostNode"]', { hasText: 'Generate block' })).toHaveCount(1);

  await page.evaluate(() => {
    window.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));
  });

  await expect(page.locator('[class*="workspaceGhostNode"]')).toHaveCount(0);
  assertNoEditorClientErrors(errors);
});

test('dropped generate blocks default to Seedance 2.0', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const generateTemplate = page.locator('[data-block-template-kind="shot"]');
  const canvas = page.locator('.react-flow');
  await expect(generateTemplate).toBeVisible();
  await expect(canvas).toBeVisible();
  const templateBox = await generateTemplate.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(templateBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!templateBox || !canvasBox) return;

  const nodeCountBeforeDrop = await canvasNodeCount(page);
  await page.mouse.move(templateBox.x + templateBox.width / 2, templateBox.y + templateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.6, canvasBox.y + canvasBox.height * 0.42, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => canvasNodeCount(page)).toBe(nodeCountBeforeDrop + 1);
  const droppedShotNode = page.locator('.react-flow__node', { hasText: 'New generation block' }).last();
  await expect(droppedShotNode).toContainText('Seedance 2.0');
  await droppedShotNode.click();

  const modelSelect = page
    .locator('aside[aria-label="Node settings"] label', { hasText: 'Model' })
    .locator('select')
    .first();
  await expect(modelSelect).toHaveValue('seedance-2-0');
  assertNoEditorClientErrors(errors);
});

test('canvas accepts local media file drops and creates matching source blocks', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const beforeCount = await canvasNodeCount(page);
  await dropLocalFileOnCanvas(page, { name: 'local-product.png', type: 'image/png', content: 'fake image bytes' }, '.react-flow', { x: 0.32, y: 0.34 });
  await dropLocalFileOnCanvas(page, { name: 'local-motion.mp4', type: 'video/mp4', content: 'fake video bytes' }, '.react-flow', { x: 0.52, y: 0.34 });
  await dropLocalFileOnCanvas(page, { name: 'local-score.wav', type: 'audio/wav', content: 'fake audio bytes' }, '.react-flow', { x: 0.72, y: 0.34 });

  await expect.poll(() => canvasNodeCount(page)).toBe(beforeCount + 3);
  await expect(page.locator('.react-flow__node', { hasText: 'local-product.png' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'local-motion.mp4' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'local-score.wav' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Image Reference' }).last()).toHaveAttribute('data-id', /asset-image/);
  await expect(page.locator('.react-flow__node', { hasText: 'Video Reference' }).last()).toHaveAttribute('data-id', /asset-video/);
  await expect(page.locator('.react-flow__node', { hasText: 'Audio Reference' }).last()).toHaveAttribute('data-id', /asset-audio/);
  assertNoEditorClientErrors(errors);
});

test('canvas file drop on a compatible empty block fills that block instead of adding another node', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const videoTemplate = page.locator('[data-block-template-kind="asset-video"]');
  const canvas = page.locator('.react-flow');
  await expect(videoTemplate).toBeVisible();
  await expect(canvas).toBeVisible();
  const templateBox = await videoTemplate.boundingBox();
  const canvasBox = await canvas.boundingBox();
  expect(templateBox).not.toBeNull();
  expect(canvasBox).not.toBeNull();
  if (!templateBox || !canvasBox) return;

  const nodeCountBeforeTemplateDrop = await canvasNodeCount(page);
  await page.mouse.move(templateBox.x + templateBox.width / 2, templateBox.y + templateBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.2, canvasBox.y + canvasBox.height * 0.25, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => canvasNodeCount(page)).toBe(nodeCountBeforeTemplateDrop + 1);

  const newVideoNode = page.locator('.react-flow__node', { hasText: 'No video selected' }).last();
  await expect(newVideoNode).toBeVisible();
  const newVideoNodeId = await newVideoNode.getAttribute('data-id');
  expect(newVideoNodeId).toBeTruthy();
  const nodeCountBeforeFileDrop = await canvasNodeCount(page);
  await dropLocalFileOnCanvas(page, { name: 'filled-reference.mp4', type: 'video/mp4', content: 'fake video bytes' }, '.react-flow__node:has-text("No video selected")');

  await expect.poll(() => canvasNodeCount(page)).toBe(nodeCountBeforeFileDrop);
  await expect(page.locator(`.react-flow__node[data-id="${newVideoNodeId}"]`)).toContainText('filled-reference.mp4');
  assertNoEditorClientErrors(errors);
});

test('canvas paste creates a prompt block from plain text', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');

  const beforeCount = await canvasNodeCount(page);
  await pasteTextOnCanvas(page, 'Pasted launch scene: close-up product turn with moody light.');

  await expect.poll(() => canvasNodeCount(page)).toBe(beforeCount + 1);
  await expect(page.locator('.react-flow__node textarea').last()).toHaveValue('Pasted launch scene: close-up product turn with moody light.');
  assertNoEditorClientErrors(errors);
});
