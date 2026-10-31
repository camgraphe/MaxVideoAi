import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { canApplyProposal, canReviewProposal } from '../frontend/src/lib/prompt-assistance/preview-state';
import { canonicalPromptDraft } from '../frontend/src/lib/prompt-assistance/session';
import type { EngineCaps, Mode } from '../frontend/types/engines';
import type { PromptAssistanceContext, usePromptAssistancePreview } from '../frontend/components/composer/usePromptAssistancePreview';

type Capture = { context: PromptAssistanceContext; controller: ReturnType<typeof usePromptAssistancePreview> };
type Draft = { value: string | undefined; set: React.Dispatch<React.SetStateAction<string | undefined>> };

test('the real Composer projects only the offered companion into Milo and suggestion guards', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'milo-negative-context-'));
  const output = join(dir, 'composer.cjs');
  const compiled = await build({
    stdin: { contents: `export {Composer} from './frontend/components/Composer'; export {I18nProvider} from './frontend/lib/i18n/I18nProvider';`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, outfile: output, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_PREVIEW': '"1"', 'process.env.NEXT_PUBLIC_PROMPT_ASSISTANCE_LIVE': '"0"' },
    plugins: [{ name: 'assistant-ui-boundary', setup(plugin) {
      plugin.onResolve({ filter: /\/PromptAssistanceComposer\.client$/ }, () => ({ path: 'assistant-ui', namespace: 'fixture' }));
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: `import {usePromptAssistancePreview} from ${JSON.stringify(resolve('frontend/components/composer/usePromptAssistancePreview.ts'))};
          export function PromptAssistanceComposer(props) {
            const controller = usePromptAssistancePreview({...props.context, draftText:props.draftText, target:'prompt', onApplyText:props.onApplyText, maxLength:props.maxLength, blocked:props.blocked});
            globalThis.__miloNegativeCapture = {context:props.context, controller};
            return props.children;
          }`, loader: 'tsx', resolveDir: process.cwd(),
      }));
    } }],
  });
  await writeFile(output, compiled.outputFiles.find(file => file.path.endsWith('.cjs'))!.contents);
  const require = createRequire(resolve('frontend/package.json'));
  const Module = require('node:module');
  const mod = new Module(output); mod.filename = output; mod.paths = require.resolve.paths('react');
  mod._compile(await readFile(output, 'utf8'), output);
  const { Composer, I18nProvider } = mod.exports;
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  let fetches = 0;
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
    React, IS_REACT_ACT_ENVIRONMENT: true,
    __miloNegativeCapture: undefined, __miloNegativeDraft: undefined,
    fetch: async () => { fetches++; throw new Error('No network is allowed in this fixture'); },
  };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const state = globalThis as typeof globalThis & { __miloNegativeCapture: Capture; __miloNegativeDraft: Draft };
  const { createRoot } = require('react-dom/client') as typeof import('react-dom/client');
  const root = createRoot(document.getElementById('root')!);
  const engine = (id: string) => { const value = listFalEngines().find(entry => entry.id === id)?.engine; assert.ok(value, id); return value; };
  const unsupported = engine('wan-3-prime'), supported = engine('wan-2-6');
  let key = 0;
  let current: { engine: EngineCaps; mode: Mode; initial: string | undefined };
  function Fixture(props: typeof current) {
    const [negativePrompt, setNegativePrompt] = React.useState(props.initial);
    state.__miloNegativeDraft = { value: negativePrompt, set: setNegativePrompt };
    const summary = summarizeWorkspaceInputSchema({ selectedEngine: props.engine, activeMode: props.mode, allowsUnifiedVeoFirstLast: false, isUnifiedHappyHorse: false, isUnifiedSeedance: false, isUnifiedGeminiOmni: false, uiLocale: 'en' });
    return React.createElement(Composer, {
      density: 'workspace', engine: props.engine, caps: props.engine.modeCaps?.[props.mode],
      prompt: 'A synthetic scene', onPromptChange() {}, negativePrompt, onNegativePromptChange: setNegativePrompt,
      price: null, currency: 'USD', isLoading: false, promptRequired: true,
      negativePromptField: summary.negativePromptField, negativePromptRequired: summary.negativePromptRequired,
      assetFields: [], assets: {}, activeManualMode: props.mode,
      assistance: {
        accountKey: 'synthetic-owner', scopeKey: 'synthetic-owner:video:create', reviewKey: 'upstream-review', contextKey: 'upstream-context',
        live: { surface: 'video', workflow: 'create', engineId: props.engine.id, mode: props.mode, settings: {}, references: [], readOnlyText: { lyrics: 'Another companion stays intact' } },
      },
    });
  }
  const render = () => act(async () => root.render(React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {} }, React.createElement(Fixture, { ...current, key }))));
  const mount = async (engine: EngineCaps, initial: string | undefined) => { key++; current = { engine, mode: 't2v', initial }; await render(); };
  const changeDraft = (value: string) => act(async () => state.__miloNegativeDraft.set(value));
  const capture = () => { assert.ok(state.__miloNegativeCapture); return state.__miloNegativeCapture; };
  const suggest = async () => {
    await act(async () => capture().controller.dispatch({ type: 'send', id: 1, message: 'Synthetic refinement' }));
    await act(async () => capture().controller.dispatch({ type: 'reply', id: 1, text: 'Synthetic suggestion', reply: 'Synthetic commentary' }));
    assert.equal(canApplyProposal(capture().controller.state), true);
  };
  try {
    await t.test('legacy empty and absent companion identities survive while a legacy nonempty draft stays distinct', async () => {
      await mount(unsupported, '');
      const empty = capture().context;
      assert.equal(empty.contextKey, '["upstream-context","wan-3-prime","t2v",{},"",null]');
      assert.equal(empty.reviewKey, '["upstream-review","wan-3-prime",null,"t2v",{},"",null]');
      const currentDraft = { ...empty.live!, text: 'A synthetic scene', target: 'prompt' as const };
      const legacyNonempty = { ...currentDraft, readOnlyText: { ...currentDraft.readOnlyText, negativePrompt: 'Earlier hidden synthetic constraint' } };
      assert.notEqual(canonicalPromptDraft(currentDraft), canonicalPromptDraft(legacyNonempty), 'a former nonempty context must not match the restored draft fingerprint');
      await mount(unsupported, undefined);
      assert.equal(capture().context.contextKey, '["upstream-context","wan-3-prime","t2v",{},null,null]');
      assert.equal(capture().context.reviewKey, '["upstream-review","wan-3-prime",null,"t2v",{},null,null]');
    });
    await t.test('an unavailable nonempty companion is omitted while other companions survive', async () => {
      await mount(unsupported, 'Preserved hidden synthetic constraint');
      assert.deepEqual(capture().context.live?.readOnlyText, { lyrics: 'Another companion stays intact' });
      assert.equal(state.__miloNegativeDraft.value, 'Preserved hidden synthetic constraint');
    });
    await t.test('changing only an unavailable value preserves the suggestion and all context identities', async () => {
      await mount(unsupported, 'First hidden synthetic constraint'); await suggest();
      const before = capture();
      await changeDraft('Second hidden synthetic constraint');
      const after = capture();
      assert.equal(after.context.contextKey, before.context.contextKey);
      assert.equal(after.context.reviewKey, before.context.reviewKey);
      assert.deepEqual(after.context.live, before.context.live);
      assert.equal(after.controller.state.fingerprint, before.controller.state.fingerprint);
      assert.equal(after.controller.state.compatibilityRevision, before.controller.state.compatibilityRevision);
      assert.equal(canApplyProposal(after.controller.state), true);
    });
    await t.test('an offered companion preserves exact bytes and changing it invalidates the suggestion', async () => {
      const text = '  Avoid smoke; preserve “CAFÉ” lettering  ';
      await mount(supported, text);
      assert.deepEqual(capture().context.live?.readOnlyText, { lyrics: 'Another companion stays intact', negativePrompt: text });
      await suggest(); const before = capture();
      await changeDraft('A different applicable constraint'); const after = capture();
      assert.equal(after.context.live?.readOnlyText?.negativePrompt, 'A different applicable constraint');
      assert.notEqual(after.context.contextKey, before.context.contextKey);
      assert.notEqual(after.context.reviewKey, before.context.reviewKey);
      assert.ok(after.controller.state.compatibilityRevision > before.controller.state.compatibilityRevision);
      assert.equal(canApplyProposal(after.controller.state), false);
      assert.equal(canReviewProposal(after.controller.state), false);
    });
    await t.test('engine changes remain guarded and returning restores the offered field without losing the draft', async () => {
      await mount(supported, 'Keep this authored constraint'); await suggest();
      const before = capture(); current.engine = unsupported; await render();
      assert.notEqual(capture().controller.state.fingerprint, before.controller.state.fingerprint);
      assert.equal(canApplyProposal(capture().controller.state), false);
      assert.equal(state.__miloNegativeDraft.value, 'Keep this authored constraint');
      current.engine = supported; await render();
      assert.equal(capture().context.live?.readOnlyText?.negativePrompt, 'Keep this authored constraint');
      assert.equal(state.__miloNegativeDraft.value, 'Keep this authored constraint');
      assert.equal(canApplyProposal(capture().controller.state), false, 'returning does not resurrect the old proposal');
      const negativeInput = document.querySelector('input[type="text"]') as HTMLInputElement | null;
      assert.ok(negativeInput); assert.equal(negativeInput.value, 'Keep this authored constraint');
    });
    await t.test('prepared mode applicability omits the field and genuine mode changes remain guarded', async () => {
      const modeSpecific: EngineCaps = { ...unsupported, id: 'synthetic-mode-specific', inputSchema: {
        ...unsupported.inputSchema!, optional: [...unsupported.inputSchema!.optional, { id: 'negative_prompt', type: 'text', label: 'Negative prompt', modes: ['t2v'] }],
      } };
      await mount(modeSpecific, 'A mode-scoped constraint'); await suggest(); const before = capture();
      current.mode = 'i2v'; await render();
      assert.equal(capture().context.live?.readOnlyText?.negativePrompt, undefined);
      assert.notEqual(capture().controller.state.fingerprint, before.controller.state.fingerprint);
      assert.equal(canApplyProposal(capture().controller.state), false);
      assert.equal(state.__miloNegativeDraft.value, 'A mode-scoped constraint');
      current.mode = 't2v'; await render();
      assert.equal(capture().context.live?.readOnlyText?.negativePrompt, 'A mode-scoped constraint');
      assert.equal(canApplyProposal(capture().controller.state), false);
    });
    assert.equal(fetches, 0);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    await rm(dir, { recursive: true, force: true });
  }
});
