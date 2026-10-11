import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {useConversationTimeline, type ConversationTimelineView} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useConversationTimeline';

function view(projectId: string, grant: string, revision = 0): ConversationTimelineView {
  const ref = {type: 'asset' as const, assetId: 'ma_'+'1'.repeat(32), kind: 'video' as const};
  return {
    data: {projectId, sequenceId: 'sequence', sequenceName: 'Film', updatedAt: '2026-10-09T00:00:00Z', revision, fps: 30,
      clips: [{id: 'clip', title: 'Clip', kind: 'video', track: 'video', startFrame: 0, durationFrames: 90, sourceInFrame: 0, volume: 100, ref}]},
    settings: {fps: 30, aspectRatio: '16:9', resolution: '720p'},
    items: [{id: 'clip', title: 'Clip', track: 'video', startSec: 0, durationSec: 3, mediaKind: 'video', assetNodeId: 'asset', ref,
      mediaUrl: 'https://fixture.invalid/original.mp4', mediaAccessRequired: true,
      mediaAccessUrl: 'https://fixture.invalid/'+grant, mediaAccessExpiresAt: new Date(Date.now()+300_000).toISOString()}],
  };
}

async function mount(projectId = 'project-a') {
  const dom = new JSDOM('<div id="root"></div>', {url: 'http://localhost/app/studio/conversation/project-a', pretendToBeVisual: true});
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{url: string; init?: RequestInit; resolve: (response: Response) => void; reject: (error: Error) => void}> = [];
  const intervals = new Map<number, () => void>();
  let intervalId = 0, refreshKey = 0;
  dom.window.setInterval = ((callback: () => void) => {intervals.set(++intervalId, callback);return intervalId;}) as typeof dom.window.setInterval;
  dom.window.clearInterval = (id) => {intervals.delete(id);};
  for (const [key, value] of Object.entries({React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true, fetch: (url: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => requests.push({url, init, resolve, reject}))})) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
  }
  let state!: ReturnType<typeof useConversationTimeline>;
  const commits: Array<ConversationTimelineView | null> = [];
  function Fixture() {state = useConversationTimeline(projectId, refreshKey);commits.push(state.view);return null;}
  const root = createRoot(dom.window.document.getElementById('root')!);
  let mounted = true;
  await act(async () => root.render(React.createElement(Fixture)));
  const unmount = async () => {if (mounted) {mounted = false;await act(async () => root.unmount());}};
  return {
    requests, commits,
    get state() {return state;},
    async respond(index: number, grant = 'poll', revision = 0, ownedProject = projectId, additionalItemId?: string) {
      const result = view(ownedProject, grant, revision);
      if (additionalItemId) {
        result.items.push({...result.items[0],id: additionalItemId});
        result.data.clips.push({...result.data.clips[0],id: additionalItemId});
      }
      await act(async () => requests[index].resolve(Response.json({ok: true, result})));
    },
    async reject(index: number) {await act(async () => requests[index].reject(new Error('OFFLINE_FIXTURE')));},
    async refuse(index: number) {await act(async () => requests[index].resolve(Response.json({ok: false, error: 'UNAVAILABLE_FIXTURE'}, {status: 503})));},
    async tick() {await act(async () => {for (const callback of intervals.values()) callback();});},
    async startRefresh(renewMediaId?: string) {
      let done!: Promise<void>;await act(async () => {done = state.refresh(renewMediaId ? {renewMediaId} : undefined);});return {done};
    },
    async startEdit() {
      let done!: Promise<void>;await act(async () => {done = state.edit({kind: 'gain', clipId: 'clip', volume: 0});});return {done};
    },
    async changeProject(next: string) {projectId = next;await act(async () => root.render(React.createElement(Fixture)));},
    async invalidate() {refreshKey++;await act(async () => root.render(React.createElement(Fixture)));},
    unmount,
    async close() {await unmount();dom.window.close();for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);},
  };
}

const oldGrant = 'https://fixture.invalid/old';
const renewedGrant = 'https://fixture.invalid/renewed';

test('periodic loading waits for the initial timeline read', async () => {
  const fixture = await mount();
  try {
    await fixture.tick();
    assert.equal(fixture.requests.length, 1, 'The initial timeline read must not be superseded by periodic loading.');
    await fixture.respond(0, 'old');
    assert.equal(fixture.state.view?.items[0].mediaAccessUrl, oldGrant);
  } finally {await fixture.close();}
});

test('a periodic tick cannot discard a requested replacement for a still-valid rejected grant', async () => {
  const fixture = await mount();
  try {
    await fixture.respond(0, 'old');
    const renewal = await fixture.startRefresh('clip');
    await fixture.tick();
    await fixture.respond(1, 'renewed');
    // The old implementation starts an unwanted read. Settle it so the assertion
    // observes the discarded renewal, rather than merely counting a request.
    if (fixture.requests[2]) await fixture.respond(2, 'poll');
    await renewal.done;
    assert.equal(fixture.state.view?.items[0].mediaAccessUrl, renewedGrant, 'The explicit replacement must become the mounted source.');
    assert.equal(fixture.requests.length, 2);
    await fixture.tick();assert.equal(fixture.requests.length, 3, 'Polling resumes after renewal completes.');
    await fixture.respond(2, 'poll-after');
    assert.equal(fixture.state.view?.items[0].mediaAccessUrl, renewedGrant, 'An ordinary poll keeps the valid mounted grant.');
  } finally {await fixture.close();}
});

