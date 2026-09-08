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

test('absence defaults to system and follows the OS', () => {
  const browser = createThemeWindow(true);
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'system', resolvedTheme: 'dark' });
  browser.window.localStorage.setItem('mv-theme', 'system');
  assert.deepEqual(readThemeSnapshot(browser.window), { preference: 'system', resolvedTheme: 'dark' });
});

test('theme preference publishes same-tab changes and applies the resolved root theme', () => {
  const browser = createThemeWindow(false);
  let events = 0;
  browser.window.addEventListener(THEME_CHANGE_EVENT, () => { events += 1; });
  persistThemePreference(browser.window, 'dark');
  const snapshot = readThemeSnapshot(browser.window);
  applyResolvedTheme(snapshot.resolvedTheme, browser.window.document.documentElement);
  assert.equal(events, 1);
  assert.equal(browser.window.localStorage.getItem('mv-theme'), 'dark');
  assert.equal(browser.window.document.documentElement.getAttribute('data-theme'), 'dark');
});

test('system changes notify subscribers and cleanup removes every listener', () => {
  const browser = createThemeWindow(false);
  browser.window.localStorage.setItem('mv-theme', 'system');
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
