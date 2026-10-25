import type { EngineCaps, Mode } from '@/types/engines';
import { videoDurationPolicy, videoInheritsSourceFraming } from '@/lib/video-workflow-capabilities';
import type { ReferenceAsset } from './workspace-assets';
import type { FormState } from './workspace-form-state';
import { getModeCaps } from './workspace-engine-helpers';
import { resolveDerivedAspectRatio } from './workspace-derived-aspect-ratio';

/** Initial choices for a newly selected Modify source, never a pricing or provider policy. */
export function getModifySourceDefaults(engine: EngineCaps, mode: Mode, source: ReferenceAsset): Partial<FormState> {
  if (mode !== 'v2v' || source.kind !== 'video' || source.status !== 'ready' || source.excerptEditing) return {};
  const caps = getModeCaps(engine, mode);
  const patch: Partial<FormState> = {};
  if (videoDurationPolicy(engine, mode, caps) === 'requested' && caps?.duration && !caps.frames?.length &&
    typeof source.durationSec === 'number' && Number.isFinite(source.durationSec) && source.durationSec > 0) {
    // Existing output contracts require integer seconds; never silently truncate the clip.
    const seconds = Math.ceil(source.durationSec);
    if ('options' in caps.duration) {
      const option = caps.duration.options.find(value => String(value).replace(/s$/, '') === String(seconds));
      if (option !== undefined) Object.assign(patch, { durationSec: seconds, durationOption: option, numFrames: null });
    } else if (seconds >= caps.duration.min && seconds <= engine.maxDurationSec) {
      Object.assign(patch, { durationSec: seconds, durationOption: seconds, numFrames: null });
    }
  }
  if (!videoInheritsSourceFraming(engine, mode)) {
    const supported = caps?.aspectRatio ?? [];
    const measured = typeof source.width === 'number' && source.width > 0 && Number.isFinite(source.width) &&
      typeof source.height === 'number' && source.height > 0 && Number.isFinite(source.height)
      ? resolveDerivedAspectRatio(`${source.width}:${source.height}`, engine, mode) : null;
    const aspectRatio = measured && supported.includes(measured) ? measured : supported.includes('auto') ? 'auto' : null;
    if (aspectRatio) patch.aspectRatio = aspectRatio;
  }
  return patch;
}
