import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
  import React,{act} from 'react';import {createRoot} from 'react-dom/client';
  import {CharacterStudioRecast} from './src/components/tools/character-builder/_components/CharacterStudioRecast.client';
  import {getCharacterStudioCopy} from './src/components/tools/character-builder/_lib/character-studio-copy';
  let root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
  window.labels=getCharacterStudioCopy('fr');
  window.fx={act,unmount:()=>root.unmount(),remount:()=>{root=createRoot(document.getElementById('root'));},render:()=>{const scene=<CharacterStudioRecast
    copy={window.labels} navigation={null} active={window.active} selection={window.selection} accountId={window.accountId}/>;root.render(window.strict?<React.StrictMode>{scene}</React.StrictMode>:scene);}};
`, { '@/lib/authFetch': 'export const authFetch=(...args)=>fetch(...args);', '../_lib/recast-draft-store': `export {draftImage, draftTrack, hasRecastDraft, restoreDraftImage} from './src/components/tools/character-builder/_lib/recast-draft-store'; export const loadRecastDraft=async(id)=>window.drafts.get(id)??null; export const saveRecastDraft=async(id,value)=>{if(window.storageFailure)throw Error('unavailable');window.drafts.set(id,value);};` });
const id = (n: number) => 'ma_' + String(n).padStart(32, '0');

async function mount(withCharacter = true, accountId?: string, strict = false) {
  const dom = createClientFlowDom('/app/tools/character-builder');
  const w = dom.window as any;
  const doc = w.document;
  const requests: Array<{ url: string; body: any; signal?: AbortSignal; resolve: (body: object) => void }> = [];
  const uploads: string[] = [];
  const probes: any[] = [];
  const paused: any[] = [];
  const revoked: string[] = [];
  const deadlines: Array<() => void> = [];
  const mediaDeadlines: Array<() => void> = [];
  const setTimeout = w.setTimeout.bind(w);
  w.setTimeout = (callback: () => void, delay?: number) => {
    if (delay === 15000) deadlines.push(callback);
    if (delay === 10000) mediaDeadlines.push(callback);
    return setTimeout(callback, delay);
  };
  let serial = 0;
  w.URL.createObjectURL = (file: File) => `blob:${++serial}-${file.name}`;
  w.URL.revokeObjectURL = (url: string) => revoked.push(url);
  w.HTMLMediaElement.prototype.pause = function () { paused.push(this); };
  w.HTMLMediaElement.prototype.load = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag: string, ...rest: any[]) => {
    const el = create(tag, ...rest);
    if (tag === 'audio' || tag === 'video') probes.push(el);
    return el;
  };
  w.fetch = async (url: string, options: any = {}) => {
    if (url.includes('/confirm')) { if (w.confirmationFixture) return w.confirmationFixture(options); throw new Error('This test must never order a render'); }
    if (url.includes('prepare?')) return Response.json({ ok: true, ready: true });
    if (url.startsWith('/api/uploads/')) {
      uploads.push(url);
      const kind = url.endsWith('video') ? 'video' : 'audio';
      return Response.json({ ok: true, asset: { id: kind, assetId: id(kind === 'video' ? 2 : 3), url: `https://example.invalid/${kind}` } });
    }
    return new Promise<Response>(resolve => requests.push({ url, body: JSON.parse(options.body), signal: options.signal,
      resolve: body => resolve(Response.json(body)) }));
  };
  w.active = true; w.strict = strict; w.accountId=accountId; w.drafts=new Map(); w.confirm=()=>true;
  const savedCharacter = { jobId: 'saved-look', transferId: '1', imageUrl: 'https://example.invalid/portrait.png', name: 'Basil' };
  w.selection = withCharacter ? savedCharacter : null;
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  const act = (fn: () => unknown) => w.fx.act(fn);
  const button = (text: string) => [...doc.querySelectorAll('button')].find((el: any) => el.textContent.trim() === text) as any;
  const input = async (node: any, value: string) => act(async () => {
    const prototype = node.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new w.Event('input', { bubbles: true }));
  });
  return { w, doc, requests, uploads, paused, revoked, probes, deadlines, mediaDeadlines, savedCharacter, button, act, input,
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

test('empty Recast estimates its default settings while explaining both generation requirements and focusing their sections', async () => {
  const f = await mount(false);
  try {
    const readiness = () => f.doc.querySelector('[data-recast-readiness]');
    assert.match(readiness()?.textContent ?? '', /personnage/i);
    assert.match(readiness()?.textContent ?? '', /consigne/i);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true);
    assert.equal(f.button(f.w.labels.reviewPrice).getAttribute('aria-describedby'), readiness().id);
    const initial = await f.estimate();
    assert.deepEqual(initial.body, { mode: 'i2v', resolution: '720p', aspectRatio: 'auto', seconds: 6, sourceSeconds: 0, audio: false });
    await f.act(async () => initial.resolve({ status: 'estimated', amountCents: 168, currency: 'USD' }));
    assert.match(f.doc.body.textContent, /1,68/);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true);
    await f.act(async () => f.doc.querySelector('[data-recast-action="character"]').click());
    assert.equal(f.doc.activeElement, f.button(f.w.labels.addReplacement));
    assert.ok(f.doc.activeElement.closest('[data-required-missing="true"]'));
    await f.act(async () => f.doc.querySelector('[data-recast-action="direction"]').click());
    assert.equal(f.doc.activeElement, f.doc.querySelector('textarea'));
    assert.doesNotMatch(f.doc.querySelector('textarea').closest('label').textContent, /facultatif/i);
    await f.input(f.doc.querySelector('textarea'), 'Dance');
    assert.equal(f.doc.querySelector('[data-recast-action="direction"]'), null);
    assert.match(f.doc.body.textContent, /1,68/, 'direction text does not invalidate unchanged pricing inputs');
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true, 'generation still needs a character');
    await f.act(async () => { f.w.selection = f.savedCharacter; f.w.fx.render(); });
    assert.equal(readiness(), null);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false);
    assert.ok(await f.estimate());
    assert.equal(f.uploads.length, 0, 'optional source video, product and audio are not required');
  } finally { await f.dispose(); }
});

