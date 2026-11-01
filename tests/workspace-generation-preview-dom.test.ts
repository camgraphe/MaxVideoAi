import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import type { Dictionary } from '../frontend/lib/i18n/types';
import type { EngineCaps } from '../frontend/types/engines';
import type { Job } from '../frontend/types/jobs';
import type { VideoGroup } from '../frontend/types/video-groups';
import {
  prepareLocalGenerationRender,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-local-generation-render';
import {
  applyAcceptedGenerationResultToRender,
  applyAcceptedGenerationResultToSelectedPreview,
  projectAcceptedGenerationResult,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-result';

const original = '/renders/current-original.mp4';
const playback = '/renders/current-playback.mp4';
const shortPreview = '/renders/current-short-preview.mp4';
const placeholder = '/assets/frames/thumb-16x9.svg';
const dictionary = {} as Dictionary;
const noop = () => {};

async function mountPreview() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://maxvideoai-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; resolve: (response: Response) => void }> = [];
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  let playCalls = 0;
  const downloads: string[] = [];
  dom.window.setInterval = ((callback: () => void, delay: number) => {
    timers.set(++timerId, { callback, delay });
    return timerId;
  }) as typeof dom.window.setInterval;
  dom.window.clearInterval = id => { timers.delete(id); };
  dom.window.HTMLMediaElement.prototype.play = async () => { playCalls += 1; };
  dom.window.HTMLMediaElement.prototype.pause = noop;
  dom.window.HTMLMediaElement.prototype.load = noop;
  dom.window.HTMLAnchorElement.prototype.click = function () { downloads.push(this.href); };
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, HTMLMediaElement: dom.window.HTMLMediaElement,
    Event: dom.window.Event, CustomEvent: dom.window.CustomEvent,
    React, IS_REACT_ACT_ENVIRONMENT: true, BroadcastChannel: undefined,
    fetch: (url: string) => new Promise<Response>(resolve => requests.push({ url, resolve })),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = noop;
  const { CompositePreviewDock } = await import('../frontend/components/groups/CompositePreviewDock');
  if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
  else delete require.extensions['.css'];
  const { useWorkspaceRenderState } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRenderState');
  const { useWorkspacePreviewState } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePreviewState');
  let state!: ReturnType<typeof useWorkspaceRenderState>;
  let preview!: ReturnType<typeof useWorkspacePreviewState>;
  let recentJobs: Job[] = [];
  let override: VideoGroup | null = null;
  let openedGroup: VideoGroup | undefined;
  const options = {
    engineIdByLabel: new Map<string, string>(), provider: 'fal' as const,
    storageScope: 'preview-owner', hydratedForScope: 'preview-owner', formIterations: 1,
    compositeOverrideSummary: null, writeScopedStorage: noop, uiLocale: 'en', workspaceCopy: {},
  };
  function Fixture() {
    state = useWorkspaceRenderState({ ...options, recentJobs, compositeOverride: override });
    preview = useWorkspacePreviewState({
      ...options, recentJobs, compositeOverride: override, selectedPreview: state.selectedPreview,
      pendingSummaryMap: state.pendingSummaryMap, activeVideoGroup: state.activeVideoGroup,
      initialPreviewGroup: null, effectiveRequestedEngineId: null, effectiveRequestedEngineToken: null,
      requestedJobId: null, fromVideoId: null,
    });
    return React.createElement(I18nProvider, {
      locale: 'en', dictionary, fallback: dictionary,
      children: React.createElement(CompositePreviewDock, {
        density: 'workspace', group: preview.displayCompositeGroup,
        onOpenModal: group => { openedGroup = group; },
      }),
    });
  }
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  const render = () => act(async () => root.render(React.createElement(Fixture)));
  await render();
  const local = prepareLocalGenerationRender({
    batchId: 'batch-local', iterationIndex: 0, iterationCount: 1,
    selectedEngine: { id: 'test-video', label: 'Test Video' } as EngineCaps,
    form: { aspectRatio: '16:9' }, effectiveDurationSec: 1,
    effectivePrompt: 'A deterministic preview fixture', formatTakeLabel: () => '',
  });
  const accepted = projectAcceptedGenerationResult({
    response: { jobId: 'job_current', batchId: 'batch-server', groupId: 'group-server', status: 'pending' },
    fallback: {
      id: local.id, batchId: 'batch-local', iterationIndex: 0, iterationCount: 1,
      thumbUrl: local.thumb, currency: 'USD', message: '', minReadyAt: local.minReadyAt,
      aspectRatio: '16:9', localKey: local.localKey,
    }, now: Date.now(),
  });
  return {
    dom, container, requests, downloads,
    get state() { return state; },
    get group() { return preview.displayCompositeGroup; },
    get openedGroup() { return openedGroup; },
    get playCalls() { return playCalls; },
    get video() { return container.querySelector<HTMLVideoElement>('video'); },
    async start() {
      await act(async () => {
        state.setRenders([local.initialRender]);
        state.setSelectedPreview(local.selectedPreview);
        state.setActiveGroupId('batch-local');
      });
    },
    async accept() {
      await act(async () => {
        state.setRenders(previous => previous.map(item => applyAcceptedGenerationResultToRender(item, accepted)));
        state.setSelectedPreview(current => applyAcceptedGenerationResultToSelectedPreview(current, accepted));
        state.setActiveGroupId('group-server');
      });
    },
    async complete(thumbUrl: string | null = null, playbackVideoUrl: string | null = playback) {
      assert.equal(requests.length, 1);
      assert.equal(requests[0].url, '/api/jobs/job_current');
      await act(async () => requests[0].resolve(new Response(JSON.stringify({
        ok: true, jobId: 'job_current', status: 'completed', progress: 100,
        videoUrl: original, playbackVideoUrl, previewVideoUrl: shortPreview, thumbUrl,
        paymentStatus: 'paid_wallet',
      }))));
      recentJobs = [{
        jobId: 'job_current', localKey: local.localKey, batchId: 'batch-server', groupId: 'group-server',
        engineLabel: 'Test Video', durationSec: 1, prompt: local.initialRender.prompt,
        createdAt: local.initialRender.createdAt, status: 'completed', videoUrl: original,
        playbackVideoUrl, previewVideoUrl: shortPreview, thumbUrl,
      }];
      await render();
    },
    async selectOther() {
      await act(async () => state.setSelectedPreview({
        id: 'job_other', status: 'completed', videoUrl: '/renders/other.mp4',
        thumbUrl: '/renders/other.jpg', aspectRatio: '9:16',
      }));
    },
    async showCurated() {
      override = { id: 'curated', provider: 'fal', layout: 'x1', status: 'ready', createdAt: '',
        items: [{ id: 'demo', url: '/renders/demo.mp4', aspect: '16:9', meta: { curated: true } }] };
      await render();
    },
    async click(label: string) {
      const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      assert.ok(button, label);
      await act(async () => button.click());
    },
    async mediaEvent(type: string, element: Element | null = container.querySelector('video')) {
      assert.ok(element, `a media element must exist before ${type}`);
      if (type === 'loadeddata') Object.defineProperty(element, 'readyState', { configurable: true, value: 2 });
      await act(async () => element.dispatchEvent(new dom.window.Event(type)));
    },
    async tick() {
      await act(async () => [...timers.values()].filter(timer => timer.delay === 15_000).forEach(timer => timer.callback()));
    },
    async dispose() {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

for (const thumb of [null, placeholder]) {
  test(`a new completed result without a usable poster displays its paused video (thumb=${thumb})`, async () => {
    const fixture = await mountPreview();
    try {
      await fixture.start();
      assert.equal(fixture.video, null);
      assert.ok(fixture.container.querySelector('.generation-pending-status'));
      assert.equal(fixture.state.selectedPreview?.id, 'local_batch-local_1');
      await fixture.accept();
      assert.equal(fixture.state.selectedPreview?.id, 'job_current');
      assert.equal(fixture.video, null);
      await fixture.complete(thumb);
      assert.equal(fixture.state.renders.length, 0, 'the completed job now belongs to history');
      assert.equal(fixture.group?.items[0].jobId, 'job_current');
      assert.equal(fixture.video?.getAttribute('src'), playback, 'full playback stays separate from the short rail preview');
      assert.equal(fixture.video?.autoplay, false);
      assert.equal(fixture.video?.paused, true);
      assert.equal(fixture.playCalls, 0);
      assert.equal(fixture.container.querySelector('.generation-pending-status'), null);
      assert.equal(fixture.container.querySelector('figure img'), null, 'the white placeholder cannot cover the first frame');
      await fixture.mediaEvent('loadeddata');
      await fixture.tick();
      assert.equal(fixture.requests.length, 1, 'available output stops status polling');
      await fixture.click('Download preview');
      assert.equal(new URL(fixture.downloads[0]).searchParams.get('url'), original);
      await fixture.click('Open preview in modal');
      assert.equal(fixture.openedGroup?.items[0].url, original);
      const reader = fixture.video;
      assert.ok(reader);
      reader.currentTime = 0.75;
      await fixture.click('Play all previews');
      assert.ok(fixture.playCalls > 0, 'manual Play starts the prepared paused reader');
      await fixture.click('Pause all previews');
      assert.equal(fixture.video, reader, 'Pause retains the decoded frame instead of returning to a white placeholder');
      assert.equal(fixture.video?.currentTime, 0.75);
      assert.equal(fixture.container.querySelector('figure img'), null);
    } finally { await fixture.dispose(); }
  });
}

test('a posterless result uses the exact original when no full playback rendition exists', async () => {
  const fixture = await mountPreview();
  try {
    await fixture.start(); await fixture.accept(); await fixture.complete(null, null);
    assert.equal(fixture.video?.getAttribute('src'), original);
    assert.equal(fixture.video?.autoplay, false);
    assert.equal(fixture.playCalls, 0);
  } finally { await fixture.dispose(); }
});

test('a real poster keeps its idle loading policy and a failed poster falls back to paused video', async () => {
  const fixture = await mountPreview();
  try {
    await fixture.start(); await fixture.accept(); await fixture.complete('/renders/real-poster.jpg');
    assert.equal(fixture.video, null);
    const poster = fixture.container.querySelector('figure img');
    assert.ok(poster);
    assert.match(poster.getAttribute('src')!, /real-poster/);
    await fixture.mediaEvent('error', poster);
    assert.equal(fixture.video?.getAttribute('src'), playback);
    assert.equal(fixture.video?.autoplay, false);
    assert.equal(fixture.playCalls, 0);
  } finally { await fixture.dispose(); }
});

test('a failed first-frame reader reports preview unavailability and switching results clears that state', async () => {
  const fixture = await mountPreview();
  try {
    await fixture.start(); await fixture.accept(); await fixture.complete();
    await fixture.mediaEvent('error');
    assert.match(fixture.container.querySelector('figure [role="status"]')?.textContent ?? '', /Preview unavailable/);
    assert.equal(fixture.container.querySelector('.generation-pending-status'), null);
    assert.equal(fixture.group?.items[0].url, original, 'playback failure does not change the completed output');
    await fixture.selectOther();
    assert.equal(fixture.group?.items[0].url, '/renders/other.mp4');
    assert.equal(fixture.container.querySelector('figure [role="status"]'), null);
    assert.equal(fixture.video, null);
  } finally { await fixture.dispose(); }
});

test('completion preserves a result selected by the user while the new render was pending', async () => {
  const fixture = await mountPreview();
  try {
    await fixture.start(); await fixture.accept(); await fixture.selectOther(); await fixture.complete();
    assert.equal(fixture.group?.items[0].jobId, 'job_other');
    assert.equal(fixture.video, null);
    await fixture.click('Play all previews');
    assert.equal(fixture.video?.getAttribute('src'), '/renders/other.mp4');
  } finally { await fixture.dispose(); }
});

test('a curated demonstration without a poster never loads an idle video', async () => {
  const fixture = await mountPreview();
  try {
    await fixture.showCurated();
    assert.equal(fixture.video, null);
    assert.equal(fixture.playCalls, 0);
    assert.deepEqual(fixture.requests, []);
  } finally { await fixture.dispose(); }
});
