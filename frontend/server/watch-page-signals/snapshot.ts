import type { GalleryVideo } from '@/server/videos';
import { asArray, asBoolean, asNumber, asRecord, asString } from './normalization';
import type { ParsedSnapshot } from './types';

export function parseSnapshot(video: GalleryVideo): ParsedSnapshot {
  const raw = asRecord(video.settingsSnapshot);
  const core = asRecord(raw?.core);
  const advanced = asRecord(raw?.advanced);
  const refs = asRecord(raw?.refs);
  const prompt = asString(raw?.prompt) ?? video.prompt ?? '';

  return {
    surface: asString(raw?.surface) ?? 'video',
    engineId: asString(raw?.engineId) ?? video.engineId ?? null,
    engineLabel: asString(raw?.engineLabel) ?? video.engineLabel ?? null,
    inputMode: asString(raw?.inputMode) ?? 't2v',
    prompt,
    negativePrompt: asString(raw?.negativePrompt),
    core: {
      durationSec: asNumber(core?.durationSec) ?? video.durationSec ?? null,
      aspectRatio: asString(core?.aspectRatio) ?? video.aspectRatio ?? null,
      resolution: asString(core?.resolution),
      fps: asNumber(core?.fps),
      iterationCount: asNumber(core?.iterationCount),
      audio: asBoolean(core?.audio),
    },
    advanced: {
      shotType: asString(advanced?.shotType),
      seed: asNumber(advanced?.seed),
      cameraFixed: asBoolean(advanced?.cameraFixed),
      multiPromptCount: asArray(advanced?.multiPrompt).filter((entry) => asRecord(entry)?.prompt).length,
      voiceIdsCount: asArray(advanced?.voiceIds).map(asString).filter(Boolean).length,
      voiceControl: Boolean(advanced?.voiceControl),
    },
    refs: {
      imageUrl: asString(refs?.imageUrl),
      audioUrl: asString(refs?.audioUrl),
      referenceImagesCount: asArray(refs?.referenceImages).map(asString).filter(Boolean).length,
      referenceVideosCount: asArray(refs?.videoUrls).map(asString).filter(Boolean).length,
      firstFrameUrl: asString(refs?.firstFrameUrl),
      lastFrameUrl: asString(refs?.lastFrameUrl),
      endImageUrl: asString(refs?.endImageUrl),
    },
  };
}
