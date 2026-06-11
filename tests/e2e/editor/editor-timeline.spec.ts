import { expect, test, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  canvasNodeCount,
  clickCanvasNode,
  clickTimelineClip,
  clickTimelineTrackAtSecond,
  cutTimelineClipAtRatio,
  dropCanvasNodeOnTimelineTrack,
  dragTimelineClip,
  dragTimelineClipEnd,
  dragTimelineClipFromLeft,
  hasTimelineOverlap,
  openEditorWorkspace,
  openFreshEditorWorkspace,
  switchEditorFocus,
  timelineClipState,
  timelineClipStates,
  timelineFrameStep,
  timelineItemCount,
  timelinePixelsPerSecond,
  trackEditorClientErrors,
} from './editor-helpers';

const PRODUCT_FIXTURE_SHOT_01_DURATION_SEC = 5;
const PRODUCT_FIXTURE_SHOT_02_START_SEC = PRODUCT_FIXTURE_SHOT_01_DURATION_SEC;
const PRODUCT_FIXTURE_SHOT_02_DURATION_SEC = 8;
const PRODUCT_FIXTURE_TWO_SECOND_DRAG_SEC = 2;
const PRODUCT_FIXTURE_SHOT_02_DRAGGED_START_SEC = PRODUCT_FIXTURE_SHOT_02_START_SEC + PRODUCT_FIXTURE_TWO_SECOND_DRAG_SEC;
const PRODUCT_FIXTURE_SHOT_02_SPLIT_START_SEC = PRODUCT_FIXTURE_SHOT_02_START_SEC + PRODUCT_FIXTURE_SHOT_02_DURATION_SEC / 2;
const PRODUCT_FIXTURE_INSERT_PREVIEW_SHOT_01_START_SEC = 9;

async function timelinePanelHeight(page: Page): Promise<number> {
  const timelinePanel = page.getByLabel('Video timeline');
  await expect(timelinePanel).toBeVisible();
  const box = await timelinePanel.boundingBox();
  expect(box).not.toBeNull();
  return box?.height ?? 0;
}

test('timeline topbar keeps only the current timecode', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const timelinePanel = page.getByLabel('Video timeline');
  const timelineTopbar = timelinePanel.locator('[data-timeline-topbar="true"]');
  await expect(timelineTopbar).toBeVisible();
  await expect(timelinePanel.locator('[data-timeline-current-timecode="true"]')).toHaveText('00:00:00:00');
  await expect(timelineTopbar).not.toContainText('Montage timeline');
  await expect(timelineTopbar).not.toContainText('/ 00:00:28:00');
  await expect(timelineTopbar).not.toContainText('Selected');
  await expect(timelineTopbar).not.toContainText('Shot 01 - Hero Reveal');

  assertNoEditorClientErrors(errors);
});

test('timeline ruler has a left tool slot for snapping and splice insert', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const timelinePanel = page.getByLabel('Video timeline');
  const ruler = timelinePanel.locator('[data-timeline-ruler="true"]');
  const rulerToolSlot = timelinePanel.locator('[data-timeline-ruler-tool-slot="true"]');
  await expect(ruler).toBeVisible();
  await expect(rulerToolSlot).toBeVisible();

  const rulerBox = await ruler.boundingBox();
  expect(rulerBox).not.toBeNull();
  expect(rulerBox?.height ?? 0).toBeGreaterThanOrEqual(30);

  const snapButton = rulerToolSlot.getByRole('button', { name: 'Toggle snapping' });
  const spliceInsertButton = rulerToolSlot.getByRole('button', { name: 'Toggle insert into clip' });
  await expect(snapButton).toBeVisible();
  await expect(spliceInsertButton).toBeVisible();
  await expect(spliceInsertButton).toHaveAttribute('aria-pressed', 'false');
  await expect(snapButton).toHaveAttribute('aria-pressed', 'true');
  await snapButton.click();
  await expect(snapButton).toHaveAttribute('aria-pressed', 'false');
  await expect(timelinePanel.locator('[data-timeline-transport="true"]').getByRole('button', { name: 'Toggle snapping' })).toHaveCount(0);
  await expect(timelinePanel.locator('[data-timeline-transport="true"]').getByRole('button', { name: 'Toggle insert into clip' })).toHaveCount(0);

  assertNoEditorClientErrors(errors);
});

