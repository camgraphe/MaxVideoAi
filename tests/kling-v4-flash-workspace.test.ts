import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { CoreSettingsBar } from '../frontend/components/CoreSettingsBar';
import { KLING_V4_FLASH_ENGINE as engine } from '../frontend/src/config/fal-engines/kling-v4-flash';
import { buildComposerModeToggles, coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveWorkspaceWorkflow, resolveWorkspaceComposerFacts } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import { buildWorkspaceGeneratePayload } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload';
import { buildWorkspacePreflightRequest } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import { getWorkspaceKlingV4ActiveAssets, getWorkspaceKlingV4MediaError } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-kling-v4-media';
import { getModifySourceDefaults } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-modify-source-defaults';
import { buildVideoSettingsFormState, resolveVideoSettingsSnapshot } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';
import { buildAssetFieldIdSet, buildKlingLibraryAsset, type ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { KlingElementsBuilder, type KlingElementState } from '../frontend/components/KlingElementsBuilder';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';

const copy = { generateVideo: 'Create video', removeAudioToUnlock: 'Remove audio', audioUnsupported: 'Unsupported', audioLocked: 'Locked', audioLockedFallback: 'Locked' };
const asset = (id: string, fieldId: string, kind: 'image' | 'video' = 'video', durationSec = 4): ReferenceAsset => ({
  ...buildKlingLibraryAsset({ id, kind, url: `https://owned.test/${id}`, width: 1280, height: 720, size: 1234, durationSec: kind === 'video' ? durationSec : null }),
  fieldId, type: kind === 'video' ? 'video/mp4' : 'image/png',
});
const videoSubject = (id: string, durationSec = 3): KlingElementState => ({ id, frontal: null, references: [], video: asset(id, 'subject', 'video', durationSec) });
const source = asset('source', 'video_url', 'video', 5.25);
type Assets = Record<string, (ReferenceAsset | null)[]>;
function project(inputAssets: Assets, form = coerceFormState(engine, 'v2v', null), klingElements: KlingElementState[] = []) {
  const workflow = resolveWorkspaceWorkflow({ engine, form, inputAssets, klingElements });
  const schema = summarizeWorkspaceInputSchema({ selectedEngine: engine, ...workflow, uiLocale: 'en' });
  const facts = resolveWorkspaceComposerFacts({ engine, form, workflow, prompt: 'Relight @Video1 with @Video2', multiPromptEnabled: true, multiPromptScenes: [], voiceIdsInput: '' });
  const prepared = prepareGenerationInputs({ selectedEngineId: engine.id, ...workflow, form, inputSchema: engine.inputSchema, inputSchemaSummary: schema,
    extraInputFields: [...schema.promotedFields, ...schema.secondaryFields], inputAssets,
    primaryAssetFieldIds: buildAssetFieldIdSet(schema.assetFields, entry => entry.role === 'primary'),
    referenceAssetFieldIds: buildAssetFieldIdSet(schema.assetFields, entry => entry.role === 'reference'),
    genericImageFieldIds: new Set(), frameAssetFieldIds: buildAssetFieldIdSet(schema.assetFields, entry => entry.role === 'frame'), referenceAudioFieldIds: new Set(),
    klingElements, multiPromptActive: facts.multiPromptActive, multiPromptScenes: [],
  });
  return { form, workflow, schema, facts, prepared };
}
function generate(state: ReturnType<typeof project>) {
  assert.ok(state.prepared.ok, state.prepared.ok ? undefined : state.prepared.message);
  if (!state.prepared.ok) throw new Error('Unreachable');
  return buildWorkspaceGeneratePayload({ selectedEngineId: engine.id, ...state.workflow, form: state.form, trimmedPrompt: 'Relight @Video1 with @Video2', trimmedNegativePrompt: '', effectiveDurationSec: state.facts.effectiveDurationSec,
    paymentMode: 'wallet', capability: engine.modeCaps?.[state.workflow.submissionMode], inputSchema: engine.inputSchema, supportsNegativePrompt: false, supportsAudioToggle: false, isSeedance: false,
    supportsKlingV3VoiceControl: false, voiceIds: [], voiceControlEnabled: false, shotType: 'customize', localKey: 'offline', batchId: 'offline', iterationIndex: 0, iterationCount: 1, friendlyMessage: '',
    lumaContext: { isLumaRay2GenerateWorkflow: false, lumaDuration: null, lumaResolution: null }, ...state.prepared,
  }).payload;
}

test('Flash Modify exposes one source and additional references while Create preserves its parked source', () => {
  assert.deepEqual(buildComposerModeToggles({ selectedEngine: engine, audioWorkflowLocked: false, uiLocale: 'en', workflowCopy: copy })?.map(toggle => toggle.mode), [null, 'v2v']);
  const inputAssets = { video_url: [source], video_urls: [asset('reference', 'video_urls')], image_urls: [asset('image', 'image_urls', 'image')], image_url: [asset('opening', 'image_url', 'image')] };
  const state = project(inputAssets, { ...coerceFormState(engine, 'v2v', null), durationSec: 6, durationOption: 6 }, [videoSubject('subject')]);
  assert.equal(state.workflow.submissionMode, 'v2v');
  assert.equal(state.workflow.activeManualMode, 'v2v');
  assert.equal(state.facts.multiPromptActive, false);
  assert.equal(state.schema.promptRequired, true);
  assert.deepEqual(state.schema.assetFields.map(entry => entry.field.id).sort(), ['image_urls', 'video_url', 'video_urls']);
  assert.equal(state.schema.assetFields.find(entry => entry.field.id === 'video_url')?.required, true);
  const payload = generate(state);
  assert.deepEqual(payload.inputs?.map(input => [input.slotId, input.assetId]), [['video_url', 'source'], ['image_urls', 'image'], ['video_urls', 'reference']]);
  assert.equal(payload.elements?.[0].videoAssetId, 'subject');
  assert.equal(payload.imageUrl, undefined);
  assert.deepEqual(state.prepared.ok && state.prepared.referenceVideoUrls, ['https://owned.test/reference']);
  assert.equal(payload.durationSec, 6);
  for (const key of ['fps', 'audio', 'voiceIds', 'endImageUrl', 'aspectRatio', 'multiPrompt']) assert.equal(payload[key as keyof typeof payload], undefined, key);
  const creation = project(inputAssets, coerceFormState(engine, 't2v', state.form));
  assert.equal(creation.workflow.submissionMode, 'ref2v');
  assert.deepEqual(generate(creation).inputs?.map(input => input.assetId), ['opening', 'image', 'reference']);
  assert.equal(inputAssets.video_url[0].assetId, 'source');
  const restored = project(inputAssets, coerceFormState(engine, 'v2v', creation.form));
  assert.equal(restored.workflow.submissionMode, 'v2v');
  assert.deepEqual(getWorkspaceKlingV4ActiveAssets('v2v', inputAssets, engine.id), { video_url: [source], video_urls: inputAssets.video_urls, image_urls: inputAssets.image_urls });
});

test('Flash Modify inherits exact source timing only when automatic duration is selected', () => {
  const initial = coerceFormState(engine, 'v2v', coerceFormState(engine, 't2v', null));
  assert.equal(initial.durationOption, 'auto');
  const state = project({ video_url: [source] }, initial);
  assert.equal(state.workflow.primaryVideoDurationSec, 5.25);
  assert.equal(state.facts.effectiveDurationSec, 5.25);
  const preflight = buildWorkspacePreflightRequest({ selectedEngine: engine, ...state.workflow, ...state.facts, form: state.form, inputAssets: { video_url: [source] }, memberTier: 'Member' });
  const payload = generate(state);
  for (const request of [preflight, payload]) {
    assert.equal(request.durationSec, undefined);
    assert.equal(request.durationOption, undefined);
    assert.equal(request.inputs?.[0].assetId, 'source');
  }
  assert.equal(payload.inputs?.[0].durationSec, 5.25);
  const explicit = project({ video_url: [source] }, { ...state.form, durationSec: 3, durationOption: 3 });
  assert.equal(generate(explicit).durationSec, 3);
  assert.equal(explicit.facts.effectiveDurationSec, 3);
  assert.equal(coerceFormState(engine, 'v2v', explicit.form).durationOption, 3);
  assert.equal(coerceFormState(engine, 'v2v', state.form).durationOption, 'auto');
  const createForm = coerceFormState(engine, 't2v', { ...state.form, durationSec: 5.25 });
  assert.notEqual(createForm.durationOption, 'auto');
  assert.equal(Number.isInteger(createForm.durationSec), true);
});

test('new Flash Modify sources default to automatic timing without rounding or framing controls', () => {
  assert.deepEqual(getModifySourceDefaults(engine, 'v2v', source), { durationSec: 5.25, durationOption: 'auto', numFrames: null });
});

test('reusing an imported Flash Modify snapshot preserves omitted source timing through the workspace', () => {
  const snapshot = resolveVideoSettingsSnapshot({ schemaVersion: 1, surface: 'video', engineId: engine.id, inputMode: 'v2v', prompt: 'Relight @Video1',
    core: { durationSec: null, durationOption: null, resolution: '720p', aspectRatio: null },
    refs: { inputs: [{ assetId: source.assetId, slotId: 'video_url', kind: 'video', url: source.url, durationSec: 5.25, width: 1280, height: 720, size: 1234 }], elements: [] },
  }, { engines: [engine], engineMap: new Map([[engine.id, engine]]), createLocalId: prefix => prefix,
    createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }), createFallbackKlingElement: () => ({ id: 'subject', frontal: null, video: null, references: [] }),
  });
  const form = buildVideoSettingsFormState(snapshot);
  assert.equal(form.durationOption, 'auto');
  const state = project(snapshot.inputAssets ?? {}, form, snapshot.klingElements ?? []);
  assert.equal(state.facts.effectiveDurationSec, 5.25);
  const payload = generate(state);
  assert.equal(payload.durationSec, undefined);
  assert.equal(payload.durationOption, undefined);
});

