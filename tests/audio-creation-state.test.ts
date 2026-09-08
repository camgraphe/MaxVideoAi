import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useAudioCreationDraft } from '../frontend/app/(core)/(workspace)/app/audio/_hooks/useAudioCreationDraft';
import { useAudioCreationQuote } from '../frontend/app/(core)/(workspace)/app/audio/_hooks/useAudioCreationQuote';
import { buildAudioCreationRequest, newAudioDraft, type AudioCreationIntent } from '../frontend/src/lib/audio-creation';

function environment(fetchImpl?: typeof fetch) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/audio' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, React, IS_REACT_ACT_ENVIRONMENT: true, ...(fetchImpl ? { fetch: fetchImpl } : {}) };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  return { dom, root, async close() { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } } };
}

test('intent drafts retain references and lyrics across navigation, isolate accounts, and reject late setters', async () => {
  const env = environment();
  let state!: ReturnType<typeof useAudioCreationDraft>;
  function Fixture({ owner, intent }: { owner: string | null; intent: AudioCreationIntent }) { state = useAudioCreationDraft(owner, intent); return null; }
  const render = (owner: string | null, intent: AudioCreationIntent) => act(async () => env.root.render(React.createElement(Fixture, { owner, intent })));
  try {
    await render('a', 'voice');
    await act(async () => state.update({ script: 'Owned script', reference: { url: 'https://fixture.example/original.wav', name: 'Voice' } }));
    const lateUpdate = state.update;
    await render('a', 'song');
    await act(async () => state.update({ lyrics: '[Verse]\nLine one\nLine two' }));
    await render('a', 'voice');
    assert.equal(state.draft.script, 'Owned script');
    assert.equal(state.draft.reference?.url, 'https://fixture.example/original.wav');
    await render('b', 'voice');
    assert.equal(state.draft.script, '');
    assert.equal(state.draft.reference, null);
    await act(async () => lateUpdate({ script: 'Late old account response' }));
    assert.equal(state.draft.script, '');
    await render(null, 'voice');
    assert.equal(state.draft.reference, null);
    await render('a', 'song');
    assert.equal(state.draft.lyrics, '[Verse]\nLine one\nLine two');
    await render('a', 'voice');
    assert.equal(state.draft.script, 'Owned script');
  } finally { await env.close(); }
});

test('edited and account-switched quotes cannot be displayed or submitted after late responses', async () => {
  const requests: Array<{ body: any; resolve: (response: Response) => void }> = [];
  const env = environment(async (_input, init) => new Promise<Response>(resolve => requests.push({ body: JSON.parse(String(init?.body)), resolve })));
  let state!: ReturnType<typeof useAudioCreationQuote>;
  function Fixture({ owner, text }: { owner: string; text: string }) { state = useAudioCreationQuote({ pack: 'voice_only', script: text }, owner, true); return null; }
  const render = (owner: string, text: string) => act(async () => env.root.render(React.createElement(Fixture, { owner, text })));
  const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 380)); });
  const respond = (index: number, patch = {}) => act(async () => requests[index].resolve(new Response(JSON.stringify({ ok: true, inputKey: `quote-${index}`, pricing: { totalCents: 20, currency: 'USD' }, expiresAt: Date.now() + 60000, ...patch }))));
  try {
    await render('a', 'First'); await tick();
    await render('a', 'Second');
    assert.equal(state.quote, null);
    await respond(0);
    assert.equal(state.quote, null, 'old quote never becomes usable');
    await tick(); await respond(1);
    assert.equal(state.quote?.inputKey, 'quote-1');
    await render('b', 'Second');
    assert.equal(state.quote, null, 'account transition invalidates synchronously');
    await tick(); await respond(2, { expiresAt: 'invalid' });
    assert.equal(state.quote, null);
    assert.ok(state.error, 'invalid expiry fails closed');
    await act(async () => state.retry()); await tick(); await respond(3, { expiresAt: Date.now() - 1 });
    assert.equal(state.quote, null);
  } finally { await env.close(); }
});

test('intent request binds the actual model behind the human voice choice and reference', () => {
  const draft = newAudioDraft('voice');
  const preset = buildAudioCreationRequest('voice', draft, 'fr');
  assert.equal(preset.voiceModel, 'minimax');
  assert.equal(preset.minimaxVoiceId, 'English_FriendlyPerson');
  const reference = buildAudioCreationRequest('voice', { ...draft, reference: { url: 'https://fixture.example/original.wav', name: 'Reference' } }, 'fr');
  assert.equal(reference.voiceModel, 'seed');
  assert.equal(reference.minimaxVoiceId, undefined);
  assert.equal(reference.voiceSampleUrl, 'https://fixture.example/original.wav');
  assert.equal(buildAudioCreationRequest('music', { ...draft, durationSec: 120 }, 'fr').musicModel, 'pro');
});

test('expired quote is removed and refreshed without reusing the confirmed amount', async () => {
  let requests = 0;
  const env = environment(async () => { requests++; return new Response(JSON.stringify({ ok: true, inputKey: `quote-${requests}`, pricing: { totalCents: requests * 10, currency: 'USD' }, expiresAt: Date.now() + 120 })); });
  let state!: ReturnType<typeof useAudioCreationQuote>;
  function Fixture() { state = useAudioCreationQuote({ pack: 'voice_only', script: 'Hello' }, 'a', true); return null; }
  try {
    await act(async () => env.root.render(React.createElement(Fixture)));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 390)); });
    assert.equal(state.quote?.pricing.totalCents, 10);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    assert.equal(state.quote, null);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 380)); });
    assert.equal(state.quote?.pricing.totalCents, 20);
  } finally { await env.close(); }
});