test('timeline zoom control sits at the far right of the toolbar', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const timelinePanel = page.getByLabel('Video timeline');
  const timelineTopbar = timelinePanel.locator('[data-timeline-topbar="true"]');
  const transport = timelinePanel.locator('[data-timeline-transport="true"]');
  const zoomControl = timelineTopbar.locator('[aria-label="Timeline zoom"]');
  const editingTools = transport.getByRole('toolbar', { name: 'Timeline editing tools' });
  await expect(editingTools).toBeVisible();
  const selectionTool = editingTools.getByRole('button', { exact: true, name: 'Selection tool' });
  const bladeTool = editingTools.getByRole('button', { exact: true, name: 'Blade / Cut tool' });
  await expect(selectionTool).toHaveAttribute('aria-pressed', 'true');
  await expect(bladeTool).toHaveAttribute('aria-pressed', 'false');
  await expect(editingTools.getByRole('button', { exact: true, name: 'Trim tool' })).toHaveCount(0);
  await expect(editingTools.getByRole('button', { exact: true, name: 'Ripple trim tool' })).toHaveCount(0);
  await expect(editingTools.getByRole('button', { exact: true, name: 'Roll trim tool' })).toHaveCount(0);
  await bladeTool.click();
  await expect(bladeTool).toHaveAttribute('aria-pressed', 'true');
  await expect(selectionTool).toHaveAttribute('aria-pressed', 'false');
  await selectionTool.click();
  await expect(selectionTool).toHaveAttribute('aria-pressed', 'true');
  await expect(zoomControl).toBeVisible();
  await expect(transport.getByRole('radiogroup', { name: 'Timeline insert mode' })).toHaveCount(0);
  await expect(transport.getByRole('radiogroup', { name: 'Timeline trim mode' })).toHaveCount(0);
  await expect(transport.locator('[aria-label="Timeline zoom"]')).toHaveCount(0);
  await expect(transport).not.toContainText('Ovr');
  await expect(transport).not.toContainText('Rep');
  await expect(transport.getByRole('button', { name: 'Toggle crossfade transition' })).toHaveCount(0);
  await expect(transport).not.toContainText('Xf');

  const transportBox = await transport.boundingBox();
  const toolsBox = await editingTools.boundingBox();
  const zoomBox = await zoomControl.boundingBox();
  const topbarBox = await timelineTopbar.boundingBox();
  expect(transportBox).not.toBeNull();
  expect(toolsBox).not.toBeNull();
  expect(zoomBox).not.toBeNull();
  expect(topbarBox).not.toBeNull();
  if (!transportBox || !toolsBox || !zoomBox || !topbarBox) return;

  expect(zoomBox.x).toBeGreaterThan(transportBox.x + transportBox.width);
  expect(zoomBox.x - (transportBox.x + transportBox.width)).toBeLessThanOrEqual(10);
  expect(Math.abs((zoomBox.x + zoomBox.width) - (topbarBox.x + topbarBox.width - 18))).toBeLessThanOrEqual(2);

  assertNoEditorClientErrors(errors);
});

test('viewer inspector keeps timing details at the bottom', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const inspector = page.getByLabel('Timeline clip settings');
  const timingDetails = inspector.locator('[data-timeline-clip-timing="true"]');
  await expect(timingDetails).toBeVisible();
  await expect(timingDetails).toContainText('Start');
  await expect(timingDetails).toContainText('Source in');
  await expect(inspector.getByRole('region', { name: 'Clip transform' })).toBeVisible();

  await expect.poll(async () => timingDetails.evaluate((element) => {
    const parent = element.parentElement;
    return Boolean(parent && parent.lastElementChild === element);
  })).toBe(true);

  assertNoEditorClientErrors(errors);
});

