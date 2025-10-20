import type { Mode as EngineMode } from '@/types/engines';

export type Mode = EngineMode;

type DurationEnumCaps = {
  options: Array<number | string>;
  default?: number | string;
};

type DurationMinCaps = {
  min: number;
  default: number;
};

export type DurationCaps = DurationEnumCaps | DurationMinCaps;

export type EngineCaps = {
  modes: Mode[];
  duration?: DurationCaps;
  frames?: number[];
  resolution?: string[];
  aspectRatio?: string[];
  fps?: number;
  audioToggle?: boolean;
  acceptsImageFormats?: string[];
  maxUploadMB?: number;
  notes?: string;
};

// Verified engine caps — expose ONLY what’s listed here.
// If a field is absent, hide the related control in UI and block it server-side.
export const ENGINE_CAPS: Record<string, EngineCaps> = {
  // --- PIKA 2.2 ---
  'fal-ai/pika/v2.2/text-to-video': {
    modes: ['t2v'],
    duration: { min: 5, default: 5 },
    resolution: ['720p', '1080p'],
    aspectRatio: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
    audioToggle: false,
  },
  'fal-ai/pika/v2.2/image-to-video': {
    modes: ['i2v'],
    duration: { min: 5, default: 5 },
    resolution: ['720p', '1080p'],
    acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    audioToggle: false,
  },

  // --- SORA 2 (OpenAI) ---
  'fal-ai/sora-2/image-to-video': {
    modes: ['i2v'],
    duration: { options: [4, 8, 12], default: 4 },
    resolution: ['auto', '720p'],
    aspectRatio: ['auto', '9:16', '16:9'],
    acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    audioToggle: false,
    notes: 'Supports optional api_key to bill OpenAI directly.',
  },
  'fal-ai/sora-2/text-to-video': {
    modes: ['t2v'],
    duration: { options: [4, 8, 12], default: 4 },
    resolution: ['720p'],
    aspectRatio: ['9:16', '16:9'],
    audioToggle: false,
    notes: 'Supports optional api_key to bill OpenAI directly.',
  },
  'fal-ai/sora-2/text-to-video/pro': {
    modes: ['t2v'],
    duration: { options: [4, 8, 12], default: 4 },
    resolution: ['720p', '1080p'],
    aspectRatio: ['9:16', '16:9'],
    audioToggle: false,
    notes: 'Supports optional api_key to bill OpenAI directly.',
  },
  'fal-ai/sora-2/image-to-video/pro': {
    modes: ['i2v'],
    duration: { options: [4, 8, 12], default: 4 },
    resolution: ['auto', '720p', '1080p'],
    aspectRatio: ['auto', '9:16', '16:9'],
    acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    audioToggle: false,
    notes: 'Supports optional api_key to bill OpenAI directly.',
  },
  // --- GOOGLE VEO 3 ---
  'fal-ai/veo3': {
    modes: ['t2v'],
    duration: { options: ['4s', '6s', '8s'], default: '8s' },
    resolution: ['720p', '1080p'],
    aspectRatio: ['16:9', '9:16', '1:1'],
    audioToggle: true,
  },
  'fal-ai/veo3/image-to-video': {
    modes: ['i2v'],
    duration: { options: ['8s'], default: '8s' },
    resolution: ['720p', '1080p'],
    aspectRatio: ['auto', '16:9', '9:16'],
    audioToggle: true,
    acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    maxUploadMB: 8,
    notes: 'If input image not 16:9, API may crop to fit when AR is 16:9.',
  },
  'fal-ai/veo3/fast': {
    modes: ['t2v'],
    duration: { options: ['4s', '6s', '8s'], default: '8s' },
    resolution: ['720p', '1080p'],
    aspectRatio: ['16:9', '9:16', '1:1'],
    audioToggle: true,
  },
  'fal-ai/veo3/fast/image-to-video': {
    modes: ['i2v'],
    duration: { options: ['8s'], default: '8s' },
    resolution: ['720p', '1080p'],
    aspectRatio: ['auto', '16:9', '9:16'],
    audioToggle: true,
    acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    maxUploadMB: 8,
  },

  // --- KLING 2.5 TURBO PRO ---
  'fal-ai/kling-video/v2.5-turbo/pro/text-to-video': {
    modes: ['t2v'],
    duration: { options: [5], default: 5 },
    audioToggle: false,
  },
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': {
    modes: ['i2v'],
    duration: { options: [5], default: 5 },
    audioToggle: false,
  },

