/**
 * Documentation-only Seedance 2.5 evidence summary.
 *
 * Runtime code must not import this file. The executable owners live under
 * frontend/src/config/fal-engines and frontend/src/server/video-providers.
 */
export const seedance25EngineEvidenceGate = {
  canonicalEngineId: 'seedance-2-5',
  modelArkModelId: 'dreamina-seedance-2-5-260628',
  checkedAt: '2026-08-07',
  documentationOnly: true,
  runtimeEntryAllowed: true,
  currentPhase: 'noindex_marketing_handoff',
  publicGenerationAllowed: false,
  publicMarketingPageAllowed: true,
  publicDiscoveryAllowed: false,
  testedContract: {
    modes: ['t2v'],
    durationsSec: { min: 4, max: 30, default: 4 },
    resolutions: ['480p', '720p'],
    defaultResolution: '480p',
    aspectRatios: ['16:9'],
    framesPerSecond: 24,
    generatedAudio: true,
    motionControls: false,
    references: false,
    editing: false,
    extension: false,
  },
  dedicatedControls: [
    'BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID',
    'SEEDANCE_2_5_BYTEPLUS_ENABLED',
    'SEEDANCE_2_5_PROVIDER',
    'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY',
    'SEEDANCE_2_5_BYTEPLUS_MODES',
  ],
  nextRequiredPhase: 'failure_refund_canary',
} as const;