test('a stalled estimate times out to retry and a late aborted response cannot replace the new price', async () => {
  const f = await mount();
  try {
    const stalled = await f.estimate();
    await f.act(async () => f.deadlines.at(-1)!());
    assert.equal(stalled.signal!.aborted, true);
    assert.ok(f.doc.querySelector('[data-recast-retry-estimate]'));
    await f.act(async () => f.doc.querySelector('[data-recast-retry-estimate]').click());
    const retry = await f.estimate();
    await f.act(async () => retry.resolve({ status: 'estimated', amountCents: 168, currency: 'USD' }));
    await f.act(async () => stalled.resolve({ status: 'estimated', amountCents: 999, currency: 'USD' }));
    assert.match(f.doc.body.textContent, /1,68/);
    assert.doesNotMatch(f.doc.body.textContent, /9,99/);
    assert.equal(f.doc.querySelector('[data-recast-estimate-error]'), null);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true, 'the missing direction still blocks generation');
  } finally { await f.dispose(); }
});

test('a failed estimate has a retry action with visible loading and keeps the ready setup', async () => {
  const f = await mount();
  try {
    await f.input(f.doc.querySelector('textarea'), 'Dance');
    const first = await f.estimate();
    assert.match(f.doc.body.textContent, /Estimation en cours/);
    await f.act(async () => first.resolve({ status: 'unavailable' }));
    assert.match(f.doc.querySelector('[data-recast-estimate-error]').textContent, /estimation/i);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false, 'the exact quote remains a separate no-charge step');
    await f.act(async () => f.doc.querySelector('[data-recast-retry-estimate]').click());
    assert.match(f.doc.body.textContent, /Estimation en cours/);
    assert.equal(f.doc.querySelector('[data-recast-estimate-error]'), null);
    const retry = await f.estimate();
    assert.notEqual(retry, first);
    assert.deepEqual(retry.body, first.body);
    await f.act(async () => retry.resolve({ status: 'estimated', amountCents: 219, currency: 'USD' }));
    assert.match(f.doc.body.textContent, /2,19/);
    assert.equal(f.doc.querySelector('[data-recast-retry-estimate]'), null);
    assert.equal(f.doc.querySelector('textarea').value, 'Dance');
    assert.ok(!f.requests.some(r => r.url.endsWith('/confirm')));
  } finally { await f.dispose(); }
});

test('media reading and an unselected passage explain the block and offer the passage editor', async () => {
  const f = await mount();
  try {
    const field = f.doc.querySelector('input[accept="video/*"]');
    await f.act(async () => {
      Object.defineProperty(field, 'files', { configurable: true, value: [new f.w.File(['bytes'], 'long.mp4', { type: 'video/mp4' })] });
      field.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    });
    assert.match(f.doc.querySelector('[data-recast-readiness]').textContent, /Lecture de la durée/);
    assert.equal(f.doc.querySelector('[data-recast-estimate-error]'), null);
    const probe = f.probes.findLast(el => typeof el.onloadedmetadata === 'function');
    await f.act(async () => { Object.defineProperty(probe, 'duration', { value: 25 }); probe.dispatchEvent(new f.w.Event('loadedmetadata')); });
    await f.click('Annuler');
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true);
    assert.match(f.doc.querySelector('[data-recast-readiness]').textContent, /passage/);
    await f.act(async () => f.doc.querySelector('[data-recast-action="passage"]').click());
    assert.ok(f.doc.querySelector('[role="dialog"]'));
    await f.passage('2', '10');
    assert.equal(f.doc.querySelector('[data-recast-readiness]'), null);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false, 'selected video provides direction without a text prompt');
    await f.click(f.w.labels.reviewPrice);
    assert.match(f.doc.querySelector('[data-recast-preparation-status]').textContent, /références/i);
    assert.equal(f.doc.querySelector('[data-recast-estimate-error]'), null);
  } finally { await f.dispose(); }
});

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