test('Flash Modify validates one owned source, four extra videos and the exact shared twenty-second budget', () => {
  const validate = (inputAssets: Assets, klingElements: KlingElementState[] = []) => getWorkspaceKlingV4MediaError({ engineId: engine.id, mode: 'v2v', inputAssets, klingElements });
  assert.equal(validate({ video_url: [source], video_urls: [asset('reference', 'video_urls', 'video', 6.75)] }, [videoSubject('subject', 8)]), null);
  assert.match(validate({ video_url: [source], video_urls: [asset('reference', 'video_urls', 'video', 6.751)] }, [videoSubject('subject', 8)]) ?? '', /20/);
  for (const inputAssets of [{}, { video_url: [source, source] }, { video_url: [{ ...source, assetId: undefined }] }, { video_url: [{ ...source, kind: 'image' as const }] }, { video_url: [{ ...source, durationSec: 2.99 }] }]) assert.ok(validate(inputAssets));
  assert.ok(validate({ video_url: [asset('short-source', 'video_url', 'video', 3)], video_urls: Array(5).fill(asset('ref', 'video_urls', 'video', 3)) }));
  assert.equal(validate({ video_url: [asset('short-source', 'video_url', 'video', 3)], video_urls: Array(4).fill(asset('ref', 'video_urls', 'video', 3)) }), null);
  assert.ok(validate({ video_url: [source] }, [videoSubject('too-short', 2.9)]));
  assert.ok(validate({ video_url: [source] }, [videoSubject('too-long', 8.1)]));
});

