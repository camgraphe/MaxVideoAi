import { expect, type Page } from '@playwright/test';
import { assertNoClientErrors, trackClientErrors, type ClientErrors } from '../admin-helpers';

export type EditorClientErrors = ClientErrors;
export type TimelineClipState = {
  duration: number;
  selected: boolean;
  start: number;
};

export function trackEditorClientErrors(page: Page): EditorClientErrors {
  return trackClientErrors(page);
}

export function assertNoEditorClientErrors(errors: EditorClientErrors): void {
  assertNoClientErrors(errors);
}

export async function openEditorWorkspace(page: Page): Promise<void> {
  await page.goto('/app/studio/workspace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByText('MaxVideoAI Editor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Viewer', exact: true })).toBeVisible();
  await expect(page.getByLabel('Video timeline')).toBeVisible();
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
}

export async function openFreshEditorWorkspace(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('maxvideoai.editor.workspace.v1');
    window.localStorage.removeItem('maxvideoai.editor.timelineRender.v1');
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

export async function clickTimelineClip(page: Page, itemId: string, options: { shift?: boolean } = {}): Promise<void> {
  const clip = page.locator(`[data-timeline-item="${itemId}"]`);
  await expect(clip).toBeVisible();
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  if (options.shift) await page.keyboard.down('Shift');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  if (options.shift) await page.keyboard.up('Shift');
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

  await page.getByRole('button', { name: 'Cut tool' }).click();
  await expect(page.getByRole('button', { name: 'Cut tool' })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.click(box.x + box.width * ratio, box.y + box.height / 2);
}
