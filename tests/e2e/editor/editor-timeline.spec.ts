import { expect, test } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  clickTimelineClip,
  cutTimelineClipAtRatio,
  dragTimelineClip,
  dragTimelineClipEnd,
  openFreshEditorWorkspace,
  switchEditorFocus,
  timelineClipState,
  timelineFrameStep,
  timelineItemCount,
  timelinePixelsPerSecond,
  trackEditorClientErrors,
} from './editor-helpers';

test('timeline drag keeps linked video and audio clips synchronized', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(8);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(8);

  await dragTimelineClip(page, 'timeline-output-02', 68);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(10);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(10);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(8);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).duration).toBe(8);

  assertNoEditorClientErrors(errors);
});

test('dragging linked audio keeps the video clip visible during preview', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const videoClip = page.locator('[data-timeline-item="timeline-output-02"]');
  const audioClip = page.locator('[data-timeline-item="timeline-output-02-audio"]');
  await expect(videoClip).toBeVisible();
  await expect(audioClip).toBeVisible();

  const audioBox = await audioClip.boundingBox();
  expect(audioBox).not.toBeNull();
  if (!audioBox) return;

  const startX = audioBox.x + Math.min(Math.max(audioBox.width / 2, 24), audioBox.width - 8);
  const startY = audioBox.y + audioBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 68, startY, { steps: 8 });

  await expect(videoClip).toBeVisible();
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(10);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(10);

  await page.mouse.up();
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(10);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(10);

  assertNoEditorClientErrors(errors);
});

test('viewer previews hard cuts by default without CSS opacity fades', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const clipTexts = await page.locator('[data-timeline-item]').evaluateAll((clips) =>
    clips.map((clip) => clip.textContent ?? '')
  );
  expect(clipTexts.some((text) => text.includes('Xf'))).toBe(false);

  const layerTransitionDurations = await page
    .locator('[data-testid="editor-program-frame"] video, [data-testid="editor-program-frame"] img')
    .evaluateAll((layers) => layers.map((layer) => getComputedStyle(layer).transitionDuration));
  expect(layerTransitionDurations.length).toBeGreaterThan(0);
  expect(layerTransitionDurations.every((duration) => duration.split(',').every((value) => value.trim() === '0s'))).toBe(true);

  assertNoEditorClientErrors(errors);
});

test('timeline end trim can move by exactly one project frame', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const zoomInButton = page.getByRole('button', { name: 'Zoom in timeline' });
  for (let clickIndex = 0; clickIndex < 12; clickIndex += 1) {
    await zoomInButton.click();
    if ((await timelinePixelsPerSecond(page)) >= 50) break;
  }

  const frameStep = await timelineFrameStep(page);
  const pixelsPerSecond = await timelinePixelsPerSecond(page);
  expect(pixelsPerSecond).toBeGreaterThanOrEqual(50);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(8);

  await dragTimelineClipEnd(page, 'timeline-output-02', -(pixelsPerSecond * frameStep * 1.1));

  const expectedDuration = Number((8 - frameStep).toFixed(6));
  await expect.poll(async () => Number((await timelineClipState(page, 'timeline-output-02')).duration.toFixed(6))).toBe(expectedDuration);
  await expect.poll(async () => Number((await timelineClipState(page, 'timeline-output-02-audio')).duration.toFixed(6))).toBe(expectedDuration);

  assertNoEditorClientErrors(errors);
});