test('Flash Modify includes the source and every subject view in its fifteen-original product limit', () => {
  const elements: KlingElementState[] = Array.from({ length: 7 }, (_, index) => ({ id: `subject-${index}`, frontal: asset(`front-${index}`, 'subject', 'image'), references: [asset(`view-${index}`, 'subject', 'image')], video: null }));
  assert.equal(getWorkspaceKlingV4MediaError({ engineId: engine.id, mode: 'v2v', inputAssets: { video_url: [source] }, klingElements: elements }), null);
  assert.match(getWorkspaceKlingV4MediaError({ engineId: engine.id, mode: 'v2v', inputAssets: { video_url: [source], image_urls: [asset('extra', 'image_urls', 'image')] }, klingElements: elements }) ?? '', /15/);
});

test('Flash Modify accepts inherited fractional timing but rejects explicit fractional or out-of-range durations', () => {
  const automatic = { ...coerceFormState(engine, 'v2v', null), durationSec: 5.25, durationOption: 'auto' };
  assert.equal(project({ video_url: [source] }, automatic).prepared.ok, true);
  for (const durationSec of [2, 3.5, 21]) {
    const form: FormState = { ...automatic, durationSec, durationOption: durationSec };
    assert.equal(project({ video_url: [source] }, form).prepared.ok, false);
  }
});

