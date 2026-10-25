import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

const stubs = {
  '@/hooks/useRequireAuth': 'export const useRequireAuth=()=>({user:window.account?{id:window.account}:null,session:window.account?{access_token:"fixture"}:null,loading:false});',
  '@/lib/i18n/I18nProvider': 'export const useI18n=()=>({locale:"fr",t:(_,fallback)=>fallback});',
  '@/lib/authFetch': 'export const authFetch=(url,init)=>window.fixtureFetch(url,init);',
  'next/navigation': 'export const useRouter=()=>({push:url=>window.navigations.push(url)});',
  'next/link': "import React from 'react';export default p=>React.createElement('a',{href:p.href},p.children);",
  'next/image': "import React from 'react';export default ({fill,priority,unoptimized,fetchPriority,...props})=>React.createElement('img',props);",
  'next/dynamic': "import React,{lazy,Suspense} from 'react';export default load=>{const Component=lazy(()=>load().then(value=>({default:value})));return props=>React.createElement(Suspense,{fallback:null},React.createElement(Component,props));};",
};
const catalog = { ok: true, engines: [{ id: 'wan-3', label: 'Wan 3', modes: ['extend', 'v2v'], availability: 'available', status: 'live', inputLimits: {}, inputSchema: { required: [{ id: 'video_url', type: 'video', label: 'Source', modes: ['extend', 'v2v'] }] } }] };
async function mount(options: { status?: string; count?: number; image?: boolean; curated?: boolean; account?: string | null } = {}) {
  return mountToolFixture(`import {GroupedJobCard} from './components/GroupedJobCard';
    const member={id:'output-a',jobId:'job-a',engineId:'wan-3',engineLabel:'Wan 3',durationSec:5,status:${JSON.stringify(options.status ?? 'completed')},createdAt:'2026-10-22T09:00:00Z',videoUrl:'https://media.invalid/original.mp4',previewVideoUrl:'https://media.invalid/preview.mp4',thumbUrl:'https://media.invalid/poster.jpg',job:{curated:${!!options.curated}}};
    const group={id:'group-a',hero:member,members:[member],previews:[{id:member.id,thumbUrl:member.thumbUrl}],count:${options.count ?? 1}};
    function App(){return <GroupedJobCard group={group} menuVariant="${options.image ? 'gallery-image' : 'gallery'}" isImageGroup={${!!options.image}} onOpen={()=>window.opens++} onAction={()=>{}} showOpenOverlay={false} warmOnVisible={false}/>;}`,
    stubs, w => { w.account = options.account === undefined ? 'account-a' : options.account; w.navigations = []; w.opens = 0; w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }; });
}
function button(w: any, label: string): HTMLButtonElement | null { return w.document.querySelector(`button[aria-label="${label}"]`); }
for (const [label, mode] of [['Prolonger la vidéo', 'extend'], ['Modifier la vidéo', 'v2v']]) {
  test(`gallery ${mode} shortcut stages the clicked original without opening the viewer or generating`, async () => {
    const f = await mount();
    try {
      const request = f.w.requests.find((item: any) => item.url === '/api/engines');
      assert.ok(request, 'the card loads account-visible destinations');
      assert.equal(button(f.w, label), null);
      await f.respond(request, catalog);
      const action = button(f.w, label); assert.ok(action, 'show the eligible direct action');
      assert.equal(action.closest('figure'), null, 'shortcuts cannot nest in the preview control');
      await f.act(async () => action.click());
      assert.equal(f.w.opens, 0);
      assert.equal(button(f.w, label)?.disabled, true, 'prevent another action while resolving');
      const original = f.w.requests.find((item: any) => item.url.includes('/recent-outputs?'));
      assert.ok(original); assert.match(original.url, /jobId=job-a/);
      await f.respond(original, { ok: true, outputs: [
        { id: 'wrong-output', url: 'https://media.invalid/preview.mp4', kind: 'video', status: 'ready' },
        { id: 'exact-output', url: 'https://media.invalid/original.mp4', kind: 'video', status: 'ready' },
      ] });
      assert.equal(f.w.navigations.length, 1);
      assert.match(f.w.navigations[0], new RegExp(`&engine=wan-3&mode=${mode}$`));
      const saved = JSON.parse(f.w.sessionStorage.getItem('maxvideoai:media-handoff:v1'));
      assert.equal(saved.asset.url, 'https://media.invalid/original.mp4');
      assert.equal(saved.asset.sourceOutputId, 'exact-output');
      assert.equal(f.w.requests.length, 2, 'only catalog and original reads; no paid generation');
    } finally { await f.close(); }
  });
}
test('gallery shortcuts stay absent on ambiguous, unfinished, image, public sample and signed-out cards', async () => {
  for (const options of [{ count: 2 }, { status: 'pending' }, { status: 'failed' }, { image: true }, { curated: true }, { account: null }]) {
    const f = await mount(options);
    try {
      const request = f.w.requests.find((item: any) => item.url === '/api/engines');
      if (request) await f.respond(request, catalog);
      assert.equal(button(f.w, 'Prolonger la vidéo'), null, JSON.stringify(options));
      assert.equal(button(f.w, 'Modifier la vidéo'), null, JSON.stringify(options));
      assert.equal(f.w.navigations.length, 0);
    } finally { await f.close(); }
  }
});
test('gallery hides unavailable Modify and reports an unavailable original without staging another output', async () => {
  const f = await mount();
  try {
    assert.ok(f.w.requests[0], 'load destinations');
    await f.respond(f.w.requests[0], { ok: true, engines: [{ ...catalog.engines[0], modes: ['extend'] }] });
    assert.equal(button(f.w, 'Modifier la vidéo'), null);
    assert.ok(button(f.w, 'Prolonger la vidéo'));
    await f.act(async () => button(f.w, 'Prolonger la vidéo')!.click());
    await f.respond(f.w.requests[1], { ok: true, outputs: [{ id: 'other', kind: 'video', url: 'https://media.invalid/other.mp4', status: 'ready' }] });
    assert.match(f.w.document.querySelector('[role="alert"]')?.textContent ?? '', /Impossible de préparer/);
    assert.equal(f.w.sessionStorage.length, 0); assert.equal(f.w.navigations.length, 0);
    assert.equal(button(f.w, 'Prolonger la vidéo')?.disabled, false);
  } finally { await f.close(); }
});
test('compact menu and continuation buttons retain named tooltips that Escape can dismiss', async () => {
  const f = await mount();
  try {
    await f.respond(f.w.requests[0], catalog);
    const controls = Array.from(f.w.document.querySelectorAll('.app-gallery-icon-action')) as HTMLButtonElement[];
    assert.equal(controls.length, 3);
    for (const control of controls) {
      const tooltip = f.w.document.getElementById(control.getAttribute('aria-describedby'));
      assert.equal(tooltip?.getAttribute('role'), 'tooltip');
      assert.equal(tooltip?.textContent, control.getAttribute('aria-label'));
      await f.act(async () => { control.focus(); control.dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      assert.equal(control.dataset.tooltipDismissed, 'true');
    }
    const menu = controls.find(control => control.hasAttribute('aria-haspopup'))!;
    await f.act(async () => menu.click());
    assert.equal(menu.getAttribute('aria-expanded'), 'true');
    assert.ok(f.w.document.querySelector('[role="dialog"]'), 'the existing gallery popup still opens');
    assert.equal(f.w.opens, 0);
    await f.act(async () => f.w.document.dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(menu.getAttribute('aria-expanded'), 'false');
  } finally { await f.close(); }
});