test('Recast restores its scene after remount, including separate local passages, without restoring a price', async () => {
  const f = await mount(true, 'account-a');
  try {
    await f.input(f.doc.querySelector('textarea'), 'Walk then show the watch');
    await f.upload('video', 20); await f.passage('1.2','7.2');
    await f.click(f.w.labels.dialogue);
    await f.input(f.doc.querySelector('textarea'), 'This is my new watch.');
    await f.upload('audio', 20); await f.passage('5.5','11.5');
    const controls=f.doc.querySelectorAll('select');
    await f.select(controls[0],'1080p'); await f.select(controls[1],'9:16'); await f.select(controls[2],'8');
    await f.act(async()=>new Promise(resolve=>setTimeout(resolve,300)));
    await f.act(async()=>f.w.fx.unmount()); f.w.selection=null; f.w.strict=true; f.w.fx.remount();
    await f.act(async()=>f.w.fx.render());
    for (const probe of f.probes.filter(el => typeof el.onloadedmetadata === 'function')) {
      assert.ok(!f.revoked.includes(probe.src), 'restored file must remain readable after Strict Mode effect replay');
      await f.act(async()=>{Object.defineProperty(probe,'duration',{value:20});probe.dispatchEvent(new f.w.Event('loadedmetadata'));});
    }
    assert.equal(f.doc.querySelector('textarea').value,'Walk then show the watch');
    assert.equal(f.doc.querySelectorAll('select')[0].value,'1080p');
    assert.equal(f.doc.querySelector('#recast-duration').value,'8');
    assert.match(f.doc.body.textContent,/1,2.*7,2/);
    await f.click(f.w.labels.dialogue + ' •');
    assert.equal(f.doc.querySelector('textarea').value,'This is my new watch.');
    assert.match(f.doc.body.textContent,/5,5.*11,5/);
    assert.ok(f.doc.querySelector('img[alt="Basil"]'));
    assert.ok(f.doc.querySelector('[data-recast-restored]'));
    assert.equal(f.requests.filter(r=>r.url.includes('/prepare')).length,0);
  } finally { await f.dispose(); }
});

test('New scene cancels preparation and clears references, descriptions, settings and saved draft', async () => {
  const f=await mount(true,'account-a');
  try {
    await f.input(f.doc.querySelector('textarea'),'Never reuse this direction');
    await f.upload('video',6);
    await f.select(f.doc.querySelector('#recast-duration'),'8');
    await f.click(f.w.labels.reviewPrice);
    const pending=f.requests.find(r=>r.url.endsWith('/prepare')); assert.ok(pending);
    const reset=()=>f.doc.querySelector('[data-recast-new]'); assert.ok(reset(),'a visible New scene action');
    let nativeConfirmations = 0;
    f.w.confirm=()=>{ nativeConfirmations++; return false; };
    reset().focus();
    await f.act(async()=>reset().click());
    assert.equal(nativeConfirmations, 0, 'reset must not block the browser with window.confirm');
    assert.ok(f.doc.querySelector('dialog[open]'), 'confirmation stays inside the page');
    assert.equal(f.doc.activeElement, f.button('Garder cette scène'), 'default focus preserves the draft');
    assert.equal(pending.signal!.aborted, false, 'opening the confirmation does not discard work');
    await f.click('Garder cette scène');
    assert.equal(f.doc.querySelector('dialog'), null);
    assert.equal(f.doc.activeElement, reset());
    assert.equal(f.doc.querySelector('textarea').value,'Never reuse this direction');
    await f.act(async()=>reset().click());
    await f.act(async()=>f.doc.querySelector('dialog').dispatchEvent(new f.w.Event('cancel', {cancelable:true})));
    assert.equal(f.doc.querySelector('dialog'), null, 'Escape keeps the scene');
    assert.equal(f.doc.querySelector('textarea').value,'Never reuse this direction');
    await f.act(async()=>reset().click());
    await f.click('Commencer une nouvelle scène');
    assert.equal(pending.signal!.aborted,true);
    assert.equal(f.doc.querySelector('textarea').value,'');
    assert.equal(f.doc.querySelector('#recast-duration').value,'6');
    assert.equal(f.doc.querySelector('img[alt="Basil"]'),null);
    assert.equal(f.doc.querySelector('video'),null);
    await f.act(async()=>pending.resolve({ok:true,kind:'rehearsal',amountCents:999,currency:'USD',sourceSeconds:6,audioSeconds:0,revision:'test'}));
    assert.doesNotMatch(f.doc.body.textContent,/9,99/);
    await f.act(async()=>f.w.fx.unmount()); f.w.selection=null; f.w.fx.remount();
    await f.act(async()=>f.w.fx.render());
    assert.equal(f.doc.querySelector('textarea').value,'');
    assert.equal(f.doc.querySelector('[data-recast-restored]'),null);
    assert.ok(f.revoked.length>0);
  } finally { await f.dispose(); }
});

