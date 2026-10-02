// Provider cost facts only. The historical customer-pricing basis is independent.
// Source: https://docs.byteplus.com/zh-TW/docs/modelark/seedance-2-5
// Checked 2026-10-01; the completed 4s square canary confirms 640/1440 rasters.
const DIMENSIONS = {
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
  if (!Object.hasOwn(DIMENSIONS, resolution)) return null;
  const ratios = DIMENSIONS[resolution as keyof typeof DIMENSIONS];
  if (!Object.hasOwn(ratios, aspectRatio)) return null;
  const [width, height] = ratios[aspectRatio as keyof typeof ratios];
  return { width, height, aspectRatio };
}

/** Duration-only estimate. Actual reported tokens remain authoritative (e.g. 97 vs 96 frames). */
export function estimateSeedance25OutputTokens(input: {
  resolution: string;
  aspectRatio?: string | null;
  durationSec: number;
}) {
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) return null;
  const dimensions = seedance25OutputDimensions(input.resolution, input.aspectRatio ?? '16:9');
  if (!dimensions) return null;
  return { ...dimensions, tokenCount: dimensions.width * dimensions.height
    * Math.max(1, Math.round(input.durationSec)) * 24 / 1024 };
}
