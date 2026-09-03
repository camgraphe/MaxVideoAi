import type { RawFalEngineEntry } from './types';
import { PIKA_FAL_ENGINE_REGISTRY } from './pika';
import { VEO_3_1_FAL_ENGINE_REGISTRY } from './veo-3-1';
import { VEO_3_1_FAST_FAL_ENGINE_REGISTRY } from './veo-3-1-fast';
import { VEO_3_1_LITE_FAL_ENGINE_REGISTRY } from './veo-3-1-lite';
import { GEMINI_OMNI_FLASH_FAL_ENGINE_REGISTRY } from './gemini-omni-flash';
import { LUMA_RAY_2_FAL_ENGINE_REGISTRY } from './luma-ray-2';
import { LUMA_RAY_2_FLASH_FAL_ENGINE_REGISTRY } from './luma-ray-2-flash';
import { LUMA_RAY_3_2_FAL_ENGINE_REGISTRY } from './luma-ray-3-2';
import { LUMA_UNI_1_FAL_ENGINE_REGISTRY } from './luma-uni-1';
import { LUMA_UNI_1_MAX_FAL_ENGINE_REGISTRY } from './luma-uni-1-max';
import { SORA_FAL_ENGINE_REGISTRY } from './sora';
import { KLING_2_5_FAL_ENGINE_REGISTRY } from './kling-2-5';
import { KLING_2_6_FAL_ENGINE_REGISTRY } from './kling-2-6';
import { KLING_3_PRO_FAL_ENGINE_REGISTRY } from './kling-3-pro';
import { KLING_3_STANDARD_FAL_ENGINE_REGISTRY } from './kling-3-standard';
import { KLING_3_4K_FAL_ENGINE_REGISTRY } from './kling-3-4k';
import { KLING_O3_FAL_ENGINE_REGISTRY } from './kling-o3';
import { KLING_3_TURBO_STANDARD_FAL_ENGINE_REGISTRY } from './kling-3-turbo-standard';
import { KLING_3_TURBO_PRO_FAL_ENGINE_REGISTRY } from './kling-3-turbo-pro';
import { HAPPY_HORSE_FAL_ENGINE_REGISTRY } from './happy-horse';
import { SEEDANCE_1_5_FAL_ENGINE_REGISTRY } from './seedance-1-5';
import { SEEDANCE_2_STANDARD_FAL_ENGINE_REGISTRY } from './seedance-2-standard';
import { SEEDANCE_2_FAST_FAL_ENGINE_REGISTRY } from './seedance-2-fast';
import { SEEDANCE_2_MINI_FAL_ENGINE_REGISTRY } from './seedance-2-mini';
import { SEEDANCE_2_BYTEPLUS_FAL_ENGINE_REGISTRY } from './seedance-2-byteplus';
import { SEEDANCE_2_5_FAL_ENGINE_REGISTRY } from './seedance-2-5';
import { WAN_2_5_FAL_ENGINE_REGISTRY } from './wan-2-5';
import { WAN_2_6_FAL_ENGINE_REGISTRY } from './wan-2-6';
import { WAN_3_FAL_ENGINE_REGISTRY } from './wan-3';
import { WAN_3_PRIME_FAL_ENGINE_REGISTRY } from './wan-3-prime';
import { LTX_2_FAST_FAL_ENGINE_REGISTRY } from './ltx-2-fast';
import { LTX_2_FAL_ENGINE_REGISTRY } from './ltx-2';
import { LTX_2_3_FAST_FAL_ENGINE_REGISTRY } from './ltx-2-3-fast';
import { LTX_2_3_FAL_ENGINE_REGISTRY } from './ltx-2-3';
import { LTX_2_5_FAST_FAL_ENGINE_REGISTRY } from './ltx-2-5-fast';
import { LTX_2_5_PRO_FAL_ENGINE_REGISTRY } from './ltx-2-5-pro';
import { GROK_IMAGINE_VIDEO_1_5_FAL_ENGINE_REGISTRY } from './grok-imagine-video-1-5';
import { FLUX_3_FAL_ENGINE_REGISTRY } from './flux-3';
import { FLUX_3_DRAFT_FAL_ENGINE_REGISTRY } from './flux-3-draft';
import { HAILUO_FAL_ENGINE_REGISTRY } from './hailuo';
import { MINIMAX_H3_FAL_ENGINE_REGISTRY } from './minimax-h3';
import { NANO_BANANA_FAL_ENGINE_REGISTRY } from './nano-banana';
import { NANO_BANANA_LITE_FAL_ENGINE_REGISTRY } from './nano-banana-lite';
import { NANO_BANANA_PRO_FAL_ENGINE_REGISTRY } from './nano-banana-pro';
import { NANO_BANANA_2_FAL_ENGINE_REGISTRY } from './nano-banana-2';
import { GPT_IMAGE_2_FAL_ENGINE_REGISTRY } from './gpt-image-2';
import { SEEDREAM_FAL_ENGINE_REGISTRY } from './seedream';

