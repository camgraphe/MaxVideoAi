import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bundleClientFlow,
  createClientFlowDom,
} from './helpers/client-flow-dom';
const bundle = bundleClientFlow(
  `import React,{act} from 'react';import{createRoot}from'react-dom/client';import{MediaActionPanel}from'./components/library/MediaActionPanel.client';const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;window.fx={act,render:()=>root.render(<MediaActionPanel asset={window.asset} neighbors={window.assets} onNavigateAsset={asset=>{window.asset=asset;window.fx.render();}} locale={window.locale??"en"} onClose={()=>root.render(null)}><button data-action={window.asset.id}>Destination</button></MediaActionPanel>),unmount:()=>root.unmount()};`,
  {
    '@/lib/supabaseClientLoader':
      'export const loadSupabaseClient=async()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}});',
  },
);
const original = 'https://cdn.example/original.png',
  preview = 'https://cdn.example/display.webp',
  thumb = 'https://cdn.example/thumb.webp';
test('image starts with thumbnail, decodes qualified display, preserves exact original actions and no extra dialog', async () => {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.asset = {
    id: 'image',
    kind: 'image',
    url: original,
    thumbUrl: thumb,
    previewUrl: preview,
    imageDisplay: {
      version: 1,
      profile: 'image-display-v1',
      sourceUrl: original,
      sourceSha256: 'a'.repeat(64),
      url: preview,
      mimeType: 'image/webp',
      width: 1920,
      height: 960,
      sizeBytes: 4000,
    },
  };
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    assert.ok(
      [...w.document.querySelectorAll('img')].some(
        (img: any) => img.src === thumb,
      ),
      'thumbnail available immediately',
    );
    for (
      let i = 0;
      i < 40 &&
      ![...w.document.querySelectorAll('img')].some(
        (img: any) => img.src === preview,
      );
      i++
    )
      await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
    assert.ok(
      [...w.document.querySelectorAll('img')].some(
        (img: any) => img.src === preview,
      ),
      'qualified display loads',
    );
    assert.ok(
      ![...w.document.querySelectorAll('img')].some(
        (img: any) => img.src === original,
      ),
      'original is not fetched for ordinary viewing',
    );
    assert.equal(
      w.document.querySelector('a[aria-label="Open original"]').href,
      original,
    );
    assert.equal(w.document.querySelectorAll('[role=dialog]').length, 1);
    assert.equal(
      w.document.querySelector('[data-action]').getAttribute('data-action'),
      'image',
    );
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    w.close();
  }
});
test('native video is mounted with controls before first Play, has no autoplay and swaps active source', async () => {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.asset = {
    id: 'video',
    kind: 'video',
    url: 'https://cdn.example/full.mp4',
    previewUrl: 'https://cdn.example/short.mp4',
    thumbUrl: thumb,
  };
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    for (let i = 0; i < 40 && !w.document.querySelector('video'); i++)
      await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
    const video = w.document.querySelector('video');
    assert.ok(video, 'native controls already own first Play');
    assert.equal(video.preload, 'none');
    assert.equal(video.autoplay, false);
    assert.equal(video.controls, true);
    assert.ok(
      video.src === 'https://cdn.example/full.mp4' ||
        video.querySelector('source')?.src === 'https://cdn.example/full.mp4',
    );
    assert.ok(
      ![...w.document.querySelectorAll('img')].some((img: any) =>
        img.src.endsWith('.mp4'),
      ),
    );
    w.asset = {
      id: 'audio',
      kind: 'audio',
      url: 'https://cdn.example/music.mp3',
    };
    await w.fx.act(async () => w.fx.render());
    assert.equal(w.document.querySelectorAll('video').length, 0);
    assert.equal(w.document.querySelectorAll('audio').length, 1);
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    w.close();
  }
});

