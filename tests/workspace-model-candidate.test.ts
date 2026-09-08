import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { prepareWorkspaceModelCandidate, type WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';

function engine(id: string) {
  const found = listFalEngines().find((entry) => entry.id === id)?.engine;
  assert.ok(found, id);
  return found;
}
function setup(id: string, patch: Partial<WorkspaceModelSetup> = {}): WorkspaceModelSetup {
  return { form: coerceFormState(engine(id), 't2v', null), inputAssets: {}, klingElements: [],
    prompt: 'A cinematic scene', negativePrompt: '', multiPromptEnabled: false, multiPromptScenes: [],
    shotType: 'customize', voiceIdsInput: '', cfgScale: null, ...patch };
}
function asset(fieldId: string, kind: ReferenceAsset['kind'], id = fieldId, durationSec?: number): ReferenceAsset {
  return { id, fieldId, kind, name: id, type: `${kind}/test`, size: 1, status: 'ready', assetId: id,
    url: `https://example.com/original/${id}`, previewUrl: `blob:preview-${id}`, durationSec };
}

test('candidate adapts a real duration without changing or revoking the original setup', () => {
  const current = setup('seedance-2-0');
  current.form.durationSec = 15; current.form.durationOption = 15;
  current.inputAssets.audio_urls = [asset('audio_urls', 'audio')];
  const before = structuredClone(current);
  let revoked = false;
  const originalRevoke = URL.revokeObjectURL;
  URL.revokeObjectURL = () => { revoked = true; };
  try {
    const candidate = prepareWorkspaceModelCandidate({ engine: engine('veo-3-1'), current, locale: 'en' });
    assert.deepEqual(current, before);
    assert.equal(revoked, false);
    assert.equal(candidate.setup.form.engineId, 'veo-3-1');
    assert.equal(candidate.effectiveDurationSec, 8);
    assert.equal(candidate.comparable, false);
    assert.equal(candidate.removedReferences[0].asset.url, before.inputAssets.audio_urls[0]!.url);
    assert.ok(candidate.changes.some((change) => change.field === 'effectiveDurationSec' && change.before === 15 && change.after === 8));
    candidate.setup.form.extraInputValues.newValue = 'changed';
    assert.deepEqual(current, before);
  } finally { URL.revokeObjectURL = originalRevoke; }
});

test('candidate does not guess equivalent roles or rename start/end fields between real schemas', () => {
  const current = setup('flux-3', { inputAssets: { start_image_url: [asset('start_image_url', 'image')], end_image_url: [asset('end_image_url', 'image')] } });
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('veo-3-1'), current, locale: 'fr' });
  assert.equal(candidate.removedReferences.length, 2);
  assert.deepEqual(candidate.keptReferences, []);
  assert.equal(candidate.setup.inputAssets.image_url, undefined);
  assert.equal(candidate.setup.inputAssets.last_frame_url, undefined);
  assert.equal(candidate.comparable, false);
});

test('candidate keeps same-role source identity and derives duration from the retained video', () => {
  const current = setup('kling-o3-standard', { inputAssets: { video_url: [asset('video_url', 'video', 'source', 7.2)] } });
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('kling-o3-pro'), current, locale: 'en' });
  assert.equal(candidate.workflow.submissionMode, 'v2v');
  assert.equal(candidate.setup.form.mode, 'v2v');
  assert.equal(candidate.effectiveDurationSec, 8);
  assert.equal(candidate.keptReferences[0].asset.assetId, 'source');
  assert.equal(candidate.removedReferences.length, 0);
  assert.notEqual(candidate.setup.inputAssets.video_url[0], current.inputAssets.video_url[0]);
});

test('candidate enforces per-field capacity even without aggregate reference budget', () => {
  const current = setup('seedance-2-5', { inputAssets: { image_urls: Array.from({ length: 12 }, (_, index) => asset('image_urls', 'image', `ref-${index}`)) } });
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('veo-3-1'), current: { ...current, form: { ...current.form, mode: 'ref2v' } }, locale: 'en' });
  assert.equal(candidate.keptReferences.length, 3);
  assert.equal(candidate.removedReferences.length, 9);
  assert.equal(current.inputAssets.image_urls.length, 12);
  assert.equal(candidate.comparable, false);
});

test('candidate drops wrong-kind media instead of treating video as a frame', () => {
  const current = setup('veo-3-1', { inputAssets: { image_url: [asset('image_url', 'video')] } });
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('veo-3-1'), current, locale: 'en' });
  assert.equal(candidate.keptReferences.length, 0);
  assert.equal(candidate.removedReferences.length, 1);
  assert.equal(candidate.workflow.submissionMode, 't2v');
});