test('reset confirmation is unnecessary for an empty scene and cannot survive leaving Recast or switching accounts', async () => {
  const f = await mount(false, 'account-a');
  try {
    let nativeConfirmations = 0;
    f.w.confirm = () => { nativeConfirmations++; return false; };
    await f.act(async () => f.doc.querySelector('[data-recast-new]').click());
    assert.equal(f.doc.querySelector('dialog'), null);
    await f.input(f.doc.querySelector('textarea'), 'Keep account A scene');
    await f.act(async () => f.doc.querySelector('[data-recast-new]').click());
    assert.ok(f.doc.querySelector('dialog[open]'));
    await f.act(async () => { f.w.active = false; f.w.fx.render(); });
    assert.equal(f.doc.querySelector('dialog'), null);
    await f.act(async () => { f.w.active = true; f.w.fx.render(); });
    assert.equal(f.doc.querySelector('dialog'), null, 'returning cannot reopen an old confirmation');
    assert.equal(f.doc.querySelector('textarea').value, 'Keep account A scene');
    await f.act(async () => f.doc.querySelector('[data-recast-new]').click());
    await f.act(async () => { f.w.accountId = 'account-b'; f.w.fx.render(); });
    assert.equal(f.doc.querySelector('dialog'), null);
    assert.equal(f.doc.querySelector('textarea').value, '');
    assert.equal(nativeConfirmations, 0);
    assert.equal(f.requests.filter(r => /\/(prepare|confirm)$/.test(r.url)).length, 0);
  } finally { await f.dispose(); }
});

test('failed draft storage warns before leaving and never reads another account draft', async () => {
  const f=await mount(true,'account-a');
  try {
    f.w.storageFailure=true;
    await f.input(f.doc.querySelector('textarea'),'Keep this scene');
    await f.act(async()=>new Promise(resolve=>setTimeout(resolve,300)));
    assert.ok(f.doc.querySelector('[data-recast-storage-error]'),'storage failure must be visible');
    const event=new f.w.Event('beforeunload',{cancelable:true});
    f.w.dispatchEvent(event); assert.equal(event.defaultPrevented,true);
    assert.ok(f.doc.querySelector('[data-recast-storage-error]'));
    await f.act(async()=>f.w.fx.unmount()); f.w.accountId='account-b'; f.w.selection=null; f.w.fx.remount();
    await f.act(async()=>f.w.fx.render());
    assert.equal(f.doc.querySelector('textarea').value,'');
    assert.equal(f.doc.querySelector('img[alt="Basil"]'),null);
  } finally { await f.dispose(); }
});


test('an uncertain confirmation keeps New scene disabled and protects reload until the same purchase is recovered', async () => {
  const f=await mount(true,'account-a');
  try {
    await f.input(f.doc.querySelector('textarea'),'Walk');
    await f.click(f.w.labels.reviewPrice);
    const request=f.requests.find(r=>r.url.endsWith('/prepare'))!;
    await f.act(async()=>request.resolve({ok:true,kind:'wallet',quoteId:'11111111-1111-4111-8111-111111111111',
      expiresAt:new Date(Date.now()+60000).toISOString(),amountCents:168,currency:'USD',sourceSeconds:0,audioSeconds:0,topupRequired:false}));
    f.w.confirmationFixture=()=>Promise.reject(new Error('network lost'));
    await f.act(async()=>f.doc.querySelector('[data-recast-submit]').click());
    assert.equal(f.doc.querySelector('[data-recast-new]').disabled,true);
    assert.equal(f.doc.querySelector('[data-recast-submit]').textContent,f.w.labels.recoverRecast);
    const event=new f.w.Event('beforeunload',{cancelable:true}); f.w.dispatchEvent(event); assert.equal(event.defaultPrevented,true);
    f.w.confirmationFixture=()=>Promise.resolve(Response.json({ok:true,jobId:'existing-job',status:'queued'}));
    await f.act(async()=>f.doc.querySelector('[data-recast-submit]').click());
    assert.ok(f.doc.querySelector('a[href="/app?job=existing-job"]'));
    assert.equal(f.doc.querySelector('[data-recast-new]').disabled,false);
  } finally { await f.dispose(); }
});

