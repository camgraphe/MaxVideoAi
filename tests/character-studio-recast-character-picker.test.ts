import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
  import React,{act} from 'react';import {createRoot} from 'react-dom/client';
  import {CharacterStudioRecast} from './src/components/tools/character-builder/_components/CharacterStudioRecast.client';
  import {getCharacterStudioCopy} from './src/components/tools/character-builder/_lib/character-studio-copy';
  const capture=()=>{const owner=window.owner;return owner ? {accessToken:'token-'+owner,signal:new AbortController().signal,isCurrent:()=>owner===window.owner} : null};
  const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
  window.labels=getCharacterStudioCopy('fr');window.fx={act,unmount:()=>root.unmount(),render:()=>root.render(
    <CharacterStudioRecast key={window.owner} copy={window.labels} navigation={null} active
      characterLibrary={{userId:window.owner,captureAccountRequest:capture,onSignIn:()=>window.signIn=true}}/>) };
`, { '@/lib/authFetch': 'export const authFetch=(...args)=>fetch(...args);' });

const character = {
  id: 'character-a', name: 'Dixie', lookCount: 2, createdAt: '2026-11-05T00:00:00Z',
  identity: { jobId: 'identity-job', imageUrl: 'https://example.invalid/original.png', thumbUrl: 'https://example.invalid/thumbnail.webp' },
};
const look = {
  id: 'look-a', name: 'Pink', jobId: 'look-job', imageUrl: 'https://example.invalid/look-original.png',
  thumbUrl: 'https://example.invalid/look-thumbnail.webp', createdAt: '2026-11-05T00:00:00Z',
  settingsSnapshot: { builder: { outputMode: 'portrait' } },
};

async function mount(owner: string | null = 'A') {
  const dom = createClientFlowDom('/app/tools/character-builder');
  const w = dom.window as any;
  w.owner = owner;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.HTMLMediaElement.prototype.pause = () => {};
  w.HTMLMediaElement.prototype.load = () => {};
  w.URL.createObjectURL = (file: File) => 'blob:' + file.name;
  w.URL.revokeObjectURL = () => {};
  const requests: Array<{ url: string; options: any; reply: (body: object, status?: number) => void }> = [];
  w.fetch = (url: string, options: any = {}) => {
    if (url.includes('/estimate')) return Promise.resolve(Response.json({ status: 'unavailable' }));
    if (url.includes('/prepare?')) return Promise.resolve(Response.json({ ok: true }));
    return new Promise<Response>(resolve => requests.push({ url, options,
      reply: (body, status = 200) => resolve(Response.json(body, { status })) }));
  };
  w.eval(await bundle);
  const act = (fn: () => unknown) => w.fx.act(fn);
  await act(async () => w.fx.render());
  const button = (label: string, scope = w.document.querySelector('dialog[open]') ?? w.document) =>
    [...scope.querySelectorAll('button')].find((b: any) => b.textContent.trim() === label) as HTMLButtonElement;
  const click = async (label: string) => { const b = button(label); assert.ok(b, `Missing button ${label}`); await act(async () => b.click()); };
  const reply = async (body: object, status = 200) => act(async () => requests.at(-1)!.reply(body, status));
  return { w, requests, act, button, click, reply,
    open: async () => { button(w.labels.addReplacement).focus(); await click(w.labels.addReplacement); },
    dispose: async () => { await act(async () => w.fx.unmount()); dom.window.close(); } };
}

test('Recast chooses a saved look, sends its original job image to the quote and keeps the scene settings', async () => {
  const f = await mount();
  try {
    assert.equal(f.requests.length, 0, 'the private library is loaded only on opening');
    const direction = f.w.document.querySelector('textarea');
    await f.act(() => {
      Object.getOwnPropertyDescriptor(f.w.HTMLTextAreaElement.prototype, 'value').set.call(direction, 'Keep the dance');
      direction.dispatchEvent(new f.w.Event('input', { bubbles: true }));
    });
    await f.act(() => {
      const select = f.w.document.querySelector('select');
      select.value = '1080p'; select.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    });
    await f.open();
    assert.ok(f.w.document.querySelector('dialog[open]'), 'Add character opens the saved-character picker');
    assert.equal(f.requests[0].url, '/api/character-studio/characters');
    assert.equal(f.requests[0].options.headers.Authorization, 'Bearer token-A');
    await f.reply({ ok: true, characters: [character], nextCursor: null });
    assert.ok(f.w.document.querySelector('img[src="https://example.invalid/thumbnail.webp"]'));
    await f.click('Dixie');
    assert.match(f.requests.at(-1)!.url, /characters\/character-a$/);
    await f.reply({ ok: true, character: { ...character, looks: [look], nextLookCursor: 'next-look' } });
    await f.click('Voir plus');
    assert.match(f.requests.at(-1)!.url, /beforeLook=next-look$/);
    await f.reply({ ok: true, character: { ...character, looks: [{ ...look, id: 'look-b', name: 'Blue' }], nextLookCursor: null } });
    await f.click('Pink');
    assert.ok(!f.w.document.querySelector('dialog'));
    assert.ok(f.w.document.querySelector('img[src="https://example.invalid/look-original.png"]'));
    assert.equal(f.w.document.activeElement?.textContent, f.w.labels.changeCharacter);
    assert.equal(direction.value, 'Keep the dance');
    assert.equal(f.w.document.querySelector('select').value, '1080p');
    await f.click(f.w.labels.reviewPrice);
    const prepared = JSON.parse(f.requests.at(-1)!.options.body);
    assert.deepEqual(prepared.portrait, { jobId: 'look-job', imageUrl: 'https://example.invalid/look-original.png' });
    assert.equal(prepared.direction, 'Keep the dance');
    assert.equal(prepared.resolution, '1080p');
    assert.ok(!f.requests.some(r => r.url.includes('/uploads/') || r.url.includes('/confirm')));
    await f.reply({ ok: true, kind: 'wallet', quoteId: '11111111-1111-4111-8111-111111111111',
      expiresAt: new Date(Date.now() + 60000).toISOString(), amountCents: 200, currency: 'USD', topupRequired: false,
      sourceSeconds: 0, audioSeconds: 0 });
    assert.ok(!f.button(f.w.labels.reviewPrice), 'a prepared quote is ready for review');
    await f.click(f.w.labels.changeCharacter);
    await f.reply({ ok: true, characters: [character], nextCursor: null });
    await f.click('Dixie');
    await f.reply({ ok: true, character: { ...character, looks: [look], nextLookCursor: null } });
    await f.click('Identité d’origine');
    assert.ok(f.button(f.w.labels.reviewPrice), 'changing identity invalidates the previously reviewed quote');
    await f.click(f.w.labels.reviewPrice);
    assert.deepEqual(JSON.parse(f.requests.at(-1)!.options.body).portrait,
      { jobId: 'identity-job', imageUrl: 'https://example.invalid/original.png' });
  } finally { await f.dispose(); }
});

test('Recast picker supports empty/error states, upload and rejects late results after closing or switching accounts', async () => {
  const f = await mount();
  try {
    await f.open();
    assert.ok(f.w.document.querySelector('dialog[open]'));
    await f.reply({ ok: false }, 500);
    assert.ok(f.w.document.querySelector('[role="alert"]'));
    await f.click('Réessayer');
    await f.reply({ ok: true, characters: [], nextCursor: null });
    assert.match(f.w.document.querySelector('dialog').textContent, /Garde un personnage/);
    let uploads = 0;
    f.w.document.querySelector('input[accept="image/*"]').click = () => uploads++;
    await f.click(f.w.labels.uploadCharacterImage);
    assert.equal(uploads, 1);
    assert.ok(!f.w.document.querySelector('dialog'));
    await f.open();
    const late = f.requests.at(-1)!;
    const opener = f.button(f.w.labels.addReplacement, f.w.document);
    await f.act(() => f.w.document.querySelector('dialog').dispatchEvent(new f.w.Event('cancel', { cancelable: true })));
    await f.act(() => late.reply({ ok: true, characters: [character], nextCursor: null }));
    assert.ok(!f.w.document.querySelector('dialog'));
    assert.equal(f.w.document.activeElement, opener);
    await f.open();
    const accountA = f.requests.at(-1)!;
    await f.act(() => { f.w.owner = 'B'; f.w.fx.render(); });
    await f.act(() => accountA.reply({ ok: true, characters: [character], nextCursor: null }));
    assert.doesNotMatch(f.w.document.body.textContent, /Dixie/);
    await f.open();
    assert.equal(f.requests.at(-1)!.options.headers.Authorization, 'Bearer token-B');
  } finally { await f.dispose(); }
});

test('a signed-out Recast user can upload or sign in without fetching another account library', async () => {
  const f = await mount(null);
  try {
    await f.open();
    assert.ok(f.w.document.querySelector('dialog[open]'));
    assert.equal(f.requests.length, 0);
    await f.click('Connecte-toi pour retrouver tes personnages');
    assert.equal(f.w.signIn, true);
    assert.equal(f.w.document.querySelector('dialog'), null);
  } finally { await f.dispose(); }
});

test('picker page retry keeps loaded characters and selection preserves the trimmed media, product and dialogue', async () => {
  const f = await mount();
  try {
    const doc = f.w.document;
    let probe: HTMLMediaElement | null = null;
    const create = doc.createElement.bind(doc);
    doc.createElement = (name: string, ...rest: any[]) => {
      const el = create(name, ...rest);
      if (name === 'video' || name === 'audio') probe = el;
      return el;
    };
    const setInput = async (input: HTMLInputElement, value: string) => f.act(() => {
      Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new f.w.Event('input', { bubbles: true }));
    });
    for (const [kind, name, type, seconds, start, end] of [
      ['video', 'dance.mp4', 'video/mp4', 25, '5', '13.5'],
      ['audio', 'rhythm.wav', 'audio/wav', 18, '2', '9'],
    ] as const) {
      if (kind === 'audio') await f.click('Dialogue');
      const input = doc.querySelector(kind === 'video' ? 'input[accept="video/*"]' : 'input[accept^=".mp3"]');
      Object.defineProperty(input, 'files', { configurable: true, value: [new f.w.File(['fixture'], name, { type })] });
      await f.act(() => input.dispatchEvent(new f.w.Event('change', { bubbles: true })));
      assert.ok(probe);
      Object.defineProperty(probe, 'duration', { value: seconds });
      await f.act(() => probe!.dispatchEvent(new f.w.Event('loadedmetadata')));
      const dialog = doc.querySelector('[role="dialog"]');
      assert.ok(dialog);
      await setInput(dialog.querySelector('input[aria-label="Fin (secondes)"]'), end);
      await setInput(dialog.querySelector('input[aria-label="Début (secondes)"]'), start);
      await f.click('Utiliser ce passage');
    }
    const product = doc.querySelector('input[accept^="image/jpeg"]');
    Object.defineProperty(product, 'files', { value: [new f.w.File(['fixture'], 'watch.png', { type: 'image/png' })] });
    await f.act(() => product.dispatchEvent(new f.w.Event('change', { bubbles: true })));
    await f.act(() => {
      const textarea = doc.querySelector('textarea');
      Object.getOwnPropertyDescriptor(f.w.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Meet my favorite watch.');
      textarea.dispatchEvent(new f.w.Event('input', { bubbles: true }));
      const duration = doc.querySelector('#recast-duration');
      duration.value = '11'; duration.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    });
    await f.open();
    await f.reply({ ok: true, characters: [character], nextCursor: 'page-two' });
    await f.click('Voir plus');
    assert.match(f.requests.at(-1)!.url, /before=page-two$/);
    await f.reply({ ok: false }, 500);
    await f.click('Réessayer');
    assert.match(f.requests.at(-1)!.url, /before=page-two$/, 'retry must request the failed page');
    const second = { ...character, id: 'character-b', name: 'Nana' };
    await f.reply({ ok: true, characters: [second], nextCursor: null });
    assert.ok(f.button('Dixie'), 'earlier pages are kept after retry');
    await f.click('Nana');
    await f.reply({ ok: true, character: { ...second, looks: [], nextLookCursor: null } });
    await f.click('Identité d’origine');
    assert.ok(doc.querySelector('img[alt="Nana"]'));
    assert.ok([...doc.querySelectorAll('video[controls]')].every((v: any) => v.getAttribute('src') === 'blob:dance.mp4#t=5,13.5'));
    assert.equal(doc.querySelector('audio[controls]').getAttribute('src'), 'blob:rhythm.wav#t=2,9');
    assert.ok(doc.querySelector('img[src="blob:watch.png"]'));
    assert.equal(doc.querySelector('textarea').value, 'Meet my favorite watch.');
    assert.equal(doc.querySelector('#recast-duration').value, '11');
  } finally { await f.dispose(); }
});
