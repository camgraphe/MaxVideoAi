import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { AppAppearanceControl } from '../frontend/components/app/AppAppearanceControl.client';
import { AppExperienceRoot } from '../frontend/components/AppExperienceRoot';
import { useThemePreference } from '../frontend/src/hooks/useThemePreference';
import { useStudioThemeMode } from '../frontend/app/(core)/(workspace)/app/studio/_hooks/useStudioThemeMode';

async function mountAppearance(locale = 'en') {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/app' });
  let dark = false;
  const listeners = new Set<() => void>();
  Object.defineProperty(dom.window, 'matchMedia', { value: () => ({
    get matches() { return dark; },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }) });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let app!: ReturnType<typeof useThemePreference>;
  let studio!: ReturnType<typeof useStudioThemeMode>;
  function Consumer() {
    app = useThemePreference();
    studio = useStudioThemeMode();
    return React.createElement('div', { 'data-studio-theme': studio.resolvedTheme }, React.createElement(AppAppearanceControl, { locale }));
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = async (path: string, publicLayout = false) => {
    dom.window.history.replaceState(null, '', path);
    await React.act(async () => root.render(React.createElement(PathnameContext.Provider, { value: path },
      publicLayout ? React.createElement('main', null, 'Public page') : React.createElement(AppExperienceRoot, { fontClass: 'test-font', children: React.createElement(Consumer) }))));
  };
  await render('/app');
  return {
    dom, render,
    get app() { return app; }, get studio() { return studio; },
    async setDark(value: boolean) { await React.act(async () => { dark = value; listeners.forEach((listener) => listener()); }); },
    async dispose() {
      await React.act(async () => root.unmount());
      assert.equal(listeners.size, 0, 'all appearance subscriptions are released');
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('app and classic Studio share the OS default and each manual choice in the same tab', async () => {
  const fixture = await mountAppearance();
  try {
    assert.equal(fixture.app.resolvedTheme, 'light');
    assert.equal(fixture.studio.resolvedTheme, 'light');
    await fixture.setDark(true);
    assert.equal(fixture.app.resolvedTheme, 'dark');
    assert.equal(fixture.studio.resolvedTheme, 'dark');
    await React.act(async () => fixture.app.setPreference('light'));
    assert.equal(fixture.studio.resolvedTheme, 'light');
    await React.act(async () => fixture.studio.toggleResolvedTheme());
    assert.equal(fixture.app.resolvedTheme, 'dark');
    assert.equal(fixture.dom.window.localStorage.getItem('mv-app-theme'), 'dark');
    await fixture.setDark(false);
    assert.equal(fixture.app.resolvedTheme, 'dark', 'explicit choice survives OS changes');
  } finally { await fixture.dispose(); }
});

test('public client navigation stays light during preference events and returning restores the saved app choice', async () => {
  const fixture = await mountAppearance();
  try {
    await React.act(async () => fixture.app.setPreference('dark'));
    assert.equal(fixture.dom.window.document.documentElement.dataset.theme, 'dark');
    await fixture.render('/fr/modeles');
    assert.equal(fixture.dom.window.document.documentElement.dataset.theme, undefined);
    await React.act(async () => fixture.app.setPreference('light'));
    await React.act(async () => fixture.app.setPreference('dark'));
    assert.equal(fixture.dom.window.document.documentElement.dataset.theme, undefined, 'mounted consumers cannot repaint public routes');
    await fixture.render('/app/studio/workspace');
    assert.equal(fixture.dom.window.document.documentElement.dataset.theme, 'dark');
    assert.equal(fixture.studio.resolvedTheme, 'dark');
  } finally { await fixture.dispose(); }
});


test('leaving the core layout clears app appearance before the public layout paints', async () => {
  const fixture = await mountAppearance();
  try {
    await React.act(async () => fixture.app.setPreference('dark'));
    await fixture.render('/pricing', true);
    assert.equal(fixture.dom.window.document.documentElement.dataset.theme, undefined);
    assert.equal(fixture.dom.window.localStorage.getItem('mv-app-theme'), 'dark');
    await fixture.render('/app');
    assert.equal(fixture.dom.window.document.documentElement.dataset.theme, 'dark');
  } finally { await fixture.dispose(); }
});


test('labeled appearance choices set an explicit palette and preserve it after remount', async () => {
  const fixture = await mountAppearance();
  try {
    const choices = () => [...fixture.dom.window.document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];
    assert.deepEqual(choices().map(button => button.textContent), ['Light', 'Dark']);
    assert.deepEqual(choices().map(button => button.getAttribute('aria-pressed')), ['true', 'false']);
    assert.equal(fixture.dom.window.localStorage.getItem('mv-app-theme'), null, 'rendering keeps the system default');
    await React.act(async () => choices()[1].click());
    assert.equal(fixture.studio.resolvedTheme, 'dark');
    assert.equal(fixture.dom.window.localStorage.getItem('mv-app-theme'), 'dark');
    await React.act(async () => choices()[1].click());
    assert.equal(fixture.app.resolvedTheme, 'dark', 'choosing the active palette never toggles away');
    await fixture.render('/pricing', true);
    await fixture.render('/app');
    assert.deepEqual(choices().map(button => button.getAttribute('aria-pressed')), ['false', 'true']);
    await React.act(async () => choices()[0].click());
    assert.equal(fixture.app.resolvedTheme, 'light');
    assert.equal(fixture.dom.window.localStorage.getItem('mv-app-theme'), 'light');
  } finally { await fixture.dispose(); }
});

for (const [locale, labels] of [['fr', ['Clair', 'Sombre']], ['es', ['Claro', 'Oscuro']]] as const) {
  test('appearance choices have visible '+locale+' labels', async () => {
    const fixture = await mountAppearance(locale);
    try {
      assert.deepEqual([...fixture.dom.window.document.querySelectorAll('button[aria-pressed]')].map(button => button.textContent), labels);
    } finally { await fixture.dispose(); }
  });
}