for (const kind of ['portrait', 'product'] as const) {
  test(`an empty ${kind} image preserves the selected reference and allows a corrected file`, async () => {
    const f = await mount(true, 'account-a');
    try {
      const field = f.doc.querySelector(kind === 'portrait' ? 'input[accept="image/*"]' : 'input[accept^="image/jpeg"]');
      const choose = (name: string, contents: string) => f.act(async () => {
        Object.defineProperty(field, 'files', { configurable: true, value: [new f.w.File([contents], name, { type: 'image/png' })] });
        field.dispatchEvent(new f.w.Event('change', { bubbles: true }));
      });
      if (kind === 'product') await choose('watch.png', 'existing-image');
      const selectedName = kind === 'portrait' ? 'Basil' : 'watch.png';
      const selected = f.doc.querySelector(`img[alt="${selectedName}"]`);
      assert.ok(selected);
      const originalUrl = selected.getAttribute('src');

      await choose('empty.png', '');
      const error = f.doc.querySelector('fieldset p[role="alert"]');
      assert.ok(error, 'the invalid image must be explained before replacing the reference');
      assert.match(error.textContent, /fichier image/i);
      assert.equal(f.doc.querySelector(`img[alt="${selectedName}"]`)?.getAttribute('src'), originalUrl);
      assert.ok(!f.doc.querySelector('img[alt="empty.png"]'));
      assert.equal(f.revoked.includes(originalUrl), false);

      await choose('corrected.png', 'replacement-image');
      assert.ok(f.doc.querySelector('img[alt="corrected.png"]'));
      assert.ok(!f.doc.querySelector('fieldset p[role="alert"]'));
      assert.equal(f.uploads.length, 0);
      assert.equal(f.requests.filter(request => /\/(prepare|confirm)$/.test(request.url)).length, 0);
    } finally { await f.dispose(); }
  });
}

// Wave 2: recovery must retain the scene, including when the old request settles later.
test('a stalled preparation can be cancelled without losing the scene, then retried safely', async () => {
  const f = await mount(true, 'account-a');
  try {
    await f.input(f.doc.querySelector('textarea'), 'Keep my scene');
    await f.click(f.w.labels.reviewPrice);
    const stalled = f.requests.find(r => r.url.endsWith('/prepare'))!;
    assert.ok(stalled);
    const cancel = f.doc.querySelector('[data-recast-cancel-preparation]');
    assert.ok(cancel, 'preparation needs an explicit cancel action without resetting the scene');
    await f.act(async () => cancel.click());
    assert.equal(stalled.signal?.aborted, true);
    assert.equal(f.doc.querySelector('textarea').value, 'Keep my scene');
    assert.ok(f.doc.querySelector('img[alt="Basil"]'));
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false);
    await f.click(f.w.labels.reviewPrice);
    const retry = f.requests.filter(r => r.url.endsWith('/prepare')).at(-1)!;
    assert.notEqual(retry, stalled);
    await f.act(async () => stalled.resolve({ ok: true, kind: 'rehearsal', amountCents: 999, currency: 'USD', revision: 'old', sourceSeconds: 0, audioSeconds: 0 }));
    assert.doesNotMatch(f.doc.body.textContent, /9,99/);
    assert.equal(f.doc.querySelector('[data-recast-submit]').disabled, true, 'the cancelled flight must not unlock the newer attempt');
    await f.act(async () => retry.resolve({ ok: true, kind: 'rehearsal', amountCents: 168, currency: 'USD', revision: 'current', sourceSeconds: 0, audioSeconds: 0 }));
    assert.match(f.doc.body.textContent, /1,68/);
    assert.ok(!f.doc.querySelector('[data-recast-cancel-preparation]'));
    assert.equal(f.doc.querySelector('textarea').value, 'Keep my scene');
  } finally { await f.dispose(); }
});