test('the Modify duration selector describes automatic timing as source duration and retains explicit options', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const choices: (string | number)[] = [];
  try {
    await act(async () => root.render(React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {},
      children: React.createElement(CoreSettingsBar, { engine, mode: 'v2v', caps: engine.modeCaps?.v2v, density: 'workspace',
        durationSec: 5.25, durationOption: 'auto', durationAutoLabel: 'Source duration', onDurationChange: value => choices.push(value),
        resolution: '720p', onResolutionChange() {}, aspectRatio: 'source', onAspectRatioChange() {}, fps: 24, onFpsChange() {},
      }),
    })));
    assert.match(dom.window.document.body.textContent ?? '', /Source duration/);
    const control = dom.window.document.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]')!;
    await act(async () => control.click());
    const options = [...dom.window.document.querySelectorAll<HTMLElement>('[role="option"]')];
    assert.equal(options.length, 19);
    assert.match(options[0].textContent ?? '', /Source duration/);
    await act(async () => options[1].click());
    assert.deepEqual(choices, ['3']);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('Flash subject help distinguishes Create from Modify in English, French and Spanish without disabling video subjects', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    for (const { locale, createCount, modifyCount, sourceBudget, opening } of [
      { locale: 'en', createCount: /five reference videos/, modifyCount: /four additional reference videos/, sourceBudget: /source.*video subjects.*20.second total/i, opening: /opening image/i },
      { locale: 'fr', createCount: /cinq vidéos de référence/, modifyCount: /quatre vidéos de référence supplémentaires/, sourceBudget: /source.*sujets vidéo.*20 secondes/i, opening: /image initiale/i },
      { locale: 'es', createCount: /cinco vídeos de referencia/, modifyCount: /cuatro vídeos de referencia adicionales/, sourceBudget: /original.*sujetos de vídeo.*20 segundos/i, opening: /incluida la inicial/i },
    ] as const) {
      for (const variant of ['kling-v4-flash-reference', 'kling-v4-flash-edit'] as const) {
        await act(async () => root.render(React.createElement(I18nProvider, { locale, dictionary: {}, fallback: {},
          children: React.createElement(KlingElementsBuilder, { variant, elements: [{ id: 'subject', frontal: null, references: [null], video: null }],
            onAddElement() {}, onRemoveElement() {}, onAddAsset() {}, onRemoveAsset() {},
          }),
        })));
        const help = dom.window.document.querySelector('p')?.textContent ?? '';
        assert.match(help, variant === 'kling-v4-flash-reference' ? createCount : modifyCount);
        if (variant === 'kling-v4-flash-edit') {
          assert.match(help, sourceBudget);
          assert.doesNotMatch(help, opening);
          assert.doesNotMatch(help, createCount);
        }
        assert.equal(dom.window.document.querySelectorAll('input[accept="video/*"]:not([disabled])').length, 1);
        assert.equal(dom.window.document.querySelectorAll('input:not([type="file"])').length, 0, 'no voice input is offered');
      }
    }
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
