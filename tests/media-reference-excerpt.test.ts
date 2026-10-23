import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getMediaExcerptLimits, getMediaExcerptImportMode, mediaExcerptNeedsSelection } from '../frontend/lib/video-excerpt';
import { buildComposerModeToggles } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
const engine = (id: string) => { const e = listFalEngines().find(entry => entry.id === id)?.engine; assert.ok(e); return e; };

test('Wan Create retains image/video/audio references and its ref2v links without a redundant mode tab', () => {
  for (const id of ['wan-3', 'wan-3-prime']) {
    const e = engine(id);
    const toggles = buildComposerModeToggles({ selectedEngine: e, audioWorkflowLocked: false, uiLocale: 'fr',
      workflowCopy: { generateVideo: 'Créer une vidéo', removeAudioToUnlock: '', audioUnsupported: '', audioLocked: '', audioLockedFallback: '' } });
    assert.deepEqual(toggles?.map(toggle => toggle.mode), [null, 'v2v', 'extend']);
    const fields = summarizeWorkspaceInputSchema({ selectedEngine: e, activeMode: 't2v', allowsUnifiedVeoFirstLast: false,
      isUnifiedHappyHorse: false, isUnifiedSeedance: false, isUnifiedGeminiOmni: false, uiLocale: 'fr' }).assetFields;
    for (const field of ['start_image_url', 'end_image_url', 'reference_image_urls', 'reference_video_urls', 'reference_audio_urls'])
      assert.ok(fields.some(entry => entry.field.id === field), `${id} keeps ${field} in Create`);
    const video = { id: 'ref', kind: 'video' as const, name: 'ref.mp4', type: 'video/mp4', size: 1, previewUrl: '/ref', durationSec: 5 };
    const result = resolveWorkspaceWorkflow({ engine: e, form: { engineId: id, mode: 'ref2v', extraInputValues: {} } as never,
      inputAssets: { reference_video_urls: [video] }, klingElements: [] });
    assert.equal(result.submissionMode, 'ref2v');
    assert.equal(result.activeManualMode, null, 'Create stays selected for restored reference generation');
  }
});

test('reference preparation uses each real field, never a different source or output duration', () => {
  for (const id of ['wan-3', 'wan-3-prime', 'seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini', 'seedance-2-5']) {
    const e = engine(id);
    const videoId = id.startsWith('wan') ? 'reference_video_urls' : 'video_urls';
    const audioId = id.startsWith('wan') ? 'reference_audio_urls' : 'audio_urls';
    for (const fieldId of [videoId, audioId]) {
      const limits = getMediaExcerptLimits(e, 'ref2v', fieldId);
      assert.ok(limits, `${id}:${fieldId}`);
      assert.equal(limits.sourceFieldId, fieldId);
      const field = [...(e.inputSchema?.required ?? []), ...(e.inputSchema?.optional ?? [])].find(field => field.id === fieldId)!;
      if (field.maxDurationSec) assert.equal(limits.maxDurationSec, field.maxDurationSec);
      assert.equal(mediaExcerptNeedsSelection(e, 'ref2v', { [fieldId]: [{ excerptEditing: true }] }), true);
      if (limits.maxDurationSec) assert.equal(mediaExcerptNeedsSelection(e, 'ref2v', { [fieldId]: [{ durationSec: limits.maxDurationSec + 1 }] }), true);
    }
  }
  const wan = engine('wan-3');
  assert.equal(getMediaExcerptImportMode(wan, 't2v', 'reference_video_urls'), 'ref2v');
  assert.equal(getMediaExcerptImportMode(wan, 't2v', 'reference_audio_urls'), 'ref2v');
  assert.equal(getMediaExcerptImportMode(wan, 'v2v', 'reference_video_urls'), null);
  assert.equal(getMediaExcerptLimits(wan, 'v2v', 'reference_video_urls'), null, 'Modify cannot borrow a Create reference slot');
  assert.equal(getMediaExcerptLimits(wan, 'ref2v', 'start_image_url'), null);
  assert.equal(getMediaExcerptLimits(wan, 'ref2v', 'invented'), null);
  assert.equal(getMediaExcerptLimits({ ...wan, modeAvailability: { ref2v: { available: false } } }, 'ref2v', 'reference_video_urls'), null);
});

test('audio upload relaxation is explicit, bounded and does not change generation limits', async () => {
  const { resolveAudioUploadConstraint } = await import('../frontend/app/api/uploads/audio/_lib/audio-upload-handler');
  const form = new FormData();
  form.set('engineId', 'wan-3'); form.set('mode', 'ref2v'); form.set('fieldId', 'reference_audio_urls');
  const normal = resolveAudioUploadConstraint(form); assert.ok(normal.ok); assert.equal(normal.maxDurationSec, 15);
  form.set('prepareExcerpt', '1');
  const preparation = resolveAudioUploadConstraint(form); assert.ok(preparation.ok); assert.equal(preparation.maxDurationSec, 180);
  assert.deepEqual(preparation.constraint, normal.constraint, 'byte and format limits stay intact');
  assert.equal(getMediaExcerptLimits(engine('wan-3'), 'ref2v', 'reference_audio_urls')?.maxDurationSec, 15);
  form.set('fieldId', 'reference_video_urls'); assert.equal(resolveAudioUploadConstraint(form).ok, false);
});
