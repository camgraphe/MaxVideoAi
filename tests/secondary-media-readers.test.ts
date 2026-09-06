import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { ImageConfigContext } from '../frontend/node_modules/next/dist/shared/lib/image-config-context.shared-runtime';
import { imageConfigDefault } from '../frontend/node_modules/next/dist/shared/lib/image-config';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { SWRConfig } from 'swr';
import { PayAsYouGoPreview } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_components/PayAsYouGoPreview.client';
import { IntegrationConversationPreview } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationConversationPreview';
import { AngleImageLibraryModal } from '../frontend/src/components/tools/angle/_components/angle-image-library-modal';
import { CharacterReferenceLibraryModal } from '../frontend/src/components/tools/character-builder/_components/character-builder-reference-library';
import { DEFAULT_ANGLE_COPY } from '../frontend/src/components/tools/angle/_lib/angle-workspace-copy';
import { DEFAULT_CHARACTER_COPY } from '../frontend/src/components/tools/character-builder/_lib/character-builder-copy';
import { isLibraryImageAsset } from '../frontend/lib/library-image';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const nextConfig = createRequire(import.meta.url)('../frontend/next.config.js');
function configuredImage(node: React.ReactNode) {
  return React.createElement(ImageConfigContext.Provider, { value: { ...imageConfigDefault, ...nextConfig.images } }, node);
}
const poster = 'https://media.maxvideoai.com/renders/poster.jpg';
const preview = 'https://media.maxvideoai.com/renderspreviews/short.mp4';

