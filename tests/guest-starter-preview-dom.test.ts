import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { useWorkspaceGalleryActions } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGalleryActions';
import { useImageWorkspaceDisplayState } from '../frontend/app/(core)/(workspace)/app/image/_hooks/useImageWorkspaceDisplayState';
import type { GroupSummary } from '../frontend/types/groups';
import type { SelectedVideoPreview } from '../frontend/lib/video-preview-group';

async function mount(element: React.ReactNode) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => new Response(JSON.stringify({ items: [] }), { status: 200 }) };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const cache = new Map();
  const render = async (child: React.ReactNode) => { await act(async () => root.render(React.createElement(SWRConfig, { value: { provider: () => cache, isVisible: () => false }, children: child }))); };
  await render(element);
  return { render, async cleanup() {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  } };
}

function sample(id: string, prompt: string): GroupSummary {
  const hero: GroupSummary['hero'] = { id, jobId: id, engineId: 'wan-3', engineLabel: 'Wan 3', durationSec: 5, prompt,
    videoUrl: `https://media.maxvideoai.com/${id}.mp4`, thumbUrl: `https://media.maxvideoai.com/${id}.webp`,
    createdAt: '2026-10-01', source: 'job', job: { jobId: id, curated: true, engineId: 'wan-3', engineLabel: 'Wan 3', durationSec: 5,
      prompt, status: 'completed', createdAt: '2026-10-01', videoUrl: `https://media.maxvideoai.com/${id}.mp4`, thumbUrl: `https://media.maxvideoai.com/${id}.webp` } };
  return { id, source: 'history', count: 1, totalPriceCents: null, createdAt: hero.createdAt, hero, members: [hero], previews: [] };
}

test('a fresh guest opens the first video with its prompt once, then can advance without overwriting edits on feed refresh', async () => {
  let ready = false, promptValue = 'A quiet cinematic shot of neon-lit Tokyo streets in the rain';
  let preview: SelectedVideoPreview | null = null;
  let gallery!: ReturnType<typeof useWorkspaceGalleryActions>, edit!: (value: string) => void;
  const first = sample('first', 'A raccoon in the rain'), second = sample('second', 'A basketball in the metro');
  const noop = () => {};
  function Fixture() {
    const [prompt, setPrompt] = React.useState(promptValue);
    const [selectedPreview, setSelectedPreview] = React.useState<SelectedVideoPreview | null>({ id: 'first', videoUrl: 'https://media.maxvideoai.com/first.mp4' });
    const [summary, setSummary] = React.useState<GroupSummary | null>(null);
    promptValue = prompt; preview = selectedPreview; edit = setPrompt;
    gallery = useWorkspaceGalleryActions({ provider: 'fal', renderGroups: new Map(), batchHeroes: {}, fallbackEngineId: 'wan-3',
      prompt, guestStarterReady: ready, recentJobs: [first.hero.job!, second.hero.job!], sharedPrompt: null, selectedPreview, compositeOverrideSummary: summary,
      applyVideoSettingsFromTile: tile => setPrompt(tile.prompt), hydrateVideoSettingsFromJob: async () => {},
      focusComposer: noop, showNotice: noop, writeScopedStorage: noop, setPrompt, setActiveGroupId: noop,
      setViewMode: noop, setActiveBatchId: noop, setBatchHeroes: noop, setSelectedPreview,
      setCompositeOverride: noop, setCompositeOverrideSummary: setSummary, setSharedPrompt: noop,
    });
    return null;
  }
  const view = await mount(React.createElement(Fixture));
  try {
    assert.equal(promptValue, 'A quiet cinematic shot of neon-lit Tokyo streets in the rain', 'the initial curated poster must wait for draft readiness before applying settings');
    ready = true; await view.render(React.createElement(Fixture));
    assert.equal((preview as SelectedVideoPreview | null)?.videoUrl, 'https://media.maxvideoai.com/first.mp4');
    assert.equal(promptValue, 'A raccoon in the rain');
    assert.equal(gallery.previewAutoPlayRequestId, 0, 'initial selection must remain manual playback');
    await act(async () => edit('My edited prompt'));
    await act(async () => gallery.handleGalleryFeedStateChange({ visibleGroups: [first, second], sampleOnly: true }));
    assert.equal(promptValue, 'My edited prompt');
    await act(async () => gallery.guidedNavigation?.onNext());
    assert.equal((preview as SelectedVideoPreview | null)?.videoUrl, 'https://media.maxvideoai.com/second.mp4');
    assert.equal(promptValue, 'A basketball in the metro');
  } finally { await view.cleanup(); }
});

test('the image guest receives a sample preview and prompt outside owned history, retaining edits and manual sample selection', async () => {
  let ready = false, promptValue = '', edit!: (value: string) => void;
  let display!: ReturnType<typeof useImageWorkspaceDisplayState>;
  function Fixture() {
    const [prompt, setPrompt] = React.useState(''); promptValue = prompt; edit = setPrompt;
    display = useImageWorkspaceDisplayState({ error: null, historyEntries: [], numImages: 1, pendingGroups: [],
      pricingErrorMessage: null, pricingSnapshot: null, selectedEngine: undefined, selectedPreviewEntryId: null,
      guestStarter: { ready, prompt, setPrompt },
    });
    return null;
  }
  const view = await mount(React.createElement(Fixture));
  try {
    assert.equal(display.starterPreview ?? null, null);
    ready = true; await view.render(React.createElement(Fixture));
    assert.equal(display.starterPreview?.src, '/assets/app-starters/night-shift-9f91929fe7da.webp');
    assert.match(promptValue, /raccoon/);
    assert.equal(display.previewEntry, undefined, 'a sample must never become an owned image');
    await act(async () => edit('My image idea'));
    await view.render(React.createElement(Fixture));
    assert.equal(promptValue, 'My image idea');
    await act(async () => display.starterNavigation.onNext?.());
    assert.equal(display.starterPreview?.id, 'acid-portrait');
    assert.match(promptValue, /punk woman/);
  } finally { await view.cleanup(); }
});

test('image boot preserves saved prompts and excludes explicit entries and signed-in visits', async () => {
  for (const scenario of [{ ready: true, prompt: 'My saved prompt', suppress: false }, { ready: false, prompt: '', suppress: false }, { ready: true, prompt: '', suppress: true }]) {
    let observedPrompt = scenario.prompt;
    let display!: ReturnType<typeof useImageWorkspaceDisplayState>;
    function Fixture() {
      const [prompt, setPrompt] = React.useState(scenario.prompt); observedPrompt = prompt;
      display = useImageWorkspaceDisplayState({ error: null, historyEntries: [], numImages: 1, pendingGroups: [],
        pricingErrorMessage: null, pricingSnapshot: null, selectedEngine: undefined, selectedPreviewEntryId: null,
        suppressDefaultPreview: scenario.suppress, guestStarter: { ready: scenario.ready, prompt, setPrompt } });
      return null;
    }
    const view = await mount(React.createElement(Fixture));
    try { assert.equal(display.starterPreview, null); assert.equal(observedPrompt, scenario.prompt); }
    finally { await view.cleanup(); }
  }
});
