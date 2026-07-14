import assert from 'node:assert/strict';
import test from 'node:test';

import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';

import { ANALYTICS_CONSENT_STORAGE_KEY } from '../frontend/lib/analytics/consent-client';

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

type FetchCall = {
  input: string | URL | Request;
  init?: RequestInit;
};

type RuntimeHarness = {
  container: HTMLDivElement;
  dom: JSDOM;
  fetchCalls: FetchCall[];
  fetchDeferred: Deferred<Response>;
  gtagCalls: unknown[][];
  navigateCalls: string[];
  root: Root;
  routerPushes: unknown[][];
  timers: Map<number, { handler: TimerHandler; timeout: number }>;
  cleanup(): Promise<void>;
  flush(): Promise<void>;
  runTimers(): Promise<void>;
};

const actions = [
  { client: 'claude' as const, href: '#claude', label: 'Start with Claude', supportingLabel: 'Open setup guide' },
  { client: 'codex' as const, href: '#codex', label: 'Start with Codex', supportingLabel: 'Open setup guide' },
];

const copy = {
  endpointLabel: 'Connection endpoint',
  copyEndpoint: 'Copy endpoint',
  copied: 'Endpoint copied. Continue with the setup guide for this client.',
  copyError: 'Unable to copy. Select the endpoint above and copy it manually.',
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function createHarness({ consent = true }: { consent?: boolean } = {}): Promise<RuntimeHarness> {
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="root"></div></body></html>', {
    url: 'https://maxvideoai.com/mcp',
  });
  const globalRecord = globalThis as typeof globalThis & Record<string, unknown>;
  const installedGlobals = [
    'window',
    'self',
    'document',
    'navigator',
    'Element',
    'HTMLElement',
    'HTMLAnchorElement',
    'MouseEvent',
    'KeyboardEvent',
    'Event',
    'CustomEvent',
    'Node',
    'getComputedStyle',
    'React',
    'IS_REACT_ACT_ENVIRONMENT',
  ] as const;
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const key of installedGlobals) previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  const install = (key: string, value: unknown) => {
    Object.defineProperty(globalRecord, key, { configurable: true, writable: true, value });
  };
  install('window', dom.window);
  install('self', dom.window);
  install('document', dom.window.document);
  install('navigator', dom.window.navigator);
  install('Element', dom.window.Element);
  install('HTMLElement', dom.window.HTMLElement);
  install('HTMLAnchorElement', dom.window.HTMLAnchorElement);
  install('MouseEvent', dom.window.MouseEvent);
  install('KeyboardEvent', dom.window.KeyboardEvent);
  install('Event', dom.window.Event);
  install('CustomEvent', dom.window.CustomEvent);
  install('Node', dom.window.Node);
  install('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
  install('React', React);
  install('IS_REACT_ACT_ENVIRONMENT', true);

  if (consent) dom.window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'granted');
  const gtagCalls: unknown[][] = [];
  (dom.window as typeof dom.window & { gtag: (...args: unknown[]) => void }).gtag = (...args) => {
    gtagCalls.push(args);
  };

  const originalFetch = globalThis.fetch;
  const fetchCalls: FetchCall[] = [];
  const fetchDeferred = deferred<Response>();
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ input, init });
    return fetchDeferred.promise;
  }) as typeof fetch;

  const routerPushes: unknown[][] = [];
  const router = {
    route: '/mcp',
    pathname: '/mcp',
    query: {},
    asPath: '/mcp',
    basePath: '',
    locale: 'en',
    locales: ['en', 'fr', 'es'],
    defaultLocale: 'en',
    isReady: true,
    isFallback: false,
    isPreview: false,
    isLocaleDomain: false,
    push: (...args: unknown[]) => {
      routerPushes.push(args);
      return Promise.resolve(true);
    },
    replace: () => Promise.resolve(true),
    reload: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    prefetch: () => Promise.resolve(),
    beforePopState: () => undefined,
    events: { on: () => undefined, off: () => undefined, emit: () => undefined },
  };

  const navigateCalls: string[] = [];
  const { McpConnectActions } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpConnectActions.client.tsx'
  );
  const container = dom.window.document.querySelector<HTMLDivElement>('#root');
  assert.ok(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(
        RouterContext.Provider,
        { value: router as never },
        React.createElement(McpConnectActions as React.ComponentType<Record<string, unknown>>, {
          actions,
          copy,
          locale: 'en',
          resourceUrl: 'https://api.maxvideoai.com/mcp',
          navigate: (href: string) => navigateCalls.push(href),
        }),
      ),
    );
  });

  let timerId = 0;
  const timers = new Map<number, { handler: TimerHandler; timeout: number }>();
  const originalSetTimeout = dom.window.setTimeout;
  const originalClearTimeout = dom.window.clearTimeout;
  dom.window.setTimeout = ((handler: TimerHandler, timeout = 0) => {
    timerId += 1;
    timers.set(timerId, { handler, timeout });
    return timerId;
  }) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = ((id: number) => {
    timers.delete(id);
  }) as typeof dom.window.clearTimeout;

  let unmounted = false;
  return {
    container,
    dom,
    fetchCalls,
    fetchDeferred,
    gtagCalls,
    navigateCalls,
    root,
    routerPushes,
    timers,
    async flush() {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    },
    async runTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      await act(async () => {
        for (const { handler } of callbacks) {
          if (typeof handler === 'function') handler();
        }
        await Promise.resolve();
      });
    },
    async cleanup() {
      if (!unmounted) {
        await act(async () => root.unmount());
        unmounted = true;
      }
      dom.window.setTimeout = originalSetTimeout;
      dom.window.clearTimeout = originalClearTimeout;
      globalThis.fetch = originalFetch;
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalRecord, key, descriptor);
        else delete globalRecord[key];
      }
    },
  };
}

