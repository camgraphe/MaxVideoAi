import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Job } from '../frontend/types/jobs';

const jobs: Job[] = Array.from({ length: 7 }, (_, index) => ({
  jobId: `job_${index}`,
  engineLabel: 'MiniMax H3',
  durationSec: 5,
  prompt: 'Polling regression fixture',
  createdAt: `2026-09-06T20:0${index}:00.000Z`,
  status: 'pending',
  message: 'IN_PROGRESS',
}));

async function mountWorkspace(initialJobs = jobs, localOnly = false) {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://maxvideoai-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ jobId: string; resolve: (response: Response) => void }> = [];
  const intervals = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  dom.window.setInterval = ((callback: () => void, delay: number) => {
    intervals.set(++timerId, { callback, delay });
    return timerId;
  }) as typeof dom.window.setInterval;
  dom.window.clearInterval = (id) => { intervals.delete(id); };
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    CustomEvent: dom.window.CustomEvent, React, IS_REACT_ACT_ENVIRONMENT: true,
    BroadcastChannel: undefined,
    fetch: (url: string) => new Promise<Response>((resolve) => {
      requests.push({ jobId: decodeURIComponent(url.split('/').pop()!), resolve });
    }),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { useWorkspaceRenderState } = await import(
    '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRenderState'
  );
  let state!: ReturnType<typeof useWorkspaceRenderState>;
  let recentJobs = localOnly ? [] : initialJobs;
  const options = {
    engineIdByLabel: new Map<string, string>(), provider: 'fal' as const,
    storageScope: 'test-user', hydratedForScope: 'test-user', formIterations: 1,
    compositeOverride: null, compositeOverrideSummary: null,
    writeScopedStorage: () => undefined,
    workspaceCopy: { messages: { seedanceCopyrightBlocked: 'Blocked', seedanceCopyrightBlockedRefunded: 'Refunded' } },
  };
  const commits: string[][] = [];
  function Fixture() {
    state = useWorkspaceRenderState({ ...options, recentJobs });
    React.useLayoutEffect(() => { commits.push(state.renders.map((render) => render.jobId!)); });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  if (localOnly) {
    const { convertJobToLocalRender } = await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-render-status');
    await act(async () => state.setRenders(initialJobs.map((job) => convertJobToLocalRender(job))));
  }
  return {
    requests, commits,
    get state() { return state; },
    async respond(index: number, payload: Record<string, unknown> = {}, status = 200) {
      await act(async () => requests[index].resolve(new Response(JSON.stringify({
        ok: true, jobId: requests[index].jobId, status: 'pending', message: 'IN_PROGRESS', ...payload,
      }), { status })));
    },
    async tick() {
      await act(async () => {
        [...intervals.values()].filter((timer) => timer.delay === 4000).forEach((timer) => timer.callback());
      });
    },
    async update(nextJobs: Job[]) {
      recentJobs = nextJobs;
      await act(async () => root.render(React.createElement(Fixture)));
    },
    async dispose() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('seven in-flight renders do not restart polling on each status response or feed refresh', async () => {
  const fixture = await mountWorkspace();
  try {
    assert.equal(fixture.requests.length, 7);
    await fixture.tick();
    assert.equal(fixture.requests.length, 7, 'slow requests must not overlap with the next interval');
    await fixture.respond(0);
    assert.equal(fixture.requests.length, 7, 'a single pending response must not start another seven requests');
    await fixture.update(jobs.map((job) => ({ ...job })));
    assert.equal(fixture.requests.length, 7, 'a feed refresh must not restart the polling interval');
    for (let index = 1; index < 7; index += 1) await fixture.respond(index);
    await fixture.tick();
    assert.equal(fixture.requests.length, 14, 'the next interval polls once per still-pending render');
  } finally { await fixture.dispose(); }
});

test('polling keeps completion, delayed thumbnails, failures and missing-job cleanup working', async () => {
  const fixture = await mountWorkspace(jobs.slice(0, 4), true);
  try {
    const ids = fixture.requests.map((request) => request.jobId);
    await fixture.respond(0, { status: 'completed', videoUrl: '/video.mp4', thumbUrl: '/thumb.jpg' });
    await fixture.respond(1, { status: 'failed', message: 'Provider failed' });
    await fixture.respond(2, { error: 'Not found' }, 404);
    await fixture.respond(3, { status: 'completed', videoUrl: '/video.mp4' });
    assert.equal(fixture.state.renders.find((render) => render.jobId === ids[0])?.status, 'completed');
    assert.equal(fixture.state.renders.find((render) => render.jobId === ids[1])?.status, 'failed');
    assert.equal(fixture.state.renders.some((render) => render.jobId === ids[2]), false);
    await fixture.tick();
    assert.deepEqual(fixture.requests.slice(4).map((request) => request.jobId), [ids[3]], 'only a missing thumbnail still needs polling');
    await fixture.respond(4, { status: 'completed', videoUrl: '/video.mp4', thumbUrl: '/thumb.jpg' });
    await fixture.tick();
    assert.equal(fixture.requests.length, 5);
  } finally { await fixture.dispose(); }
});

test('history refresh does not temporarily reinsert finished jobs into local renders', async () => {
  const finished = { ...jobs[0], status: 'completed', videoUrl: '/video.mp4', thumbUrl: '/thumb.jpg' };
  const fixture = await mountWorkspace([jobs[1], finished]);
  try {
    await fixture.update([{ ...jobs[1] }, { ...finished }]);
    assert.equal(fixture.commits.some((ids) => ids.includes('job_0')), false, 'finished history must never flash back into the active list');
  } finally { await fixture.dispose(); }
});

test('transient status errors retry and unauthorized renders are removed only after three responses', async () => {
  const fixture = await mountWorkspace(jobs.slice(0, 1), true);
  try {
    await fixture.respond(0, { error: 'Temporary outage' }, 503);
    assert.equal(fixture.state.renders.length, 1);
    await fixture.tick();
    for (let index = 1; index <= 3; index += 1) {
      await fixture.respond(index, { error: 'Unauthorized' }, 401);
      assert.equal(fixture.state.renders.length, index < 3 ? 1 : 0);
      await fixture.tick();
    }
    assert.equal(fixture.requests.length, 4, 'removed renders must stop polling');
  } finally { await fixture.dispose(); }
});

test('new jobs join the next polling cycle while a slow existing job stays in flight', async () => {
  const fixture = await mountWorkspace(jobs.slice(0, 1));
  try {
    await fixture.update(jobs.slice(0, 2));
    assert.equal(fixture.requests.length, 1, 'new feed data does not restart the timer');
    await fixture.tick();
    assert.deepEqual(fixture.requests.map((request) => request.jobId), ['job_0', 'job_1']);
  } finally { await fixture.dispose(); }
});
