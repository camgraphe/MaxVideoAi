import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import en from '../frontend/messages/en.json';
import type { AppLocale } from '../frontend/i18n/locales';

test('language controls reflect the watch runtime preference and keep marketing URL authority', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com/video/example', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    const { LanguageToggle } = await import('../frontend/components/marketing/LanguageToggle');
    const { I18nProvider } = await import('../frontend/lib/i18n/I18nProvider');
    const render = async (path: string, locale: AppLocale, key: string) => {
      dom.window.history.replaceState(null, '', path);
      await act(async () => root.render(React.createElement(I18nProvider, { locale, dictionary: en, fallback: en,
        children: React.createElement(React.Fragment, { key }, React.createElement(LanguageToggle), React.createElement(LanguageToggle, { variant: 'icon' })) })));
    };
    for (const [path, runtime, expected, label] of [
      ['/video/example', 'fr', 'fr', 'Français'],
      ['/video/example', 'es', 'es', 'Español'],
      ['/video/example', 'en', 'en', 'English'],
      ['/video', 'es', 'es', 'Español'],
      ['/models/pika-text-to-video', 'fr', 'en', 'English'],
      ['/', 'es', 'en', 'English'],
      ['/fr/modeles/pika-text-to-video', 'es', 'fr', 'Français'],
      ['/es/modelos/pika-text-to-video', 'fr', 'es', 'Español'],
      ['/video-guide', 'fr', 'en', 'English'],
    ] as const) {
      await render(path, runtime, `${path}:${runtime}`);
      const doc = dom.window.document;
      assert.equal(doc.querySelector('select')?.value, expected, `${path} with shell ${runtime}`);
      const button = doc.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
      assert.equal(button.title, label);
      await act(async () => button.click());
      assert.ok(doc.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent?.includes(label));
    }
    await render('/video/example', 'fr', 'watch');
    await render('/video/example', 'es', 'watch');
    assert.equal(dom.window.document.querySelector('select')?.value, 'es', 'a refreshed runtime updates mounted controls on the same watch URL');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