test('viewer playback controls sit under the video and jump between cuts', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const viewer = page.getByTestId('editor-video-viewer');
  const viewerControls = viewer.locator('[data-viewer-playback-controls="true"]');
  await expect(viewerControls).toBeVisible();
  await expect(viewerControls.getByRole('button', { name: 'Previous cut' })).toBeVisible();
  await expect(viewerControls.getByRole('button', { name: 'Play timeline' })).toBeVisible();
  await expect(viewerControls.getByRole('button', { name: 'Next cut' })).toBeVisible();
  await expect(page.getByLabel('Video timeline').locator('[data-timeline-transport="true"]').getByRole('button', { name: 'Play timeline' })).toHaveCount(0);
  await expect(page.getByLabel('Video timeline').locator('[data-timeline-transport="true"]').getByRole('button', { name: 'Delete selected timeline clip' })).toHaveCount(0);

  await viewerControls.getByRole('button', { name: 'Next cut' }).click();
  await expect.poll(async () => Number(await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead'))).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);

  await viewerControls.getByRole('button', { name: 'Previous cut' }).click();
  await expect.poll(async () => Number(await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead'))).toBe(0);

  assertNoEditorClientErrors(errors);
});

test('timeline arrow up and down shortcuts jump between edit cuts', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  await clickTimelineClip(page, 'timeline-output-01');

  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => Number(await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead'))).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);

  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => Number(await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead'))).toBe(0);

  assertNoEditorClientErrors(errors);
});

test('viewer supports in and out marks with keyboard shortcuts and export dialog range options', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const viewer = page.getByTestId('editor-video-viewer');
  const viewerControls = viewer.locator('[data-viewer-playback-controls="true"]');
  const inOutSummary = viewer.locator('[data-viewer-in-out-summary="true"]');
  await expect(viewerControls.getByRole('button', { name: 'Mark In' })).toBeVisible();
  await expect(viewerControls.getByRole('button', { name: 'Mark Out' })).toBeVisible();
  await expect(inOutSummary).toContainText('In --:--:--:--');
  await expect(inOutSummary).toContainText('Out --:--:--:--');

  await page.keyboard.press('i');
  await expect(inOutSummary).toContainText('In 00:00:00:00');
  await viewerControls.getByRole('button', { name: 'Next cut' }).click();
  await page.keyboard.press('o');
  await expect(inOutSummary).toContainText('Out 00:00:05:00');

  await page.route('**/api/studio/timeline-exports/estimate', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        quota: {
          freeLimit: 2,
          usedFreeExports: 0,
          freeExportsRemaining: 2,
          billingKind: 'free',
        },
        estimate: {
          billingKind: 'free',
          amountCents: 0,
          currency: 'USD',
          freeExportsRemaining: 2,
          unitCentsPerSecond: 4,
          multiplier: 1.5,
        },
      }),
    });
  });
  await page.route('**/api/studio/timeline-exports', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        reused: false,
        export: {
          id: 'tlx_e2e_export',
          status: 'queued',
          progress: 0,
          message: 'Queued for server render.',
          output_url: null,
        },
        billing: {
          billingKind: 'free',
          freeExportsRemaining: 1,
        },
      }),
    });
  });
  await page.route('**/api/studio/timeline-exports/tlx_e2e_export', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        export: {
          id: 'tlx_e2e_export',
          status: 'completed',
          progress: 100,
          message: 'Export ready.',
          output_url: 'https://cdn.maxvideoai.test/timeline-exports/tlx_e2e_export.mp4',
        },
      }),
    });
  });

  await page.getByRole('button', { name: 'Open export dialog' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export sequence' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'In/Out range' })).toBeChecked();
  await expect(dialog).toContainText('00:00:00:00');
  await expect(dialog).toContainText('00:00:05:00');
  await expect(dialog.getByRole('button', { name: 'Export video' })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Standard' })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: 'Draft' })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'High' })).toBeVisible();
  await expect(dialog).toContainText('MP4 H.264');
  await expect(dialog).toContainText('Preflight');
  await expect(dialog).toContainText('Server render');
  await expect(dialog).toContainText('Free export');
  await expect(dialog).toContainText('Advanced');
  await dialog.getByRole('button', { name: 'Export video' }).click();
  await expect(dialog.getByRole('status')).toContainText(/Server export queued|Export ready/);
  await expect(dialog.getByRole('status')).toContainText('Export ready. Download available.');
  await expect(dialog.getByRole('link', { name: 'Download MP4' })).toHaveAttribute(
    'href',
    'https://cdn.maxvideoai.test/timeline-exports/tlx_e2e_export.mp4'
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const rawRequest = window.localStorage.getItem('maxvideoai.editor.videoExportRequest.v1');
        if (!rawRequest) return null;
        return JSON.parse(rawRequest) as {
          exportSettings?: { format?: string; qualityPreset?: string; serverRenderMode?: string };
          idempotencyKey?: string;
          manifest?: { sequenceId?: string; sequenceName?: string };
          source?: string;
        };
      })
    )
    .toMatchObject({
      exportSettings: {
        format: 'mp4-h264',
        qualityPreset: 'standard',
        serverRenderMode: 'server',
      },
      manifest: {
        sequenceId: 'sequence-main',
        sequenceName: 'Main sequence',
      },
      source: 'maxvideoai-editor',
    });
  const storedExportRequest = await page.evaluate(() => JSON.parse(window.localStorage.getItem('maxvideoai.editor.videoExportRequest.v1') ?? '{}'));
  expect(typeof storedExportRequest.idempotencyKey).toBe('string');
  expect(storedExportRequest.idempotencyKey.length).toBeGreaterThan(0);
  await expect(dialog.getByRole('button', { name: 'Prepare render JSON' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Export EDL' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close export dialog' }).click();
  await expect(dialog).toHaveCount(0);

  assertNoEditorClientErrors(errors);
});

test('video track labels expose visibility and lock controls', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const videoTrackLabel = page.locator('[data-timeline-track-label="video"]');
  const videoTrackLane = page.locator('[data-timeline-track="video"]');
  await expect(videoTrackLabel).toBeVisible();
  await expect(videoTrackLane).toBeVisible();

  const visibilityToggle = videoTrackLabel.getByRole('button', { name: 'Hide V1 track' });
  const lockToggle = videoTrackLabel.getByRole('button', { name: 'Lock V1 track' });
  await expect(visibilityToggle).toBeVisible();
  await expect(visibilityToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(lockToggle).toBeVisible();
  await expect(lockToggle).toHaveAttribute('aria-pressed', 'false');

  await expect(page.getByTestId('editor-program-frame').locator('[data-playback-item-id="timeline-output-01"]')).toHaveCount(1);
  await visibilityToggle.click();
  await expect(videoTrackLabel).toHaveAttribute('data-timeline-track-hidden', 'true');
  await expect(videoTrackLabel.getByRole('button', { name: 'Show V1 track' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('editor-program-frame').locator('[data-playback-item-id="timeline-output-01"]')).toHaveCount(0);
  await videoTrackLabel.getByRole('button', { name: 'Show V1 track' }).click();
  await expect(page.getByTestId('editor-program-frame').locator('[data-playback-item-id="timeline-output-01"]')).toHaveCount(1);

  const initialStart = (await timelineClipState(page, 'timeline-output-01')).start;
  await lockToggle.click();
  await expect(videoTrackLabel).toHaveAttribute('data-timeline-track-locked', 'true');
  await expect(videoTrackLabel.getByRole('button', { name: 'Unlock V1 track' })).toHaveAttribute('aria-pressed', 'true');

  await dragTimelineClip(page, 'timeline-output-01', 120);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).start).toBe(initialStart);

  assertNoEditorClientErrors(errors);
});

