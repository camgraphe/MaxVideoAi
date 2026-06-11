import type { Mode } from '@/types/engines';

export const LUMA_AGENTS_PROVIDER = 'luma_agents_direct' as const;

export const LUMA_UNI_1_ENGINE_IDS = ['luma-uni-1', 'luma-uni-1-max'] as const;
export const LUMA_RAY_32_ENGINE_ID = 'luma-ray-3-2' as const;
export const LUMA_AGENTS_ENGINE_IDS = [...LUMA_UNI_1_ENGINE_IDS, LUMA_RAY_32_ENGINE_ID] as const;

export type LumaAgentsImageEngineId = (typeof LUMA_UNI_1_ENGINE_IDS)[number];
export type LumaAgentsEngineId = (typeof LUMA_AGENTS_ENGINE_IDS)[number];
export type LumaAgentsImageMode = Extract<Mode, 't2i' | 'i2i'>;
export type LumaRay32PublicMode = Extract<Mode, 't2v' | 'i2v'>;
export type LumaRay32AdvancedMode = Extract<Mode, 'v2v' | 'reframe' | 'extend'>;

export const LUMA_UNI_MODEL_BY_ENGINE: Record<LumaAgentsImageEngineId, 'uni-1' | 'uni-1-max'> = {
  'luma-uni-1': 'uni-1',
  'luma-uni-1-max': 'uni-1-max',
};

export const LUMA_UNI_FAL_MODEL_BY_ENGINE_MODE: Record<LumaAgentsImageEngineId, Record<LumaAgentsImageMode, string>> =
  {
    'luma-uni-1': {
      t2i: 'luma/agent/uni-1/v1/text-to-image',
      i2i: 'luma/agent/uni-1/v1/edit',
    },
    'luma-uni-1-max': {
      t2i: 'luma/agent/uni-1/v1/max',
      i2i: 'luma/agent/uni-1/v1/max/edit',
    },
  };

export const LUMA_RAY_32_FAL_MODEL_BY_MODE: Record<LumaRay32PublicMode, string> = {
  t2v: 'luma/agent/ray/v3.2/text-to-video',
  i2v: 'luma/agent/ray/v3.2/image-to-video',
};

export const LUMA_UNI_ASPECT_RATIOS = ['3:1', '2:1', '16:9', '3:2', '1:1', '2:3', '9:16', '1:2', '1:3'] as const;
export const LUMA_UNI_MANGA_ASPECT_RATIOS = ['2:3', '9:16', '1:2', '1:3'] as const;
export const LUMA_UNI_STYLES = ['auto', 'manga'] as const;
export const LUMA_UNI_OUTPUT_FORMATS = ['png', 'jpeg'] as const;
export const LUMA_RAY_32_DURATIONS = ['5s', '10s'] as const;
export const LUMA_RAY_32_RESOLUTIONS = ['540p', '720p', '1080p'] as const;
export const LUMA_RAY_32_ASPECT_RATIOS = ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9'] as const;
export const LUMA_RAY_32_EDIT_STRENGTHS = [
  'auto',
  'adhere_1',
  'adhere_2',
  'adhere_3',
  'flex_1',
  'flex_2',
  'flex_3',
  'reimagine_1',
  'reimagine_2',
  'reimagine_3',
] as const;
export const LUMA_RAY_32_POSE_STRENGTHS = ['off', 'precise', 'coarse'] as const;

export function isLumaAgentsEngineId(value: string | null | undefined): value is LumaAgentsEngineId {
  return Boolean(value && LUMA_AGENTS_ENGINE_IDS.includes(value as LumaAgentsEngineId));
}

export function isLumaAgentsImageEngineId(value: string | null | undefined): value is LumaAgentsImageEngineId {
  return Boolean(value && LUMA_UNI_1_ENGINE_IDS.includes(value as LumaAgentsImageEngineId));
}

export function isLumaRay32EngineId(value: string | null | undefined): value is typeof LUMA_RAY_32_ENGINE_ID {
  return value === LUMA_RAY_32_ENGINE_ID;
}

export function isLumaRay32PublicMode(value: string | null | undefined): value is LumaRay32PublicMode {
  return value === 't2v' || value === 'i2v';
}

export function isLumaRay32AdvancedMode(value: string | null | undefined): value is LumaRay32AdvancedMode {
  return value === 'v2v' || value === 'reframe' || value === 'extend';
}