for (const kind of ['portrait', 'product'] as const) test(`an unreadable ${kind} upload asks for another image and a corrected file prepares successfully`, async () => {
  const f = await mount(true, 'account-a');
  try {
    const originalFetch = f.w.fetch;
    let rejected = true;
    f.w.createImageBitmap = async () => ({ width: 100, height: 100, close() {} });
    f.w.fetch = (url: string, options: any) => url === '/api/uploads/image'
      ? Promise.resolve(rejected
        ? Response.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 })
        : Response.json({ ok: true, asset: { assetId: id(4) } }))
      : originalFetch(url, options);
    await f.input(f.doc.querySelector('textarea'), 'Keep the direction');
    const field = f.doc.querySelector(kind === 'portrait' ? 'input[accept="image/*"]' : 'input[accept^="image/jpeg"]');
    const choose = (name: string) => f.act(async () => {
      Object.defineProperty(field, 'files', { configurable: true, value: [new f.w.File(['bytes'], name, { type: 'image/png' })] });
      field.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    });
    await choose('unreadable.png');
    await f.click(f.w.labels.reviewPrice);
    assert.match(f.doc.querySelector('[role="alert"]').textContent, /image.*(?:lisible|lue|lire)|(?:lisible|lue|lire).*image/i);
    assert.match(f.doc.querySelector('[role="alert"]').textContent, /(?:autre|nouveau|remplac)/i);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false);
    assert.equal(f.requests.filter(r => r.url.endsWith('/prepare')).length, 0);
    assert.equal(f.doc.querySelector('textarea').value, 'Keep the direction');
    rejected = false;
    await choose('corrected.png');
    await f.click(f.w.labels.reviewPrice);
    const prepared = f.requests.find(r => r.url.endsWith('/prepare'))!;
    assert.ok(prepared);
    assert.equal(kind === 'portrait' ? prepared.body.portrait.assetId : prepared.body.product, id(4));
    assert.ok(!f.doc.querySelector('[role="alert"]'));
  } finally { await f.dispose(); }
});

test('an external character selection cannot discard an uncertain purchase or apply itself later', async () => {
  const f = await mount(true, 'account-a');
  try {
    await f.input(f.doc.querySelector('textarea'), 'Walk');
    await f.click(f.w.labels.reviewPrice);
    const quoteId = '11111111-1111-4111-8111-111111111111';
    await f.act(async () => f.requests.find(r => r.url.endsWith('/prepare'))!.resolve({ ok: true, kind: 'wallet', quoteId,
      expiresAt: new Date(Date.now() + 60000).toISOString(), amountCents: 168, currency: 'USD', sourceSeconds: 0, audioSeconds: 0, topupRequired: false }));
    f.w.confirmationFixture = () => Promise.reject(new Error('network lost'));
    await f.act(async () => f.doc.querySelector('[data-recast-submit]').click());
    assert.equal(f.doc.querySelector('[data-recast-submit]').textContent, f.w.labels.recoverRecast);
    await f.act(async () => { f.w.active = false; f.w.fx.render(); });
    await f.act(async () => {
      f.w.selection = { jobId: 'new-job', imageUrl: 'https://example.invalid/other.png', name: 'Other character', transferId: '2' };
      f.w.active = true; f.w.fx.render();
    });
    assert.equal(f.doc.querySelector('[data-recast-submit]')?.textContent, f.w.labels.recoverRecast, 'keep the original recovery action');
    assert.ok(f.doc.querySelector('img[alt="Basil"]'));
    assert.ok(!f.doc.querySelector('img[alt="Other character"]'));
    assert.match(f.doc.querySelector('[data-recast-locked-selection]')?.textContent ?? '', /confirmation|vérifi/i);
    f.w.confirmationFixture = (options: any) => {
      assert.equal(JSON.parse(options.body).quoteId, quoteId);
      return Promise.resolve(Response.json({ ok: true, jobId: 'existing-job', status: 'accepted' }));
    };
    await f.act(async () => f.doc.querySelector('[data-recast-submit]').click());
    assert.ok(f.doc.querySelector('a[href="/app?job=existing-job"]'));
    assert.ok(f.doc.querySelector('img[alt="Basil"]'), 'unlocking must not silently apply a previously rejected handoff');
    assert.ok(!f.doc.querySelector('[data-recast-locked-selection]'));
    await f.act(async () => { f.w.selection = { ...f.w.selection, transferId: '3' }; f.w.fx.render(); });
    assert.ok(f.doc.querySelector('img[alt="Other character"]'), 'an explicit later selection is allowed after recovery');
  } finally { await f.dispose(); }
});

