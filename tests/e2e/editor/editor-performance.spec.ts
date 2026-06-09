import { expect, test, type Page } from '@playwright/test';
import {
  assertNoEditorClientErrors,
  dragTimelineClip,
  openEditorWorkspace,
  switchEditorFocus,
  timelineClipState,
  timelinePixelsPerSecond,
  trackEditorClientErrors,
} from './editor-helpers';

const STRESS_NODE_COUNT = 80;
const STRESS_VIDEO_CLIP_COUNT = 75;
const STRESS_TIMELINE_ITEM_COUNT = STRESS_VIDEO_CLIP_COUNT * 2;
const INTERACTION_LIMIT_MS = 6_000;

type StressWorkspaceNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  selected?: boolean;
  data: Record<string, unknown>;
};

type StressWorkspaceTimelineItem = {
  id: string;
  outputNodeId: string;
  track: string;
  title: string;
  durationSec: number;
  startSec: number;
  sourceStartSec?: number;
  sourceDurationSec?: number;
  linkedGroupId?: string;
  linkedGroupKind?: string;
  mediaKind?: string;
  hasEmbeddedAudio?: boolean;
  mediaUrl?: string;
  thumbnailUrl?: string;
  modelId?: string;
  status?: string;
  audioMix?: {
    muted: boolean;
    volume: number;
  };
};

function buildStressNodes(): StressWorkspaceNode[] {
  return Array.from({ length: STRESS_NODE_COUNT }, (_, index) => {
    const column = index % 10;
    const row = Math.floor(index / 10);
    const position = { x: column * 260, y: row * 190 };
    const variant = index % 5;

    if (variant === 0) {
      return {
        id: `perf-image-${index}`,
        type: 'asset-image',
        position,
        data: {
          kind: 'asset-image',
          title: `Image Reference ${index + 1}`,
          subtitle: 'stress image source',
          accent: '#8b5cf6',
          sourceHandles: ['reference'],
          asset: {
            id: `perf-image-asset-${index}`,
            kind: 'image',
            filename: `perf_image_${index + 1}.jpg`,
            subtitle: 'Image · 2048x2048',
            url: '/storyboard/examples/storyboarder-product-reference.jpg',
            thumbUrl: '/storyboard/examples/storyboarder-product-reference.jpg',
            dimensions: '2048x2048',
          },
        },
      };
    }

    if (variant === 1) {
      return {
        id: `perf-video-${index}`,
        type: 'asset-video',
        position,
        data: {
          kind: 'asset-video',
          title: `Video Reference ${index + 1}`,
          subtitle: 'stress video source',
          accent: '#3b82f6',
          sourceHandles: ['video_reference'],
          asset: {
            id: `perf-video-asset-${index}`,
            kind: 'video',
            filename: `perf_video_${index + 1}.mp4`,
            subtitle: 'Video · 6s',
            url: '/assets/gallery/aerial-road.mp4',
            thumbUrl: '/assets/placeholders/thumb-16x9.png',
            durationSec: 6,
            dimensions: '1920x1080',
          },
        },
      };
    }

    if (variant === 2) {
      return {
        id: `perf-audio-${index}`,
        type: 'asset-audio',
        position,
        data: {
          kind: 'asset-audio',
          title: `Audio Reference ${index + 1}`,
          subtitle: 'stress audio source',
          accent: '#10b981',
          sourceHandles: ['audio'],
          asset: {
            id: `perf-audio-asset-${index}`,
            kind: 'audio',
            filename: `perf_audio_${index + 1}.wav`,
            subtitle: 'Audio · 28s',
            url: '/studio/demo-ambient.wav',
            durationSec: 28,
          },
        },
      };
    }

    if (variant === 3) {
      return {
        id: `perf-prompt-${index}`,
        type: 'text-prompt',
        position,
        data: {
          kind: 'text-prompt',
          title: `Prompt Block ${index + 1}`,
          subtitle: 'stress prompt source',
          accent: '#60a5fa',
          promptRole: 'prompt',
          promptText: 'Stress test prompt with camera motion, subject, lighting, and mood.',
          sourceHandles: ['prompt'],
        },
      };
    }

    return {
      id: `perf-shot-${index}`,
      type: 'shot',
      position,
      data: {
        kind: 'shot',
        title: `Shot ${index + 1}`,
        subtitle: 'stress generation block',
        accent: '#f97316',
        sourceHandles: ['generated_output'],
        targetHandles: ['prompt', 'start_image', 'reference'],
        shot: {
          modelId: 'seedance-2-0',
          workflowType: 'image_to_video',
          durationSec: 5,
          aspectRatio: '16:9',
          resolution: '1080p',
          fps: 30,
          seed: null,
          audioEnabled: false,
          lipSyncEnabled: false,
          referenceStrength: 0.65,
          outputName: `Perf Shot ${index + 1}`,
          status: 'draft',
        },
      },
    };
  });
}