test('track names align with video bottom controls and audio top controls', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const videoTrackLabel = page.locator('[data-timeline-track-label="video"]');
  const audioTrackLabel = page.locator('[data-timeline-track-label="audio"]');
  const videoTitle = videoTrackLabel.getByText('V1', { exact: true });
  const audioTitle = audioTrackLabel.getByText('Audio 1', { exact: true });
  const videoLock = videoTrackLabel.getByRole('button', { name: 'Lock V1 track' });
  const audioMute = audioTrackLabel.getByRole('button', { name: 'Mute Audio 1 track' });
  await expect(videoTitle).toBeVisible();
  await expect(audioTitle).toBeVisible();
  await expect(videoLock).toBeVisible();
  await expect(audioMute).toBeVisible();

  const videoTitleBox = await videoTitle.boundingBox();
  const videoLockBox = await videoLock.boundingBox();
  const audioTitleBox = await audioTitle.boundingBox();
  const audioMuteBox = await audioMute.boundingBox();
  expect(videoTitleBox).not.toBeNull();
  expect(videoLockBox).not.toBeNull();
  expect(audioTitleBox).not.toBeNull();
  expect(audioMuteBox).not.toBeNull();
  if (!videoTitleBox || !videoLockBox || !audioTitleBox || !audioMuteBox) return;

  expect(Math.abs((videoTitleBox.y + videoTitleBox.height / 2) - (videoLockBox.y + videoLockBox.height / 2))).toBeLessThanOrEqual(6);
  expect(Math.abs((audioTitleBox.y + audioTitleBox.height / 2) - (audioMuteBox.y + audioMuteBox.height / 2))).toBeLessThanOrEqual(6);

  assertNoEditorClientErrors(errors);
});