test('bounded neighbors keep action/source identity together and never load a neighbor original', async () => {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.assets = Array.from({ length: 9 }, (_, i) => ({
    id: 'output-' + i,
    kind: 'image',
    url: `https://cdn.example/original-${i}.png`,
    thumbUrl: `https://cdn.example/thumb-${i}.webp`,
  }));
  w.asset = w.assets[4];
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    assert.equal(
      w.document.querySelectorAll('.app-library-neighbors img').length,
      5,
    );
    for (let i = 0; i < 40 && !w.document.querySelector('.yarl__root'); i++)
      await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
    assert.ok(
      ![...w.document.querySelectorAll('img')].some((img: any) =>
        /original-[^4]/.test(img.src),
      ),
    );
    const dialog = w.document.querySelector('[role=dialog]');
    await w.fx.act(async () =>
      w.document.querySelector('button[aria-label="Next"]').click(),
    );
    assert.equal(w.asset.id, 'output-5');
    assert.equal(
      w.document.querySelector('[data-action]').getAttribute('data-action'),
      'output-5',
    );
    assert.equal(
      w.document.querySelector('a[aria-label="Open original"]').href,
      w.asset.url,
    );
    assert.equal(w.document.querySelectorAll('[role=dialog]').length, 1);
    assert.equal(
      w.document.querySelector('[role=dialog]'),
      dialog,
      'navigation keeps one focus host',
    );
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    w.close();
  }
});

test('thumbnail stays until the active display decode completes; failed display falls back only to exact original', async () => {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  let resolveDecode!: () => void;
  const decoding = new Promise<void>((resolve) => {
    resolveDecode = resolve;
  });
  w.HTMLImageElement.prototype.decode = () => decoding;
  w.asset = {
    id: 'image',
    kind: 'image',
    url: original,
    thumbUrl: thumb,
    previewUrl: preview,
    imageDisplay: {
      version: 1,
      profile: 'image-display-v1',
      sourceUrl: original,
      sourceSha256: 'a'.repeat(64),
      url: preview,
      mimeType: 'image/webp',
      width: 1920,
      height: 960,
      sizeBytes: 4000,
    },
  };
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    for (
      let i = 0;
      i < 40 && !w.document.querySelector('.yarl__slide img');
      i++
    )
      await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
    const display = w.document.querySelector('.yarl__slide img');
    await w.fx.act(async () => display.dispatchEvent(new w.Event('load')));
    assert.ok(w.document.querySelector('.app-library-reader-placeholder'));
    await w.fx.act(async () => resolveDecode());
    assert.equal(
      w.document.querySelector('.app-library-reader-placeholder'),
      null,
    );
    await w.fx.act(async () => display.dispatchEvent(new w.Event('error')));
    assert.ok(
      [...w.document.querySelectorAll('img')].some(
        (img: any) => img.src === original,
      ),
    );
    assert.ok(w.document.querySelector('.app-library-reader-placeholder'));
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    w.close();
  }
});

test('an undecodable display falls back to its exact original instead of leaving a permanent placeholder', async () => {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.HTMLImageElement.prototype.decode = () =>
    Promise.reject(Error('decode failed'));
  w.asset = {
    id: 'image',
    kind: 'image',
    url: original,
    thumbUrl: thumb,
    previewUrl: preview,
    imageDisplay: {
      version: 1,
      profile: 'image-display-v1',
      sourceUrl: original,
      sourceSha256: 'a'.repeat(64),
      url: preview,
      mimeType: 'image/webp',
      width: 1920,
      height: 960,
      sizeBytes: 4000,
    },
  };
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    for (
      let i = 0;
      i < 40 && !w.document.querySelector('.yarl__slide img');
      i++
    )
      await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
    await w.fx.act(async () =>
      w.document
        .querySelector('.yarl__slide img')
        .dispatchEvent(new w.Event('load')),
    );
    assert.ok(
      [...w.document.querySelectorAll('img')].some(
        (img: any) => img.src === original,
      ),
    );
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    w.close();
  }
});

