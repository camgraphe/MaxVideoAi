// Provider cost facts only. The historical customer-pricing basis is independent.
// Source: https://docs.byteplus.com/zh-TW/docs/modelark/seedance-2-5
// Checked 2026-10-01; the completed 4s square canary confirms 640/1440 rasters.
const SEEDANCE_25_DIMENSIONS = {
  '480p': {
    '16:9': [854, 480], '4:3': [752, 560], '1:1': [640, 640],
    '3:4': [560, 752], '9:16': [480, 854], '21:9': [992, 432],
  },
  '720p': {
    '16:9': [1280, 720], '4:3': [1112, 834], '1:1': [960, 960],
    '3:4': [834, 1112], '9:16': [720, 1280], '21:9': [1470, 630],
  },
  '1080p': {
    '16:9': [1920, 1080], '4:3': [1664, 1248], '1:1': [1440, 1440],
    '3:4': [1248, 1664], '9:16': [1080, 1920], '21:9': [2206, 946],
  },
} as const;

export function seedance25OutputDimensions(resolution: string, aspectRatio = '16:9') {
  if (!Object.hasOwn(SEEDANCE_25_DIMENSIONS, resolution)) return null;
  const ratios = SEEDANCE_25_DIMENSIONS[resolution as keyof typeof SEEDANCE_25_DIMENSIONS];
  if (!Object.hasOwn(ratios, aspectRatio)) return null;
  const [width, height] = ratios[aspectRatio as keyof typeof ratios];
  return { width, height, aspectRatio };
}


const SEEDANCE_2_0_4K_DIMENSIONS: Record<string, Record<string, { width: number; height: number }>> = {
  '4k': {
    '21:9': { width: 4398, height: 1886 },
    '16:9': { width: 3840, height: 2160 },
    '4:3': { width: 3326, height: 2494 },
    '1:1': { width: 2880, height: 2880 },
    '3:4': { width: 2494, height: 3326 },
    '9:16': { width: 2160, height: 3840 },
  },
};

// Published 1.5/2.0 series rasters; 2.5 differs at 480p. Provider usage overrides estimates.
// https://docs.byteplus.com/pt/docs/modelark/create-video-generation-task-api (2026-10-01).
const SEEDANCE_1_5_AND_2_0_DIMENSIONS: typeof SEEDANCE_2_0_4K_DIMENSIONS = {
  '480p': {
    '21:9': { width: 992, height: 432 },
    '16:9': { width: 864, height: 496 },
    '4:3': { width: 752, height: 560 },
    '1:1': { width: 640, height: 640 },
    '3:4': { width: 560, height: 752 },
    '9:16': { width: 496, height: 864 },
  },
  '720p': {
    '21:9': { width: 1470, height: 630 },
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 1112, height: 834 },
    '1:1': { width: 960, height: 960 },
    '3:4': { width: 834, height: 1112 },
    '9:16': { width: 720, height: 1280 },
  },
  '1080p': {
    '21:9': { width: 2206, height: 946 },
    '16:9': { width: 1920, height: 1080 },
    '4:3': { width: 1664, height: 1248 },
    '1:1': { width: 1440, height: 1440 },
    '3:4': { width: 1248, height: 1664 },
    '9:16': { width: 1080, height: 1920 },
  },
};

export function seedanceOutputDimensions(engineId: string, resolution: string, aspectRatio: string) {
  if (engineId === 'seedance-2-5') return seedance25OutputDimensions(resolution, aspectRatio);
  return (resolution === '4k' ? SEEDANCE_2_0_4K_DIMENSIONS : SEEDANCE_1_5_AND_2_0_DIMENSIONS)[resolution]?.[aspectRatio];
}

