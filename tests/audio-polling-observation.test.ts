import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useAudioActiveJobPolling } from '../frontend/app/(core)/(workspace)/app/audio/_hooks/useAudioActiveJobPolling';
import type { ActiveAudioJobState, AudioResultState } from '../frontend/app/(core)/(workspace)/app/audio/_lib/audio-workspace-types';

test('audio keeps one five-second poll timer through updates and errors and immediately exposes completed media', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/audio' });
  const intervals = new Map<number, () => void>();
  let timerId = 0;
  dom.window.setInterval = ((callback: () => void, delay: number) => {
    assert.equal(delay, 5000); intervals.set(++timerId, callback); return timerId;
  }) as typeof dom.window.setInterval;
  dom.window.clearInterval = (id) => { intervals.delete(id); };
  const requests: Array<(response: Response) => void> = [];
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, CustomEvent: dom.window.CustomEvent, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (input: string) => { assert.match(input, /^\/api\/jobs\/aud_fixture$/); return new Promise<Response>((resolve) => requests.push(resolve)); },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let current: ActiveAudioJobState | null = null;
  let result: AudioResultState | null = null;
  function Fixture() {
    const [activeJob, setActiveJob] = React.useState<ActiveAudioJobState | null>({ jobId: 'aud_fixture', status: 'pending', startedAt: Date.now(), etaSeconds: 900, progress: 15, message: null, videoUrl: null, audioUrl: null, thumbUrl: null, outputKind: 'audio' });
    const [output, setResult] = React.useState<AudioResultState | null>(null);
    current = activeJob; result = output;
    useAudioActiveJobPolling({ activeJob, setActiveJob, setResult });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const tick = async () => act(async () => { [...intervals.values()].forEach((callback) => callback()); });
  const respond = async (index: number, payload: object, status = 200) => act(async () => requests[index](new Response(JSON.stringify({ ok: true, jobId: 'aud_fixture', status: 'pending', ...payload }), { status })));
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    assert.equal(requests.length, 1);
    await tick();
    assert.equal(requests.length, 1, 'slow requests never overlap');
    await respond(0, { observation: { stage: 'processing' } });
    const checkedAt = (current as ActiveAudioJobState | null)?.observation?.checkedAt;
    assert.ok(checkedAt);
    assert.equal(requests.length, 1, 'state update does not trigger an immediate extra request');
    assert.equal(timerId, 1, 'the existing interval remains stable');
    await tick();
    await respond(1, { error: 'Unavailable' }, 503);
    assert.equal((current as ActiveAudioJobState | null)?.observation?.degraded, true);
    assert.equal((current as ActiveAudioJobState | null)?.observation?.checkedAt, checkedAt);
    await tick();
    await respond(2, { status: 'completed', audioUrl: '/audio-fixture.mp3' });
    assert.equal((current as ActiveAudioJobState | null)?.status, 'completed');
    assert.equal((result as AudioResultState | null)?.audioUrl, '/audio-fixture.mp3');
    assert.equal(intervals.size, 0, 'completed output stops polling even before the estimate');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
