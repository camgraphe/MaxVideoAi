import type { AspectRatio, EngineInputField, Mode, Resolution } from '@/types/engines';

export const BYTEPLUS_MODELARK_PROVIDER = 'byteplus_modelark';
export const PUBLIC_SEEDANCE_ENGINE_ID = 'seedance-2-0';
export const PUBLIC_SEEDANCE_FAST_ENGINE_ID = 'seedance-2-0-fast';
export const PUBLIC_SEEDANCE_MINI_ENGINE_ID = 'seedance-2-0-mini';
export const BYTEPLUS_SEEDANCE_FAST_ENGINE_ID = 'seedance-2-0-fast-byteplus';
export const BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID = 'dreamina-seedance-2-0-260128';
export const BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID = 'dreamina-seedance-2-0-fast-260128';
export const BYTEPLUS_SEEDANCE_MINI_DEFAULT_MODEL_ID = 'dreamina-seedance-2-0-mini-260615';
export const BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
export const BYTEPLUS_SEEDANCE_MODES: Mode[] = ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'];
export const BYTEPLUS_SEEDANCE_RESOLUTIONS: Resolution[] = ['480p', '720p', '1080p', '4k'];
export const BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS: Resolution[] = ['480p', '720p'];
export const BYTEPLUS_SEEDANCE_MINI_RESOLUTIONS: Resolution[] = ['480p', '720p'];
export const BYTEPLUS_SEEDANCE_ASPECT_RATIOS: AspectRatio[] = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
export const BYTEPLUS_SEEDANCE_DURATION_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export const BYTEPLUS_SEEDANCE_MINI_DURATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

const BYTEPLUS_SOURCE_VIDEO_FIELD: EngineInputField = {
  id: 'video_url',
  type: 'video',
  label: 'Source video',
  description: 'Required source video for video-to-video editing.',
  modes: ['v2v'],
  requiredInModes: ['v2v'],
  minCount: 1,
  maxCount: 1,
  source: 'either',
};

const BYTEPLUS_EXTENSION_SOURCE_VIDEO_FIELD: EngineInputField = {
  id: 'extension_source_videos',
  type: 'video',
  label: 'Source clips to extend (up to 3)',
  description: 'Add one source clip to extend forward or backward, or 2-3 clips to stitch a transition.',
  modes: ['extend'],
  requiredInModes: ['extend'],
  minCount: 1,
  maxCount: 3,
  source: 'either',
  slotLabelPattern: 'Source clip {n}',
};

export function withBytePlusVideoSourceFields(fields: EngineInputField[]): EngineInputField[] {
  const next = [...fields];
  if (!next.some((field) => field.id === BYTEPLUS_SOURCE_VIDEO_FIELD.id)) next.push(BYTEPLUS_SOURCE_VIDEO_FIELD);
  if (!next.some((field) => field.id === BYTEPLUS_EXTENSION_SOURCE_VIDEO_FIELD.id)) {
    next.push(BYTEPLUS_EXTENSION_SOURCE_VIDEO_FIELD);
  }
  return next;
}

export function isPublicSeedanceEngine(engineId: string | null | undefined): boolean {
  return engineId === PUBLIC_SEEDANCE_ENGINE_ID;
}

export function isPublicSeedanceFastEngine(engineId: string | null | undefined): boolean {
  return engineId === PUBLIC_SEEDANCE_FAST_ENGINE_ID;
}

export function isPublicSeedanceMiniEngine(engineId: string | null | undefined): boolean {
  return engineId === PUBLIC_SEEDANCE_MINI_ENGINE_ID;
}
