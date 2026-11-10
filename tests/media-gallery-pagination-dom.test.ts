import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';
import { installMediaGridGeometry } from './helpers/media-grid-dom';

const bundle = bundleClientFlow(`
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {CompactMediaGrid} from './components/library/CompactMediaGrid.client';
const root=createRoot(document.getElementById('root'));
window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<CompactMediaGrid userId="A" assets={window.assets}
 selectedKeys={new Set()} onSelectionChange={()=>{}} onOpen={asset=>window.opened.push(asset)}
 density={128} locale="en" displayMode={window.mode}/>),unmount:()=>root.unmount()};
`, {
  '@/lib/supabaseClientLoader': 'export const loadSupabaseClient=async()=>({auth:{getSession:()=>window.getSession()}});',
});

function asset(index: number, grant = 'initial') {
  const dimensions = [[600, 1000], [1600, 900], [1024, 1024], [1080, 1920]][index % 4];
  const kind = index % 3 === 1 ? 'video' : 'image';
  const url = `https://media.test/original-${index}.${kind === 'video' ? 'mp4' : 'png'}`;
  const thumbUrl = `https://media.test/poster-${index}.webp`;
  return {
    id: `asset-${index}`, name: `Media ${index}`, kind, source: 'upload',
    width: dimensions[0], height: dimensions[1],
    url, thumbUrl, accessUrl: `${url}?grant=${grant}`, thumbnailAccessUrl: `${thumbUrl}?grant=${grant}`,
    readAccessOwnerId: 'A', readAccessRef: {type: 'asset', assetId: `asset-${index}`, kind},
    readAccessRevision: `revision-${index}`, readAccessExpiresAt: '2099-01-01T00:00:00Z',
    organization: { key: `media-${index}`, favorite: false, trashedAt: null, collectionIds: [] },
  };
}

async function settle(w: any) {
  await w.fx.act(async () => new Promise(resolve => setTimeout(resolve, 35)));
}

async function scroll(w: any, top: number) {
  await w.fx.act(async () => {
    const surface = w.document.querySelector('.compact-media-grid');
    surface.scrollTop = top;
    surface.dispatchEvent(new w.Event('scroll'));
  });
  await settle(w);
}

function cards(w: any) {
  return new Map<string, { node: any; image: any; src: string; position: string }>(
    [...w.document.querySelectorAll('[data-media-key]')].map((node: any) => [node.dataset.mediaKey, {
      node, image: node.querySelector('img'), src: node.querySelector('img')?.getAttribute('src'),
      position: node.parentElement.style.cssText,
    }]),
  );
}

for (const mode of ['mosaic', 'grid', 'list']) {
  test(`${mode} append keeps existing card positions and never reuses a retained thumbnail for another media`, async () => {
    const dom = createClientFlowDom('/app/library'), w = dom.window as any;
    installMediaGridGeometry(w);
    w.mode = mode; w.assets = Array.from({length: 30}, (_, index) => asset(index)); w.opened = [];
    w.eval(await bundle);
    const images = new Map<any, string>();
    const remember = () => {
      const current = cards(w);
      for (const [key, card] of current) {
        assert.equal(new URL(card.src).pathname, `/poster-${key.slice(6)}.webp`, 'thumbnail source belongs to its media key');
        if (images.has(card.image)) assert.equal(images.get(card.image), key, 'an image decoder must not change media identity');
        images.set(card.image, key);
      }
      return current;
    };
    try {
      await w.fx.act(async () => w.fx.render()); await settle(w); remember();
      await scroll(w, 500); remember();
      const before = cards(w);
      await w.fx.act(async () => {w.assets = Array.from({length: 60}, (_, index) => asset(index, 'page-2')); w.fx.render();});
      await settle(w);
      const after = remember();
      for (const [key, previous] of before) {
        const current = after.get(key);
        if (!current) continue;
        assert.equal(current.position, previous.position, `${key} stays in its existing position when a page appends`);
        assert.equal(current.image, previous.image, `${key} keeps its loaded thumbnail`);
        assert.equal(current.src, previous.src, `${key} keeps its healthy lease when a listing has a new signature`);
      }
      await scroll(w, 0); remember();
      await scroll(w, 1500); remember();
      await w.fx.act(async () => {w.assets = Array.from({length: 150}, (_, index) => asset(index, 'page-5')); w.fx.render();});
      await settle(w); remember();
      for (const top of [...Array.from({length: 18}, (_, index) => 1000 + index * 500), 0, 500, 3000]) {
        await scroll(w, top); remember();
      }
      assert.ok(cards(w).size <= 96, 'recent thumbnail retention stays bounded after page appends');
      assert.equal(w.document.querySelectorAll('video,audio').length, 0, 'video cards use only their stored image poster');
    } finally {await w.fx.act(async () => w.fx.unmount()); dom.window.close();}
  });
}

test('recycling a private thumbnail retires its pending lease and cannot apply a late grant to another media', async () => {
  const dom = createClientFlowDom('/app/library'), w = dom.window as any;
  installMediaGridGeometry(w);
  w.mode = 'mosaic'; w.assets = Array.from({length:30}, (_, index) => asset(index)); w.opened = [];
  w.getSession = async () => ({data:{session:{user:{id:'A'},access_token:'fixture-token'}},error:null});
  const requests: {signal:AbortSignal; reference:any; resolve:(value:any)=>void}[] = [];
  w.fetch = (_url:string, init:RequestInit) => new Promise(resolve => {
    requests.push({signal:init.signal!,reference:JSON.parse(init.body as string).reference,resolve});
  });
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render()); await settle(w);
    const first = cards(w).get('media-0')!;
    await w.fx.act(async () => first.image.dispatchEvent(new w.Event('error')));
    await settle(w);
    assert.equal(requests.length,1);
    assert.equal(requests[0].reference.assetId,'asset-0');
    assert.equal(cards(w).get('media-0')?.image,null,'failed source is hidden while its own renewal is pending');

    await w.fx.act(async () => {w.assets=Array.from({length:150},(_,index)=>asset(index,'appended'));w.fx.render();});
    await settle(w);
    for(const top of Array.from({length:14},(_,index)=>500+index*500)) await scroll(w,top);
    assert.equal(requests[0].signal.aborted,true,'retiring the last thumbnail consumer aborts its private read');
    await w.fx.act(async () => requests[0].resolve({ok:true,json:async()=>({ok:true,access:{...asset(0,'late')}})}));
    await settle(w);
    for(const [key, card] of cards(w)) {
      assert.equal(new URL(card.src).pathname,`/poster-${key.slice(6)}.webp`,'late private state cannot cross media identity');
    }

    await scroll(w,0);
    const returned=cards(w).get('media-0')!;
    assert.ok(returned.image,'returning media gets a clean failure state');
    assert.equal(returned.src,'https://media.test/poster-0.webp?grant=appended','fresh mount ignores the retired late grant');
    await w.fx.act(async () => returned.image.dispatchEvent(new w.Event('error')));
    await settle(w);
    assert.equal(requests.length,2,'the new consumer has its own renewal attempt');
    assert.equal(requests[1].reference.assetId,'asset-0');
    await w.fx.act(async () => requests[1].resolve({ok:true,json:async()=>({ok:true,access:{...asset(0,'renewed')}})}));
    await settle(w);
    assert.equal(cards(w).get('media-0')?.src,'https://media.test/poster-0.webp?grant=renewed');
  } finally {await w.fx.act(async()=>w.fx.unmount());dom.window.close();}
});