test('viewer follows the trim preview playhead before mouse release', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const zoomInButton = page.getByRole('button', { name: 'Zoom in timeline' });
  for (let clickIndex = 0; clickIndex < 12; clickIndex += 1) {
    await zoomInButton.click();
    if ((await timelinePixelsPerSecond(page)) >= 50) break;
  }

  const frameStep = await timelineFrameStep(page);
  const pixelsPerSecond = await timelinePixelsPerSecond(page);
  const clip = page.locator('[data-timeline-item="timeline-output-02"]');
  const box = await clip.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const trimStartX = box.x + box.width - 4;
  const trimStartY = box.y + box.height / 2;
  await page.mouse.move(trimStartX, trimStartY);
  await page.mouse.down();
  await page.mouse.move(trimStartX - pixelsPerSecond * frameStep * 1.1, trimStartY, { steps: 8 });

  const expectedPreviewPlayhead = Number((8 + (8 - frameStep) - frameStep).toFixed(6));
  await expect.poll(async () => {
    const value = await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead');
    return Number(Number(value).toFixed(6));
  }).toBeCloseTo(expectedPreviewPlayhead, 5);

  await page.mouse.up();
  assertNoEditorClientErrors(errors);
});

test('viewer video frame updates on one-frame keyboard step while paused', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const frameStep = await timelineFrameStep(page);
  const activeVideo = page.locator('[data-testid="editor-program-frame"] video[data-playback-item-id="timeline-output-01"]');
  await expect(activeVideo).toBeVisible();
  await expect.poll(async () =>
    activeVideo.evaluate((video) => (video as HTMLVideoElement).readyState)
  ).toBeGreaterThanOrEqual(1);

  const initialTime = await activeVideo.evaluate((video) => (video as HTMLVideoElement).currentTime);
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => {
    const value = await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead');
    return Number(Number(value).toFixed(6));
  }).toBeCloseTo(frameStep, 5);
  await expect.poll(async () => {
    const currentTime = await activeVideo.evaluate((video) => (video as HTMLVideoElement).currentTime);
    return Number((currentTime - initialTime).toFixed(6));
  }).toBeCloseTo(frameStep, 2);

  assertNoEditorClientErrors(errors);
});

test('timeline multi-select drag preserves relative offsets and linked audio sync', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await clickTimelineClip(page, 'timeline-output-01');
  await clickTimelineClip(page, 'timeline-output-02', { shift: true });
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).selected).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).selected).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).selected).toBe(true);

  await dragTimelineClip(page, 'timeline-output-01', 34);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).start).toBe(1);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(9);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(9);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(8);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(8);

  assertNoEditorClientErrors(errors);
});

test('timeline multi-select drag is blocked before overlapping non-selected clips', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await cutTimelineClipAtRatio(page, 'timeline-output-02', 0.5);
  await expect(page.locator('[data-timeline-item="timeline-output-02-split"]')).toBeVisible();
  await page.getByRole('button', { name: 'Select tool' }).click();
  await expect(page.getByRole('button', { name: 'Select tool' })).toHaveAttribute('aria-pressed', 'true');

  await clickTimelineClip(page, 'timeline-output-02');
  await clickTimelineClip(page, 'timeline-output-02-split', { shift: true });
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).selected).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-split')).selected).toBe(true);

  await dragTimelineClip(page, 'timeline-output-02-split', -68);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(8);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-split')).start).toBe(12);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(8);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio-split')).start).toBe(12);

  assertNoEditorClientErrors(errors);
});

test('timeline end trim caps video duration and mirrors linked audio duration', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(8);
  await dragTimelineClipEnd(page, 'timeline-output-02', -68);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(8);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(6);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(8);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).duration).toBe(6);

  assertNoEditorClientErrors(errors);
});

test('cut tool splits linked video and audio into distinct synchronized segments', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  const initialItemCount = await timelineItemCount(page);

  await cutTimelineClipAtRatio(page, 'timeline-output-02', 0.5);

  await expect.poll(async () => timelineItemCount(page)).toBe(initialItemCount + 2);
  await expect(page.locator('[data-timeline-item="timeline-output-02-split"]')).toBeVisible();
  await expect(page.locator('[data-timeline-item="timeline-output-02-audio-split"]')).toBeVisible();
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(4);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-split')).start).toBe(12);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-split')).duration).toBe(4);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).duration).toBe(4);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio-split')).start).toBe(12);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio-split')).duration).toBe(4);

  assertNoEditorClientErrors(errors);
});
