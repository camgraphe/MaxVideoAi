import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { studioMediaByteResponse } from '../../helpers/studio-media-byte-fixture';
import { assertNoEditorClientErrors, openEditorWorkspace, switchEditorFocus, trackEditorClientErrors } from './editor-helpers';

// This is a real-reader baseline, not proof of server persistence or private S3.
const items = ['a', 'b'].flatMap((name, index) => {
  const common = {
    outputNodeId: `decode-output-${name}`, title: `Local ${name.toUpperCase()}`,
    startSec: index * 2, durationSec: 2, sourceStartSec: index ? 0.5 : 1,
    sourceDurationSec: 6, linkedGroupId: `decode-linked-${name}`, linkedGroupKind: 'video-audio',
    mediaUrl: `/__studio-test/pattern-${name}.mp4`, status: 'completed',
  };
  return [
    { ...common, id: `decode-video-${name}`, track: 'video', mediaKind: 'video', hasEmbeddedAudio: true },
    { ...common, id: `decode-audio-${name}`, track: 'audio', mediaKind: 'audio', audioMix: { muted: false, volume: 80 } },
  ];
});

test('real timeline readers decode trimmed frames, produce audio and seek into the next source', async ({ page }) => {
  test.setTimeout(45_000);
  const errors = trackEditorClientErrors(page);
  const requestedRanges: string[] = [];
  const fixtures = new Map(await Promise.all(['a', 'b'].map(async (name) => [
    `/__studio-test/pattern-${name}.mp4`, await readFile(`tests/fixtures/studio-media/pattern-${name}.mp4`),
  ] as const)));
  await page.route('**/__studio-test/*', async (route) => {
    const url = new URL(route.request().url());
    const bytes = fixtures.get(url.pathname);
    if (!bytes) { await route.fulfill({ status: 404, body: '' }); return; }
    const range = route.request().headers().range;
    if (range) requestedRanges.push(range);
    await route.fulfill(studioMediaByteResponse(bytes, { method: route.request().method(), range }));
  });
  await page.route('**/api/legal/cookies/version', (route) => route.fulfill({
    json: { ok: true, version: 'studio-decode-fixture', publishedAt: null },
  }));
  await page.route('**/api/legal/cookies', (route) => route.fulfill({ json: { ok: true, version: 'studio-decode-fixture' } }));
  await page.addInitScript((timelineItems) => {
    localStorage.setItem('maxvideoai.editor.workspace.v1', JSON.stringify({
      nodes: [], edges: [], projectAssets: [], timelineItems,
      activeSequenceId: 'sequence-main', activeTemplateId: 'minimal-start', focusMode: 'viewer',
      audioTrackCount: 1, videoTrackCount: 1, hiddenVideoTracks: [], lockedTimelineTracks: [], mutedAudioTracks: [],
      timelinePanelHeight: 300, projectSettings: { aspectRatio: '16:9', resolution: '1080p', fps: 30 },
    }));
  }, items);
  await openEditorWorkspace(page);
  await switchEditorFocus(page, 'Viewer');
  const videoA = page.locator('video[data-playback-item-id="decode-video-a"]');
  const videoB = page.locator('video[data-playback-item-id="decode-video-b"]');
  const audioA = page.locator('audio[data-playback-audio-item-id="decode-audio-a"]');
  await expect(videoA).toHaveCount(1);
  await expect.poll(() => videoA.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  // Instrument native readers only. The assertions below never read the editor clock.
  await page.locator('video[data-playback-item-id]').evaluateAll((elements) => {
    for (const element of elements) {
      const video = element as HTMLVideoElement;
      video.dataset.proofFrames = '0';
      const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
        video.dataset.proofFrames = String(Number(video.dataset.proofFrames) + 1);
        video.dataset.proofMediaTime = String(metadata.mediaTime);
        video.dataset.proofWidth = String(metadata.width);
        video.dataset.proofHeight = String(metadata.height);
        if (video.isConnected) video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    }
  });
  await audioA.evaluate((element) => {
    const audio = element as HTMLAudioElement & { __studioProof?: { analyser: AnalyserNode; context: AudioContext } };
    const context = new AudioContext();
    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    source.connect(analyser);
    analyser.connect(context.destination);
    audio.__studioProof = { analyser, context };
    document.addEventListener('click', () => { void context.resume(); }, { once: true });
  });
  await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
  await expect.poll(() => videoA.getAttribute('data-proof-frames').then(Number)).toBeGreaterThan(1);
  await expect.poll(() => videoA.getAttribute('data-proof-media-time').then(Number)).toBeGreaterThan(1.05);
  expect(Number(await videoA.getAttribute('data-proof-media-time'))).toBeLessThan(3);
  await expect(videoA).toHaveAttribute('data-proof-width', '320');
  await expect(videoA).toHaveAttribute('data-proof-height', '180');
  let audioRms = 0;
  await expect.poll(async () => {
    audioRms = await audioA.evaluate((element) => {
    const audio = element as HTMLAudioElement & { __studioProof?: { analyser: AnalyserNode; context: AudioContext } };
    if (!audio.__studioProof || audio.paused || audio.muted || audio.volume <= 0) return 0;
    const samples = new Float32Array(audio.__studioProof.analyser.fftSize);
    audio.__studioProof.analyser.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
    });
    return audioRms;
  }).toBeGreaterThan(0.005);
  expect(await audioA.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeGreaterThan(1.05);
  const nativeEvidence = {
    frames: Number(await videoA.getAttribute('data-proof-frames')),
    mediaTime: Number(await videoA.getAttribute('data-proof-media-time')),
    audioTime: await audioA.evaluate((element) => (element as HTMLAudioElement).currentTime),
    audioRms,
  };
  // Linked audio owns sound; embedded video must not produce a second copy.
  expect(await videoA.evaluate((element) => (element as HTMLVideoElement).muted)).toBe(true);
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  await expect.poll(() => audioA.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(true);
  await page.getByLabel('Timeline scrubber').evaluate((element) => {
    const input = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2.5');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(() => videoB.getAttribute('data-proof-media-time').then(Number)).toBeCloseTo(1, 1);
  expect(await videoB.evaluate((element) => (element as HTMLVideoElement).paused)).toBe(true);
  expect(requestedRanges.length).toBeGreaterThan(0);
  await audioA.evaluate(async (element) => {
    await (element as HTMLAudioElement & { __studioProof?: { context: AudioContext } }).__studioProof?.context.close();
  });
  assertNoEditorClientErrors(errors);
  await test.info().attach('native-decode-evidence', {
    body: JSON.stringify({ fixture: 'local H264/AAC 6s, two moving patterns', nativeEvidence,
      secondSourceMediaTime: Number(await videoB.getAttribute('data-proof-media-time')),
      observed: ['decoded320x180', 'linked embedded audio muted', 'paused source seek1s'], ranges: requestedRanges }),
    contentType: 'application/json',
  });
});