test('candidate reports long prompts and uploading originals without truncation or invented media', () => {
  const current = setup('seedance-2-0', { prompt: 'x'.repeat(100_000), inputAssets: { audio_urls: [{ ...asset('audio_urls', 'audio'), status: 'uploading' }] } });
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('minimax-h3'), current, locale: 'en' });
  assert.equal(candidate.setup.prompt, current.prompt);
  assert.ok(candidate.blockingReasons.some((reason) => reason.code === 'prompt-too-long'), JSON.stringify({ limit: engine('minimax-h3').inputLimits.promptMaxChars, reasons: candidate.blockingReasons }));
  assert.ok(candidate.blockingReasons.some((reason) => reason.code === 'uploading-reference' && reason.scope === 'apply'));
  assert.equal(candidate.applicable, false);
});

test('candidate reports inactive multiprompt, voice, extra settings and preserves subject originals', () => {
  const current = setup('kling-o3-pro', { multiPromptEnabled: true, multiPromptScenes: [{ id: 'scene', prompt: 'Scene one', duration: 5 }],
    voiceIdsInput: 'voice-a', shotType: 'intelligent',
    klingElements: [{ id: 'subject', frontal: asset('frontal', 'image'), references: [asset('reference', 'image')], video: null }],
  });
  current.form.extraInputValues = { orphanedSetting: ['a', 'b'] };
  const before = structuredClone(current);
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('veo-3-1'), current, locale: 'en' });
  assert.equal(candidate.setup.multiPromptEnabled, false);
  assert.deepEqual(candidate.setup.klingElements, []);
  assert.equal(candidate.removedReferences.filter((reference) => reference.elementId === 'subject').length, 2);
  assert.ok(candidate.changes.some((change) => change.field === 'multiPromptEnabled'));
  assert.ok(candidate.changes.some((change) => change.field === 'extraInputValues.orphanedSetting'));
  assert.deepEqual(current, before);
});

test('candidate compares identical effective conditions and preserves Omni context on same-model preparation', () => {
  const current = setup('veo-3-1');
  const same = prepareWorkspaceModelCandidate({ engine: engine('veo-3-1'), current, locale: 'en' });
  assert.equal(same.comparable, true, JSON.stringify({ changes: same.changes, reasons: same.blockingReasons }));
  const omni = setup('gemini-omni-flash');
  omni.form.extraInputValues.previous_interaction_id = 'private-context';
  const next = prepareWorkspaceModelCandidate({ engine: engine('gemini-omni-flash'), current: omni, locale: 'en' });
  assert.equal(next.workflow.submissionMode, 'retake');
  assert.equal(next.setup.form.extraInputValues.previous_interaction_id, 'private-context');
});

test('candidate respects the real MiniMax aggregate budget without touching discarded originals', () => {
  const current = setup('minimax-h3', { inputAssets: {
    reference_image_urls: Array.from({ length: 9 }, (_, index) => asset('reference_image_urls', 'image', `image-${index}`)),
    reference_video_urls: Array.from({ length: 3 }, (_, index) => asset('reference_video_urls', 'video', `video-${index}`, 3)),
    reference_audio_urls: Array.from({ length: 3 }, (_, index) => asset('reference_audio_urls', 'audio', `audio-${index}`, 3)),
  } });
  const before = structuredClone(current);
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('minimax-h3'), current, locale: 'en' });
  assert.equal(candidate.keptReferences.length, 12);
  assert.equal(candidate.removedReferences.length, 3);
  assert.deepEqual(current, before);
});

test('candidate allows configuration-only manual retake when the required source is missing', () => {
  const current = setup('ltx-2-3');
  current.form.mode = 'retake';
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('ltx-2-3'), current, locale: 'en' });
  assert.equal(candidate.workflow.submissionMode, 'retake');
  assert.equal(candidate.applicable, true);
  assert.ok(candidate.blockingReasons.some(({ scope, code }) => scope === 'generation' && code === 'missing-input'));
  assert.deepEqual(candidate.setup.inputAssets, {});
});

test('candidate retains the existing Kling 4K source-video prohibition before reconciliation', () => {
  const current = setup('kling-o3-pro', { inputAssets: { video_url: [asset('video_url', 'video', 'source', 7.2)] } });
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('kling-o3-4k'), current, locale: 'en' });
  assert.equal(candidate.applicable, false);
  assert.ok(candidate.blockingReasons.some(({ code, scope }) => code === 'unsupported-workflow' && scope === 'apply'));
});

test('candidate identifies subject references that become inactive even within the Kling control family', () => {
  const current = setup('kling-o3-pro', { klingElements: [{ id: 'subject', frontal: asset('frontal', 'image'), references: [asset('reference', 'image')], video: null }] });
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('kling-3-pro'), current, locale: 'en' });
  assert.equal(candidate.workflow.submissionMode, 't2v');
  assert.ok(candidate.changes.some(({ field, reason }) => field === 'klingElements' && reason === 'inactive'));
  assert.equal(candidate.comparable, false);
});