function analyticsEvents(harness: RuntimeHarness, eventName: string): unknown[][] {
  return harness.gtagCalls.filter((call) => call[0] === 'event' && call[1] === eventName);
}

async function dispatchClick(
  harness: RuntimeHarness,
  element: Element,
  init: MouseEventInit = {},
): Promise<MouseEvent> {
  const event = new harness.dom.window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  await act(async () => {
    element.dispatchEvent(event);
    await Promise.resolve();
  });
  return event;
}

test('plain primary Link activation prevents Next routing and navigates exactly once after acquisition succeeds', async () => {
  const harness = await createHarness();
  try {
    const link = harness.container.querySelector<HTMLAnchorElement>('a[data-client="claude"]');
    assert.ok(link);
    const event = await dispatchClick(harness, link);

    assert.equal(event.defaultPrevented, true);
    assert.equal(harness.routerPushes.length, 0);
    assert.equal(harness.fetchCalls.length, 1);
    assert.equal(harness.fetchCalls[0]?.init?.keepalive, true);
    assert.equal(analyticsEvents(harness, 'mcp_landing_cta_clicked').length, 1);
    assert.deepEqual(harness.navigateCalls, []);

    harness.fetchDeferred.resolve(new Response(null, { status: 204 }));
    await harness.flush();
    assert.deepEqual(harness.navigateCalls, [link.href]);
    await harness.runTimers();
    assert.deepEqual(harness.navigateCalls, [link.href]);
  } finally {
    await harness.cleanup();
  }
});

test('acquisition fetch failure still performs one guarded navigation', async () => {
  const harness = await createHarness();
  try {
    const link = harness.container.querySelector<HTMLAnchorElement>('a[data-client="claude"]');
    assert.ok(link);
    await dispatchClick(harness, link);
    harness.fetchDeferred.reject(new Error('network unavailable'));
    await harness.flush();
    assert.equal(harness.routerPushes.length, 0);
    assert.deepEqual(harness.navigateCalls, [link.href]);
    await harness.runTimers();
    assert.deepEqual(harness.navigateCalls, [link.href]);
  } finally {
    await harness.cleanup();
  }
});

test('timer-first ordering navigates once and a later fetch settlement cannot navigate again', async () => {
  const harness = await createHarness();
  try {
    const link = harness.container.querySelector<HTMLAnchorElement>('a[data-client="claude"]');
    assert.ok(link);
    await dispatchClick(harness, link);
    await harness.runTimers();
    assert.deepEqual(harness.navigateCalls, [link.href]);
    harness.fetchDeferred.resolve(new Response(null, { status: 204 }));
    await harness.flush();
    assert.deepEqual(harness.navigateCalls, [link.href]);
  } finally {
    await harness.cleanup();
  }
});

