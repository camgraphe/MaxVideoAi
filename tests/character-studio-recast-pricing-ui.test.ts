import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
  import React,{act} from 'react';import {createRoot} from 'react-dom/client';
  import {CharacterStudioRecast} from './src/components/tools/character-builder/_components/CharacterStudioRecast.client';
  import {getCharacterStudioCopy} from './src/components/tools/character-builder/_lib/character-studio-copy';
  const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
  window.labels=getCharacterStudioCopy('fr');
  window.fx={act,unmount:()=>root.unmount(),render:()=>root.render(<CharacterStudioRecast
    copy={window.labels} navigation={null} active={window.active} selection={window.selection}/>)};
`, { '@/lib/authFetch': 'export const authFetch=(...args)=>fetch(...args);' });
const id = (n: number) => 'ma_' + String(n).padStart(32, '0');

async function mount() {
  const dom = createClientFlowDom('/app/tools/character-builder');
  const w = dom.window as any;
  const doc = w.document;
  const requests: Array<{ url: string; body: any; signal?: AbortSignal; resolve: (body: object) => void }> = [];
  const uploads: string[] = [];
  const probes: any[] = [];
  const paused: any[] = [];
  const revoked: string[] = [];
  let serial = 0;
  w.URL.createObjectURL = (file: File) => `blob:${++serial}-${file.name}`;
  w.URL.revokeObjectURL = (url: string) => revoked.push(url);
  w.HTMLMediaElement.prototype.pause = function () { paused.push(this); };
  w.HTMLMediaElement.prototype.load = () => {};
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag: string, ...rest: any[]) => {
    const el = create(tag, ...rest);
    if (tag === 'audio' || tag === 'video') probes.push(el);
    return el;
  };
  w.fetch = async (url: string, options: any = {}) => {
    if (url.includes('/confirm')) throw new Error('This test must never order a render');
    if (url.includes('prepare?')) return Response.json({ ok: true, ready: true });
    if (url.startsWith('/api/uploads/')) {
      uploads.push(url);
      const kind = url.endsWith('video') ? 'video' : 'audio';
      return Response.json({ ok: true, asset: { id: kind, assetId: id(kind === 'video' ? 2 : 3), url: `https://example.invalid/${kind}` } });
    }
    return new Promise<Response>(resolve => requests.push({ url, body: JSON.parse(options.body), signal: options.signal,
      resolve: body => resolve(Response.json(body)) }));
  };
  w.active = true;
  w.selection = { jobId: 'saved-look', transferId: '1', imageUrl: 'https://example.invalid/portrait.png', name: 'Basil' };
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  const act = (fn: () => unknown) => w.fx.act(fn);
  const button = (text: string) => [...doc.querySelectorAll('button')].find((el: any) => el.textContent.trim() === text) as any;
  const input = async (node: any, value: string) => act(async () => {
    const prototype = node.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new w.Event('input', { bubbles: true }));
  });
  return { w, doc, requests, uploads, paused, revoked, button, act, input,
    click: (text: string) => act(async () => { assert.ok(button(text), text); button(text).click(); }),
    select: (node: any, value: string) => act(async () => {
      node.value = value; node.dispatchEvent(new w.Event('change', { bubbles: true }));
    }),
    async upload(kind: 'audio' | 'video', duration: number, name = `${kind}.${kind === 'video' ? 'mp4' : 'wav'}`) {
      const field = doc.querySelector(kind === 'video' ? 'input[accept="video/*"]' : 'input[accept^=".mp3"]');
      await act(async () => {
        Object.defineProperty(field, 'files', { configurable: true, value: [new w.File(['bytes'], name, { type: `${kind}/${kind === 'video' ? 'mp4' : 'wav'}` })] });
        field.dispatchEvent(new w.Event('change', { bubbles: true }));
      });
      const probe = probes.findLast(el => typeof el.onloadedmetadata === 'function');
      assert.ok(probe);
      await act(async () => { Object.defineProperty(probe, 'duration', { value: duration }); probe.dispatchEvent(new w.Event('loadedmetadata')); });
    },
    async passage(start: string, end: string) {
      const dialog = doc.querySelector('[role=dialog]');
      assert.ok(dialog);
      await input(dialog.querySelector('input[aria-label="Début (secondes)"]'), start);
      await input(dialog.querySelector('input[aria-label="Fin (secondes)"]'), end);
      assert.equal(button('Utiliser ce passage').disabled, false);
      await act(async () => button('Utiliser ce passage').click());
    },
    async estimate() {
      await act(async () => new Promise(resolve => setTimeout(resolve, 230)));
      return requests.filter(r => r.url.endsWith('/estimate')).at(-1)!;
    },
    async dispose() { await act(async () => w.fx.unmount()); dom.window.close(); },
  };
}