// --- LUMA DREAM MACHINE (v1.5) & LUMA RAY 2 family ---
'fal-ai/luma-dream-machine/image-to-video': {
  modes: ['i2v'],
  resolution: ['720p'],
  audioToggle: false,
},
'fal-ai/luma-dream-machine': {
  modes: ['t2v'],
  duration: { min: 5, default: 5 },
  resolution: ['720p'],
  aspectRatio: ['16:9', '9:16'],
  audioToggle: false,
},
'fal-ai/luma-dream-machine/ray-2': {
  modes: ['t2v'],
  duration: { min: 5, default: 5 },
  resolution: ['720p'],
  aspectRatio: ['16:9', '9:16'],
  audioToggle: false,
  notes: 'Billed at $0.50 per 5s block via Fal.ai (≈$0.10/s).',
},
'fal-ai/luma-dream-machine/ray-2/image-to-video': {
  modes: ['i2v'],
  audioToggle: false,
  resolution: ['720p'],
  duration: { min: 5, default: 5 },
},
'fal-ai/luma-dream-machine/ray-2/modify': {
  modes: ['i2v'],
  duration: { min: 1, default: 5 },
  resolution: ['source', '720p'],
  audioToggle: false,
  maxUploadMB: 500,
  notes: 'Video→Video restyle. Fal.ai bills $0.35 per output second.',
},
'fal-ai/luma-dream-machine/ray-2/reframe': {
  modes: ['i2v'],
  duration: { min: 1, default: 5 },
  resolution: ['source', '720p'],
  aspectRatio: ['16:9', '9:16', '1:1', '4:5'],
  audioToggle: false,
  maxUploadMB: 500,
  notes: 'Aspect conversion / smart inpaint. Fal.ai bills $0.20 per output second.',
},
'fal-ai/luma-dream-machine/ray-2-flash': {
  modes: ['t2v'],
  duration: { min: 5, default: 5 },
  resolution: ['720p'],
  aspectRatio: ['16:9', '9:16'],
  audioToggle: false,
  notes: 'Flash variant tuned for faster Ray-2 generations.',
},
'fal-ai/luma-dream-machine/ray-2-flash/image-to-video': {
  modes: ['i2v'],
  audioToggle: false,
  resolution: ['720p'],
  duration: { min: 5, default: 5 },
},
'fal-ai/luma-dream-machine/ray-2-flash/reframe': {
  modes: ['i2v'],
  duration: { min: 1, default: 5 },
  resolution: ['source', '720p'],
  aspectRatio: ['16:9', '9:16', '1:1', '4:5'],
  audioToggle: false,
  maxUploadMB: 500,
  notes: 'Flash Reframe • Fal.ai bills $0.06 per output second.',
},

// --- MINIMAX / HAILUO ---
'fal-ai/minimax/hailuo-02/standard/image-to-video': {
  modes: ['i2v'],
  duration: { options: [6, 10], default: 6 },
    resolution: ['512P', '768P'],
    fps: 25,
    audioToggle: false,
    acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    maxUploadMB: 20,
    notes: 'AR between 2:5 and 5:2; min 300px short side. 10s not supported at 1080P (not applicable to Standard).',
  },
  'fal-ai/minimax/hailuo-02/pro/image-to-video': {
    modes: ['i2v'],
    duration: { options: [6], default: 6 },
    resolution: ['1080P'],
    fps: 25,
    audioToggle: false,
    acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
  },
  'fal-ai/minimax/video-01/image-to-video': {
    modes: ['i2v'],
    duration: { options: [6], default: 6 },
    resolution: ['720p'],
    fps: 25,
    audioToggle: false,
    acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    notes: 'Supports camera directives like [Pan], [Zoom], [Tilt] in prompt.',
  },
  'fal-ai/minimax/video-01': {
    modes: ['t2v'],
    audioToggle: false,
  },
  'fal-ai/minimax/video-01-live/image-to-video': {
    modes: ['i2v'],
    audioToggle: false,
  },
  'fal-ai/minimax/video-01-director': {
    modes: ['t2v'],
    audioToggle: false,
  },

  // --- HUNYUAN VIDEO (Open) ---
  'fal-ai/hunyuan-video': {
    modes: ['t2v'],
    frames: [85, 129],
    resolution: ['480p', '580p', '720p'],
    aspectRatio: ['16:9', '9:16'],
    audioToggle: false,
    notes: 'Pro mode (55 steps) increases quality and doubles billing units; expose as a toggle separate from audio.',
  },
};