test('audio track labels expose mute and lock controls', async ({ page }) => {
  const errors = trackEditorClientErrors(page);
  const audioItemId = 'timeline-output-02-audio';

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const audioTrackLabel = page.locator('[data-timeline-track-label="audio"]');
  const audioTrackLane = page.locator('[data-timeline-track="audio"]');
  await expect(audioTrackLabel).toBeVisible();
  await expect(audioTrackLane).toBeVisible();

  const muteToggle = audioTrackLabel.getByRole('button', { name: 'Mute Audio 1 track' });
  const lockToggle = audioTrackLabel.getByRole('button', { name: 'Lock Audio 1 track' });
  await expect(muteToggle).toBeVisible();
  await expect(muteToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(lockToggle).toBeVisible();
  await expect(lockToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(`[data-timeline-item="${audioItemId}"]`)).toBeVisible();
  const playbackAudio = page.getByTestId('editor-program-frame').locator(`[data-playback-audio-item-id="${audioItemId}"]`);
  await expect(playbackAudio).toHaveAttribute('data-playback-audio-track-id', 'audio');
  await expect(playbackAudio).toHaveAttribute('data-playback-audio-muted', 'false');

  await muteToggle.click();
  await expect(audioTrackLabel).toHaveAttribute('data-timeline-track-muted', 'true');
  await expect(audioTrackLabel.getByRole('button', { name: 'Unmute Audio 1 track' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`[data-timeline-item="${audioItemId}"]`)).toBeVisible();
  await expect(playbackAudio).toHaveAttribute('data-playback-audio-muted', 'true');

  const initialStart = (await timelineClipState(page, audioItemId)).start;
  await lockToggle.click();
  await expect(audioTrackLabel).toHaveAttribute('data-timeline-track-locked', 'true');
  await expect(audioTrackLabel.getByRole('button', { name: 'Unlock Audio 1 track' })).toHaveAttribute('aria-pressed', 'true');

  await dragTimelineClip(page, audioItemId, 120);
  await expect.poll(async () => (await timelineClipState(page, audioItemId)).start).toBe(initialStart);

  assertNoEditorClientErrors(errors);
});

test('timeline panel height can be resized with the top drag handle and persists', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openEditorWorkspace(page);
  await page.evaluate(() => {
    window.localStorage.removeItem('maxvideoai.editor.workspace.v1');
    window.localStorage.removeItem('maxvideoai.editor.timelineRender.v1');
  });
  await openEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const handle = page.locator('[data-timeline-resize-handle="true"]');
  await expect(handle).toBeVisible();

  const initialHeight = await timelinePanelHeight(page);
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) return;

  const handleX = handleBox.x + handleBox.width / 2;
  const handleY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(handleX, handleY);
  await page.mouse.down();
  await page.mouse.move(handleX, handleY - 90, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => timelinePanelHeight(page)).toBeGreaterThan(initialHeight + 50);

  const enlargedHeight = await timelinePanelHeight(page);
  const enlargedHandleBox = await handle.boundingBox();
  expect(enlargedHandleBox).not.toBeNull();
  if (!enlargedHandleBox) return;

  await page.mouse.move(enlargedHandleBox.x + enlargedHandleBox.width / 2, enlargedHandleBox.y + enlargedHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(enlargedHandleBox.x + enlargedHandleBox.width / 2, enlargedHandleBox.y + enlargedHandleBox.height / 2 + 70, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => timelinePanelHeight(page)).toBeLessThan(enlargedHeight - 35);
  const reducedHeight = await timelinePanelHeight(page);

  await expect.poll(async () => page.evaluate(() => {
    const rawState = window.localStorage.getItem('maxvideoai.editor.workspace.v1');
    return rawState ? Number(JSON.parse(rawState).timelinePanelHeight) : 0;
  })).toBeCloseTo(reducedHeight, 0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('header').getByText('MaxVideoAI Editor')).toBeVisible();
  await switchEditorFocus(page, 'Viewer');
  await expect.poll(async () => timelinePanelHeight(page)).toBeCloseTo(reducedHeight, 0);

  assertNoEditorClientErrors(errors);
});

test('timeline linked video drag can move right into empty time and leave a gap', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);

  await dragTimelineClip(page, 'timeline-output-02', 68);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(PRODUCT_FIXTURE_SHOT_01_DURATION_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(PRODUCT_FIXTURE_SHOT_02_DRAGGED_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(PRODUCT_FIXTURE_SHOT_02_DRAGGED_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(PRODUCT_FIXTURE_SHOT_02_DURATION_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).duration).toBe(PRODUCT_FIXTURE_SHOT_02_DURATION_SEC);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(async () => hasTimelineOverlap(page, 'audio')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('timeline context menu unlinks video audio pairs and links selected clips', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const videoClip = page.locator('[data-timeline-item="timeline-output-02"]');
  await expect(videoClip).toBeVisible();
  const videoBox = await videoClip.boundingBox();
  expect(videoBox).not.toBeNull();
  if (!videoBox) return;

  await page.mouse.click(videoBox.x + 42, videoBox.y + videoBox.height / 2, { button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Unlink selected clips', exact: true })).toBeEnabled();
  await page.getByRole('menuitem', { name: 'Unlink selected clips', exact: true }).click();

  await dragTimelineClip(page, 'timeline-output-02-audio', 68);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(PRODUCT_FIXTURE_SHOT_02_DRAGGED_START_SEC);

  await clickTimelineClip(page, 'timeline-output-02');
  await clickTimelineClip(page, 'timeline-output-02-audio', { shift: true });
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).selected).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).selected).toBe(true);

  const relinkBox = await videoClip.boundingBox();
  expect(relinkBox).not.toBeNull();
  if (!relinkBox) return;
  await page.mouse.click(relinkBox.x + 42, relinkBox.y + relinkBox.height / 2, { button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Link selected clips', exact: true })).toBeEnabled();
  await page.getByRole('menuitem', { name: 'Link selected clips', exact: true }).click();

  await dragTimelineClip(page, 'timeline-output-02', -204);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(PRODUCT_FIXTURE_TWO_SECOND_DRAG_SEC);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(async () => hasTimelineOverlap(page, 'audio')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('timeline uses generic expandable audio tracks and allows audio clips to move between them', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await expect(page.locator('[data-timeline-track="audio"]')).toBeVisible();
  await expect(page.locator('[data-timeline-track="audio-2"]')).toBeVisible();
  await expect(page.locator('[data-timeline-track="audio-3"]')).toBeVisible();
  await expect(page.getByText('Audio 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Audio 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Audio 3', { exact: true })).toBeVisible();
  await expect(page.locator('[data-timeline-add-track="video"]')).toHaveCount(1);
  await expect(page.locator('[data-timeline-add-track="audio"]')).toHaveCount(1);
  await expect.poll(async () => page.locator('[data-timeline-add-track="video"]').evaluate((button) =>
    button.closest('[data-timeline-track-label]')?.getAttribute('data-timeline-track-label')
  )).toBe('video');
  await expect.poll(async () => page.locator('[data-timeline-add-track="audio"]').evaluate((button) =>
    button.closest('[data-timeline-track-label]')?.getAttribute('data-timeline-track-label')
  )).toBe('audio-3');
  const initialAudioAddBox = await page.locator('[data-timeline-add-track="audio"]').boundingBox();
  const initialAudioLockBox = await page.locator('[data-timeline-track-label="audio-3"] [data-timeline-track-lock="audio-3"]').boundingBox();
  const initialVideoAddBox = await page.locator('[data-timeline-add-track="video"]').boundingBox();
  const initialVideoLockBox = await page.locator('[data-timeline-track-label="video"] [data-timeline-track-lock="video"]').boundingBox();
  expect(initialAudioAddBox).not.toBeNull();
  expect(initialAudioLockBox).not.toBeNull();
  expect(initialVideoAddBox).not.toBeNull();
  expect(initialVideoLockBox).not.toBeNull();
  if (!initialAudioAddBox || !initialAudioLockBox || !initialVideoAddBox || !initialVideoLockBox) return;
  expect(initialAudioAddBox.y).toBeGreaterThanOrEqual(initialAudioLockBox.y + initialAudioLockBox.height);
  expect(initialVideoAddBox.y + initialVideoAddBox.height).toBeLessThanOrEqual(initialVideoLockBox.y);

  await page.locator('[data-timeline-add-track="audio"]').click();
  await expect(page.locator('[data-timeline-track="audio-4"]')).toBeVisible();
  await expect(page.getByText('Audio 4', { exact: true })).toBeVisible();
  await expect.poll(async () => page.locator('[data-timeline-add-track="audio"]').evaluate((button) =>
    button.closest('[data-timeline-track-label]')?.getAttribute('data-timeline-track-label')
  )).toBe('audio-4');

  await page.locator('[data-timeline-track-label="audio-4"]').click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Add audio track', exact: true })).toBeEnabled();
  await expect(page.getByRole('menuitem', { name: 'Delete audio track', exact: true })).toBeEnabled();
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Audio 4');
    await dialog.accept();
  });
  await page.getByRole('menuitem', { name: 'Delete audio track', exact: true }).click();
  await expect(page.locator('[data-timeline-track="audio-4"]')).toHaveCount(0);
  await expect.poll(async () => page.locator('[data-timeline-add-track="audio"]').evaluate((button) =>
    button.closest('[data-timeline-track-label]')?.getAttribute('data-timeline-track-label')
  )).toBe('audio-3');

  await page.locator('[data-timeline-add-track="audio"]').click();
  await expect(page.locator('[data-timeline-track="audio-4"]')).toBeVisible();

  await page.locator('[data-timeline-add-track="video"]').click();
  await expect(page.locator('[data-timeline-track="video-2"]')).toBeVisible();
  await expect.poll(async () => page.locator('[data-timeline-add-track="video"]').evaluate((button) =>
    button.closest('[data-timeline-track-label]')?.getAttribute('data-timeline-track-label')
  )).toBe('video-2');
  await page.locator('[data-timeline-track-label="video-2"]').click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Add video track', exact: true })).toBeEnabled();
  await expect(page.getByRole('menuitem', { name: 'Delete video track', exact: true })).toBeEnabled();
  await page.getByRole('menuitem', { name: 'Add video track', exact: true }).click();
  await expect(page.locator('[data-timeline-track="video-3"]')).toBeVisible();
  await expect.poll(async () => page.locator('[data-timeline-add-track="video"]').evaluate((button) =>
    button.closest('[data-timeline-track-label]')?.getAttribute('data-timeline-track-label')
  )).toBe('video-3');
  await page.locator('[data-timeline-track-label="video-3"]').click({ button: 'right' });
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('V3');
    await dialog.accept();
  });
  await page.getByRole('menuitem', { name: 'Delete video track', exact: true }).click();
  await expect(page.locator('[data-timeline-track="video-3"]')).toHaveCount(0);
  await expect.poll(async () => page.locator('[data-timeline-add-track="video"]').evaluate((button) =>
    button.closest('[data-timeline-track-label]')?.getAttribute('data-timeline-track-label')
  )).toBe('video-2');

  const sourceClip = page.locator('[data-timeline-item="timeline-music-01"]');
  const targetTrack = page.locator('[data-timeline-track="audio-4"]');
  await expect(sourceClip).toBeVisible();
  await expect(targetTrack).toBeVisible();
  const sourceBox = await sourceClip.boundingBox();
  const targetBox = await targetTrack.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !targetBox) return;

  await dragTimelineClipFromLeft(page, 'timeline-music-01', 0, targetBox.y + targetBox.height / 2 - (sourceBox.y + sourceBox.height / 2));

  await expect.poll(async () => {
    const states = await timelineClipStates(page);
    return states.find((clip) => clip.id === 'timeline-music-01')?.track;
  }).toBe('audio-4');
  await expect.poll(async () => hasTimelineOverlap(page, 'audio-4')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('clicking empty timeline space clears a multi-selection', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await clickTimelineClip(page, 'timeline-output-01');
  await clickTimelineClip(page, 'timeline-output-02', { shift: true });
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).selected).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).selected).toBe(true);

  await clickTimelineTrackAtSecond(page, 'video', 18);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).selected).toBe(false);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).selected).toBe(false);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).selected).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('delete key only applies to the active canvas or timeline surface', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');
  const initialTimelineItemCount = await timelineItemCount(page);
  const initialCanvasNodeCount = await canvasNodeCount(page);

  await switchEditorFocus(page, 'Viewer');
  await clickTimelineClip(page, 'timeline-output-01');
  await expect(page.locator('[data-active-editor-surface="timeline"]')).toBeVisible();
  await switchEditorFocus(page, 'Canvas');
  await clickCanvasNode(page, 'shot-03');
  await expect(page.locator('[data-active-editor-surface="canvas"]')).toBeVisible();
  await page.keyboard.press('Delete');

  await expect.poll(async () => canvasNodeCount(page)).toBe(initialCanvasNodeCount - 1);
  await expect.poll(async () => timelineItemCount(page)).toBe(initialTimelineItemCount);

  await clickCanvasNode(page, 'output-01');
  await expect(page.locator('[data-active-editor-surface="canvas"]')).toBeVisible();
  await switchEditorFocus(page, 'Viewer');
  await clickTimelineClip(page, 'timeline-output-01');
  await expect(page.locator('[data-active-editor-surface="timeline"]')).toBeVisible();
  await page.keyboard.press('Delete');

  await expect.poll(async () => timelineItemCount(page)).toBeLessThan(initialTimelineItemCount);
  await switchEditorFocus(page, 'Canvas');
  await expect.poll(async () => canvasNodeCount(page)).toBe(initialCanvasNodeCount - 1);
  await expect(page.locator('.react-flow__node[data-id="output-01"]')).toBeVisible();

  assertNoEditorClientErrors(errors);
});