test('keyboard-synthesized Link activation follows the same single-navigation path', async () => {
  const harness = await createHarness();
  try {
    const link = harness.container.querySelector<HTMLAnchorElement>('a[data-client="claude"]');
    assert.ok(link);
    link.focus();
    link.dispatchEvent(new harness.dom.window.KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    const event = await dispatchClick(harness, link, { detail: 0 });
    assert.equal(event.defaultPrevented, true);
    assert.equal(harness.routerPushes.length, 0);
    harness.fetchDeferred.resolve(new Response(null, { status: 204 }));
    await harness.flush();
    assert.deepEqual(harness.navigateCalls, [link.href]);
  } finally {
    await harness.cleanup();
  }
});

test('modified primary clicks record attribution without delaying or duplicating native navigation', async () => {
  const harness = await createHarness();
  try {
    const link = harness.container.querySelector<HTMLAnchorElement>('a[data-client="claude"]');
    assert.ok(link);
    const event = await dispatchClick(harness, link, { ctrlKey: true });
    assert.equal(event.defaultPrevented, false);
    assert.equal(harness.routerPushes.length, 0);
    assert.equal(harness.fetchCalls.length, 1);
    assert.equal(analyticsEvents(harness, 'mcp_landing_cta_clicked').length, 1);
    assert.equal(
      [...harness.timers.values()].some(({ timeout }) => timeout === 750),
      false,
    );
    harness.fetchDeferred.resolve(new Response(null, { status: 204 }));
    await harness.flush();
    assert.deepEqual(harness.navigateCalls, []);
  } finally {
    await harness.cleanup();
  }
});

test('double plain clicks are guarded before analytics, fetch, router, and delayed navigation duplicate', async () => {
  const harness = await createHarness();
  try {
    const link = harness.container.querySelector<HTMLAnchorElement>('a[data-client="claude"]');
    assert.ok(link);
    const first = await dispatchClick(harness, link);
    const second = await dispatchClick(harness, link);
    assert.equal(first.defaultPrevented, true);
    assert.equal(second.defaultPrevented, true);
    assert.equal(harness.routerPushes.length, 0);
    assert.equal(harness.fetchCalls.length, 1);
    assert.equal(analyticsEvents(harness, 'mcp_landing_cta_clicked').length, 1);
    assert.equal(harness.timers.size, 1);
    harness.fetchDeferred.resolve(new Response(null, { status: 204 }));
    await harness.flush();
    assert.deepEqual(harness.navigateCalls, [link.href]);
  } finally {
    await harness.cleanup();
  }
});

test('unmount cancels pending delayed navigation and ignores a later fetch settlement', async () => {
  const harness = await createHarness();
  try {
    const link = harness.container.querySelector<HTMLAnchorElement>('a[data-client="claude"]');
    assert.ok(link);
    await dispatchClick(harness, link);
    await act(async () => harness.root.unmount());
    assert.equal(harness.timers.size, 0);
    await harness.runTimers();
    harness.fetchDeferred.resolve(new Response(null, { status: 204 }));
    await harness.flush();
    assert.deepEqual(harness.navigateCalls, []);
  } finally {
    await harness.cleanup();
  }
});

test('analytics consent off suppresses GA while acquisition and one navigation still proceed', async () => {
  const harness = await createHarness({ consent: false });
  try {
    const link = harness.container.querySelector<HTMLAnchorElement>('a[data-client="claude"]');
    assert.ok(link);
    await dispatchClick(harness, link);
    assert.equal(harness.gtagCalls.length, 0);
    assert.equal(harness.fetchCalls.length, 1);
    harness.fetchDeferred.resolve(new Response(null, { status: 204 }));
    await harness.flush();
    assert.deepEqual(harness.navigateCalls, [link.href]);
  } finally {
    await harness.cleanup();
  }
});

test('endpoint copy emits only the distinct copy event and exposes accessible success feedback', async () => {
  const harness = await createHarness();
  try {
    Object.defineProperty(harness.dom.window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => undefined },
    });
    const button = harness.container.querySelector<HTMLButtonElement>('button[data-copy-endpoint="claude"]');
    const status = harness.container.querySelector<HTMLElement>('[role="status"][aria-live="polite"]');
    assert.ok(button && status);
    await dispatchClick(harness, button);
    await harness.flush();
    assert.equal(status.textContent, copy.copied);
    assert.equal(analyticsEvents(harness, 'mcp_endpoint_copy_clicked').length, 1);
    assert.equal(analyticsEvents(harness, 'mcp_landing_cta_clicked').length, 0);
    assert.equal(harness.gtagCalls.some((call) => /success|completed/i.test(String(call[1]))), false);
    assert.match(String(harness.fetchCalls[0]?.init?.body), /"action":"copy_endpoint"/);
  } finally {
    harness.fetchDeferred.resolve(new Response(null, { status: 204 }));
    await harness.cleanup();
  }
});

test('clipboard rejection exposes accessible error feedback without inventing a success event', async () => {
  const harness = await createHarness();
  try {
    Object.defineProperty(harness.dom.window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error('clipboard denied')) },
    });
    const button = harness.container.querySelector<HTMLButtonElement>('button[data-copy-endpoint="claude"]');
    const status = harness.container.querySelector<HTMLElement>('[role="status"][aria-live="polite"]');
    assert.ok(button && status);
    await dispatchClick(harness, button);
    await harness.flush();
    assert.equal(status.textContent, copy.copyError);
    assert.equal(analyticsEvents(harness, 'mcp_endpoint_copy_clicked').length, 1);
    assert.equal(harness.gtagCalls.some((call) => /success|completed/i.test(String(call[1]))), false);
  } finally {
    harness.fetchDeferred.resolve(new Response(null, { status: 204 }));
    await harness.cleanup();
  }
});
