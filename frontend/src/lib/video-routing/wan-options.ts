import { WAN_3_PROVIDER_ASPECT_RATIOS, WAN_3_RESOLUTIONS } from '../../config/fal-engines/wan-3-shared';
import type { VideoInputProfile } from './input-profile';

export const WAN_PILOT_INPUTS: VideoInputProfile = {
  durations: [2, 30], resolutions: WAN_3_RESOLUTIONS,
  fixedRatios: WAN_3_PROVIDER_ASPECT_RATIOS.filter(ratio => ratio !== 'adaptive'),
  automaticRatioModes: ['t2v', 'i2v', 'ref2v'],
  text: true, frames: 'first-and-last', referenceImages: 10, referenceVideo: false,
};

export const WAVESPEED_WAN_INPUTS: VideoInputProfile = {
  ...WAN_PILOT_INPUTS, referenceVideo: true, automaticRatioModes: ['i2v'],
};

export const WAN_REVIEWED_EXTRA_KEYS = ['enable_prompt_expansion', 'file_url', 'web_url'];
export function hasUnreviewedWanOptions(extras: Record<string, unknown> | undefined) {
  return Object.entries(extras ?? {}).some(([key, value]) => value != null && !WAN_REVIEWED_EXTRA_KEYS.includes(key))
    || (extras?.enable_prompt_expansion != null && typeof extras.enable_prompt_expansion !== 'boolean');
}

/** Called after the application has resolved its audio choice. Preserve explicit false values. */
export function wanControls(mode: string, generateAudio: boolean, promptExpansion: boolean | undefined) {
  return { generateAudio, expandPrompt: promptExpansion ?? mode !== 'v2v' };
}

type WanControls = ReturnType<typeof wanControls>;
export type WanControlFields = Record<keyof WanControls, string>;

export const DIRECT_WAN_FIELDS = { generateAudio: 'audio', expandPrompt: 'prompt_extend' } as const satisfies WanControlFields;

export function encodeWanControls<F extends WanControlFields>(fields: F, controls: WanControls) {
  return { [fields.generateAudio]: controls.generateAudio, [fields.expandPrompt]: controls.expandPrompt } as Record<F[keyof WanControlFields], boolean>;
}