for (const renewalFirst of [false, true]) {
  test('explicit renewal wins an existing poll, with '+(renewalFirst ? 'renewal' : 'polling')+' response first', async () => {
    const fixture = await mount();
    try {
      await fixture.respond(0, 'old');await fixture.tick();
      const renewal = await fixture.startRefresh('clip');
      assert.equal(fixture.requests.length, 3, 'Explicit renewal still starts while a periodic read is in flight.');
      if (renewalFirst) {await fixture.respond(2, 'renewed');await fixture.tick();}
      else {await fixture.respond(1, 'poll');await fixture.tick();}
      assert.equal(fixture.requests.length, 3, 'Periodic loading waits for all current-project reads.');
      if (renewalFirst) await fixture.respond(1, 'poll');else await fixture.respond(2, 'renewed');
      await renewal.done;
      assert.equal(fixture.state.view?.items[0].mediaAccessUrl, renewedGrant);
      await fixture.tick();assert.equal(fixture.requests.length, 4);
      await fixture.respond(3, 'poll-after');
      assert.equal(fixture.state.view?.items[0].mediaAccessUrl, renewedGrant);
    } finally {await fixture.close();}
  });
}

test('overlapping explicit refreshes release polling only after every read settles', async () => {
  const fixture = await mount();
  try {
    await fixture.respond(0, 'old');
    const first = await fixture.startRefresh('clip'), latest = await fixture.startRefresh();
    assert.equal(fixture.requests.length, 3);
    await fixture.respond(2, 'latest', 2);await latest.done;
    assert.equal(fixture.state.view?.data.revision, 2);
    assert.equal(fixture.state.view?.items[0].mediaAccessUrl, 'https://fixture.invalid/latest', 'The winning read must also replace the rejected grant.');
    await fixture.tick();assert.equal(fixture.requests.length, 3, 'One pending older request still holds the polling gate.');
    await fixture.respond(1, 'older', 1);await first.done;
    assert.equal(fixture.state.view?.data.revision, 2, 'An obsolete explicit read cannot reset the winning timeline.');
    await fixture.tick();assert.equal(fixture.requests.length, 4);
  } finally {await fixture.close();}
});

for (const failure of ['network', 'http'] as const) {
  test('polling resumes after a renewal '+failure+' failure', async () => {
    const fixture = await mount();
    try {
      await fixture.respond(0, 'old');
      const renewal = await fixture.startRefresh('clip');
      if (failure === 'network') await fixture.reject(1);else await fixture.refuse(1);
      await renewal.done;
      assert.equal(fixture.state.error, failure === 'network' ? 'OFFLINE_FIXTURE' : 'UNAVAILABLE_FIXTURE');
      assert.equal(fixture.state.view?.items[0].mediaAccessUrl, oldGrant);
      await fixture.tick();assert.equal(fixture.requests.length, 3);
      await fixture.respond(2, 'poll');assert.equal(fixture.state.error, null);
    } finally {await fixture.close();}
  });
}

test('a pending read from the previous project neither holds nor releases current-project polling', async () => {
  const fixture = await mount();
  try {
    await fixture.changeProject('project-b');
    assert.equal(fixture.requests.length, 2);
    assert.equal(fixture.requests[1].url, '/api/studio/projects/project-b/conversation-timeline?preview=1');
    await fixture.respond(1, 'b-initial', 0, 'project-b');
    await fixture.tick();assert.equal(fixture.requests.length, 3, 'The previous project does not block current polling.');
    await fixture.respond(0, 'a-late', 99, 'project-a');
    assert.equal(fixture.state.view?.data.projectId, 'project-b');
    await fixture.tick();assert.equal(fixture.requests.length, 3, 'An old completion does not release the current pending read.');
    await fixture.respond(2, 'b-poll', 1, 'project-b');
    assert.equal(fixture.state.view?.data.revision, 1);
    await fixture.tick();assert.equal(fixture.requests.length, 4);
  } finally {await fixture.close();}
});

