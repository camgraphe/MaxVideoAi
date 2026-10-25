import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useWorkspaceGalleryActions } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGalleryActions';
import type { Job } from '../frontend/types/jobs';
import type { VideoGroup } from '../frontend/types/video-groups';

const first: Job = {
  jobId: 'starter-first', engineId: 'wan-3-prime', engineLabel: 'Wan 3 Prime', durationSec: 5,
  prompt: 'First editorial sample', createdAt: '2026-01-01T00:00:00Z', status: 'completed', curated: true,
  videoUrl: 'https://example.com/first.mp4', thumbUrl: 'https://example.com/first.jpg', aspectRatio: '16:9',
};
const newer: Job = { ...first, jobId: 'starter-newer', prompt: 'Newer second sample',
  createdAt: '2026-10-01T00:00:00Z', videoUrl: 'https://example.com/newer.mp4' };
const initialPreviewGroup: VideoGroup = {
  id: 'initial-starter-first', provider: 'fal', layout: 'x1', status: 'ready', createdAt: first.createdAt,
  items: [{ id: first.jobId, jobId: first.jobId, url: first.videoUrl!, aspect: '16:9', meta: { curated: true } }],
};

function mount(overrides: { guestStarterReady?: boolean; prompt?: string; recentJobs?: Job[] } = {}) {
  const selected: Array<{ id: string; prompt?: string | null }> = [];
  const hydrated: string[] = [];
  const noop = () => {};
  let actions!: ReturnType<typeof useWorkspaceGalleryActions>;
  function Fixture({ recentJobs = overrides.recentJobs ?? [first, newer] }: { recentJobs?: Job[] }) {
    actions = useWorkspaceGalleryActions({
      guestStarterReady: true, prompt: '', initialPreviewGroup, provider: 'fal',
      renderGroups: new Map(), batchHeroes: {}, fallbackEngineId: 'wan-3-prime',
      sharedPrompt: null, selectedPreview: null, compositeOverrideSummary: null,
      applyVideoSettingsFromTile: () => true, hydrateVideoSettingsFromJob: async id => { if (id) hydrated.push(id); },
      focusComposer: noop, showNotice: noop, writeScopedStorage: noop, setPrompt: noop, setActiveGroupId: noop,
      setViewMode: noop, setActiveBatchId: noop, setBatchHeroes: noop,
      setSelectedPreview: value => { if (value && typeof value !== 'function') selected.push(value); },
      setCompositeOverride: noop, setCompositeOverrideSummary: noop, setSharedPrompt: noop,
      ...overrides, recentJobs,
    });
    return null;
  }
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Fixture)); });
  return { selected, hydrated, actions: () => actions, update: (jobs: Job[]) => act(() => renderer.update(React.createElement(Fixture, { recentJobs: jobs }))),
    unmount: () => act(() => renderer.unmount()) };
}

test('gallery hydration keeps the server-selected first Starter video and its prompt, without autoplay', () => {
  const fixture = mount();
  try {
    assert.deepEqual(fixture.hydrated, [first.jobId]);
    assert.equal(fixture.selected[0]?.prompt, first.prompt);
    assert.equal(fixture.actions().previewAutoPlayRequestId, 0);
  } finally { fixture.unmount(); }
});

test('explicit links and restored drafts disable automatic Starter selection', () => {
  const fixture = mount({ guestStarterReady: false });
  try { assert.deepEqual(fixture.hydrated, []); } finally { fixture.unmount(); }
});

test('a prompt entered before the gallery loads is preserved', () => {
  const fixture = mount({ prompt: 'My prepared prompt' });
  try { assert.deepEqual(fixture.hydrated, []); } finally { fixture.unmount(); }
});

test('a partial gallery waits for the selected Starter and applies it once it arrives', () => {
  const fixture = mount({ recentJobs: [newer] });
  try {
    assert.deepEqual(fixture.hydrated, []);
    fixture.update([first, newer]);
    assert.deepEqual(fixture.hydrated, [first.jobId]);
    fixture.update([newer, first]);
    assert.deepEqual(fixture.hydrated, [first.jobId]);
  } finally { fixture.unmount(); }
});

test('the initial Starter stays selected even when it is not the gallery batch hero', () => {
  const fixture = mount({ recentJobs: [{ ...first, groupId: 'sample-batch' }, { ...newer, groupId: 'sample-batch' }] });
  try {
    assert.deepEqual(fixture.hydrated, [first.jobId]);
    assert.equal(fixture.selected[0]?.prompt, first.prompt);
  } finally { fixture.unmount(); }
});