test('duration/resolution edits hide old estimates immediately and discard late responses', async () => {
  const f = await mount();
  try {
    await f.input(f.doc.querySelector('textarea'), 'Dance');
    const first = await f.estimate();
    assert.deepEqual(first.body, { mode: 'i2v', resolution: '720p', aspectRatio: 'auto', seconds: 6, sourceSeconds: 0, audio: false });
    await f.select(f.doc.querySelector('select'), '1080p');
    const second = await f.estimate();
    assert.equal(first.signal!.aborted, true);
    await f.act(async () => second.resolve({ status: 'estimated', amountCents: 219, currency: 'USD', revision: 'current' }));
    assert.match(f.doc.body.textContent, /2,19/);
    await f.act(async () => first.resolve({ status: 'estimated', amountCents: 110, currency: 'USD', revision: 'old' }));
    assert.match(f.doc.body.textContent, /2,19/);
    assert.doesNotMatch(f.doc.body.textContent, /1,10/);
    await f.select(f.doc.querySelector('#recast-duration'), '12');
    assert.doesNotMatch(f.doc.body.textContent, /2,19/);
    const longer = await f.estimate();
    assert.equal(longer.body.seconds, 12);
    assert.equal(longer.body.resolution, '1080p');
    await f.select(f.doc.querySelector('select'), '480p');
    const smaller = await f.estimate();
    assert.equal(smaller.body.seconds, 12);
    assert.equal(smaller.body.resolution, '480p');
    await f.act(async () => smaller.resolve({ status: 'unavailable' }));
    assert.match(f.doc.body.textContent, new RegExp(f.w.labels.noPrice));
  } finally { await f.dispose(); }
});