for (const renewalFirst of [false, true]) {
test('refresh-key invalidation keeps the latest revision and pending renewal, with '+(renewalFirst ? 'renewal' : 'canonical')+' response first', async () => {
  const fixture = await mount();
  try {
    await fixture.respond(0, 'old');
    const renewal = await fixture.startRefresh('clip');await fixture.invalidate();
    assert.equal(fixture.requests.length, 3, 'Explicit invalidation is not gated by the pending read.');
    if (renewalFirst) await fixture.respond(1, 'renewed', 1);
    await fixture.respond(2, 'invalidated', 2);
    if (!renewalFirst) await fixture.respond(1, 'renewed', 1);
    await renewal.done;
    assert.equal(fixture.state.view?.data.revision, 2);
    assert.equal(fixture.state.view?.items[0].mediaAccessUrl, 'https://fixture.invalid/invalidated', 'The latest canonical response must replace the rejected grant even after it supersedes the renewal read.');
    await fixture.tick();assert.equal(fixture.requests.length, 4);
    await fixture.respond(3, 'poll');
    assert.equal(fixture.state.view?.items[0].mediaAccessUrl, 'https://fixture.invalid/invalidated', 'Later polling retains the successfully replaced grant.');
  } finally {await fixture.close();}
});
}

test('failed replacement stays pending for the next successful canonical read', async () => {
  const fixture = await mount();
  try {
    await fixture.respond(0, 'old');const renewal = await fixture.startRefresh('clip');
    await fixture.refuse(1);await renewal.done;await fixture.tick();
    await fixture.respond(2, 'recovered', 2);
    assert.equal(fixture.state.error, null);
    assert.equal(fixture.state.view?.items[0].mediaAccessUrl, 'https://fixture.invalid/recovered');
    await fixture.tick();await fixture.respond(3, 'poll');
    assert.equal(fixture.state.view?.items[0].mediaAccessUrl, 'https://fixture.invalid/recovered');
  } finally {await fixture.close();}
});

test('the winning canonical read replaces all concurrently rejected clips', async () => {
  const fixture = await mount();
  try {
    await fixture.respond(0, 'old', 0, 'project-a', 'clip-2');
    const first = await fixture.startRefresh('clip'), second = await fixture.startRefresh('clip-2');
    await fixture.invalidate();
    await fixture.respond(3, 'latest', 3, 'project-a', 'clip-2');
    await fixture.respond(2, 'older', 2, 'project-a', 'clip-2');await second.done;
    await fixture.respond(1, 'oldest', 1, 'project-a', 'clip-2');await first.done;
    assert.equal(fixture.state.view?.data.revision, 3);
    assert.deepEqual(fixture.state.view?.items.map(item => item.mediaAccessUrl), ['https://fixture.invalid/latest','https://fixture.invalid/latest']);
    await fixture.tick();await fixture.respond(4, 'poll', 4, 'project-a', 'clip-2');
    assert.deepEqual(fixture.state.view?.items.map(item => item.mediaAccessUrl), ['https://fixture.invalid/latest','https://fixture.invalid/latest']);
  } finally {await fixture.close();}
});

test('a pending replacement cannot force a new project to reload its valid grant', async () => {
  const fixture = await mount();
  try {
    await fixture.respond(0, 'old');const renewal = await fixture.startRefresh('clip');
    await fixture.changeProject('project-b');await fixture.respond(2, 'b-initial', 0, 'project-b');
    await fixture.respond(1, 'a-late', 99, 'project-a');await renewal.done;
    await fixture.tick();await fixture.respond(3, 'b-poll', 1, 'project-b');
    assert.equal(fixture.state.view?.data.projectId, 'project-b');
    assert.equal(fixture.state.view?.data.revision, 1);
    assert.equal(fixture.state.view?.items[0].mediaAccessUrl, 'https://fixture.invalid/b-initial');
  } finally {await fixture.close();}
});

test('canonical edits and their final refresh retain their existing polling gates', async () => {
  const fixture = await mount();
  try {
    await fixture.respond(0, 'old', 3);
    const edit = await fixture.startEdit();
    assert.equal(fixture.requests[1].init?.method, 'POST');
    const body = JSON.parse(String(fixture.requests[1].init?.body));
    assert.equal(body.expectedRevision, 3);assert.equal(body.sequenceId, 'sequence');
    assert.deepEqual(body.edit, {kind: 'gain', clipId: 'clip', volume: 0});
    await fixture.tick();assert.equal(fixture.requests.length, 2);
    await fixture.respond(1, 'unused');
    assert.equal(fixture.requests.length, 3);
    await fixture.tick();assert.equal(fixture.requests.length, 3, 'The post-edit refresh is a pending read too.');
    await fixture.respond(2, 'post-edit', 4);await edit.done;
    assert.equal(fixture.state.view?.data.revision, 4);
    await fixture.tick();assert.equal(fixture.requests.length, 4);
  } finally {await fixture.close();}
});

test('unmount removes periodic loading and ignores a late renewal response', async () => {
  const fixture = await mount();
  try {
    await fixture.respond(0, 'old');const renewal = await fixture.startRefresh('clip');
    await fixture.unmount();const commits = fixture.commits.length;
    await fixture.respond(1, 'renewed');await renewal.done;await fixture.tick();
    assert.equal(fixture.commits.length, commits);
    assert.equal(fixture.requests.length, 2);
  } finally {await fixture.close();}
});