test('candidate coerces all requested scalar settings through the real target capabilities', () => {
  const current = setup('seedance-2-0');
  current.form = { ...current.form, durationSec: 15, durationOption: 15, resolution: '480p', aspectRatio: '1:1', fps: 60, iterations: 8, audio: false, loop: true };
  const candidate = prepareWorkspaceModelCandidate({ engine: engine('veo-3-1'), current, locale: 'es' });
  assert.equal(candidate.setup.form.durationSec, 8);
  assert.equal(candidate.setup.form.resolution, '720p');
  assert.equal(candidate.setup.form.aspectRatio, '16:9');
  assert.equal(candidate.setup.form.fps, 24);
  assert.equal(candidate.setup.form.iterations, 4);
  assert.equal(candidate.setup.form.audio, true);
  assert.equal(candidate.setup.form.loop, undefined);
  for (const field of ['durationSec', 'resolution', 'aspectRatio', 'fps', 'iterations', 'audio', 'loop']) assert.ok(candidate.changes.some((change) => change.field === field), field);
  assert.equal(candidate.comparable, false);
});

test('candidate stabilizes the actual video catalogue without modifying the source draft', () => {
  const current = setup('veo-3-1');
  const before = structuredClone(current);
  const videoEngines = listFalEngines().filter((entry) => (entry.category ?? 'video') === 'video');
  assert.ok(videoEngines.length > 20);
  for (const { engine: target } of videoEngines) {
    const candidate = prepareWorkspaceModelCandidate({ engine: target, current, locale: 'en' });
    assert.equal(candidate.setup.form.engineId, target.id);
    assert.ok(target.modes.includes(candidate.workflow.submissionMode), target.id);
    assert.ok(Number.isFinite(candidate.effectiveDurationSec) && candidate.effectiveDurationSec > 0, target.id);
    assert.equal(candidate.blockingReasons.some(({ code }) => code === 'not-stable'), false, target.id);
    assert.deepEqual(current, before, target.id);
  }
});

test('saved recovery uses its own schema and settings but compares against the live draft', () => {
 const current = setup('veo-3-1'); current.form.audio = true;
 const saved = setup('seedance-2-0', {inputAssets:{image_url:[asset('image_url','image','saved-frame')]}, prompt:'Saved prompt'});
 saved.form.durationSec = 10; saved.form.durationOption = 10; saved.form.audio = false;
 const candidate = prepareWorkspaceModelCandidate({engine:engine('seedance-2-0'),current,restoreSetup:saved,locale:'en'});
 assert.equal(candidate.setup.form.durationSec,10); assert.equal(candidate.setup.form.audio,false);
 assert.equal(candidate.keptReferences[0].asset.id,'saved-frame'); assert.equal(candidate.setup.prompt,'Saved prompt');
 assert.equal(candidate.comparable,false); assert.ok(candidate.changes.some(c=>c.field==='audio' && c.before===true && c.after===false));
 assert.ok(candidate.changes.some(c=>c.field==='prompt' && c.before===current.prompt));
});

test('saved recovery blocks reference loss under a changed or unknown schema role', () => {
  const current = setup('veo-3-1');
  const saved = setup('seedance-2-0', {inputAssets:{retired_reference_role:[asset('retired_reference_role','image','original')]}});
  const before = structuredClone(saved);
  const candidate = prepareWorkspaceModelCandidate({engine:engine('seedance-2-0'),current,restoreSetup:saved,locale:'en'});
  assert.equal(candidate.applicable,false);
  assert.ok(candidate.blockingReasons.some(reason=>reason.code==='invalid-reference' && reason.scope==='apply'));
  assert.deepEqual(saved,before);
});

test('review presentation groups duplicate durations and labels real frame roles without changing candidate facts', async () => {
  const {describeWorkspaceModelReferences,workspaceModelReviewChangeRows}=await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-model-review-presentation');
  const current=setup('seedance-2-5',{inputAssets:{image_url:[asset('image_url','image','start')],end_image_url:[asset('end_image_url','image','end')]}});
  current.form.durationSec=6;current.form.durationOption=6;current.form.resolution='480p';
  const candidate=prepareWorkspaceModelCandidate({engine:engine('veo-3-1'),current,locale:'fr'});
  // Presentation accepts the observed live-catalogue adaptations, independently of static fixture durations.
  candidate.changes.push(...(['effectiveDurationSec','durationSec','durationOption'] as const).map(field=>({field,before:6,after:4,reason:'adapted' as const})));
  const before=structuredClone(candidate.changes);
  const rows=workspaceModelReviewChangeRows(candidate,engine('seedance-2-5'),engine('veo-3-1'),'fr');
  assert.equal(rows.filter(row=>row.before==='6s'&&row.after==='4s').length,1,JSON.stringify(rows));
  const references=describeWorkspaceModelReferences(current,engine('seedance-2-5'),'fr');
  assert.equal(references.find(row=>row.fieldId==='end_image_url')?.label,'Image de fin');
  assert.equal(references.find(row=>row.fieldId==='image_url')?.label,'Image de début');
  assert.deepEqual(candidate.changes,before);
});
