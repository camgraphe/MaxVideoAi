import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { buildPublicWatchRuntimeFixture } from './helpers/public-watch-runtime-fixture';
import type { AppLocale } from '../frontend/i18n/locales';
import type { Dictionary } from '../frontend/lib/i18n/types';

type RuntimeFixture = {
  act: (callback: () => unknown) => Promise<void>; seedCache: () => Promise<void>; unmount: () => Promise<void>;
  render: (group: 'core' | 'watch' | null, path: string, locale: AppLocale, browserLocale?: AppLocale) => Promise<void>;
};
type RuntimeHost = {
  cookies: Record<string, string>; messages: Record<AppLocale, Dictionary>; revalidations: number;
  router: { refresh: () => void };
};

test('Core and watch remounts release real runtime effects and retain SWR, locale, fallback and theme behavior', async () => {
  const script = await buildPublicWatchRuntimeFixture();
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com/video/approved', runScripts: 'outside-only' });
  const win = dom.window as JSDOM['window'] & { runtimeFixture: RuntimeFixture; runtimeHost: RuntimeHost; IS_REACT_ACT_ENVIRONMENT: boolean };
  // JSDOM lacks the browser task channel used by React's async act helper.
  Object.defineProperty(win, 'MessageChannel', { value: class {
    port1 = { onmessage: () => {} };
    port2 = { postMessage: () => setImmediate(() => this.port1.onmessage()) };
  } });
  const listeners = new Map<string, Set<unknown>>();
  const track = (target: EventTarget, prefix: string, types: string[]) => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = (type, listener, options) => {
      if (types.includes(type)) {
        const key = `${prefix}:${type}`;
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key)!.add(listener);
      }
      return add(type, listener, options);
    };
    target.removeEventListener = (type, listener, options) => {
      listeners.get(`${prefix}:${type}`)?.delete(listener);
      return remove(type, listener, options);
    };
  };
  track(win, 'window', ['focus', 'pageshow', 'storage', 'consent:updated', 'mvai:analytics', 'jobs:status', 'mv-app-theme-change', 'consent:open-preferences']);
  track(win.document, 'document', ['visibilitychange']);
  const count = (key: string) => listeners.get(key)?.size ?? 0;
  const intervals = new Set<number>();
  const setInterval = win.setInterval.bind(win);
  const clearInterval = win.clearInterval.bind(win);
  win.setInterval = (callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    const id = setInterval(callback, delay, ...args); intervals.add(id); return id;
  };
  win.clearInterval = (id: number) => { intervals.delete(id); clearInterval(id); };
  const mediaListeners = new Set<unknown>();
  Object.defineProperty(win, 'matchMedia', { value: () => ({ matches: true, addEventListener: (_: unknown, listener: unknown) => mediaListeners.add(listener),
    removeEventListener: (_: unknown, listener: unknown) => mediaListeners.delete(listener) }) });
  win.IS_REACT_ACT_ENVIRONMENT = true;
  win.fetch = async (url: RequestInfo | URL) => {
    assert.equal(url, '/api/legal/cookies/version', 'only the existing public policy read is allowed');
    return new Response(JSON.stringify({ ok: true, version: '2025-10-26' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  let visible = 'visible';
  Object.defineProperty(win.document, 'visibilityState', { get: () => visible });
  let now = 10000;
  win.Date.now = () => now;
  let refreshes = 0;
  let walletInvalidations = 0;
  win.addEventListener('wallet:invalidate', () => { walletInvalidations++; });
  const messages = Object.fromEntries(['en', 'fr', 'es'].map(locale => [locale,
    JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8')) as Dictionary,
  ])) as Record<AppLocale, Dictionary>;
  Reflect.deleteProperty(messages.fr.nav.account, 'signOut'); // Missing localized copy must use real EN fallback.
  win.runtimeHost = { cookies: {}, messages, revalidations: 0, router: { refresh: () => { refreshes++; } } };
  win.localStorage.setItem('mv-app-theme', 'dark');
  win.eval(script);
  const fixture = win.runtimeFixture;
  const baseline = new Map([...listeners].map(([key, value]) => [key, value.size]));
  const extra = (key: string) => count(key) - (baseline.get(key) ?? 0);
  const output = () => win.document.querySelector('output')!;
  try {
    await fixture.seedCache();
    for (const [group, path, locale, cta, signOut] of [
      ['watch', '/video/approved', 'fr', 'Générer', 'Sign out'],
      ['core', '/app', 'fr', 'Générer', 'Sign out'],
      ['watch', '/video/approved', 'es', 'Generar', 'Cerrar sesión'],
      ['core', '/app', 'en', 'Generate', 'Sign out'],
      ['watch', '/video/approved', 'en', 'Generate', 'Sign out'],
    ] as const) {
      await fixture.render(group, path, locale);
      assert.match(output().textContent, new RegExp(`^${locale}\\|${cta}\\|${signOut}\\|`));
      assert.equal(win.document.documentElement.lang, locale);
      assert.equal(output().dataset.namespaces, group === 'watch' ? 'footer,nav' : Object.keys(messages[locale]).sort().join(','));
      assert.equal(win.document.querySelectorAll('script[type="application/ld+json"]').length, 2);
      for (const event of ['focus', 'pageshow']) assert.equal(extra(`window:${event}`), 2, 'one copy of each real focus owner');
      assert.equal(extra('document:visibilitychange'), 2);
      assert.equal(extra('window:mvai:analytics'), 1, 'one analytics bridge');
      assert.equal(extra('window:jobs:status'), 1);
      assert.equal(intervals.size, 1, 'one real analytics queue interval');
      assert.equal(mediaListeners.size, group === 'core' ? 1 : 0);
      assert.equal(win.document.documentElement.dataset.theme, group === 'core' ? 'dark' : undefined);
      assert.equal(win.localStorage.getItem('mv-app-theme'), 'dark');
      assert.equal(refreshes, 0, 'matching cookies need no refresh');
    }
    const beforeWallet = walletInvalidations;
    const beforeRevalidate = win.runtimeHost.revalidations;
    now += 6000;
    await fixture.act(async () => win.dispatchEvent(new win.Event('focus')));
    assert.equal(walletInvalidations, beforeWallet + 1);
    assert.ok(win.runtimeHost.revalidations > beforeRevalidate, 'focus revalidates the real shared SWR cache');
    await fixture.act(async () => win.dispatchEvent(new win.Event('pageshow')));
    assert.equal(walletInvalidations, beforeWallet + 1, 'existing debounce survives a repeated focus signal');
    visible = 'hidden'; now += 6000;
    await fixture.act(async () => win.dispatchEvent(new win.Event('focus')));
    assert.equal(walletInvalidations, beforeWallet + 1, 'hidden pages do not refresh');
    visible = 'visible';
    await fixture.act(async () => win.document.dispatchEvent(new win.Event('visibilitychange')));
    assert.equal(walletInvalidations, beforeWallet + 2);

    await fixture.render(null, '/examples', 'en');
    for (const key of ['window:focus', 'window:pageshow', 'document:visibilitychange', 'window:mvai:analytics', 'window:jobs:status', 'window:consent:updated', 'window:mv-app-theme-change']) {
      assert.equal(extra(key), 0, `${key} is released when the lower group unmounts`);
    }
    assert.equal(intervals.size, 0);
    assert.equal(mediaListeners.size, 0);
    const cacheBefore = win.runtimeHost.revalidations;
    await fixture.render('core', '/app', 'en');
    assert.equal(output().textContent, `en|Generate|Sign out|${cacheBefore}`, 'cache identity survives lower-group remounts');
    await fixture.render('watch', '/video/approved', 'fr', 'es');
    assert.equal(refreshes, 1, 'real LocaleSync refreshes a stale server locale after remount');
    await fixture.render('watch', '/video/approved', 'fr', 'es');
    assert.equal(refreshes, 1, 'same mounted LocaleSync does not refresh repeatedly');
    await fixture.render('core', '/app', 'fr', 'es');
    assert.equal(refreshes, 2, 'a fresh group instance retains its own LocaleSync lifecycle');
  } finally {
    await fixture.unmount();
    assert.equal(intervals.size, 0);
    assert.equal(mediaListeners.size, 0);
    dom.window.close();
  }
});
