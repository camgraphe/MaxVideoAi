import type { PurchaseRequest } from '../../server/video-providers/purchase/types';

/** A reviewed subset of an engine. Each entry describes an exact combination a supplier can preserve. */
export type VideoInputProfile = {
  durations: readonly [number, number];
  resolutions: readonly string[];
  fixedRatios: readonly string[];
  automaticRatioModes: readonly string[];
  text: boolean;
  frames: 'first' | 'first-and-last' | false;
  referenceImages: number;
  referenceVideo: boolean;
};

export function unsupportedVideoInput(r: PurchaseRequest, profile: VideoInputProfile): string | null {
  if (r.hasUnpricedOptions || r.requiresDirectControls) return 'A requested control has no reviewed mapping';
  if (r.hasDocument) return 'Document or web reference has no reviewed mapping';
  if (r.hasAudioReference) return 'Audio reference has no reviewed mapping';
  if (!Number.isInteger(r.durationSec) || r.durationSec < profile.durations[0] || r.durationSec > profile.durations[1])
    return 'Output duration outside reviewed range';
  if (!profile.resolutions.includes(r.resolution.toLowerCase())) return 'Unsupported output resolution';
  const ratio = r.aspectRatio ?? 'auto';
  const automatic = ratio === 'auto' || ratio === 'adaptive';
  if (automatic ? !profile.automaticRatioModes.includes(r.mode) : !profile.fixedRatios.includes(ratio))
    return 'Aspect ratio outside reviewed profile';
  if (!Number.isInteger(r.images) || r.images < 0) return 'Unknown image count';
  if (r.hasVideo && !profile.referenceVideo) return 'Source video has no reviewed mapping';
  if (!r.hasVideo && (r.inputVideoSeconds ?? 0) !== 0) return 'Input duration without a source video';

  // PurchaseRequest.images includes the start frame and excludes the end frame.
  if (r.mode === 't2v' && profile.text && !r.images && !r.hasStartFrame && !r.hasEndFrame && !r.hasVideo) return null;
  if (r.mode === 'i2v' && profile.frames && r.hasStartFrame && r.images === 1 && !r.hasVideo)
    return r.hasEndFrame && profile.frames !== 'first-and-last' ? 'Last frame has no reviewed mapping' : null;
  if (r.mode === 'ref2v' && !r.hasStartFrame && !r.hasEndFrame && r.images <= profile.referenceImages && (r.images || r.hasVideo))
    return null;
  return 'Unsupported combination of mode, frames and references';
}