test('neighbors never warm a legacy original masquerading as a thumbnail, including signed same-resource URLs', async () => {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.assets = [
    { id: 'active', kind: 'image', url: original, thumbUrl: thumb },
    {
      id: 'legacy',
      kind: 'image',
      url: 'https://cdn.example/neighbor.png',
      thumbUrl: 'https://cdn.example/neighbor.png?grant=old',
    },
    {
      id: 'video',
      kind: 'video',
      url: 'https://cdn.example/neighbor.mp4',
      thumbUrl: 'https://cdn.example/neighbor.mp4',
    },
  ];
  w.asset = w.assets[0];
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    assert.equal(
      w.document.querySelectorAll('.app-library-neighbors img').length,
      1,
    );
    assert.ok(
      ![...w.document.querySelectorAll('img')].some((img: any) =>
        img.src.includes('/neighbor.'),
      ),
    );
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    w.close();
  }
});

for (const thumbnail of [original, original + '?signed=thumbnail', null]) {
  test(`qualified display does not mount original-valued placeholder ${thumbnail}`, async () => {
    const dom = createClientFlowDom('/app/library'),
      w = dom.window as any;
    w.asset = {
      id: 'image',
      kind: 'image',
      url: original,
      thumbUrl: thumbnail,
      previewUrl: preview,
      imageDisplay: {
        version: 1,
        profile: 'image-display-v1',
        sourceUrl: original,
        sourceSha256: 'a'.repeat(64),
        url: preview,
        mimeType: 'image/webp',
        width: 1920,
        height: 960,
        sizeBytes: 4000,
      },
    };
    w.eval(await bundle);
    try {
      await w.fx.act(async () => w.fx.render());
      for (
        let i = 0;
        i < 40 && !w.document.querySelector('.yarl__slide img');
        i++
      )
        await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
      assert.ok(
        w.document.querySelector('.app-library-reader-placeholder'),
        'fixed geometry remains while display decodes',
      );
      assert.ok(
        !w.document.querySelector('.app-library-reader-placeholder img'),
        'placeholder must not mount original bytes',
      );
      assert.deepEqual(
        [...w.document.querySelectorAll('img')].map((img: any) => img.src),
        [preview],
      );
      await w.fx.act(async () =>
        w.document
          .querySelector('.yarl__slide img')
          .dispatchEvent(new w.Event('error')),
      );
      assert.deepEqual(
        [...w.document.querySelectorAll('img')].map((img: any) => img.src),
        [original],
        'failed display still falls back to exact original',
      );
    } finally {
      await w.fx.act(async () => w.fx.unmount());
      w.close();
    }
  });
}

test('missing qualified display retains the exact original without an original-valued thumbnail read', async () => {
  const dom = createClientFlowDom('/app/library'),
    w = dom.window as any;
  w.asset = {
    id: 'legacy',
    kind: 'image',
    url: original,
    thumbUrl: original + '?signed=thumbnail',
    previewUrl: preview,
  };
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    for (
      let i = 0;
      i < 40 && !w.document.querySelector('.yarl__slide img');
      i++
    )
      await w.fx.act(async () => new Promise((r) => setTimeout(r, 5)));
    assert.deepEqual(
      [...w.document.querySelectorAll('img')].map((img: any) => img.src),
      [original],
    );
  } finally {
    await w.fx.act(async () => w.fx.unmount());
    w.close();
  }
});


test('French image reader translates its real carousel and position accessibility labels', async () => {
  const dom = createClientFlowDom('/app/library'), w = dom.window as any;
  w.locale = 'fr'; w.asset = {id:'image',kind:'image',url:original,thumbUrl:thumb};
  w.eval(await bundle);
  try {
    await w.fx.act(async () => w.fx.render());
    for(let i=0;i<60&&!w.document.querySelector('.yarl__carousel');i++)
      await w.fx.act(async()=>new Promise(r=>setTimeout(r,5)));
    assert.equal(w.document.querySelector('.yarl__carousel')?.getAttribute('aria-label'), 'Galerie photo');
    assert.ok(w.document.querySelector('[aria-label="1 sur 1"]'));
    assert.equal(w.document.querySelector('[aria-label="Photo gallery"]'),null);
  } finally {await w.fx.act(async()=>w.fx.unmount());w.close();}
});
