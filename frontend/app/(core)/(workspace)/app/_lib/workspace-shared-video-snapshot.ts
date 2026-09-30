import { publicExampleRequestedResolution, publicExampleResolution } from '@/lib/example-recreation';
import type { SharedVideoPreview } from '@/lib/video-preview-group';

export function buildVideoSettingsSnapshotFromSharedVideo(sharedVideo: SharedVideoPreview): unknown {
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
    inputMode: 't2v',
    prompt: sharedVideo.prompt ?? sharedVideo.promptExcerpt ?? '',
    negativePrompt: null,
    core: {
      durationSec,
      durationOption: null,
      numFrames: null,
      aspectRatio,
      resolution: sharedVideo.outputWidth && sharedVideo.outputHeight
        ? publicExampleResolution(sharedVideo.outputWidth, sharedVideo.outputHeight)
        : publicExampleRequestedResolution(sharedVideo.requestedResolution),
      fps: null,
      iterationCount: 1,
      audio: typeof sharedVideo.hasAudio === 'boolean' ? sharedVideo.hasAudio : null,
    },
    advanced: { cfgScale: null, loop: null },
    refs: { imageUrl: null, referenceImages: null, firstFrameUrl: null, lastFrameUrl: null, inputs: null },
    meta: { derived: true },
  };
}
