/** Bounded maintenance proposal; generation reads literal customer cells only. */
export const MODIFY_TARIFF_POLICY = 'modify_kling_resolution_and_luma_source_classes_v1';
export const MODIFY_TARIFF_SCOPE = {
  kling: { engineId: 'kling-o3-standard', mode: 'v2v', fromResolution: '1080p', toResolution: '720p',
    minimumDurationSec: 3, maximumDurationSec: 15, expectedCells: 13 },
  luma: { engineId: 'luma-ray-3-2', mode: 'v2v', resolutions: ['540p', '720p', '1080p'],
    durations: [6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18], dynamicRange: 'sdr', expectedCells: 36 },
  expectedCells: 49,
} as const;
export const MODIFY_LUMA_ANCHORS = { '540p': [94, 188], '720p': [141, 281], '1080p': [281, 562] } as const;
