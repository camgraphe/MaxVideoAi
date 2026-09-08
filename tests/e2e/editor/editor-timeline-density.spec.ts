import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  openFreshEditorWorkspace,
  openMinimalEditorWorkspace,
  switchEditorFocus,
  timelineFrameStep,
  timelinePixelsPerSecond,
} from './editor-helpers';

type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

async function requiredBox(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('Expected a rendered timeline box.');
  return box;
}

async function assertTimelineGeometry(page: Page): Promise<void> {
  const panel = page.getByLabel('Video timeline');
  const viewport = panel.locator('[data-timeline-viewport="true"]');
  await viewport.evaluate((element) => { element.scrollLeft = 0; });

  const ruler = panel.locator('[data-timeline-ruler="true"]');
  const rulerColumns = ruler.locator(':scope > div');
  const rulerLabel = rulerColumns.nth(0);
  const rulerLane = rulerColumns.nth(1);
  const rulerInner = rulerLane.locator(':scope > div');
  const firstTrackLane = panel.locator('[data-timeline-track="video"]');
  const zeroTick = rulerInner.locator('span').filter({ hasText: '00:00:00:00' }).first();

  const [rulerBox, rulerLabelBox, rulerLaneBox, rulerInnerBox, trackLaneBox, zeroTickBox] = await Promise.all([
    requiredBox(ruler),
    requiredBox(rulerLabel),
    requiredBox(rulerLane),
    requiredBox(rulerInner),
    requiredBox(firstTrackLane),
    requiredBox(zeroTick),
  ]);

  expect(Math.abs(rulerLabelBox.height - rulerBox.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(rulerLaneBox.height - rulerBox.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(rulerInnerBox.height - rulerBox.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(rulerInnerBox.x - trackLaneBox.x)).toBeLessThanOrEqual(1);
  expect(zeroTickBox.x).toBeGreaterThanOrEqual(rulerInnerBox.x - 1);

  const toolButtons = rulerLabel.getByRole('button');
  for (const button of await toolButtons.all()) {
    const buttonBox = await requiredBox(button);
    expect(buttonBox.y).toBeGreaterThanOrEqual(rulerBox.y - 1);
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(rulerBox.y + rulerBox.height + 1);
  }

  const trackRows = panel.locator('[data-timeline-track-label]').locator('..');
  await expect(trackRows).toHaveCount(3);
  for (const row of await trackRows.all()) {
    expect((await requiredBox(row)).height).toBeCloseTo(64, 0);
  }

  const playheadSegments = panel.locator('[data-playhead-handle="true"]');
  await expect(playheadSegments).toHaveCount(4);
  const segmentBoxes = await Promise.all((await playheadSegments.all()).map(requiredBox));
  segmentBoxes.sort((left, right) => left.y - right.y);
  const playheadCenterX = segmentBoxes[0].x + segmentBoxes[0].width / 2;
  for (const segment of segmentBoxes) {
    expect(Math.abs(segment.x + segment.width / 2 - playheadCenterX)).toBeLessThanOrEqual(1);
  }
  for (let index = 1; index < segmentBoxes.length; index += 1) {
    const previousBottom = segmentBoxes[index - 1].y + segmentBoxes[index - 1].height;
    expect(segmentBoxes[index].y - previousBottom).toBeLessThanOrEqual(1);
  }
}

for (const viewport of [{ width: 1166, height: 1003 }, { width: 390, height: 844 }]) {
  test(`timeline tracks stay compact at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openMinimalEditorWorkspace(page);

    const tracks = page.locator('[data-timeline-track-label]');
    await expect(tracks).toHaveCount(3);
    for (const track of await tracks.all()) {
      expect((await track.boundingBox())!.height).toBeLessThanOrEqual(64);
    }
  });
}

test('the expanded track menu stays fully reachable in short landscape view', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openMinimalEditorWorkspace(page);

  const actions = page.locator('[data-timeline-track-actions="audio-2"]');
  await actions.scrollIntoViewIfNeeded();
  await expect(actions).toBeVisible();
  await actions.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu').filter({ has: page.locator('[data-timeline-menu-toggle-lock="audio-2"]') });
  await expect(menu.getByRole('menuitem')).toHaveCount(3);
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(390);
  const lastEnabledAction = menu.locator('button:not(:disabled)').last();
  await page.keyboard.press('End');
  await expect(lastEnabledAction).toBeFocused();
  await expect(menu).toBeVisible();
});

test('ruler and 64px tracks keep one continuous time axis across target viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1269, height: 900 });
  await openMinimalEditorWorkspace(page);

  for (const viewport of [
    { width: 1269, height: 900 },
    { width: 1166, height: 1003 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await assertTimelineGeometry(page);
  }
});

test('timeline click stays frame-accurate after horizontal scroll and viewport resize', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const viewport = page.locator('[data-timeline-viewport="true"]');
  await viewport.evaluate((element) => { element.scrollLeft = 300; });
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const rulerInner = page.locator('[data-timeline-ruler="true"] > div').nth(1).locator(':scope > div');
  const [viewportBox, rulerInnerBox, pixelsPerSecond, frameStep] = await Promise.all([
    requiredBox(viewport),
    requiredBox(rulerInner),
    timelinePixelsPerSecond(page),
    timelineFrameStep(page),
  ]);
  const clickX = viewportBox.x + viewportBox.width - 32;
  const rawSeconds = (clickX - rulerInnerBox.x) / pixelsPerSecond;
  const expectedSeconds = Math.round(rawSeconds / frameStep) * frameStep;
  await page.mouse.click(clickX, rulerInnerBox.y + rulerInnerBox.height / 2);

  await expect.poll(async () => Number(
    await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead')
  )).toBeCloseTo(expectedSeconds, 6);

  const rulerPlayhead = page.locator('[data-timeline-ruler="true"] [data-playhead-handle="true"]');
  const rulerPlayheadBox = await requiredBox(rulerPlayhead);
  const dragTargetX = rulerPlayheadBox.x + rulerPlayheadBox.width / 2 - 40;
  const expectedDraggedSeconds = Math.round(
    ((dragTargetX - rulerInnerBox.x) / pixelsPerSecond) / frameStep
  ) * frameStep;
  await page.mouse.move(
    rulerPlayheadBox.x + rulerPlayheadBox.width / 2,
    rulerPlayheadBox.y + rulerPlayheadBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(dragTargetX, rulerPlayheadBox.y + rulerPlayheadBox.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect.poll(async () => Number(
    await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead')
  )).toBeCloseTo(expectedDraggedSeconds, 6);
});
