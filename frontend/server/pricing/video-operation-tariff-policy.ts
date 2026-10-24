export const VIDEO_OPERATION_TARIFF_POLICY = 'video-operations:current-standard-30:v1';
export const VIDEO_OPERATION_TARIFF_SCOPE = { fixedCells: 76, continuousCells: 13, expectedCells: 89,
  families: { 'kling-reference': 13, 'kling-edit': 3, 'h3-recast': 2, 'h3-relight': 4,
    'luma-extend': 3, 'flux-keyframes': 48, 'flux-fast-edit': 1, 'flux-draft-enhance': 1, 'ltx23-reframe': 2, 'veo-standard-i2v': 12 },
  excludedOperations: ['h3-extend','h3-insert','h3-reframe'] } as const;
export const VIDEO_OPERATION_TARIFF_EVENT = 'video-operations:bounded-current-policy-initialization';