test('cancelling a stalled local upload evicts only that attempt and retry keeps the corrected upload cached', async () => {
  const f = await mount(true, 'account-a');
  try {
    await f.upload('video', 5);
    const uploads: Array<{ signal: AbortSignal; resolve: (value: Response) => void }> = [];
    const originalFetch = f.w.fetch;
    f.w.fetch = (url: string, options: any) => url === '/api/uploads/video'
      ? new Promise<Response>(resolve => uploads.push({ signal: options.signal, resolve }))
      : originalFetch(url, options);
    await f.click(f.w.labels.reviewPrice);
    assert.equal(uploads.length, 1);
    await f.act(async () => f.doc.querySelector('[data-recast-cancel-preparation]').click());
    assert.equal(uploads[0].signal?.aborted, true);
    await f.click(f.w.labels.reviewPrice);
    assert.equal(uploads.length, 2, 'retry must not wait on the cancelled cached upload');
    await f.act(async () => uploads[0].resolve(Response.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 })));
    assert.ok(!f.doc.querySelector('[role="alert"]'), 'old upload failure cannot replace the current progress');
    await f.act(async () => uploads[1].resolve(Response.json({ ok: true, asset: { assetId: id(5), id: 'video', url: 'https://example.invalid/corrected.mp4' } })));
    const quote = f.requests.find(r => r.url.endsWith('/prepare'))!;
    assert.equal(quote.body.video.assetId, id(5));
    await f.act(async () => quote.resolve({ ok: false, error: { code: 'ENGINE_UNAVAILABLE' } }));
    await f.click(f.w.labels.reviewPrice);
    assert.equal(uploads.length, 2, 'a late failed attempt must not evict the newer successful cache entry');
    assert.equal(f.requests.filter(r => r.url.endsWith('/prepare')).length, 2);
  } finally { await f.dispose(); }
});

for (const kind of ['video', 'audio'] as const) test(`invalid ${kind} formats and byte limits preserve the passage; corrupt or stalled metadata can be corrected`, async () => {
  const f = await mount(true, 'account-a');
  try {
    if (kind === 'audio') await f.click('Dialogue');
    await f.upload(kind, 5, `good.${kind === 'video' ? 'mp4' : 'wav'}`);
    const field = f.doc.querySelector(kind === 'video' ? 'input[accept="video/*"]' : 'input[accept^=".mp3"]');
    const choose = (name: string, type: string, size?: number) => f.act(async () => {
      const file = new f.w.File(['bytes'], name, { type });
      if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
      Object.defineProperty(field, 'files', { configurable: true, value: [file] });
      field.dispatchEvent(new f.w.Event('change', { bubbles: true }));
    });
    const original = f.doc.querySelector(`${kind}[controls]`).src;
    for (const [name, type, size] of [
      ['wrong.txt', 'text/plain', 5],
      [kind === 'video' ? 'empty.mp4' : 'empty.wav', `${kind}/${kind === 'video' ? 'mp4' : 'wav'}`, 0],
      [kind === 'video' ? 'large.mp4' : 'large.wav', `${kind}/${kind === 'video' ? 'mp4' : 'wav'}`, (kind === 'video' ? 100 : 15) * 1024 * 1024 + 1],
    ] as const) {
      await choose(name, type, size);
      assert.ok(f.doc.querySelector('fieldset p[role="alert"]'));
      assert.equal(f.doc.querySelector(`${kind}[controls]`).src, original);
    }
    await choose(kind === 'video' ? 'corrupt.mp4' : 'corrupt.wav', `${kind}/${kind === 'video' ? 'mp4' : 'wav'}`);
    const broken = f.probes.findLast(el => typeof el.onerror === 'function');
    await f.act(async () => broken.dispatchEvent(new f.w.Event('error')));
    assert.ok(f.doc.querySelector('fieldset p[role="alert"]'));
    assert.ok(!f.doc.querySelector(`${kind}[controls]`));
    assert.ok(f.button(kind === 'video' ? f.w.labels.addVideo : f.w.labels.addAudio) || f.doc.querySelector(kind === 'video' ? 'input[accept="video/*"]' : 'input[accept^=".mp3"]'));
    await choose(kind === 'video' ? 'stalled.mp4' : 'stalled.wav', `${kind}/${kind === 'video' ? 'mp4' : 'wav'}`);
    const late = f.probes.findLast(el => typeof el.onloadedmetadata === 'function');
    const staleMetadata = late.onloadedmetadata;
    await f.act(async () => f.mediaDeadlines.at(-1)!());
    assert.ok(f.doc.querySelector('fieldset p[role="alert"]'));
    await f.upload(kind, 6, kind === 'video' ? 'corrected.mp4' : 'corrected.wav');
    await f.act(async () => { Object.defineProperty(late, 'duration', { value: 25 }); staleMetadata(); });
    assert.ok(!f.doc.querySelector('fieldset p[role="alert"]'));
    assert.match(f.doc.querySelector(`${kind}[controls]`).src, /corrected/);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false);
    assert.ok(!f.doc.querySelector('[role="dialog"]'), 'late invalidated metadata must not reopen a trim');
  } finally { await f.dispose(); }
});

