import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { getModeCaps } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { WorkspaceComparisonSettings } from '../frontend/app/(core)/(workspace)/app/_components/WorkspaceComparisonSettings';
import type { SeedanceDraftControls } from '../frontend/lib/seedance-workflow-contract';

const noop = () => {};
function render(selected: boolean, phase: SeedanceDraftControls['phase'] = 'setup') {
  const engine = getBaseEngines().find(engine => engine.id === 'seedance-2-5')!;
  const oldReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return new JSDOM(renderToStaticMarkup(React.createElement(I18nProvider, {
      locale: 'en', dictionary: {}, fallback: {}, children: React.createElement(WorkspaceComparisonSettings, {
        density: 'comparison', engine, mode: 't2v', caps: getModeCaps(engine, 't2v'), durationSec: 4, resolution: selected ? '480p' : '1080p',
        aspectRatio: '16:9', fps: 24, iterations: 1, showAudioControl: true, audioEnabled: false,
        onDurationChange: noop, onResolutionChange: noop, onAspectRatioChange: noop, onFpsChange: noop,
        onIterationsChange: noop, onAudioChange: noop,
        draftControls: { available: true, selected, phase, toggle: noop, generate: noop, live: true },
      }),
    })));
  } finally {
    if (oldReact) Object.defineProperty(globalThis, 'React', oldReact); else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('comparison cannot change Draft resolution or output count during setup', () => {
  const dom = render(true);
  try {
    const buttons = [...dom.window.document.querySelectorAll<HTMLButtonElement>('button')];
    const resolution = buttons.find(button => button.textContent?.includes('Resolution:'));
    assert.ok(resolution);
    assert.match(resolution.textContent ?? '', /Draft 480p/);
    assert.equal(resolution.getAttribute('aria-disabled'), 'true');
    assert.equal(buttons.some(button => button.textContent?.includes('Outputs:')), false);
    assert.equal(buttons.find(button => button.textContent?.includes('Format:'))?.matches(':disabled'), false);
  } finally { dom.window.close(); }
});

test('submitted Draft locks comparison settings while normal generation keeps them editable', () => {
  for (const selected of [true, false]) {
    const dom = render(selected, 'draft');
    try {
      const buttons = [...dom.window.document.querySelectorAll<HTMLButtonElement>('button')];
      assert.ok(buttons.length >= 4);
      assert.equal(buttons.filter(button => button.matches(':disabled')).length, selected ? buttons.length : 0);
      assert.equal(buttons.some(button => button.textContent?.includes('Outputs:')), !selected);
    } finally { dom.window.close(); }
  }
});