function buildStressTimelineItems(): StressWorkspaceTimelineItem[] {
  return Array.from({ length: STRESS_VIDEO_CLIP_COUNT }, (_, index) => {
    const startSec = index * 2;
    const linkedGroupId = `perf-link-${index}`;
    const videoTrack = index % 2 === 0 ? 'video' : 'video-2';
    const audioTrack = index % 2 === 0 ? 'audio' : 'audio-2';
    const video: StressWorkspaceTimelineItem = {
      id: `perf-video-clip-${index}`,
      outputNodeId: `perf-output-${index}`,
      track: videoTrack,
      title: `Perf Video ${index + 1}`,
      durationSec: 1.2,
      startSec,
      sourceStartSec: 0,
      sourceDurationSec: 1.2,
      linkedGroupId,
      linkedGroupKind: 'video-audio',
      mediaKind: 'video',
      hasEmbeddedAudio: true,
      mediaUrl: '/assets/gallery/aerial-road.mp4',
      thumbnailUrl: '/assets/placeholders/thumb-16x9.png',
      modelId: 'seedance-2-0',
      status: 'completed',
    };
    const audio: StressWorkspaceTimelineItem = {
      id: `perf-audio-clip-${index}`,
      outputNodeId: `perf-output-${index}`,
      track: audioTrack,
      title: `Perf Audio ${index + 1}`,
      durationSec: 1.2,
      startSec,
      sourceStartSec: 0,
      sourceDurationSec: 1.2,
      linkedGroupId,
      linkedGroupKind: 'video-audio',
      mediaKind: 'audio',
      mediaUrl: '/studio/demo-ambient.wav',
      audioMix: {
        muted: false,
        volume: 80,
      },
    };
    return [video, audio];
  }).flat();
}

function buildStressWorkspaceState() {
  const timelineItems = buildStressTimelineItems();
  return {
    nodes: buildStressNodes(),
    edges: [],
    projectAssets: [],
    timelineItems,
    activeSequenceId: 'sequence-main',
    activeTemplateId: 'dev-blocks',
    focusMode: 'viewer',
    audioTrackCount: 3,
    hiddenVideoTracks: [],
    lockedTimelineTracks: [],
    mutedAudioTracks: [],
    videoTrackCount: 2,
    timelinePanelHeight: 420,
    timelineInPointSec: null,
    timelineOutPointSec: null,
    projectSettings: {
      aspectRatio: '16:9',
      resolution: '1080p',
      fps: 30,
    },
  };
}

async function measureInteraction(label: string, action: () => Promise<void>): Promise<number> {
  const startedAt = Date.now();
  await action();
  const durationMs = Date.now() - startedAt;
  test.info().annotations.push({ type: 'perf', description: `${label}: ${durationMs}ms` });
  expect(durationMs, `${label} should complete within a broad interaction threshold`).toBeLessThanOrEqual(INTERACTION_LIMIT_MS);
  return durationMs;
}

