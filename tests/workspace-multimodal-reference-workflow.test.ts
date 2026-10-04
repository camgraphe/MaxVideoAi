import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { resolveWorkspaceComposerFacts, resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { getWorkspaceReferenceFields } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-reference-fields';
import { reconcileReferenceAssets, type ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import type { Mode } from '../frontend/types/engines';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import { getGenerationIterationGuardMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-guards';

const ids = ['wan-3', 'wan-3-prime', 'minimax-h3', 'minimax-h3-max'];
function asset(fieldId: string, kind: ReferenceAsset['kind']): ReferenceAsset {
  return { id: fieldId, fieldId, kind, name: fieldId, size: 1, type: `${kind}/test`,
    url: `https://example.com/${fieldId}`, previewUrl: `https://example.com/${fieldId}`, status: 'ready' };
}
function project(id: string, inputAssets: Record<string, (ReferenceAsset | null)[]> = {}, mode: Mode = 't2v') {
  const engine = listFalEngines().find((entry) => entry.id === id)?.engine;
  assert.ok(engine, id);
  const workflow = resolveWorkspaceWorkflow({ engine, form: coerceFormState(engine, mode, null), inputAssets, klingElements: [] });
  const summary = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: workflow.activeMode,
    allowsUnifiedVeoFirstLast: workflow.allowsUnifiedVeoFirstLast, isUnifiedHappyHorse: workflow.isUnifiedHappyHorse,
    isUnifiedSeedance: workflow.isUnifiedSeedance, isUnifiedGeminiOmni: workflow.isUnifiedGeminiOmni, uiLocale: 'en' });
  const fields = getWorkspaceReferenceFields(summary.assetFields, { inputAssets, isUnifiedSeedance: workflow.isUnifiedSeedance,
    isUnifiedKlingO3: false, klingO3VideoToVideoSupported: false, hasAnyVideoInput: workflow.referenceInputStatus.hasVideo,
    guestUploadLockedReason: null, workflowCopy: { clearReferencesToUseStartEnd: 'clear references', clearStartEndToUseReferences: 'clear frames' },
    showOmniStudioPanel: false, showLumaRay32KeyframeEditor: false });
  return { engine, workflow, summary, fields };
}

for (const id of ids) {
  test(`${id}: reference entry is available from an empty composer and manual reference mode remains selected`, () => {
    const initial = project(id);
    const visible = initial.fields.filter((entry) => !entry.disabled).map(({ field }) => field.id);
    for (const fieldId of ['reference_image_urls', 'reference_video_urls', 'reference_audio_urls']) {
      assert.ok(visible.includes(fieldId), `${fieldId} can be selected before the first upload`);
    }
    assert.equal(project(id, {}, 'ref2v').workflow.activeMode, 'ref2v');
    assert.ok(initial.fields.every((entry) => !entry.required));
  });

  test(`${id}: image and audio references select ref2v and survive schema reconciliation`, () => {
    const inputAssets = { reference_image_urls: [asset('reference_image_urls', 'image')], reference_audio_urls: [asset('reference_audio_urls', 'audio')] };
    const result = project(id, inputAssets);
    assert.equal(result.workflow.submissionMode, 'ref2v');
    assert.equal(result.workflow.audioWorkflowUnsupported, false);
    assert.equal(result.workflow.audioWorkflowLocked, false);
    assert.deepEqual(reconcileReferenceAssets(inputAssets, result.summary.assetFields.map(({ field }) => field), null), inputAssets);
    const frames = result.fields.filter(({ field }) => ['image_url', 'start_image_url', 'end_image_url'].includes(field.id));
    assert.ok(frames.length >= 2);
    assert.ok(frames.every((entry) => entry.disabled));
    assert.ok(result.fields.filter(({ field }) => ['reference_image_urls', 'reference_audio_urls'].includes(field.id)).every((entry) => !entry.disabled));
  });

  test(`${id}: image mode keeps the reference choices visible but blocks incompatible additions`, () => {
    const frameId = id.startsWith('wan-') ? 'start_image_url' : 'image_url';
    const inputAssets = { [frameId]: [asset(frameId, 'image')] };
    const result = project(id, inputAssets);
    assert.equal(result.workflow.submissionMode, 'i2v');
    for (const fieldId of ['reference_image_urls', 'reference_video_urls', 'reference_audio_urls']) {
      assert.equal(result.fields.find(({ field }) => field.id === fieldId)?.disabled, true, fieldId);
    }
    assert.deepEqual(reconcileReferenceAssets(inputAssets, result.summary.assetFields.map(({ field }) => field), null), inputAssets);
    assert.equal(result.fields.find(({ field }) => field.id === 'end_image_url')?.disabled, false);
  });

  test(`${id}: audio reference alone selects reference mode, never audio-to-video`, () => {
    const result = project(id, { reference_audio_urls: [asset('reference_audio_urls', 'audio')] });
    assert.equal(result.workflow.submissionMode, 'ref2v');
    assert.equal(result.workflow.audioWorkflowUnsupported, false);
  });
}

for (const id of ['wan-3', 'wan-3-prime']) {
  for (const mode of ['v2v', 'extend'] as const) {
    test(`${id}: ${mode} preserves its source and accepts optional image/audio references`, () => {
      const inputAssets = { video_url: [asset('video_url', 'video')], reference_image_urls: [asset('reference_image_urls', 'image')], reference_audio_urls: [asset('reference_audio_urls', 'audio')] };
      const result = project(id, inputAssets, mode);
      assert.equal(result.workflow.activeManualMode, mode);
      assert.equal(result.workflow.submissionMode, mode);
      assert.equal(result.workflow.audioWorkflowUnsupported, false);
      for (const fieldId of ['video_url', 'reference_image_urls', 'reference_audio_urls']) {
        assert.equal(result.fields.find(({ field }) => field.id === fieldId)?.disabled, false, fieldId);
      }
      assert.equal(result.fields.find(({ field }) => field.id === 'reference_video_urls')?.disabled, true);
      assert.deepEqual(reconcileReferenceAssets(inputAssets, result.summary.assetFields.map(({ field }) => field), null), inputAssets);
    });
  }
}

test('H3 Max: a target soundtrack stays in text/image mode, independent of audio references', () => {
  const inputAssets = { target_audio_url: [asset('target_audio_url', 'audio')] };
  const text = project('minimax-h3-max', inputAssets);
  assert.equal(text.workflow.submissionMode, 't2v');
  assert.equal(text.workflow.audioWorkflowUnsupported, false);
  assert.equal(text.fields.find(({ field }) => field.id === 'target_audio_url')?.disabled, false);
  assert.deepEqual(reconcileReferenceAssets(inputAssets, text.summary.assetFields.map(({ field }) => field), null), inputAssets);
  const image = project('minimax-h3-max', { ...inputAssets, end_image_url: [asset('end_image_url', 'image')] });
  assert.equal(image.workflow.submissionMode, 'i2v');
  assert.equal(image.workflow.audioWorkflowUnsupported, false);
  assert.equal(image.fields.find(({ field }) => field.id === 'image_url')?.required, false);
});

test('unsupported audio slots still trigger the guard instead of gaining a family exemption', () => {
  for (const id of ids) {
    assert.equal(project(id, { unsupported_audio: [asset('unsupported_audio', 'audio')] }).workflow.audioWorkflowUnsupported, true, id);
  }
});

function generationGuard(id: string, inputAssets: Record<string, (ReferenceAsset | null)[]>, mode: Mode = 't2v', extraInputValues: Record<string, unknown> = {}) {
  const { engine, workflow, summary } = project(id, inputAssets, mode);
  const fieldsWithRole = (role: string) => new Set(summary.assetFields.filter((entry) => entry.role === role).map(({ field }) => field.id));
  const form = { ...coerceFormState(engine, workflow.submissionMode, null), extraInputValues };
  const prepared = prepareGenerationInputs({ selectedEngineId: id, ...workflow, form,
    inputSchema: engine.inputSchema, inputSchemaSummary: summary, extraInputFields: summary.secondaryFields, inputAssets,
    primaryAssetFieldIds: fieldsWithRole('primary'), referenceAssetFieldIds: fieldsWithRole('reference'),
    genericImageFieldIds: new Set(), frameAssetFieldIds: fieldsWithRole('frame'),
    referenceAudioFieldIds: new Set(['reference_audio_urls']), klingElements: [], multiPromptActive: false, multiPromptScenes: [] });
  if (!prepared.ok) return prepared.message;
  return getGenerationIterationGuardMessage({ selectedEngineId: id, inputSchema: engine.inputSchema, ...workflow, ...prepared,
    primaryAssetFieldLabel: 'Start image', extendOrRetakeSourceVideoMessage: 'Add a source video' });
}

for (const id of ids) {
  test(`${id}: generation accepts video-only and audio-only references while refusing an empty reference request`, () => {
    assert.equal(generationGuard(id, { reference_video_urls: [asset('reference_video_urls', 'video')] }), null);
    assert.equal(generationGuard(id, { reference_audio_urls: [asset('reference_audio_urls', 'audio')] }), null);
    assert.ok(generationGuard(id, {}, 'ref2v'));
  });

  test(`${id}: stored incompatible frames and references are rejected, never silently dropped`, () => {
    const fieldId = id.startsWith('wan-') ? 'start_image_url' : 'image_url';
    assert.match(generationGuard(id, { [fieldId]: [asset(fieldId, 'image')], reference_image_urls: [asset('reference_image_urls', 'image')] }) ?? '', /incompatible/i);
  });
}

for (const id of ['minimax-h3', 'minimax-h3-max']) {
  test(`${id}: generation accepts an end frame without an opening frame`, () => {
    assert.equal(generationGuard(id, { end_image_url: [asset('end_image_url', 'image')] }), null);
  });
}

test('Wan document/web references satisfy the authored reference requirement', () => {
  assert.equal(generationGuard('wan-3', {}, 'ref2v', { web_url: 'https://example.com/reference' }), null);
  assert.equal(generationGuard('wan-3-prime', {}, 'ref2v', { file_url: 'https://example.com/reference.pdf' }), null);
});

test('Wan edit quotes and submits the selected output duration independently of source length', () => {
  for (const id of ['wan-3', 'wan-3-prime']) {
    const { engine, workflow } = project(id, { video_url: [{ ...asset('video_url', 'video'), durationSec: 7.2 }] }, 'v2v');
    const form = { ...coerceFormState(engine, 'v2v', null), durationSec: 12, durationOption: 12 };
    const facts = resolveWorkspaceComposerFacts({ engine, form, workflow, prompt: 'Change the setting', multiPromptEnabled: false,
      multiPromptScenes: [], voiceIdsInput: '' });
    assert.equal(workflow.primaryVideoDurationSec, 8);
    assert.equal(facts.effectiveDurationSec, 12);
  }
});
