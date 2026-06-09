import { expect, type Page } from '@playwright/test';
import { assertNoClientErrors, trackClientErrors, type ClientErrors } from '../admin-helpers';

export type EditorClientErrors = ClientErrors;
export type TimelineClipState = {
  duration: number;
  selected: boolean;
  start: number;
};

export type TimelineClipFullState = TimelineClipState & {
  id: string;
  track: string;
};

export function trackEditorClientErrors(page: Page): EditorClientErrors {
  return trackClientErrors(page);
}

export function assertNoEditorClientErrors(errors: EditorClientErrors): void {
  assertNoClientErrors(errors);
}

async function mockEditorHeaderAccountApi(page: Page): Promise<void> {
  await page.route('**/api/wallet', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ balance: 42.5, balanceCents: 4250, currency: 'USD' }),
    });
  });
  await page.route('**/api/admin/access', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false }),
    });
  });
}

async function mockEditorStudioPersistenceApi(page: Page): Promise<void> {
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

export async function openEditorWorkspace(page: Page): Promise<void> {
  await mockEditorHeaderAccountApi(page);
  await mockEditorStudioPersistenceApi(page);
  await page.goto('/app/studio/workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByText('MaxVideoAI Editor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Viewer', exact: true })).toBeVisible();
  await expect(page.getByLabel('Video timeline')).toBeVisible();
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  const rejectCookies = page.getByRole('button', { name: 'Reject all' });
  await rejectCookies.waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined);
  if (await rejectCookies.isVisible().catch(() => false)) {
    await rejectCookies.click();
  }
}

export async function openFreshEditorWorkspace(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.workspace.v1');
    window.localStorage.removeItem('maxvideoai.editor.timelineRender.v1');
    window.localStorage.removeItem('maxvideoai.editor.canvasTemplates.v1');
    window.localStorage.removeItem('maxvideoai.editor.projects.v1');
  });
  await openEditorWorkspace(page);
}

export async function switchEditorFocus(page: Page, focus: 'Canvas' | 'Viewer'): Promise<void> {
  await page.getByRole('button', { name: focus, exact: true }).click();
  await expect(page.getByRole('button', { name: focus, exact: true })).toHaveAttribute('aria-pressed', 'true');
}

export async function timelineItemCount(page: Page): Promise<number> {
  return page.locator('[data-timeline-item]').count();
}

export async function canvasNodeCount(page: Page): Promise<number> {
  return page.locator('.react-flow__node').count();
}

export async function clickCanvasNode(page: Page, nodeId: string): Promise<void> {
  const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
  await expect(node).toBeVisible();
  await node.click();
}

export async function timelineFrameStep(page: Page): Promise<number> {
  const timeline = page.getByLabel('Video timeline');
  await expect(timeline).toBeVisible();
  return Number(await timeline.getAttribute('data-timeline-frame-step'));
}

export async function timelinePixelsPerSecond(page: Page): Promise<number> {
  const timeline = page.getByLabel('Video timeline');
  await expect(timeline).toBeVisible();
  return Number(await timeline.getAttribute('data-timeline-pixels-per-second'));
}

export async function timelineClipState(page: Page, itemId: string): Promise<TimelineClipState> {
  const clip = page.locator(`[data-timeline-item="${itemId}"]`);
  await expect(clip).toBeVisible();
  return {
    duration: Number(await clip.getAttribute('data-timeline-duration')),
    selected: (await clip.getAttribute('data-selected')) === 'true',
    start: Number(await clip.getAttribute('data-timeline-start')),
  };
}

export async function timelineClipStates(page: Page): Promise<TimelineClipFullState[]> {
  return page.locator('[data-timeline-item]').evaluateAll((clips) =>
    clips.map((clip) => ({
      id: clip.getAttribute('data-timeline-item') ?? '',
      track: clip.getAttribute('data-timeline-track-id') ?? '',
      duration: Number(clip.getAttribute('data-timeline-duration')),
      selected: clip.getAttribute('data-selected') === 'true',
      start: Number(clip.getAttribute('data-timeline-start')),
    }))
  );
}

export async function hasTimelineOverlap(page: Page, track: string): Promise<boolean> {
  const clips = (await timelineClipStates(page))
    .filter((clip) => clip.track === track)
    .sort((left, right) => left.start - right.start);
  return clips.some((clip, index) => index > 0 && clip.start < clips[index - 1].start + clips[index - 1].duration - 0.0001);
}

export async function dragTimelineClip(page: Page, itemId: string, deltaX: number, deltaY = 0): Promise<void> {
  const clip = page.locator(`[data-timeline-item="${itemId}"]`);
  await expect(clip).toBeVisible();
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + Math.min(Math.max(box.width / 2, 24), box.width - 8);
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
  await page.mouse.up();
}

