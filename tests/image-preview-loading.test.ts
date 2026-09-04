import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { ImageCompositePreviewDock } from '../frontend/components/groups/ImageCompositePreviewDock';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
const { ImageConfigContext } = frontendRequire('next/dist/shared/lib/image-config-context.shared-runtime');
const { imageConfigDefault } = frontendRequire('next/dist/shared/lib/image-config');
const imageConfig = { ...imageConfigDefault, ...frontendRequire('./next.config.js').images };
const original = 'https://media.maxvideoai.com/renders/images/portrait.png';
const thumbnail = 'https://media.maxvideoai.com/renders/thumbs/portrait.webp';

function preview(props: Partial<React.ComponentProps<typeof ImageCompositePreviewDock>> = {}) {
  return React.createElement(ImageConfigContext.Provider, { value: imageConfig },
    React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {} },
      React.createElement(ImageCompositePreviewDock, {
        density: 'workspace',
        entry: { id: 'portrait', engineLabel: 'Seedream', prompt: 'Portrait', createdAt: 1,
          images: [{ url: original, thumbUrl: thumbnail, width: 1600, height: 2848 }] },
        selectedIndex: 0, onSelectIndex() {}, ...props,
      })));
}

test('the visible image preview requests a responsive optimized image immediately', () => {
  const dom = new JSDOM(renderToStaticMarkup(preview()));
  try {
    const image = dom.window.document.querySelector<HTMLImageElement>('[data-workspace-preview-media] img')!;
    assert.ok(image.src.startsWith('/_next/image?'), 'The small preview must not download the original PNG directly');
    assert.equal(new URL(image.src, 'https://maxvideoai.com').searchParams.get('url'), original);
    assert.match(image.srcset, /w=256&.* 256w/);
    assert.match(image.sizes, /124px/);
    assert.match(image.sizes, /186px/);
    assert.equal(image.getAttribute('loading'), 'eager');
    assert.equal(image.getAttribute('fetchpriority'), 'high');
    assert.ok(image.classList.contains('object-contain'));
  } finally {
    dom.window.close();
  }
});

test('temporary provider results retain their stable preview fallback', () => {
  const dom = new JSDOM(renderToStaticMarkup(preview({ entry: {
    id: 'pending-copy', engineLabel: 'Seedream', prompt: 'Portrait', createdAt: 1,
    images: [{ url: 'https://example.volces.com/seedream-5-0/image.png?X-Tos-Signature=temporary', thumbUrl: thumbnail }],
  } })));
  try {
    const image = dom.window.document.querySelector<HTMLImageElement>('[data-workspace-preview-media] img')!;
    assert.equal(new URL(image.src, 'https://maxvideoai.com').searchParams.get('url'), thumbnail);
  } finally {
    dom.window.close();
  }
});

test('local, private, signed and external preview URLs keep direct loading', () => {
  for (const url of [
    'blob:https://maxvideoai.com/local-preview',
    'data:image/png;base64,aW1hZ2U=',
    '/api/assets/private-image',
    `${original}?X-Amz-Signature=private`,
    'https://provider.example/result.png',
  ]) {
    const dom = new JSDOM(renderToStaticMarkup(preview({ entry: {
      id: 'local', engineLabel: 'Seedream', prompt: 'Portrait', createdAt: 1, images: [{ url }],
    } })));
    try {
      const image = dom.window.document.querySelector<HTMLImageElement>('[data-workspace-preview-media] img')!;
      assert.equal(image.getAttribute('src'), url);
      assert.equal(image.getAttribute('srcset'), null);
    } finally {
      dom.window.close();
    }
  }
});

test('an optimizer error falls back once and preview actions retain the original URL', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  const actions: string[] = [];
  const props = { onDownload: (url: string) => actions.push(url), onCopyLink: (url: string) => actions.push(url),
    onEditImage: (url: string) => actions.push(url), onAddToLibrary: (url: string) => actions.push(url) };
  try {
    await act(async () => root.render(preview(props)));
    const image = () => container.querySelector<HTMLImageElement>('[data-workspace-preview-media] img')!;
    assert.match(image().src, /\/_next\/image\?/);
    for (const label of ['Download', 'Copy link', 'Edit this image', 'Add to Library']) {
      await act(async () => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());
    }
    assert.deepEqual(actions, [original, original, original, original]);
    await act(async () => image().dispatchEvent(new dom.window.Event('error')));
    assert.equal(image().src, original);
    assert.equal(image().getAttribute('srcset'), null);
    await act(async () => image().dispatchEvent(new dom.window.Event('error')));
    assert.equal(image().src, original, 'A failed original must not restart the optimizer');
    await act(async () => root.render(preview({ ...props, entry: {
      id: 'next', engineLabel: 'Seedream', prompt: 'Next portrait', createdAt: 2,
      images: [{ url: 'https://media.maxvideoai.com/renders/images/next.png' }],
    } })));
    assert.match(image().src, /\/_next\/image\?/, 'Another image must still use optimization');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
