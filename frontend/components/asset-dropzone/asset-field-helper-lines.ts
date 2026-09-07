import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '@/types/engines';
import type { getLocalizedAssetDropzoneCopy } from '@/lib/ltx-localization';
import type { MediaFieldConstraint } from '@/lib/media-field-constraints';
import { formatAcceptedAudioExtensions } from './asset-dropzone-helpers';

/** Display-only format/size/duration guidance. Validation remains in AssetDropzone. */
export function buildAssetFieldHelperLines({ field, engine, caps, acceptFormats, minimumImageSidePx, mediaFieldConstraint, assetCopy }: {
  field: EngineInputField;
  engine: EngineCaps;
  caps?: EngineModeUiCaps;
  acceptFormats: string[];
  minimumImageSidePx: number | null;
  mediaFieldConstraint: MediaFieldConstraint;
  assetCopy: ReturnType<typeof getLocalizedAssetDropzoneCopy>;
}) {
  const constraints = engine.inputSchema?.constraints ?? {};
  const limits = engine.inputLimits;
  const lines: string[] = [];
  if (field.type === 'image') {
    if (acceptFormats.length) {
      lines.push(assetCopy.formats(acceptFormats.map((ext) => ext.toUpperCase()).join(', ')));
    } else {
      lines.push(assetCopy.formats('PNG, JPG, WebP'));
    }
    const maxImage = caps?.maxUploadMB ?? constraints.maxImageSizeMB ?? limits.imageMaxMB;
    if (maxImage) lines.push(assetCopy.mbMax(maxImage));
    if (minimumImageSidePx != null) lines.push(`${minimumImageSidePx} x ${minimumImageSidePx} px min`);
  } else if (field.type === 'video') {
    lines.push(assetCopy.formats('MP4, MOV'));
    const maxVideo = constraints.maxVideoSizeMB ?? limits.videoMaxMB;
    if (maxVideo) lines.push(assetCopy.mbMax(maxVideo));
    const maxVideoDuration = field.maxDurationSec ?? limits.videoMaxDurationSec;
    if (maxVideoDuration) lines.push(assetCopy.secondsMax(maxVideoDuration));
  } else {
    const audioFormats = formatAcceptedAudioExtensions(mediaFieldConstraint);
    lines.push(assetCopy.formats(audioFormats));
    const maxAudio = mediaFieldConstraint.maxSizeMB ?? limits.videoMaxMB;
    if (maxAudio) lines.push(assetCopy.mbMax(maxAudio));
    const minAudioDuration = field.minDurationSec;
    const maxAudioDuration = field.maxDurationSec ?? limits.audioMaxDurationSec;
    if (typeof minAudioDuration === 'number' && typeof maxAudioDuration === 'number') {
      lines.push(assetCopy.secondsRequired(minAudioDuration, maxAudioDuration));
    } else if (typeof maxAudioDuration === 'number') {
      lines.push(assetCopy.secondsMax(maxAudioDuration));
    }
    if (field.id === 'audio_url') {
      lines.push(assetCopy.videoLengthFollowsAudio);
    }
  }
  if (field.maxCount && field.maxCount > 1) {
    lines.push(assetCopy.upToFiles(field.maxCount));
  }
  if (field.minCount && field.minCount > 1) {
    lines.push(assetCopy.atLeastFiles(field.minCount));
  }
  return lines;
}