test('independent passages reach preparation unchanged; cancel keeps them and edits invalidate the reviewed price', async () => {
  const f = await mount();
  try {
    await f.upload('video', 25.6);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true);
    await f.passage('18', '25.5');
    await f.click('Dialogue');
    await f.upload('audio', 22);
    await f.passage('8.25', '13.5');
    assert.equal(f.doc.querySelector('#recast-duration').value, '8');
    const estimate = await f.estimate();
    assert.equal(estimate.body.sourceSeconds, 7.5);
    assert.equal(estimate.body.seconds, 8);
    assert.equal(estimate.body.audio, true);
    await f.select(f.doc.querySelector('select'), '1080p');
    await f.select(f.doc.querySelectorAll('select')[1], '9:16');
    await f.click(f.w.labels.reviewPrice);
    const request = f.requests.find(r => r.url.endsWith('/prepare'))!;
    assert.ok(request);
    assert.deepEqual(request.body.video, { assetId: id(2), range: { startSec: 18, endSec: 25.5 } });
    assert.deepEqual(request.body.audio, { assetId: id(3), range: { startSec: 8.25, endSec: 13.5 } });
    assert.equal(request.body.seconds, 8);
    assert.equal(request.body.resolution, '1080p');
    assert.equal(request.body.aspectRatio, '9:16');
    await f.act(async () => request.resolve({ ok: true, kind: 'rehearsal', amountCents: 565, currency: 'USD', revision: 'current', sourceSeconds: 7.5, audioSeconds: 5.25 }));
    assert.match(f.doc.body.textContent, /5,65/);
    assert.equal(f.button(f.w.labels.reviewPrice), undefined, 'rehearsal cannot proceed to a paid confirmation');
    await f.act(async () => { f.w.active = false; f.w.fx.render(); });
    await f.act(async () => { f.w.active = true; f.w.fx.render(); });
    assert.match(f.doc.body.textContent, /5,65/);
    await f.click('Choisir un passage');
    await f.click('Annuler');
    assert.match(f.doc.body.textContent, /5,65/);
    assert.match(f.doc.querySelector('video[controls]').src, /#t=18,25.5$/);
    await f.select(f.doc.querySelector('#recast-duration'), '12');
    assert.doesNotMatch(f.doc.body.textContent, /5,65/);
    await f.click(f.w.labels.reviewPrice);
    const changed = f.requests.filter(r => r.url.endsWith('/prepare')).at(-1)!;
    assert.equal(changed.body.seconds, 12);
    assert.deepEqual(f.uploads, ['/api/uploads/video', '/api/uploads/audio'], 'duration changes reuse the owned originals');
    await f.upload('video', 35, 'replacement.mp4');
    assert.equal(changed.signal!.aborted, true);
    await f.act(async () => changed.resolve({ ok: true, kind: 'rehearsal', amountCents: 711, currency: 'USD', revision: 'old', sourceSeconds: 7.5, audioSeconds: 5.25 }));
    assert.doesNotMatch(f.doc.body.textContent, /7,11/);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true);
    await f.passage('1.1', '16.1');
    assert.equal(f.doc.querySelector('#recast-duration').value, '12', 'manual duration survives replacement');
    assert.match(f.doc.querySelector('audio[controls]').src, /#t=8.25,13.5$/);
    assert.ok(f.revoked.some(url => url.includes('video.mp4')));
  } finally { await f.dispose(); }
});

for (const kind of ['video', 'audio'] as const) test(`the Recast ${kind} player stops at the selected end and replay starts at the selected beginning`, async () => {
  const f = await mount();
  try {
    if (kind === 'audio') await f.click('Dialogue');
    await f.upload(kind, 25.6);
    await f.passage('18', '25.5');
    const player = f.doc.querySelector(`${kind}[controls]`);
    f.paused.length = 0;
    await f.act(async () => { player.currentTime = 25.5; player.dispatchEvent(new f.w.Event('timeupdate')); });
    assert.ok(f.paused.includes(player), 'stop exactly at the selected endpoint');
    await f.act(async () => player.dispatchEvent(new f.w.Event('play')));
    assert.equal(player.currentTime, 18);
    await f.act(async () => { player.currentTime = 3; player.dispatchEvent(new f.w.Event('seeked')); });
    assert.equal(player.currentTime, 18);
  } finally { await f.dispose(); }
});

test('dialogue and audio suggest output duration while preserving an explicit user choice', async () => {
  const f = await mount();
  try {
    await f.click('Dialogue');
    await f.input(f.doc.querySelector('textarea'), 'Un deux trois quatre cinq six sept huit neuf dix');
    assert.equal(f.doc.querySelector('#recast-duration').value, '4');
    const speech = await f.estimate();
    assert.equal(speech.body.mode, 'i2v');
    assert.equal(speech.body.seconds, 4);
    assert.equal(speech.body.audio, true);
    await f.select(f.doc.querySelector('#recast-duration'), '12');
    await f.input(f.doc.querySelector('textarea'), 'Bonjour '.repeat(50));
    assert.equal(f.doc.querySelector('#recast-duration').value, '12');
    assert.match(f.doc.body.textContent, new RegExp(f.w.labels.shortDuration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await f.upload('audio', 22);
    await f.passage('8.25', '13.5');
    assert.equal(f.doc.querySelector('#recast-duration').value, '12');
    await f.click(f.w.labels.restoreAuto);
    assert.equal(f.doc.querySelector('#recast-duration').value, '6');
    const voice = await f.estimate();
    assert.equal(voice.body.mode, 'ref2v');
    assert.equal(voice.body.seconds, 6);
    assert.equal(voice.body.sourceSeconds, 0, 'audio duration must not become billable input video');
  } finally { await f.dispose(); }
});
