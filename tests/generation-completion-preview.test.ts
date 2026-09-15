import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import type { Dictionary } from '../frontend/lib/i18n/types';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('a completed preview replaces the wait screen with video and disposes its display clock', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  let CompositePreviewDockTile;
  try {
    ({ CompositePreviewDockTile } = await import('../frontend/components/groups/CompositePreviewDockTile'));
  } finally {
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const previous = new Map(['window', 'document'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  const timers = new Set<number>();
  let nextTimer = 0;
  dom.window.setInterval = (() => { const id = ++nextTimer; timers.add(id); return id; }) as typeof dom.window.setInterval;
  dom.window.clearInterval = (id) => { timers.delete(id!); };
  const noop = () => {};
  function preview(status: 'pending' | 'completed' | 'failed') {
    return React.createElement(I18nProvider, {
      locale: 'fr', dictionary: {} as Dictionary, fallback: {} as Dictionary,
      children: React.createElement(CompositePreviewDockTile, {
        activeVideoKey: 'render', index: 0, isLooping: false, isMuted: true, isPlaying: true,
        isSingleLayout: true, isVideoReady: false, itemKey: 'render', tileCount: 1, showGroupError: false,
        item: { id: 'render', url: status === 'completed' ? '/completed.mp4' : '', aspect: '16:9',
          meta: { status, mediaType: 'video', startedAt: Date.now() - 72000, etaSeconds: 277, observation: { stage: 'processing' } } },
        markReady: noop, onVideoCanPlay: noop, onVideoLoadedData: noop, registerVideo: () => noop,
      }),
    });
  }
  let renderer: ReactTestRenderer | undefined;
  try {
    act(() => { renderer = create(preview('pending')); });
    assert.equal(renderer!.root.findAllByProps({ className: 'generation-pending-status' }).length, 1);
    assert.equal(renderer!.root.findAllByType('video').length, 0);
    assert.equal(timers.size, 1);

    act(() => renderer!.update(preview('completed')));
    assert.equal(renderer!.root.findAllByProps({ className: 'generation-pending-status' }).length, 0);
    assert.equal(renderer!.root.findAllByProps({ className: 'generation-companion' }).length, 0);
    assert.equal(renderer!.root.findByType('video').props.src, '/completed.mp4');
    assert.equal(timers.size, 0, 'the elapsed-time interval must stop when the result replaces the overlay');

    act(() => renderer!.update(preview('pending')));
    assert.equal(timers.size, 1);
    act(() => renderer!.update(preview('failed')));
    assert.equal(renderer!.root.findAllByType('video').length, 0);
    assert.equal(renderer!.root.findAllByProps({ role: 'alert' }).length, 1);
    assert.equal(renderer!.root.findAllByProps({ className: 'generation-companion' }).length, 0);
    assert.equal(timers.size, 0, 'a failed render must stop looking active');
  } finally {
    act(() => renderer?.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
