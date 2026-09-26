import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import type { WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';
import { useWorkspaceModelAlternatives } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceModelAlternatives';

test('closed comparison skips candidate preparation and reopening uses the complete current draft', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const originalClone = globalThis.structuredClone;
  let root: ReturnType<typeof createRoot> | undefined;
  let clones = 0;
  try {
    for (const [key, value] of Object.entries({
      window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      IS_REACT_ACT_ENVIRONMENT: true,
    })) {
      saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    // Observe the real candidate builder's draft cloning, without replacing its behavior.
    globalThis.structuredClone = ((...args: Parameters<typeof structuredClone>) => {
      clones += 1;
      return originalClone(...args);
    }) as typeof structuredClone;
    const engines = listFalEngines()
      .filter(({ id }) => ['seedance-2-0', 'veo-3-1', 'kling-3-pro'].includes(id))
      .map(({ engine }) => engine);
    const source = engines.find(({ id }) => id === 'seedance-2-0')!;
    const draft: WorkspaceModelSetup = {
      form: coerceFormState(source, 't2v', null), inputAssets: {}, klingElements: [],
      prompt: 'A cinematic landscape', negativePrompt: '', multiPromptEnabled: false,
      multiPromptScenes: [], shotType: 'customize', voiceIdsInput: '', cfgScale: null,
    };
    let latest!: ReturnType<typeof useWorkspaceModelAlternatives>;
    function Harness({ current, enabled }: { current: WorkspaceModelSetup; enabled: boolean }) {
      latest = useWorkspaceModelAlternatives({ current, enabled, engines, locale: 'en', memberTier: 'Member', accessToken: null });
      return React.createElement('ul', null, latest.alternatives.map(({ engine, candidate }) =>
        React.createElement('li', { key: engine.id }, `${engine.id}: ${candidate.setup.prompt}`)));
    }
    root = createRoot(dom.window.document.getElementById('root')!);
    const render = async (enabled: boolean, current: WorkspaceModelSetup) => {
      clones = 0;
      await act(async () => root!.render(React.createElement(Harness, { current, enabled })));
    };
    await render(false, draft);
    assert.equal(clones, 0, 'a closed comparison must not clone candidate drafts');
    await render(false, { ...draft });
    assert.equal(clones, 0, 'unrelated parent renders must not prepare hidden candidates');
    const edited = { ...draft, prompt: 'A daylight landscape' };
    await render(false, edited);
    assert.equal(clones, 0, 'typing while comparison is closed must not prepare candidates');

    await render(true, edited);
    assert.ok(clones > 0, 'opening prepares the real candidate configurations');
    assert.deepEqual([...latest.availableIds].sort(), ['kling-3-pro', 'veo-3-1']);
    assert.deepEqual(latest.alternatives.map(({ engine }) => engine.id).sort(), ['kling-3-pro', 'veo-3-1']);
    assert.equal(dom.window.document.querySelectorAll('li').length, 2);
    for (const alternative of latest.alternatives) {
      assert.equal(alternative.candidate.setup.prompt, edited.prompt);
      assert.ok(alternative.request, 'compatible alternatives retain their quote inputs');
    }
    const opened = JSON.stringify(latest.alternatives);
    await render(false, edited);
    assert.equal(clones, 0);
    await render(true, edited);
    assert.equal(JSON.stringify(latest.alternatives), opened, 'reopening preserves complete candidates and quote inputs');
    await act(async () => latest.remove('veo-3-1'));
    await render(false, edited);
    await render(true, edited);
    assert.deepEqual(latest.alternatives.map(({ engine }) => engine.id), ['kling-3-pro'], 'closing preserves user comparison selection');
  } finally {
    if (root) await act(async () => root!.unmount());
    globalThis.structuredClone = originalClone;
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
