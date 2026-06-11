export const LUMA_AGENTS_DEFAULT_BASE_URL = 'https://agents.lumalabs.ai';
export const LUMA_AGENTS_API_VERSION_PATH = '/v1';
export const LUMA_AGENTS_RAY_32_PROVIDER_MODEL = 'ray-3.2';

export const LUMA_AGENTS_RAY_32_DIRECT_ASPECT_RATIOS = [
  '9:16',
  '3:4',
  '1:1',
  '4:3',
  '16:9',
  '21:9',
] as const;

export const LUMA_AGENTS_RAY_32_DIRECT_RESOLUTIONS = ['540p', '720p', '1080p'] as const;
export const LUMA_AGENTS_RAY_32_DIRECT_DURATIONS = ['5s', '10s'] as const;
export const LUMA_AGENTS_RAY_32_EDIT_STRENGTHS = [
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
export const LUMA_AGENTS_RAY_32_POSE_STRENGTHS = ['off', 'precise', 'coarse'] as const;
export const LUMA_AGENTS_DEFAULT_VIDEO_RESOLUTION = '720p' as const;
export const LUMA_AGENTS_DEFAULT_VIDEO_DURATION = '5s' as const;

export type LumaAgentsRay32DirectAspectRatio = (typeof LUMA_AGENTS_RAY_32_DIRECT_ASPECT_RATIOS)[number];
export type LumaAgentsRay32DirectResolution = (typeof LUMA_AGENTS_RAY_32_DIRECT_RESOLUTIONS)[number];
export type LumaAgentsRay32DirectDuration = (typeof LUMA_AGENTS_RAY_32_DIRECT_DURATIONS)[number];
