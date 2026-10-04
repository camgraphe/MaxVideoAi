import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { THEME_BOOTSTRAP } from '../frontend/lib/theme-bootstrap';
import { THEME_STORAGE_KEY, readThemeSnapshot } from '../frontend/src/hooks/useThemePreference';

function runBootstrap(path: string, saved?: string, systemDark = false, blocked = false) {
  const dom = new JSDOM('<!doctype html><html data-theme="dark"></html>', {url: `https://maxvideoai.test${path}`, runScripts: 'outside-only'});
  Object.defineProperty(dom.window, 'matchMedia', {value: () => ({matches: systemDark})});
  if (saved) dom.window.localStorage.setItem(THEME_STORAGE_KEY, saved);
  if (blocked) Object.defineProperty(dom.window, 'localStorage', {get() {throw new Error('blocked');}});
  dom.window.eval(THEME_BOOTSTRAP);
  return dom;
}

test('public routes use the fixed light design regardless of the app preference', () => {
  for (const path of ['/', '/fr', '/es/herramientas', '/tools', '/mcp', '/integrations/codex']) {
    const dom = runBootstrap(path, 'dark', true);
    assert.equal(dom.window.document.documentElement.getAttribute('data-theme'), null, path);
    assert.equal(dom.window.localStorage.getItem(THEME_STORAGE_KEY), 'dark', 'public route does not rewrite the app choice');
    dom.window.close();
  }
});

test('workspace first paint agrees with the hook for default, saved and system themes', () => {
  for (const systemDark of [false, true]) for (const saved of [undefined, 'light', 'dark', 'system', 'invalid']) {
    for (const path of ['/app', '/app/tools/angle', '/settings', '/billing']) {
      const dom = runBootstrap(path, saved, systemDark);
      const theme = dom.window.document.documentElement.getAttribute('data-theme') ?? 'light';
      assert.equal(theme, readThemeSnapshot(dom.window as unknown as Window).resolvedTheme, `${path}:${saved}`);
      dom.window.close();
    }
  }
});

test('blocked storage uses the OS for app first paint', () => {
  for (const systemDark of [false, true]) {
    const dom = runBootstrap('/app', undefined, systemDark, true);
    assert.equal(dom.window.document.documentElement.getAttribute('data-theme'), systemDark ? 'dark' : null);
    dom.window.close();
  }
});

test('the fixed marketing theme does not require personalized SSR or a marketing toggle', () => {
  const layout = readFileSync('frontend/app/layout.tsx', 'utf8');
  assert.match(layout, /id="theme-bootstrap"/);
  assert.doesNotMatch(layout, /cookies\(\)|headers\(\)/);
  for (const file of ['MarketingNav', 'MarketingMobileMenu']) {
    assert.doesNotMatch(readFileSync(`frontend/components/marketing/${file}.tsx`, 'utf8'), /toggleTheme|onToggleTheme|useThemePreference/);
  }
  for (const file of ['frontend/components/HeaderBar.tsx', 'frontend/components/header/HeaderMobileMenu.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /toggleTheme|onToggleTheme|useThemePreference/);
  }
  assert.match(readFileSync('frontend/components/app/AppSiteMenu.client.tsx', 'utf8'), /AppAppearanceControl/);
});


test('bootstrap imports only explicit legacy Studio choices and preserves app precedence', () => {
  for (const saved of [undefined, 'light', 'dark', 'system', 'invalid']) {
    for (const override of [false, true]) {
      const dom = runBootstrap('/app/studio/workspace', saved);
      dom.window.localStorage.setItem('maxvideoai.studio.theme.v1', 'dark');
      if (override) dom.window.localStorage.setItem('maxvideoai.studio.theme.userOverride.v1', 'true');
      dom.window.eval(THEME_BOOTSTRAP);
      const actual = dom.window.document.documentElement.getAttribute('data-theme') ?? 'light';
      const expected = saved === 'dark' || (override && (saved === undefined || saved === 'invalid')) ? 'dark' : 'light';
      assert.equal(actual, expected, `${saved}:${override}`);
      assert.equal(actual, readThemeSnapshot(dom.window as unknown as Window).resolvedTheme);
      dom.window.close();
    }
  }
});
