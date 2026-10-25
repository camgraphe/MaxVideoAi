import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { useWorkspaceModelPicker } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceModelPicker';
import type { WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';

test('price scenarios are provisional, cleared on close, and reject replaced callbacks', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const engines = getBaseEnginesByCategory('video');
  const engine = engines.find(engine => engine.id === 'wan-3-prime')!;
  const current: WorkspaceModelSetup = { form: { ...coerceFormState(engine, 't2v', null), durationSec: 5, durationOption: 5 }, prompt: 'A scene', negativePrompt: '', inputAssets: {}, klingElements: [], multiPromptEnabled: false, multiPromptScenes: [], shotType: 'customize', voiceIdsInput: '', cfgScale: null };
  const before = structuredClone(current);
  let context!: ReturnType<typeof useWorkspaceModelPicker>, calls = 0;
  function Fixture() {
    context = useWorkspaceModelPicker({ current, engines, locale: 'en', memberTier: 'Member', accountId: 'test', accessToken: 'test-token', applyScenario: () => { calls++; return true; } });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    assert.deepEqual(context.options, {});
    await act(async () => context.onOpenChange?.(true));
    await act(async () => context.onControlChange?.('durationSec', '10'));
    const ten = context.onApply!;
    assert.match(context.options[engine.id].summary, /10 s/);
    assert.deepEqual(current, before);
    await act(async () => context.onControlChange?.('durationSec', '5'));
    assert.equal(ten(engine.id), false, 'an earlier scenario cannot apply after its settings changed');
    assert.equal(calls, 0);
    assert.equal(context.onApply?.(engine.id), true);
    assert.equal(calls, 1);
    await act(async () => context.onOpenChange?.(false));
    assert.equal(ten(engine.id), false);
    await act(async () => context.onOpenChange?.(true));
    assert.equal(context.hasChanges, false);
    assert.equal(context.controls?.find(control => control.id === 'durationSec')?.value, '5');
    assert.deepEqual(current, before);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);
  }
});
