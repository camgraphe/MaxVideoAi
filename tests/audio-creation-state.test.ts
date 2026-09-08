import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useAudioCreationDraft } from '../frontend/app/(core)/(workspace)/app/audio/_hooks/useAudioCreationDraft';
import { useAudioCreationQuote } from '../frontend/app/(core)/(workspace)/app/audio/_hooks/useAudioCreationQuote';
import { audioCreationReusePatch } from '../frontend/app/(core)/(workspace)/app/audio/_lib/audio-creation-reuse';
import { validateAudioGenerateRequest } from '../frontend/src/server/audio/audio-generate-validation';
import { useAudioCreationScope } from '../frontend/app/(core)/(workspace)/app/audio/_hooks/useAudioCreationScope';
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

test('long music drafts saved before the model picker hydrate as Lyria Pro', async () => {
  const env = environment();
  let state!: ReturnType<typeof useAudioCreationDraft>;
  function Fixture() { state = useAudioCreationDraft('a', 'music'); return null; }
  try {
    localStorage.setItem('maxvideoai.audio.creation.v1:a', JSON.stringify({
      version: 1,
      drafts: { music: { ...newAudioDraft('music'), durationSec: 120, musicModel: 'clip' } },
    }));
    await act(async () => env.root.render(React.createElement(Fixture)));
    assert.equal(state.draft.durationSec, 120);
    assert.equal(state.draft.musicModel, 'pro');
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
  assert.equal(buildAudioCreationRequest('music', { ...draft, durationSec: 120, musicModel: 'pro' }, 'fr').musicModel, 'pro');
  assert.equal(buildAudioCreationRequest('music', { ...draft, durationSec: 30, musicModel: 'pro' }, 'fr').musicModel, 'pro');
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


test('retired draft updaters stay retired after A → B → A and unmount/recreate', async () => {
  const env = environment();
  let state!: ReturnType<typeof useAudioCreationDraft>;
  const observations: string[] = [];
  function Fixture({ owner }: { owner: string }) { state = useAudioCreationDraft(owner, 'voice'); observations.push(state.draft.script); return null; }
  const render = (owner: string) => act(async () => env.root.render(React.createElement(Fixture, { owner })));
  try {
    await render('a');
    await act(async () => state.update({ script: 'Initial A' }));
    const retired = state.update;
    await render('b');
    observations.length = 0;
    await render('a');
    assert.equal(observations[0], '', 'old observations hidden before hydration effects');
    await act(async () => state.update({ script: 'New A' }));
    await act(async () => retired({ script: 'Late upload under old A' }));
    assert.equal(state.draft.script, 'New A');
    const beforeUnmount = state.update;
    await act(async () => env.root.render(null));
    await render('a');
    await act(async () => state.update({ script: 'Recreated A' }));
    await act(async () => beforeUnmount({ script: 'Late unmounted setter' }));
    assert.equal(state.draft.script, 'Recreated A');
    assert.equal(JSON.parse(localStorage.getItem('maxvideoai.audio.creation.v1:a')!).drafts.voice.script, 'Recreated A');
  } finally { await env.close(); }
});

test('async scope callbacks cannot regain ownership on return to account or remount', async () => {
  const env = environment();
  let scope!: ReturnType<typeof useAudioCreationScope>;
  function Fixture({ owner }: { owner: string }) { scope = useAudioCreationScope(owner); return null; }
  const render = (owner: string) => act(async () => env.root.render(React.createElement(Fixture, { owner })));
  try {
    await render('a'); const first = scope;
    await render('b'); await render('a');
    assert.equal(first.isCurrent(), false); assert.equal(scope.isCurrent(), true);
    const beforeUnmount = scope;
    await act(async () => env.root.render(null)); await render('a');
    assert.equal(beforeUnmount.isCurrent(), false); assert.notEqual(scope, beforeUnmount);
  } finally { await env.close(); }
});

test('late quote and retry from earlier A cannot replace or clear a fresh A quote', async () => {
  const requests: Array<(response: Response) => void> = [];
  const env = environment(async () => new Promise(resolve => requests.push(resolve)));
  let state!: ReturnType<typeof useAudioCreationQuote>;
  function Fixture({ owner }: { owner: string }) { state = useAudioCreationQuote({ pack: 'voice_only', script: 'Same script' }, owner, true); return null; }
  const render = (owner: string) => act(async () => env.root.render(React.createElement(Fixture, { owner })));
  const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 380)); });
  const respond = (index: number) => act(async () => requests[index](new Response(JSON.stringify({ ok: true, inputKey: `quote-${index}`, pricing: { totalCents: 20, currency: 'USD' }, expiresAt: Date.now() + 60000 }))));
  try {
    await render('a'); await tick(); const old = state;
    await render('b'); await render('a'); await tick(); await respond(1);
    assert.equal(state.quote?.inputKey, 'quote-1'); assert.equal(old.isCurrent(), false);
    await respond(0); await act(async () => old.retry());
    assert.equal(state.quote?.inputKey, 'quote-1');
    const beforeUnmount = state;
    await act(async () => env.root.render(null)); await render('a'); await tick(); await respond(2);
    await act(async () => beforeUnmount.retry());
    assert.equal(state.quote?.inputKey, 'quote-2');
  } finally { await env.close(); }
});

test('historical Seed voice settings roundtrip through reuse, draft and validated request', () => {
  const initial = newAudioDraft('voice');
  const patch = audioCreationReusePatch({ pack: 'voice_only', script: 'Hello again', seedAudioOutputFormat: 'wav', seedAudioSampleRate: 48000, voiceDelivery: 'intimate', voiceProfile: 'deep', voiceGender: 'male', seedAudioSpeed: 0.85 }, initial, 'Reference');
  const result = validateAudioGenerateRequest(buildAudioCreationRequest('voice', { ...initial, ...patch }, 'fr'));
  assert.equal(result.voiceModel, 'seed'); assert.equal(result.seedAudioOutputFormat, 'wav'); assert.equal(result.seedAudioSampleRate, 48000);
  assert.equal(result.voiceDelivery, 'intimate'); assert.equal(result.voiceProfile, 'deep'); assert.equal(result.voiceGender, 'male'); assert.equal(result.seedAudioSpeed, 0.85);
  assert.equal(buildAudioCreationRequest('voice', initial, 'fr').seedAudioSampleRate, undefined, 'MiniMax does not receive unsupported Seed options');
});