for (const kind of ['video', 'audio'] as const) test(`a cancelled ${kind} trim is reopened from readiness; invalid ranges stay editable and exact 15 seconds is accepted`, async () => {
  const f = await mount(true, 'account-a');
  try {
    if (kind === 'audio') await f.click('Dialogue');
    await f.upload(kind, 20);
    await f.click('Annuler');
    await f.act(async () => f.doc.querySelector('[data-recast-action="passage"]').click());
    assert.ok(f.doc.querySelector('[role="dialog"]'));
    const start = () => f.doc.querySelector('input[aria-label="Début (secondes)"]');
    const end = () => f.doc.querySelector('input[aria-label="Fin (secondes)"]');
    for (const [a, b] of [['', '15'], ['-1', '10'], ['5', '5'], ['10', '8'], ['0', '15.001'], ['10', '21']]) {
      await f.input(start(), a); await f.input(end(), b);
      assert.equal(f.button('Utiliser ce passage').disabled, true, `invalid range ${a}..${b}`);
      assert.ok(f.doc.querySelector('[role="dialog"]'));
    }
    await f.passage('5', '20');
    assert.equal(f.doc.querySelector('#recast-duration').value, '15');
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false);
    await f.click('Choisir un passage');
    await f.input(end(), '19.5');
    await f.click('Annuler');
    assert.match(f.doc.querySelector(`${kind}[controls]`).src, /#t=5,20$/);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false);
  } finally { await f.dispose(); }
});

test('whitespace direction and long dialogue explain the block; duration correction preserves the full text', async () => {
  const f = await mount(true, 'account-a');
  try {
    await f.input(f.doc.querySelector('textarea'), '   \n ');
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true);
    assert.ok(f.doc.querySelector('[data-recast-action="direction"]'));
    assert.equal(f.doc.querySelector('textarea').maxLength, 2000);
    await f.input(f.doc.querySelector('textarea'), 'x'.repeat(2000));
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false);
    await f.click('Dialogue');
    assert.equal(f.doc.querySelector('textarea').maxLength, 500);
    const longDialogue = 'word '.repeat(100);
    await f.input(f.doc.querySelector('textarea'), longDialogue);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true);
    const action = f.doc.querySelector('[data-recast-action="duration"]');
    assert.ok(action);
    await f.act(async () => action.click());
    assert.equal(f.doc.activeElement, f.doc.querySelector('#recast-duration'));
    await f.select(f.doc.querySelector('#recast-duration'), '30');
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false);
    assert.equal(f.doc.querySelector('textarea').value, longDialogue);
    await f.upload('video', 2);
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, true, 'source plus output must fit 30 seconds');
    await f.select(f.doc.querySelector('#recast-duration'), '28');
    assert.equal(f.button(f.w.labels.reviewPrice).disabled, false);
    await f.click(f.w.labels.reviewPrice);
    const quote = f.requests.find(r => r.url.endsWith('/prepare'))!;
    assert.equal(quote.body.direction.length, 2000);
    assert.equal(quote.body.dialogue, longDialogue);
    assert.equal(quote.body.seconds, 28);
  } finally { await f.dispose(); }
});

test('a failed local reset preserves the draft; retry after storage recovery clears it without a quote', async () => {
  const f = await mount(true, 'account-a');
  try {
    await f.input(f.doc.querySelector('textarea'), 'Keep this draft');
    await f.act(async () => new Promise(resolve => setTimeout(resolve, 300)));
    f.w.storageFailure = true;
    await f.act(async () => f.doc.querySelector('[data-recast-new]').click());
    await f.click('Commencer une nouvelle scène');
    assert.equal(f.doc.querySelector('textarea').value, 'Keep this draft');
    assert.ok(f.doc.querySelector('img[alt="Basil"]'));
    assert.ok(f.doc.querySelector('[data-recast-storage-error]'));
    assert.equal(f.doc.querySelector('[data-recast-new]').disabled, false);
    f.w.storageFailure = false;
    await f.act(async () => f.doc.querySelector('[data-recast-new]').click());
    await f.click('Commencer une nouvelle scène');
    assert.equal(f.doc.querySelector('textarea').value, '');
    assert.ok(!f.doc.querySelector('img[alt="Basil"]'));
    assert.ok(!f.doc.querySelector('[data-recast-storage-error]'));
    assert.equal(f.w.drafts.get('account-a'), null);
    assert.equal(f.requests.filter(r => /\/(prepare|confirm)$/.test(r.url)).length, 0);
  } finally { await f.dispose(); }
});

test('a character handoff survives the StrictMode effect replay and keeps its original identity', async () => {
  const f = await mount(true, 'account-a', true);
  try {
    assert.equal(f.doc.querySelector('img[alt="Basil"]')?.getAttribute('src'), f.savedCharacter.imageUrl);
    await f.input(f.doc.querySelector('textarea'), 'Walk');
    await f.click(f.w.labels.reviewPrice);
    const request = f.requests.find(r => r.url.endsWith('/prepare'))!;
    assert.deepEqual(request.body.portrait, { jobId: f.savedCharacter.jobId, imageUrl: f.savedCharacter.imageUrl });
  } finally { await f.dispose(); }
});
