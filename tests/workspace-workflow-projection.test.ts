import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { useWorkspaceComposerState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState';
import { resolveWorkspaceWorkflow, resolveWorkspaceComposerFacts } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import type { KlingElementState } from '../frontend/components/KlingElementsBuilder';

function asset(fieldId: string, kind: ReferenceAsset['kind'], durationSec?: number): ReferenceAsset {
  return { id: fieldId, fieldId, kind, name: fieldId, type: `${kind}/test`, size: 1,
    url: `https://example.com/${fieldId}`, previewUrl: `https://example.com/${fieldId}`, status: 'ready', durationSec };
}
function live(id: string, inputAssets: Record<string, (ReferenceAsset | null)[]> = {}, patch: Partial<FormState> = {}, klingElements: KlingElementState[] = []) {
  const engine = listFalEngines().find((entry) => entry.id === id)?.engine;
  assert.ok(engine, id);
  const form: FormState = { engineId: id, mode: 't2v', durationSec: 5, resolution: '720p', aspectRatio: '16:9', fps: 24, iterations: 1, audio: true, extraInputValues: {}, ...patch };
  let result: ReturnType<typeof useWorkspaceComposerState> | undefined;
  function Harness() {
    result = useWorkspaceComposerState({ engines: [engine!], form, inputAssets, klingElements, setForm: () => {},
      prompt: 'A cinematic scene', multiPromptEnabled: false, setMultiPromptEnabled: () => {}, multiPromptScenes: [], setMultiPromptScenes: () => {},
      voiceIdsInput: '', shotType: 'customize', setShotType: () => {}, effectiveRequestedEngineToken: null,
      authChecked: true, hydratedForScope: 'test', storageScope: 'test', preserveStoredDraftRef: { current: false },
      requestedEngineOverrideIdRef: { current: null }, requestedEngineOverrideTokenRef: { current: null }, requestedModeOverrideRef: { current: null },
      writeStorage: () => {}, uiLocale: 'en', showNotice: () => {}, workflowCopy: {
        generateVideo: 'Generate', removeAudioToUnlock: 'Remove audio', audioUnsupported: 'Unsupported', audioLocked: 'Locked',
        audioLockedFallback: 'Locked', removeAudioToUseEdit: 'Remove audio',
      } });
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  assert.ok(result);
  const workflow = resolveWorkspaceWorkflow({ engine, form, inputAssets, klingElements });
  for (const field of ['activeMode', 'submissionMode', 'audioWorkflowUnsupported', 'activeManualMode', 'supportsAudioToggle'] as const) assert.deepEqual(workflow[field], result[field]);
  const facts = resolveWorkspaceComposerFacts({ engine, form, workflow, prompt: 'A cinematic scene', multiPromptEnabled: false, multiPromptScenes: [], voiceIdsInput: '' });
  assert.equal(facts.effectiveDurationSec, result.effectiveDurationSec);
  return result;
}

test('live Seedance distinguishes first/last images from mixed references and explicit extension', () => {
  const frames = live('seedance-2-0', { image_url: [asset('image_url', 'image')], end_image_url: [asset('end_image_url', 'image')] });
  assert.equal(frames.activeMode, 'i2v');
  assert.equal(frames.submissionMode, 'i2v');
  const mixed = live('seedance-2-0', { image_urls: [asset('image_urls', 'image')], audio_urls: [asset('audio_urls', 'audio', 9)] });
  assert.equal(mixed.submissionMode, 'ref2v');
  assert.equal(mixed.audioWorkflowUnsupported, false);
  const extend = live('seedance-2-5', { extension_source_videos: [asset('extension_source_videos', 'video', 11.2)] }, { mode: 'extend' });
  assert.equal(extend.activeManualMode, 'extend');
  assert.equal(extend.submissionMode, 'extend');
  assert.equal(extend.effectiveDurationSec, 5);
});

test('live MiniMax H3 reference audio uses reference mode without the unsupported-audio guard', () => {
  const result = live('minimax-h3', { reference_audio_urls: [asset('reference_audio_urls', 'audio', 10.4)] });
  assert.equal(result.activeMode, 'ref2v');
  assert.equal(result.audioWorkflowUnsupported, false);
  assert.equal(result.effectiveDurationSec, 5);
});

test('live Veo first/last promotion preserves implicit i2v and submits fl2v', () => {
  const result = live('veo-3-1', { image_url: [asset('image_url', 'image')], last_frame_url: [asset('last_frame_url', 'image')] });
  assert.equal(result.activeManualMode, null);
  assert.equal(result.activeMode, 'i2v');
  assert.equal(result.allowsUnifiedVeoFirstLast, true);
  assert.equal(result.submissionMode, 'fl2v');
});

test('live Kling O3 subjects choose reference mode and video sources control effective duration', () => {
  const subject = { id: 'subject', frontal: asset('frontal', 'image'), references: [], video: null } as KlingElementState;
  assert.equal(live('kling-o3-pro', {}, {}, [subject]).submissionMode, 'ref2v');
  const source = live('kling-o3-pro', { video_url: [asset('video_url', 'video', 7.2)] });
  assert.equal(source.submissionMode, 'v2v');
  assert.equal(source.effectiveDurationSec, 8);
  assert.ok(live('kling-o3-4k', { video_url: [asset('video_url', 'video', 7.2)] }).klingO3UnsupportedVideoReason);
});

test('live LTX preserves manual retake and derives a2v duration from rounded source audio', () => {
  const retake = live('ltx-2-3', { video_url: [asset('video_url', 'video', 9.1)] }, { mode: 'retake' });
  assert.equal(retake.activeManualMode, 'retake');
  assert.equal(retake.submissionMode, 'retake');
  assert.equal(retake.effectiveDurationSec, 5);
  const audio = live('ltx-2-3', { audio_url: [asset('audio_url', 'audio', 9.1)] });
  assert.equal(audio.submissionMode, 'a2v');
  assert.equal(audio.audioWorkflowLocked, true);
  assert.equal(audio.effectiveDurationSec, 9);
});

test('live Omni private interaction selects retake while source video takes priority', () => {
  const patch = { extraInputValues: { previous_interaction_id: 'private-context' } };
  assert.equal(live('gemini-omni-flash', {}, patch).submissionMode, 'retake');
  const result = live('gemini-omni-flash', { video_url: [asset('video_url', 'video', 6.3)] }, patch);
  assert.equal(result.submissionMode, 'v2v');
  assert.equal(result.effectiveDurationSec, 7);
});

test('pure workflow retains the empty live hydration fallback', () => {
  const workflow = resolveWorkspaceWorkflow({ engine: null, form: null, inputAssets: {}, klingElements: [] });
  assert.equal(workflow.activeMode, 't2v');
  assert.equal(workflow.submissionMode, 't2v');
  assert.equal(workflow.capability, undefined);
  assert.equal(workflow.supportsAudioToggle, false);
  assert.equal(workflow.audioWorkflowUnsupported, false);
});

test('pure composer facts preserve current Kling multi-prompt and voice behavior', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'kling-3-pro')!.engine;
  const form: FormState = { engineId: engine.id, mode: 't2v', durationSec: 5, resolution: '720p', aspectRatio: '16:9', fps: 24, iterations: 1, audio: true, extraInputValues: {} };
  const workflow = resolveWorkspaceWorkflow({ engine, form, inputAssets: {}, klingElements: [] });
  const facts = resolveWorkspaceComposerFacts({ engine, form, workflow, prompt: 'Original', multiPromptEnabled: true,
    multiPromptScenes: [{ id: 'one', prompt: 'First scene', duration: 3 }, { id: 'two', prompt: 'Second scene', duration: 4 }], voiceIdsInput: ' voice-a, voice-b ' });
  assert.equal(facts.multiPromptActive, true);
  assert.equal(facts.effectiveDurationSec, 7);
  assert.equal(facts.multiPromptInvalid, false);
  assert.equal(facts.voiceControlEnabled, false);
  assert.deepEqual(facts.voiceIds, ['voice-a', 'voice-b']);
  const turbo = listFalEngines().find((entry) => entry.id === 'kling-3-turbo-pro')!.engine;
  const turboWorkflow = resolveWorkspaceWorkflow({ engine: turbo, form: { ...form, engineId: turbo.id }, inputAssets: {}, klingElements: [] });
  assert.equal(turboWorkflow.supportsKlingV3Controls, false, 'schema multi-prompt availability must not expand existing family controls');
});
