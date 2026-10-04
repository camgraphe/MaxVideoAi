import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useWorkspacePreviewState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePreviewState';
import { useWorkspaceVideoSettings } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings';
import type { VideoGroup } from '../frontend/types/video-groups';
import type { SelectedVideoPreview } from '../frontend/src/lib/video-preview-group';

type Options = Parameters<typeof useWorkspaceVideoSettings>[0];
const noop = () => {};
const engines = [{ id: 'fixture-engine', label: 'Fixture', modes: ['t2v'] }] as Options['engines'];
const engineMap = new Map(engines.map(engine => [engine.id, engine]));
const latest: VideoGroup = {
  id: 'initial-job_latest', provider: 'fal', layout: 'x1', status: 'ready',
  createdAt: '2026-10-04T12:00:00Z',
  items: [{ id: 'job_latest', jobId: 'job_latest', url: '/latest.mp4', thumb: '/latest.jpg', aspect: '9:16' }],
};
const oldPayload = {
  ok: true, status: 'completed', videoUrl: '/old.mp4', thumbUrl: '/old.jpg', aspectRatio: '16:9',
  createdAt: '2026-01-01T12:00:00Z',
  settingsSnapshot: { schemaVersion: 1, surface: 'video', engineId: 'fixture-engine', prompt: 'Old prompt',
    core: { mode: 't2v', durationSec: 5, resolution: '720p', aspectRatio: '16:9' } },
};

async function mount(initialPreviewGroup: VideoGroup | null, patch: Partial<Options> = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; resolve: (response: Response) => void }> = [];
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string) => new Promise<Response>(resolve => requests.push({ url, resolve })),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  function Fixture() {
    const [compositeOverride, setCompositeOverride] = React.useState<VideoGroup | null>(null);
    const [selectedPreview, setSelectedPreview] = React.useState<SelectedVideoPreview | null>(null);
    const [prompt, setPrompt] = React.useState('Current draft');
    const options: Options = {
      accountScope: 'fixture-account', activeDraftReady: true, hasActiveSetup: true,
      initialPreviewGroup, engines, engineMap, provider: 'fal',
      fromVideoId: null, requestedJobId: null, searchString: '', sharedVideoSettings: null,
      authChecked: true, hydratedForScope: 'fixture-account', storageScope: 'fixture-account',
      effectiveRequestedEngineId: null, effectiveRequestedEngineToken: null, rendersLength: 0,
      compositeOverride, compositeOverrideSummary: null, focusComposer: noop,
      readScopedStorage: () => 'job_old', writeScopedStorage: noop, replaceRoute: noop,
      setPrompt, setSelectedPreview, setCompositeOverride,
      setNegativePrompt: noop, setMemberTier: noop, setCfgScale: noop, setShotType: noop,
      setVoiceIdsInput: noop, setMultiPromptEnabled: noop, setMultiPromptScenes: noop,
      setForm: noop, setInputAssets: noop, setKlingElements: noop,
      setCompositeOverrideSummary: noop, setSharedPrompt: noop, setSharedVideoSettings: noop, setNotice: noop,
      ...patch,
    };
    useWorkspaceVideoSettings(options);
    const preview = useWorkspacePreviewState({
      ...options, recentJobs: [], selectedPreview, pendingSummaryMap: new Map(), activeVideoGroup: null,
    });
    const item = preview.displayCompositeGroup?.items[0];
    return React.createElement('div', null,
      item ? React.createElement('video', { src: item.url, 'data-aspect': item.aspect }) : null,
      React.createElement('textarea', { value: prompt, readOnly: true }));
  }
  await act(async () => root.render(React.createElement(Fixture)));
  return {
    requests,
    get video() { return dom.window.document.querySelector('video'); },
    get prompt() { return dom.window.document.querySelector('textarea')?.value; },
    async completeRequests() {
      await act(async () => {
        for (const request of requests) request.resolve(new Response(JSON.stringify(oldPayload)));
      });
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

test('the server-selected latest preview survives boot instead of loading a stale saved job', async () => {
  for (const hasActiveSetup of [true, false]) {
    const fixture = await mount(latest, { hasActiveSetup });
    try {
      assert.equal(fixture.video?.getAttribute('src'), '/latest.mp4');
      await fixture.completeRequests();
      assert.equal(fixture.video?.getAttribute('src'), '/latest.mp4');
      assert.equal(fixture.video?.getAttribute('data-aspect'), '9:16');
      assert.equal(fixture.prompt, 'Current draft');
      assert.deepEqual(fixture.requests, [], 'boot must not request media/settings for the stale saved preview');
    } finally { await fixture.dispose(); }
  }
});

test('legacy saved-preview restoration remains available when the server has no preview', async () => {
  const fixture = await mount(null);
  try {
    assert.equal(fixture.video, null);
    await fixture.completeRequests();
    assert.equal(fixture.video?.getAttribute('src'), '/old.mp4');
    assert.equal(fixture.prompt, 'Current draft');
    assert.deepEqual(fixture.requests.map(request => request.url), ['/api/jobs/job_old']);
  } finally { await fixture.dispose(); }
});

test('an explicit job link can still select its preview instead of the default latest render', async () => {
  const fixture = await mount(latest, { requestedJobId: 'job_requested' });
  try {
    await fixture.completeRequests();
    assert.equal(fixture.video?.getAttribute('src'), '/old.mp4');
    assert.equal(fixture.prompt, 'Old prompt');
    assert.deepEqual(fixture.requests.map(request => request.url), ['/api/jobs/job_requested']);
  } finally { await fixture.dispose(); }
});