export async function dragTimelineClipFromLeft(page: Page, itemId: string, deltaX: number, deltaY = 0): Promise<void> {
  const clip = page.locator(`[data-timeline-item="${itemId}"]`);
  await expect(clip).toBeVisible();
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + Math.min(Math.max(32, box.width * 0.2), box.width - 18);
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
  await page.mouse.up();
}

export async function dropCanvasNodeOnTimelineTrack(page: Page, nodeTitle: string, track: string, seconds: number): Promise<void> {
  const node = page.locator('[data-timeline-node-drag-kind]', { hasText: nodeTitle }).first();
  await expect(node).toBeVisible();
  const lane = page.locator(`[data-timeline-track="${track}"]`);
  await expect(lane).toBeVisible();
  const laneBox = await lane.boundingBox();
  expect(laneBox).not.toBeNull();
  if (!laneBox) return;
  const pixelsPerSecond = await timelinePixelsPerSecond(page);
  const targetX = laneBox.x + seconds * pixelsPerSecond;
  const targetY = laneBox.y + laneBox.height / 2;
  const payload = await node.evaluate((element) => {
    const mediaKind = element.getAttribute('data-timeline-node-drag-kind');
    const nodeId = element.closest('[data-id]')?.getAttribute('data-id');
    if (!mediaKind || !nodeId) throw new Error('Missing timeline drag payload data.');
    return { mediaKind, nodeId };
  });
  await lane.evaluate((target, { clientX, clientY, mediaKind, nodeId }) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/x-maxvideoai-timeline-node', JSON.stringify({ nodeId, mediaKind }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
  }, { clientX: targetX, clientY: targetY, ...payload });
}

export async function dropProjectMediaAssetOnTimelineTrack(page: Page, assetName: string, track: string, seconds: number): Promise<void> {
  const row = page.locator('[data-project-media-asset-id]', { hasText: assetName }).first();
  await expect(row).toBeVisible();
  const lane = page.locator(`[data-timeline-track="${track}"]`);
  await expect(lane).toBeVisible();
  const laneBox = await lane.boundingBox();
  expect(laneBox).not.toBeNull();
  if (!laneBox) return;
  const pixelsPerSecond = await timelinePixelsPerSecond(page);
  const targetX = laneBox.x + seconds * pixelsPerSecond;
  const targetY = laneBox.y + laneBox.height / 2;
  const payload = await row.evaluate((element) => {
    const mediaKind = element.getAttribute('data-project-media-drag-kind');
    const assetId = element.getAttribute('data-project-media-asset-id');
    const durationSec = Number(element.getAttribute('data-project-media-duration-sec') ?? 0);
    const title = element.getAttribute('data-project-media-title');
    if (!mediaKind || !assetId) throw new Error('Missing project media timeline drag payload data.');
    return { assetId, durationSec, mediaKind, title };
  });
  await lane.evaluate((target, { clientX, clientY, durationSec, mediaKind, assetId, title }) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/x-maxvideoai-timeline-node', JSON.stringify({ assetId, durationSec, mediaKind, title }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX, clientY, dataTransfer }));
  }, { clientX: targetX, clientY: targetY, ...payload });
}

export async function clickTimelineClip(page: Page, itemId: string, options: { shift?: boolean } = {}): Promise<void> {
  const clip = page.locator(`[data-timeline-item="${itemId}"]`);
  await expect(clip).toBeVisible();
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  if (options.shift) await page.keyboard.down('Shift');
  await page.mouse.click(box.x + Math.min(28, Math.max(8, box.width - 8)), box.y + box.height / 2);
  if (options.shift) await page.keyboard.up('Shift');
}

export async function clickTimelineTrackAtSecond(page: Page, track: string, seconds: number): Promise<void> {
  const lane = page.locator(`[data-timeline-track="${track}"]`);
  await expect(lane).toBeVisible();
  const laneBox = await lane.boundingBox();
  expect(laneBox).not.toBeNull();
  if (!laneBox) return;
  const pixelsPerSecond = await timelinePixelsPerSecond(page);
  await page.mouse.click(laneBox.x + seconds * pixelsPerSecond, laneBox.y + laneBox.height / 2);
}

export async function dragTimelineClipEnd(page: Page, itemId: string, deltaX: number): Promise<void> {
  const clip = page.locator(`[data-timeline-item="${itemId}"]`);
  await expect(clip).toBeVisible();
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const startX = box.x + box.width - 4;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY, { steps: 8 });
  await page.mouse.up();
}

export async function cutTimelineClipAtRatio(page: Page, itemId: string, ratio: number): Promise<void> {
  const clip = page.locator(`[data-timeline-item="${itemId}"]`);
  await expect(clip).toBeVisible();
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.getByRole('button', { name: 'Blade / Cut tool' }).click();
  await expect(page.getByRole('button', { name: 'Blade / Cut tool' })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
}
