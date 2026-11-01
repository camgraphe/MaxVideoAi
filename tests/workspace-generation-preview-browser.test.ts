import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { chromium, webkit, expect, type Locator } from '@playwright/test';
import { startWorkspaceReferenceFixture } from './helpers/workspace-reference-browser-fixture';
import { studioMediaByteResponse } from './helpers/studio-media-byte-fixture';

const source = `
import {createRoot} from 'react-dom/client';
import {CompositePreviewDock} from './components/groups/CompositePreviewDock';
import {I18nProvider} from './lib/i18n/I18nProvider';
const group={id:'local-completed',provider:'fal',layout:'x1',status:'ready',createdAt:'2026-11-01T00:00:00Z',
 items:[{id:'selected-result',jobId:'job-local',url:'/fixture-original.mp4',previewUrl:'/fixture-short-preview.mp4',
 thumb:'/assets/frames/thumb-16x9.svg',aspect:'16:9',meta:{status:'completed',mediaType:'video'}}]};
createRoot(document.getElementById('root')).render(<I18nProvider locale="en" dictionary={{}} fallback={{}}>
 <main style={{maxWidth:900,margin:'40px auto'}}><h1>Local paused result fixture</h1>
 <CompositePreviewDock density="workspace" group={group}/></main></I18nProvider>);`;

async function decodedFrame(video: Locator) {
  return video.evaluate((element: HTMLVideoElement) => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 36;
    const context = canvas.getContext('2d')!; context.drawImage(element, 0, 0, 64, 36);
    return Array.from(context.getImageData(0, 0, 64, 36).data).filter((_, index) => index % 4 !== 3);
  });
}

async function visibleFrame(video: Locator, expected: number[]) {
  const require = createRequire(join(process.cwd(), 'frontend/package.json'));
  const sharp = require('sharp') as typeof import('sharp');
  // A decoded canvas alone cannot prove that the reader is painted or uncovered.
  const screenshot = await video.screenshot();
  const painted = await sharp(screenshot).resize(64, 36).removeAlpha().raw().toBuffer();
  assert.equal(painted.length, expected.length);
  const meanError = painted.reduce((total, channel, index) => total + Math.abs(channel - expected[index]), 0) / painted.length;
  assert.ok(meanError < 18, `the visible video must match its decoded frame (mean error ${meanError})`);
  assert.ok(painted.reduce((total, channel) => total + 255 - channel, 0) / painted.length > 30,
    'a white placeholder must not cover the first frame');
  return { screenshot, meanError };
}

for (const browserType of [chromium, webkit]) {
  test(`a personal video paints its first frame while paused and survives Play → Pause (${browserType.name()})`,
    { timeout: 60_000 }, async () => {
      const fixture = await startWorkspaceReferenceFixture({ source, config: {} });
      const browser = await browserType.launch();
      const evidence = process.env.WORKSPACE_PREVIEW_EVIDENCE_DIR;
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const bytes = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
        const mediaRequests: string[] = [], foreignRequests: string[] = [], errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== fixture.url) { foreignRequests.push(request.url()); return route.abort(); }
          if (!url.pathname.endsWith('.mp4')) return route.continue();
          mediaRequests.push(url.pathname);
          assert.equal(url.pathname, '/fixture-original.mp4', 'the short preview must never replace the full reader');
          const response = studioMediaByteResponse(bytes, { method: request.method(), range: request.headers().range });
          return route.fulfill(response);
        });
        await page.goto(fixture.url);
        await expect(page.getByRole('heading', { name: 'Local paused result fixture' })).toBeVisible();
        const video = page.locator('figure video');
        await expect(video).toHaveCount(1, { timeout: 5_000 });
        await expect.poll(() => video.evaluate((element: HTMLVideoElement) =>
          element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && element.videoWidth > 0)).toBe(true);
        const initial = await video.evaluate((element: HTMLVideoElement) => ({
          readyState: element.readyState, width: element.videoWidth, height: element.videoHeight,
          paused: element.paused, muted: element.muted, autoplay: element.autoplay, currentTime: element.currentTime,
          currentSrc: element.currentSrc,
        }));
        assert.deepEqual([initial.width, initial.height], [320, 180]);
        assert.equal(initial.paused, true); assert.equal(initial.muted, true); assert.equal(initial.autoplay, false);
        assert.equal(initial.currentTime, 0);
        await expect(page.locator('figure img')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Play all previews', exact: true })).toBeVisible();
        const firstFrame = await visibleFrame(video, await decodedFrame(video));
        const originalNode = await video.elementHandle();
        assert.ok(originalNode);

        await page.getByRole('button', { name: 'Play all previews', exact: true }).click();
        await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.2);
        await page.getByRole('button', { name: 'Pause all previews', exact: true }).click();
        await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
        assert.equal(await video.evaluate((element, previous) => element === previous, originalNode), true);
        const pausedAt = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
        assert.ok(pausedAt > 0.2);
        const retainedFrame = await visibleFrame(video, await decodedFrame(video));
        assert.equal(await video.evaluate((element: HTMLVideoElement) => element.currentTime), pausedAt);
        assert.ok(mediaRequests.length > 0);
        assert.deepEqual([...new Set(mediaRequests)], ['/fixture-original.mp4']);
        assert.deepEqual(foreignRequests, []); assert.deepEqual(errors, []);
        if (evidence) {
          await mkdir(evidence, { recursive: true });
          await writeFile(join(evidence, `${browserType.name()}-first-paused.png`), firstFrame.screenshot);
          await writeFile(join(evidence, `${browserType.name()}-after-play-pause.png`), retainedFrame.screenshot);
          await writeFile(join(evidence, `${browserType.name()}-native.json`), JSON.stringify({
            initial, pausedAt, firstFrameMeanError: firstFrame.meanError, retainedFrameMeanError: retainedFrame.meanError,
            mediaRequests, foreignRequests, errors,
          }, null, 2));
        }
      } finally { await browser.close(); await fixture.close(); }
    });
}