test('timeline undo and redo shortcuts work after focus returns to the canvas', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await dragTimelineClipEnd(page, 'timeline-output-01', -34);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(4);
  await expect(page.getByRole('button', { name: 'Undo timeline edit' })).toBeEnabled();

  await switchEditorFocus(page, 'Canvas');
  await clickCanvasNode(page, 'asset-product-image');
  await expect(page.locator('[data-active-editor-surface="canvas"]')).toBeVisible();

  await page.keyboard.press('Control+Z');
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(PRODUCT_FIXTURE_SHOT_01_DURATION_SEC);
  await expect(page.getByRole('button', { name: 'Redo timeline edit' })).toBeEnabled();

  await page.keyboard.press('Control+Shift+Z');
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(4);

  assertNoEditorClientErrors(errors);
});

test('timeline end trim ripples clips attached to the cut', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await dragTimelineClipEnd(page, 'timeline-output-01', -34);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(4);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(4);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(4);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(async () => hasTimelineOverlap(page, 'audio')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('insert-mode timeline drag resolves occupied drops to clip boundaries by default', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await dragTimelineClip(page, 'timeline-output-02', -204);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).start).toBe(8);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(PRODUCT_FIXTURE_SHOT_01_DURATION_SEC);
  await expect.poll(async () => {
    const states = await timelineClipStates(page);
    return states.some((clip) => clip.id.startsWith('timeline-output-01-tail-') && clip.track === 'video');
  }).toBe(false);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('insert-mode timeline drag reverts ambiguous self-overlap drops', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await dragTimelineClip(page, 'timeline-output-01', 34);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(async () => hasTimelineOverlap(page, 'audio')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('insert into clip tool allows splice drags that split the target clip', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const spliceToggle = page.getByRole('button', { name: 'Toggle insert into clip' });
  await spliceToggle.click();
  await expect(spliceToggle).toHaveAttribute('aria-pressed', 'true');

  await dragTimelineClip(page, 'timeline-output-02', -136);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(1);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(1);
  await expect.poll(async () => {
    const states = await timelineClipStates(page);
    return states.some((clip) => clip.id.startsWith('timeline-output-01-tail-') && clip.track === 'video' && clip.start === 9 && clip.duration === 4);
  }).toBe(true);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('canvas video output drop inside a clip resolves to a timeline edit point by default', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');
  const initialItemCount = await timelineItemCount(page);

  await dropCanvasNodeOnTimelineTrack(page, 'Output 01', 'video', 4);

  await expect.poll(async () => timelineItemCount(page)).toBeGreaterThan(initialItemCount);
  await expect.poll(async () => {
    const states = await timelineClipStates(page);
    return states.some((clip) => clip.id.startsWith('timeline-output-01-') && clip.id !== 'timeline-output-01' && clip.track === 'video' && clip.start === PRODUCT_FIXTURE_SHOT_02_START_SEC);
  }).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(PRODUCT_FIXTURE_SHOT_01_DURATION_SEC * 2);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toHaveAttribute('aria-pressed', 'true');

  assertNoEditorClientErrors(errors);
});

test('canvas video output can be dropped directly on a timeline edit point', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');
  const initialItemCount = await timelineItemCount(page);

  await dropCanvasNodeOnTimelineTrack(page, 'Output 01', 'video', PRODUCT_FIXTURE_SHOT_02_START_SEC);

  await expect.poll(async () => timelineItemCount(page)).toBeGreaterThan(initialItemCount);
  await expect.poll(async () => {
    const states = await timelineClipStates(page);
    return states.some((clip) => clip.id.startsWith('timeline-output-01-') && clip.id !== 'timeline-output-01' && clip.track === 'video' && clip.start === PRODUCT_FIXTURE_SHOT_02_START_SEC);
  }).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(PRODUCT_FIXTURE_SHOT_01_DURATION_SEC * 2);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toHaveAttribute('aria-pressed', 'true');

  assertNoEditorClientErrors(errors);
});

test('canvas visual block drop is rejected on audio tracks without mutating the timeline', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Canvas');
  const initialItemCount = await timelineItemCount(page);

  await dropCanvasNodeOnTimelineTrack(page, 'Output 01', 'audio-2', 4);

  await expect.poll(async () => timelineItemCount(page)).toBe(initialItemCount);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);

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
  await page.mouse.move(startX - 204, startY, { steps: 8 });

  await expect(videoClip).toBeVisible();
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(0);

  await page.mouse.up();
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(0);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(async () => hasTimelineOverlap(page, 'audio')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('insert drag preview resolves occupied clip drops to the intended edit boundary', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const clip = page.locator('[data-timeline-item="timeline-output-01"]');
  await expect(clip).toBeVisible();
  const clipBox = await clip.boundingBox();
  expect(clipBox).not.toBeNull();
  if (!clipBox) return;

  const pixelsPerSecond = await timelinePixelsPerSecond(page);
  const startX = clipBox.x + Math.min(Math.max(clipBox.width / 2, 24), clipBox.width - 8);
  const startY = clipBox.y + clipBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + pixelsPerSecond * 14, startY, { steps: 12 });

  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).start).toBe(PRODUCT_FIXTURE_INSERT_PREVIEW_SHOT_01_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(PRODUCT_FIXTURE_SHOT_01_DURATION_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(PRODUCT_FIXTURE_SHOT_02_DURATION_SEC);

  await page.mouse.up();
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).start).toBe(PRODUCT_FIXTURE_INSERT_PREVIEW_SHOT_01_START_SEC);

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
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(PRODUCT_FIXTURE_SHOT_02_DURATION_SEC);

  await dragTimelineClipEnd(page, 'timeline-output-02', -(pixelsPerSecond * frameStep * 1.1));

  const expectedDuration = Number((PRODUCT_FIXTURE_SHOT_02_DURATION_SEC - frameStep).toFixed(6));
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

  const expectedPreviewPlayhead = Number((PRODUCT_FIXTURE_SHOT_02_START_SEC + (PRODUCT_FIXTURE_SHOT_02_DURATION_SEC - frameStep) - frameStep).toFixed(6));
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

test('timeline ambiguous multi-select drag reverts relative offsets and linked audio sync', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await clickTimelineClip(page, 'timeline-output-01');
  await clickTimelineClip(page, 'timeline-output-02', { shift: true });
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).selected).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).selected).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).selected).toBe(true);

  await dragTimelineClip(page, 'timeline-output-01', 34);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).duration).toBe(PRODUCT_FIXTURE_SHOT_01_DURATION_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(PRODUCT_FIXTURE_SHOT_02_DURATION_SEC);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(async () => hasTimelineOverlap(page, 'audio')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('timeline multi-select insert drag pushes by the full selected package span', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await cutTimelineClipAtRatio(page, 'timeline-output-02', 0.5);
  await expect(page.locator('[data-timeline-item="timeline-output-02-split"]')).toBeVisible();
  await page.getByRole('button', { name: 'Selection tool' }).click();
  await expect(page.getByRole('button', { name: 'Selection tool' })).toHaveAttribute('aria-pressed', 'true');

  await clickTimelineClip(page, 'timeline-output-02');
  await clickTimelineClip(page, 'timeline-output-02-split', { shift: true });
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).selected).toBe(true);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-split')).selected).toBe(true);

  await dragTimelineClip(page, 'timeline-output-02-split', -272);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-split')).start).toBe(4);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-01')).start).toBe(8);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(0);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio-split')).start).toBe(4);
  await expect.poll(async () => hasTimelineOverlap(page, 'video')).toBe(false);
  await expect.poll(async () => hasTimelineOverlap(page, 'audio')).toBe(false);

  assertNoEditorClientErrors(errors);
});

test('timeline end trim caps video duration and mirrors linked audio duration', async ({ page }) => {
  const errors = trackEditorClientErrors(page);

  await openFreshEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(PRODUCT_FIXTURE_SHOT_02_DURATION_SEC);
  await dragTimelineClipEnd(page, 'timeline-output-02', -68);

  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).start).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(6);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).start).toBe(PRODUCT_FIXTURE_SHOT_02_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).duration).toBe(6);

  await dragTimelineClipEnd(page, 'timeline-output-02', 68);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02')).duration).toBe(PRODUCT_FIXTURE_SHOT_02_DURATION_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).duration).toBe(PRODUCT_FIXTURE_SHOT_02_DURATION_SEC);

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
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-split')).start).toBe(PRODUCT_FIXTURE_SHOT_02_SPLIT_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-split')).duration).toBe(4);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio')).duration).toBe(4);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio-split')).start).toBe(PRODUCT_FIXTURE_SHOT_02_SPLIT_START_SEC);
  await expect.poll(async () => (await timelineClipState(page, 'timeline-output-02-audio-split')).duration).toBe(4);

  assertNoEditorClientErrors(errors);
});
