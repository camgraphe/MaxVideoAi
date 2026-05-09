import type { AspectRatio, Mode, Resolution } from '@/types/engines';

export const BYTEPLUS_MODELARK_PROVIDER = 'byteplus_modelark';
export const PUBLIC_SEEDANCE_ENGINE_ID = 'seedance-2-0';
export const PUBLIC_SEEDANCE_FAST_ENGINE_ID = 'seedance-2-0-fast';
export const BYTEPLUS_SEEDANCE_FAST_ENGINE_ID = 'seedance-2-0-fast-byteplus';
export const BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID = 'dreamina-seedance-2-0-260128';
export const BYTEPLUS_SEEDANCE_FAST_DEFAULT_MODEL_ID = 'dreamina-seedance-2-0-fast-260128';
export const BYTEPLUS_SEEDANCE_FAST_DEFAULT_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
export const BYTEPLUS_SEEDANCE_MODES: Mode[] = ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'];
export const BYTEPLUS_SEEDANCE_RESOLUTIONS: Resolution[] = ['480p', '720p', '1080p'];
export const BYTEPLUS_SEEDANCE_FAST_RESOLUTIONS: Resolution[] = ['480p', '720p'];
export const BYTEPLUS_SEEDANCE_ASPECT_RATIOS: AspectRatio[] = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
export const BYTEPLUS_SEEDANCE_DURATION_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
