import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { WatchVideoPlayer } from '../frontend/components/watch/WatchVideoPlayer';

async function withPlayer(
  configure: (window: JSDOM['window']) => void,
  check: (container: HTMLElement, errors: unknown[]) => Promise<void>,
) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const globals = {
    window: dom.window,
    document: dom.window.document,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const errors: unknown[] = [];
  dom.window.addEventListener('error', (event) => {
    errors.push(event.error);
    event.preventDefault();
  });
  configure(dom.window);
  const container = dom.window.document.querySelector<HTMLElement>('#root')!;
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(React.createElement(WatchVideoPlayer, {
        src: '/example.mp4', poster: '/poster.jpg', title: 'Example', engineLabel: 'Model', hasAudio: true,
      }));
    });
    await check(container, errors);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

async function clickFullscreen(container: HTMLElement) {
  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Fullscreen video"]');
  assert.ok(button, 'A supported browser should offer fullscreen');
  await act(async () => button.click());
}

test('iPhone Safari enters native video fullscreen when element fullscreen is unavailable', async () => {
  let nativePlayer: HTMLVideoElement | undefined;
  await withPlayer((window) => {
    Object.defineProperty(window.HTMLVideoElement.prototype, 'webkitEnterFullscreen', {
      configurable: true,
      value(this: HTMLVideoElement) { nativePlayer = this; },
    });
  }, async (container, errors) => {
    await clickFullscreen(container);
    assert.ok(nativePlayer === container.querySelector('video'), 'Safari should open the current video');
    assert.deepEqual(errors, []);
  });
});

test('standard fullscreen opens the shell and exits through its document', async () => {
  let fullscreenTarget: HTMLElement | null = null;
  let exits = 0;
  await withPlayer((window) => {
    window.HTMLElement.prototype.requestFullscreen = async function () { fullscreenTarget = this; };
    Object.defineProperty(window.document, 'fullscreenElement', { get: () => fullscreenTarget });
    window.document.exitFullscreen = async function () {
      assert.equal(this, window.document);
      fullscreenTarget = null;
      exits += 1;
    };
  }, async (container, errors) => {
    await clickFullscreen(container);
    assert.ok(fullscreenTarget === container.firstElementChild, 'Standard fullscreen should open the player shell');
    await clickFullscreen(container);
    assert.equal(exits, 1);
    assert.equal(fullscreenTarget, null);
    assert.deepEqual(errors, []);
  });
});

test('unsupported browsers do not offer a broken fullscreen button', async () => {
  await withPlayer(() => {}, async (container) => {
    assert.ok(!container.querySelector('button[aria-label="Fullscreen video"]'), 'Fullscreen should be hidden when unsupported');
    assert.ok(container.querySelector('button[aria-label="Play video"]'));
  });
});

test('a denied fullscreen request does not become an unhandled rejection', async () => {
  await withPlayer((window) => {
    window.HTMLElement.prototype.requestFullscreen = () => Promise.reject(new TypeError('Fullscreen denied'));
  }, async (container, errors) => {
    await clickFullscreen(container);
    assert.deepEqual(errors, []);
  });
});

test('a rejected fullscreen exit is handled without breaking player controls', async () => {
  await withPlayer((window) => {
    window.HTMLElement.prototype.requestFullscreen = async () => {};
    Object.defineProperty(window.document, 'fullscreenElement', { value: window.document.body });
    window.document.exitFullscreen = () => Promise.reject(new TypeError('Exit denied'));
  }, async (container, errors) => {
    await clickFullscreen(container);
    assert.deepEqual(errors, []);
  });
});

test('Safari refusing native fullscreen before media readiness does not throw from the click', async () => {
  await withPlayer((window) => {
    Object.defineProperty(window.HTMLVideoElement.prototype, 'webkitEnterFullscreen', {
      value() { throw new Error('InvalidStateError'); },
    });
  }, async (container, errors) => {
    await clickFullscreen(container);
    assert.deepEqual(errors, []);
  });
});
