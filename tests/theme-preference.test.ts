import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { applyResolvedTheme, persistThemePreference, readThemeSnapshot, subscribeToThemePreference, THEME_CHANGE_EVENT } from '../frontend/src/hooks/useThemePreference';

function createThemeWindow(initialDark = false) {
  const dom = new JSDOM('<!doctype html><html></html>', { url: 'https://maxvideoai.test' });
  let dark = initialDark;
  const listeners = new Set<() => void>();
  const media = {
    get matches() { return dark; },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true,
  } as MediaQueryList;
  Object.defineProperty(dom.window, 'matchMedia', { value: () => media });
  return { window: dom.window as unknown as Window, setDark(value: boolean) { dark = value; listeners.forEach((listener) => listener()); }, listenerCount: () => listeners.size };
}

test('absence follows the OS and defaults to light when the OS is light', () => {
  const browser = createThemeWindow(false);
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'system', resolvedTheme: 'light' });
  browser.setDark(true);
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'system', resolvedTheme: 'dark' });
});

test('saved light and dark preferences remain authoritative over the system default', () => {
  const browser = createThemeWindow(true);
  browser.window.localStorage.setItem('mv-app-theme', 'light');
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'light', resolvedTheme: 'light' });
  browser.window.localStorage.setItem('mv-app-theme', 'dark');
  browser.setDark(false);
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'dark', resolvedTheme: 'dark' });
});

test('theme preference publishes same-tab changes and applies the resolved root theme', () => {
  const browser = createThemeWindow(false);
  let events = 0;
  browser.window.addEventListener(THEME_CHANGE_EVENT, () => { events += 1; });
  persistThemePreference(browser.window, 'dark');
  const snapshot = readThemeSnapshot(browser.window);
  applyResolvedTheme(snapshot.resolvedTheme, browser.window.document.documentElement);
  assert.equal(events, 1);
  assert.equal(browser.window.localStorage.getItem('mv-app-theme'), 'dark');
  assert.equal(browser.window.document.documentElement.getAttribute('data-theme'), 'dark');
});

test('system changes notify subscribers and cleanup removes every listener', () => {
  const browser = createThemeWindow(false);
  const snapshots: string[] = [];
  const cleanup = subscribeToThemePreference(browser.window, (snapshot) => snapshots.push(snapshot.resolvedTheme));
  browser.setDark(true);
  assert.deepEqual(snapshots, ['dark']);
  assert.equal(browser.listenerCount(), 1);
  cleanup();
  browser.setDark(false);
  assert.deepEqual(snapshots, ['dark']);
  assert.equal(browser.listenerCount(), 0);
});

test('blocked localStorage falls back to tab memory without crashing consumers', () => {
  const browser = createThemeWindow(false);
  Object.defineProperty(browser.window, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Storage blocked', 'SecurityError'); },
  });

  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'system', resolvedTheme: 'light' });
  assert.doesNotThrow(() => persistThemePreference(browser.window, 'dark'));
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'dark', resolvedTheme: 'dark' });
});

test('the old marketing preference does not set the new app default', () => {
  const browser = createThemeWindow(false);
  browser.window.localStorage.setItem('mv-theme', 'dark');
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'system', resolvedTheme: 'light' });
  persistThemePreference(browser.window, 'light');
  assert.equal(readThemeSnapshot(browser.window).resolvedTheme, 'light');
});


test('invalid app values fall back to the OS without persisting an implicit choice', () => {
  const browser = createThemeWindow(false);
  browser.window.localStorage.setItem('mv-app-theme', 'invalid');
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'system', resolvedTheme: 'light' });
  assert.equal(browser.window.localStorage.getItem('mv-app-theme'), 'invalid');
});

test('only an explicit legacy Studio choice migrates, and a valid app preference always wins', () => {
  const browser = createThemeWindow(false);
  browser.window.localStorage.setItem('maxvideoai.studio.theme.v1', 'dark');
  assert.equal(readThemeSnapshot(browser.window).resolvedTheme, 'light');
  browser.window.localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'dark', resolvedTheme: 'dark' });
  assert.equal(browser.window.localStorage.getItem('mv-app-theme'), 'dark');
  for (const appChoice of ['light', 'system']) {
    browser.window.localStorage.setItem('mv-app-theme', appChoice);
    assert.equal(readThemeSnapshot(browser.window).preference, appChoice);
    assert.equal(readThemeSnapshot(browser.window).resolvedTheme, 'light');
  }
});

test('a failed storage write keeps the manual choice even when reads still succeed', () => {
  const browser = createThemeWindow(false);
  browser.window.localStorage.setItem('mv-app-theme', 'system');
  Object.defineProperty(Object.getPrototypeOf(browser.window.localStorage), 'setItem', {
    value() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
  });
  persistThemePreference(browser.window, 'dark');
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'dark', resolvedTheme: 'dark' });
});

test('other-tab changes and clearing storage resync subscribers, while explicit choices ignore OS changes', () => {
  const browser = createThemeWindow(false);
  const snapshots: string[] = [];
  const cleanup = subscribeToThemePreference(browser.window, (snapshot) => snapshots.push(`${snapshot.preference}:${snapshot.resolvedTheme}`));
  persistThemePreference(browser.window, 'dark');
  browser.setDark(true);
  browser.setDark(false);
  assert.deepEqual(snapshots, ['dark:dark']);
  browser.window.localStorage.setItem('mv-app-theme', 'light');
  browser.window.dispatchEvent(new browser.window.StorageEvent('storage', { key: 'mv-app-theme', newValue: 'light', storageArea: browser.window.localStorage }));
  browser.window.localStorage.clear();
  browser.setDark(true);
  browser.window.dispatchEvent(new browser.window.StorageEvent('storage', { key: null, storageArea: browser.window.localStorage }));
  assert.deepEqual(snapshots.slice(-2), ['system:dark', 'system:dark']);
  assert.ok(snapshots.includes('light:light'));
  cleanup();
});


test('missing system APIs still resolve to light and leave explicit dark usable', () => {
  const dom = new JSDOM('<!doctype html><html></html>', { url: 'https://maxvideoai.test' });
  const browserWindow = dom.window as unknown as Window;
  assert.deepEqual(readThemeSnapshot(browserWindow), { preference: 'system', resolvedTheme: 'light' });
  const received: string[] = [];
  const cleanup = subscribeToThemePreference(browserWindow, (snapshot) => received.push(snapshot.resolvedTheme));
  persistThemePreference(browserWindow, 'dark');
  assert.deepEqual(received, ['dark']);
  cleanup();
  dom.window.close();
});