export type EngineCapsKey = keyof typeof ENGINE_CAPS;

type ModeCapsMap = Partial<Record<Mode, EngineCapsKey>>;

export const ENGINE_CAP_INDEX: Record<string, ModeCapsMap> = {
  pika22: {
    t2v: 'fal-ai/pika/v2.2/text-to-video',
    i2v: 'fal-ai/pika/v2.2/image-to-video',
  },
  'sora-2': {
    t2v: 'fal-ai/sora-2/text-to-video',
    i2v: 'fal-ai/sora-2/image-to-video',
  },
  'sora-2-pro': {
    t2v: 'fal-ai/sora-2/text-to-video/pro',
    i2v: 'fal-ai/sora-2/image-to-video/pro',
  },
  veo3: {
    t2v: 'fal-ai/veo3',
    i2v: 'fal-ai/veo3/image-to-video',
  },
  veo3fast: {
    t2v: 'fal-ai/veo3/fast',
    i2v: 'fal-ai/veo3/fast/image-to-video',
  },
  kling25_turbo_pro: {
    t2v: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    i2v: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  },
  lumaDM: {
    t2v: 'fal-ai/luma-dream-machine',
    i2v: 'fal-ai/luma-dream-machine/image-to-video',
  },
  lumaRay2: {
    t2v: 'fal-ai/luma-dream-machine/ray-2',
    i2v: 'fal-ai/luma-dream-machine/ray-2/image-to-video',
  },
  lumaRay2_flash: {
    t2v: 'fal-ai/luma-dream-machine/ray-2-flash',
    i2v: 'fal-ai/luma-dream-machine/ray-2-flash/image-to-video',
  },
  lumaRay2_modify: {
    i2v: 'fal-ai/luma-dream-machine/ray-2/modify',
  },
  lumaRay2_reframe: {
    i2v: 'fal-ai/luma-dream-machine/ray-2/reframe',
  },
  lumaRay2_flash_reframe: {
    i2v: 'fal-ai/luma-dream-machine/ray-2-flash/reframe',
  },
  minimax_hailuo_02_pro: {
    i2v: 'fal-ai/minimax/hailuo-02/pro/image-to-video',
  },
  minimax_video_01: {
    t2v: 'fal-ai/minimax/video-01',
    i2v: 'fal-ai/minimax/video-01/image-to-video',
  },
  minimax_video_01_live: {
    i2v: 'fal-ai/minimax/video-01-live/image-to-video',
  },
  minimax_video_01_director: {
    t2v: 'fal-ai/minimax/video-01-director',
  },
  minimax_hailuo_02_standard: {
    i2v: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
  },
  hunyuan_video: {
    t2v: 'fal-ai/hunyuan-video',
  },
};

export function resolveEngineCapsKey(engineId: string, mode?: Mode): EngineCapsKey | undefined {
  const entry = ENGINE_CAP_INDEX[engineId];
  if (!entry) return undefined;
  if (mode && entry[mode]) return entry[mode];
  return (mode ? undefined : Object.values(entry).find(Boolean)) as EngineCapsKey | undefined;
}

export function getEngineCaps(engineId: string, mode?: Mode): EngineCaps | undefined {
  const key = resolveEngineCapsKey(engineId, mode);
  return key ? ENGINE_CAPS[key] : undefined;
}
