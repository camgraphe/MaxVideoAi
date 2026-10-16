import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { CoreSettingsBar } from '../frontend/components/CoreSettingsBar';
import { SettingsControls } from '../frontend/components/SettingsControls';
import { getModeCaps } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';

test('both rendered settings surfaces show inherited Edit timing and expose no independent duration or framing input', () => {
  const base = getFalEngineById('seedance-2-5')!.engine;
  const engine = { ...base, modeAvailability: { v2v: { available: true, reason: 'available' as const, inheritsSourceVideo: true } } };
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    for (const Control of [CoreSettingsBar, SettingsControls]) {
      const dom = new JSDOM(renderToStaticMarkup(React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {},
        children: React.createElement(Control as React.ComponentType<any>, { engine, mode: 'v2v', caps: getModeCaps(engine, 'v2v'),
          durationSec: 9, durationManagedLabel: '4.25s source · 5s price bracket', resolution: '480p', aspectRatio: '9:16', fps: 24,
          onDurationChange: () => {}, onResolutionChange: () => {}, onAspectRatioChange: () => {}, onFpsChange: () => {},
          showSeedanceControls: true, variant: 'full' }),
      })));
      try {
        assert.match(dom.window.document.body.textContent ?? '', /4\.25s source.*5s price bracket/);
        const buttons = [...dom.window.document.querySelectorAll('button')];
        assert.equal(buttons.some(button => /Duration:|Format:|9:16|16:9/.test(button.textContent ?? '')), false);
        assert.equal(dom.window.document.querySelectorAll('input[type=range],input[type=number]').length, 0);
      } finally { dom.window.close(); }
    }
  } finally { if (previousReact) Object.defineProperty(globalThis, 'React', previousReact); else Reflect.deleteProperty(globalThis, 'React'); }
});
