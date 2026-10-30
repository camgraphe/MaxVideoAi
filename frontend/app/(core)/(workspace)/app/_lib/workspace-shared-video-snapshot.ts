import { publicExampleRequestedResolution, publicExampleResolution } from '@/lib/example-recreation';
import type { SharedVideoPreview } from '@/lib/video-preview-group';
import { buildPublicKeyframeSettingsSnapshot, parsePublicKeyframeRecipe } from '@/lib/public-keyframe-demo';

export function hasPublishedRecreationSnapshot(shared: SharedVideoPreview): boolean {
  const value = shared.recreationSnapshot as Record<string, unknown> | null;
  return Boolean(value && value.schemaVersion === 1 && value.surface === 'video' && value.engineId === shared.engineId && typeof value.prompt === 'string' && value.core && value.refs);
}

export function buildVideoSettingsSnapshotFromSharedVideo(sharedVideo: SharedVideoPreview): unknown {
  if (hasPublishedRecreationSnapshot(sharedVideo)) {
    // A published recipe transfers creative settings, never private provider lineage.
    // Personal job recall uses the authenticated job route and retains its own source binding.
    const record = sharedVideo.recreationSnapshot as unknown as Record<string, unknown>;
    const advanced = record.advanced && typeof record.advanced === 'object' ? record.advanced as Record<string, unknown> : {};
    const extra = advanced.extraInputValues && typeof advanced.extraInputValues === 'object'
      ? advanced.extraInputValues as Record<string, unknown> : {};
    const settings = { ...record }, reusable = { ...extra };
    delete settings.sourceJobId; delete settings.sourceOutputId;
    delete reusable.source_job_id; delete reusable.source_output_id;
    return { ...settings, advanced: { ...advanced, extraInputValues: reusable } };
  }
  const recipe = parsePublicKeyframeRecipe(sharedVideo.keyframeRecipe);
  if (recipe && recipe.jobId === sharedVideo.id && recipe.engineId === sharedVideo.engineId) {
    return buildPublicKeyframeSettingsSnapshot(recipe);
  }
  const durationSec =
    typeof sharedVideo.durationSec === 'number' && sharedVideo.durationSec > 0 ? sharedVideo.durationSec : null;
  const aspectRatio =
    typeof sharedVideo.aspectRatio === 'string' && sharedVideo.aspectRatio.trim().length
      ? sharedVideo.aspectRatio.trim()
      : '16:9';
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: sharedVideo.engineId,
    engineLabel: sharedVideo.engineLabel,
    inputMode: sharedVideo.generationMode ?? 't2v',
    ...(sharedVideo.operation ? { operation: sharedVideo.operation } : {}),
    prompt: sharedVideo.prompt ?? sharedVideo.promptExcerpt ?? '',
    negativePrompt: null,
    core: {
      durationSec,
      durationOption: null,
      numFrames: null,
      aspectRatio,
      // Reuse the recorded input resolution; dimensions remain measured output metadata.
      resolution: publicExampleRequestedResolution(sharedVideo.requestedResolution)
        ?? publicExampleResolution(sharedVideo.outputWidth, sharedVideo.outputHeight),
      fps: null,
      iterationCount: 1,
      audio: typeof sharedVideo.hasAudio === 'boolean' ? sharedVideo.hasAudio : null,
    },
    advanced: { cfgScale: null, loop: null },
    refs: { imageUrl: null, referenceImages: null, firstFrameUrl: null, lastFrameUrl: null, inputs: null },
    meta: { derived: true },
  };
}