// These contracts are intentionally excluded from the public engine catalog until
// direct Kling acceptance and the model-registry publication gates are complete.
export const UNPUBLISHED_FAL_ENGINE_REGISTRY: readonly RawFalEngineEntry[] = [
  ...KLING_3_TURBO_STANDARD_FAL_ENGINE_REGISTRY,
  ...KLING_3_TURBO_PRO_FAL_ENGINE_REGISTRY,
];

export const RAW_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  ...PIKA_FAL_ENGINE_REGISTRY,
  ...VEO_3_1_FAL_ENGINE_REGISTRY,
  ...VEO_3_1_FAST_FAL_ENGINE_REGISTRY,
  ...VEO_3_1_LITE_FAL_ENGINE_REGISTRY,
  ...GEMINI_OMNI_FLASH_FAL_ENGINE_REGISTRY,
  ...LUMA_RAY_2_FAL_ENGINE_REGISTRY,
  ...LUMA_RAY_2_FLASH_FAL_ENGINE_REGISTRY,
  ...LUMA_RAY_3_2_FAL_ENGINE_REGISTRY,
  ...LUMA_UNI_1_FAL_ENGINE_REGISTRY,
  ...LUMA_UNI_1_MAX_FAL_ENGINE_REGISTRY,
  ...SORA_FAL_ENGINE_REGISTRY,
  ...KLING_2_5_FAL_ENGINE_REGISTRY,
  ...KLING_2_6_FAL_ENGINE_REGISTRY,
  ...KLING_3_PRO_FAL_ENGINE_REGISTRY,
  ...KLING_3_STANDARD_FAL_ENGINE_REGISTRY,
  ...KLING_3_4K_FAL_ENGINE_REGISTRY,
  ...KLING_O3_FAL_ENGINE_REGISTRY,
  ...HAPPY_HORSE_FAL_ENGINE_REGISTRY,
  ...SEEDANCE_1_5_FAL_ENGINE_REGISTRY,
  ...SEEDANCE_2_STANDARD_FAL_ENGINE_REGISTRY,
  ...SEEDANCE_2_FAST_FAL_ENGINE_REGISTRY,
  ...SEEDANCE_2_MINI_FAL_ENGINE_REGISTRY,
  ...SEEDANCE_2_BYTEPLUS_FAL_ENGINE_REGISTRY,
  ...SEEDANCE_2_5_FAL_ENGINE_REGISTRY,
  ...WAN_2_5_FAL_ENGINE_REGISTRY,
  ...WAN_2_6_FAL_ENGINE_REGISTRY,
  ...LTX_2_FAST_FAL_ENGINE_REGISTRY,
  ...LTX_2_FAL_ENGINE_REGISTRY,
  ...LTX_2_3_FAST_FAL_ENGINE_REGISTRY,
  ...LTX_2_3_FAL_ENGINE_REGISTRY,
  ...MINIMAX_H3_FAL_ENGINE_REGISTRY,
  ...HAILUO_FAL_ENGINE_REGISTRY,
  ...NANO_BANANA_FAL_ENGINE_REGISTRY,
  ...NANO_BANANA_LITE_FAL_ENGINE_REGISTRY,
  ...NANO_BANANA_PRO_FAL_ENGINE_REGISTRY,
  ...NANO_BANANA_2_FAL_ENGINE_REGISTRY,
  ...GPT_IMAGE_2_FAL_ENGINE_REGISTRY,
  ...SEEDREAM_FAL_ENGINE_REGISTRY,
  ...WAN_3_FAL_ENGINE_REGISTRY,
  ...WAN_3_PRIME_FAL_ENGINE_REGISTRY,
  ...LTX_2_5_FAST_FAL_ENGINE_REGISTRY,
  ...LTX_2_5_PRO_FAL_ENGINE_REGISTRY,
  ...GROK_IMAGINE_VIDEO_1_5_FAL_ENGINE_REGISTRY,
  ...FLUX_3_FAL_ENGINE_REGISTRY,
  ...FLUX_3_DRAFT_FAL_ENGINE_REGISTRY,
];