function browserFixture({ desktop = true, reducedMotion = false, saveData = false } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  let notify: IntersectionObserverCallback;
  let playCalls = 0;
  let disconnected = false;
  class Observer {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  dom.window.matchMedia = ((query: string) => ({ matches: query.includes('min-width') ? desktop : query.includes('reduced-motion') ? reducedMotion : false, addEventListener() {}, removeEventListener() {} })) as typeof window.matchMedia;
  Object.defineProperty(dom.window.navigator, 'connection', { value: { saveData } });
  dom.window.HTMLMediaElement.prototype.play = () => { playCalls++; return Promise.resolve(); };
  dom.window.HTMLMediaElement.prototype.pause = () => {};
  const replacements = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IntersectionObserver: Observer, IS_REACT_ACT_ENVIRONMENT: true };
  const old = new Map(Object.keys(replacements).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(replacements)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const container = dom.window.document.getElementById('root')!;
  const root = createRoot(container);
  return {
    dom, container, root, plays: () => playCalls, disconnected: () => disconnected,
    visible: (ratio: number) => act(async () => notify([{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver)),
    async cleanup() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, value] of old) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

test('PAYG SSR reserves its poster without scheduling a video or prioritizing below-fold media', () => {
  for (const source of [poster, `${poster}?signature=private`, 'https://private.example/image.jpg']) {
    const html = renderToStaticMarkup(configuredImage(React.createElement(PayAsYouGoPreview, { src: preview, poster: source, label: 'Result', placeholder: 'Preview' })));
    const dom = new JSDOM(html);
    const image = dom.window.document.querySelector('img')!;
    assert.equal(dom.window.document.querySelector('video'), null);
    assert.equal(image.getAttribute('loading'), 'lazy');
    assert.equal(image.getAttribute('sizes'), source === poster ? '(max-width: 639px) 210px, 230px' : null);
    assert.equal(dom.window.document.querySelector('link[rel="preload"]'), null);
    if (source !== poster) assert.equal(image.getAttribute('src'), source, 'Signed or unknown URLs retain exact direct loading');
    dom.window.close();
  }
});

for (const scenario of [
  { name: 'desktop', desktop: true, allowed: true },
  { name: 'mobile', desktop: false, allowed: false },
  { name: 'reduced motion', desktop: true, reducedMotion: true, allowed: false },
  { name: 'data saver', desktop: true, saveData: true, allowed: false },
]) {
  test(`PAYG ${scenario.name}: playback needs visibility and respects visitor preferences`, async () => {
    const f = browserFixture(scenario);
    try {
      await act(async () => f.root.render(configuredImage(React.createElement(PayAsYouGoPreview, { src: preview, poster, label: 'Result', placeholder: 'Preview' }))));
      assert.equal(f.container.querySelector('video'), null);
      await f.visible(0.1);
      assert.equal(f.container.querySelector('video'), null, 'Mostly clipped cards do not play');
      await f.visible(1);
      const video = f.container.querySelector('video');
      assert.equal(Boolean(video), scenario.allowed);
      if (video) {
        assert.equal(video.getAttribute('src'), preview);
        assert.equal(video.getAttribute('preload'), 'none');
        assert.equal(video.hasAttribute('poster'), false);
        assert.ok(video.className.includes('opacity-0'), 'Keep the image cover while buffering');
        await act(async () => video.dispatchEvent(new f.dom.window.Event('playing')));
        assert.ok(video.className.includes('opacity-100'));
        assert.ok(f.plays() > 0);
        await f.visible(0);
        assert.equal(f.container.querySelector('video'), null, 'Leaving view releases the reader');
        await f.visible(1);
        assert.ok(f.container.querySelector('video'), 'Returning into view works');
        await act(async () => f.container.querySelector('video')!.dispatchEvent(new f.dom.window.Event('error')));
        assert.equal(f.container.querySelector('video'), null, 'Failed short preview returns to poster without a full-video download');
      }
    } finally { await f.cleanup(); }
    assert.equal(f.disconnected(), true);
  });
}

test('all integration clients/locales defer the exact original video until native Play', () => {
  for (const client of ['claude', 'chatgpt', 'codex'] as const) for (const locale of ['en', 'fr', 'es'] as const) {
    const dom = new JSDOM(renderToStaticMarkup(React.createElement(IntegrationConversationPreview, { client, locale })));
    const video = dom.window.document.querySelector('video')!;
    assert.equal(video.preload, 'none');
    assert.ok(video.controls && video.playsInline);
    assert.match(video.poster, /^\/_next\/image\?/);
    assert.match(video.querySelector('source')!.src, /4e4954fc-513a-4345-945c-41adba7ec26a\.mp4$/);
    assert.ok(video.className.includes('aspect-video'));
    dom.window.close();
  }
});

test('image selection respects explicit kinds and supports older image records', () => {
  assert.equal(isLibraryImageAsset({ url: '/signed', kind: 'image' }), true);
  assert.equal(isLibraryImageAsset({ url: '/cover.jpg', kind: 'video' }), false);
  assert.equal(isLibraryImageAsset({ url: '/render.mp4', mime: 'video/mp4' }), false);
  assert.equal(isLibraryImageAsset({ url: '/signed', mime: 'image/webp' }), true);
  assert.equal(isLibraryImageAsset({ url: '/original.PNG?sig=exact' }), true);
  assert.equal(isLibraryImageAsset({ url: '/unknown' }), false);
});

for (const tool of ['angle', 'character'] as const) {
  test(`${tool} library loads stored thumbnails, filters videos and selects the unchanged original`, async () => {
    const f = browserFixture();
    const previousFetch = globalThis.fetch;
    const requests: string[] = [];
    const asset = { id: 'image', kind: 'image' as const, url: 'https://private.example/original.png?sig=original', thumbUrl: 'https://private.example/thumb.webp?sig=thumb' };
    let selected: unknown;
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return Response.json({ ok: true, assets: [asset, { id: 'video', kind: 'video', url: '/large.mp4', thumbUrl: '/video.jpg' }] });
    };
    try {
      const props = { open: true, onClose() {}, onSelect: (value: unknown) => { selected = value; } };
      const modal = tool === 'angle'
        ? React.createElement(AngleImageLibraryModal, { ...props, copy: DEFAULT_ANGLE_COPY })
        : React.createElement(CharacterReferenceLibraryModal, { ...props, copy: DEFAULT_CHARACTER_COPY });
      await act(async () => f.root.render(React.createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, modal)));
      assert.equal(requests[0], '/api/user-assets?kind=image&limit=60');
      assert.equal(f.container.querySelectorAll('img').length, 1);
      const image = f.container.querySelector('img')!;
      assert.equal(image.src, asset.thumbUrl);
      assert.equal(image.getAttribute('loading'), 'lazy');
      assert.equal(image.getAttribute('referrerPolicy'), 'no-referrer');
      await act(async () => image.closest('button')!.click());
      assert.deepEqual(selected, asset);
      await act(async () => image.dispatchEvent(new f.dom.window.Event('error')));
      assert.equal(image.src, asset.url, 'A broken stored thumbnail retains exact-original fallback');
      await act(async () => image.dispatchEvent(new f.dom.window.Event('error')));
      assert.equal(image.src, asset.url, 'Original failure does not start a fallback loop');
    } finally { globalThis.fetch = previousFetch; await f.cleanup(); }
  });
}

test('image-kind filtering reaches the existing bounded user-owned query before its limit', () => {
  const route = readFileSync('frontend/app/api/user-assets/route.ts', 'utf8');
  assert.match(route, /getRouteAuthContext\(req\)/);
  assert.match(route, /kind: requestedKind === 'image'.*requestedKind : null/);
  const listing = readFileSync('frontend/server/media-library/asset-listing.ts', 'utf8');
  assert.match(listing, /WHERE user_id = \$1[\s\S]*kind = \$3::text[\s\S]*LIMIT \$2/);
});
