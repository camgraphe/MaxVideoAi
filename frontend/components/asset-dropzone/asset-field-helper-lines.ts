import type { EngineCaps, EngineInputField, EngineModeUiCaps } from '@/types/engines';
import type { getLocalizedAssetDropzoneCopy } from '@/lib/ltx-localization';
import type { MediaFieldConstraint } from '@/lib/media-field-constraints';
import { formatAcceptedAudioExtensions } from './asset-dropzone-helpers';

/** Display-only format/size/duration guidance. Validation remains in AssetDropzone. */
export function buildAssetFieldHelperLines({ field, engine, caps, acceptFormats, minimumImageSidePx, mediaFieldConstraint, assetCopy, compact = false }: {
  field: EngineInputField;
  engine: EngineCaps;
  caps?: EngineModeUiCaps;
  acceptFormats: string[];
  minimumImageSidePx: number | null;
  mediaFieldConstraint: MediaFieldConstraint;
  assetCopy: ReturnType<typeof getLocalizedAssetDropzoneCopy>;
  compact?: boolean;
}) {
  const constraints = engine.inputSchema?.constraints ?? {};
  const limits = engine.inputLimits;
  const lines: string[] = [];
  const formats = (values: string[]) => Array.from(new Set(values.map((ext) => ext.replace(/^\./, '').toUpperCase().replace(/^JPEG$/, 'JPG')))).join(', ');
  const formatLine = (value: string) => compact ? value : assetCopy.formats(value);
  const sizeLine = (value: number) => compact ? assetCopy.mbPerFile(value) : assetCopy.mbMax(value);
  if (field.type === 'image') {
    const imageFormats = field.acceptedFileExtensions?.length ? mediaFieldConstraint.acceptedFileExtensions : acceptFormats;
    lines.push(formatLine(imageFormats.length ? formats(imageFormats) : 'PNG, JPG, WebP'));
    const maxImage = field.maxSizeMB ?? caps?.maxUploadMB ?? mediaFieldConstraint.maxSizeMB;
    if (maxImage) lines.push(sizeLine(maxImage));
    if (!compact && minimumImageSidePx != null) lines.push(`${minimumImageSidePx} x ${minimumImageSidePx} px min`);
  } else if (field.type === 'video') {
    lines.push(formatLine(mediaFieldConstraint.acceptedFileExtensions.length ? formats(mediaFieldConstraint.acceptedFileExtensions) : 'MP4, MOV'));
    const maxVideo = mediaFieldConstraint.maxSizeMB ?? constraints.maxVideoSizeMB ?? limits.videoMaxMB;
    if (maxVideo) lines.push(sizeLine(maxVideo));
    const maxVideoDuration = field.maxDurationSec ?? limits.videoMaxDurationSec;
    const combinedDuration = compact && (field.maxCount ?? 0) > 1 ? constraints.maxCombinedVideoDurationSec : undefined;
    if (combinedDuration) lines.push(assetCopy.secondsTotal(combinedDuration));
    else if (maxVideoDuration) lines.push(assetCopy.secondsMax(maxVideoDuration));
  } else {
    const audioFormats = formatAcceptedAudioExtensions(mediaFieldConstraint);
    lines.push(formatLine(audioFormats));
    const maxAudio = mediaFieldConstraint.maxSizeMB ?? limits.audioMaxMB;
    if (maxAudio) lines.push(sizeLine(maxAudio));
    const minAudioDuration = field.minDurationSec;
    const maxAudioDuration = field.maxDurationSec ?? limits.audioMaxDurationSec;
    const combinedDuration = compact && (field.maxCount ?? 0) > 1 ? constraints.maxCombinedAudioDurationSec : undefined;
    if (combinedDuration) {
      lines.push(assetCopy.secondsTotal(combinedDuration));
    } else if (typeof minAudioDuration === 'number' && typeof maxAudioDuration === 'number') {
      lines.push(assetCopy.secondsRequired(minAudioDuration, maxAudioDuration));
    } else if (typeof maxAudioDuration === 'number') {
      lines.push(assetCopy.secondsMax(maxAudioDuration));
    }
    if (!compact && field.id === 'audio_url') {
      lines.push(assetCopy.videoLengthFollowsAudio);
    }
  }
  if (!compact && field.maxCount && field.maxCount > 1) {
    lines.push(assetCopy.upToFiles(field.maxCount));
  }
  if (!compact && field.minCount && field.minCount > 1) {
    lines.push(assetCopy.atLeastFiles(field.minCount));
  }
  return lines;
}