async function setTimelineScrubber(page: Page, seconds: number): Promise<void> {
  const scrubber = page.getByLabel('Timeline scrubber');
  await expect(scrubber).toBeVisible();
  await scrubber.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, String(nextValue));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, seconds);
}

async function programPlayheadSec(page: Page): Promise<number> {
  return Number(await page.getByTestId('editor-program-frame').getAttribute('data-program-playhead'));
}

test('stress fixture scrubs, drags, zooms, and pans without timing out', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = trackEditorClientErrors(page);
  const stressState = buildStressWorkspaceState();

  await page.addInitScript((state) => {
    window.localStorage.setItem('maxvideoai.editor.workspace.v1', JSON.stringify(state));
    window.localStorage.removeItem('maxvideoai.editor.timelineRender.v1');
    window.localStorage.removeItem('maxvideoai.editor.videoExportRequest.v1');
    window.localStorage.removeItem('maxvideoai.editor.canvasTemplates.v1');
  }, stressState);

  await openEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');

  const persistedItemCount = await page.evaluate(() => {
    const parsed = JSON.parse(window.localStorage.getItem('maxvideoai.editor.workspace.v1') ?? '{}') as { timelineItems?: unknown[] };
    return parsed.timelineItems?.length ?? 0;
  });
  expect(persistedItemCount).toBeGreaterThanOrEqual(STRESS_TIMELINE_ITEM_COUNT);
  await expect(page.locator('[data-timeline-item]').first()).toBeVisible();

  await measureInteraction('timeline scrub on stress fixture', async () => {
    await setTimelineScrubber(page, 42);
    await expect.poll(() => programPlayheadSec(page)).toBeGreaterThan(41.9);
  });

  const dragTargetClipId = 'perf-video-clip-2';
  const beforeDrag = await timelineClipState(page, dragTargetClipId);
  await measureInteraction('timeline clip drag on stress fixture', async () => {
    await dragTimelineClip(page, dragTargetClipId, 48);
    await expect.poll(async () => (await timelineClipState(page, dragTargetClipId)).start).toBeGreaterThan(beforeDrag.start);
  });

  const beforeZoom = await timelinePixelsPerSecond(page);
  await measureInteraction('timeline zoom on stress fixture', async () => {
    await page.getByRole('button', { name: 'Zoom in timeline' }).click();
    await page.getByRole('button', { name: 'Zoom in timeline' }).click();
    await expect.poll(() => timelinePixelsPerSecond(page)).toBeGreaterThan(beforeZoom);
  });

  await switchEditorFocus(page, 'Canvas');
  const canvasMap = page.locator('[data-canvas-miniature-map="true"]');
  await expect(canvasMap).toHaveAttribute('data-node-count', String(STRESS_NODE_COUNT));
  const viewport = page.locator('.react-flow__viewport');
  const beforePanTransform = await viewport.evaluate((element) => getComputedStyle(element).transform);
  const miniViewport = page.locator('[data-canvas-mini-viewport="true"]');
  const miniViewportBox = await miniViewport.boundingBox();
  const canvasMapBox = await canvasMap.boundingBox();
  expect(miniViewportBox).not.toBeNull();
  expect(canvasMapBox).not.toBeNull();
  if (!miniViewportBox || !canvasMapBox) return;

  const viewportMapX = Number(await canvasMap.getAttribute('data-viewport-x'));
  const dragDirection = viewportMapX < canvasMapBox.width / 2 ? 1 : -1;

  await measureInteraction('canvas pan on stress fixture', async () => {
    const startX = miniViewportBox.x + miniViewportBox.width / 2;
    const startY = miniViewportBox.y + miniViewportBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + dragDirection * 36, startY + 18, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => viewport.evaluate((element) => getComputedStyle(element).transform)).not.toBe(beforePanTransform);
  });

  assertNoEditorClientErrors(errors);
});
