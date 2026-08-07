/**
 * Documentation-only Seedance 2.5 evidence summary.
 *
 * Runtime code must not import this file. The executable owners live under
 * frontend/src/config/fal-engines and frontend/src/server/video-providers.
 */
export const seedance25EngineEvidenceGate = {
  canonicalEngineId: 'seedance-2-5',
  modelArkModelId: 'dreamina-seedance-2-5-260628',
  checkedAt: '2026-08-08',
  documentationOnly: true,
  runtimeEntryAllowed: true,
  currentPhase: 'public_flagship_launch',
  publicGenerationAllowed: true,
  publicMarketingPageAllowed: true,
  publicDiscoveryAllowed: true,
  testedContract: {
    modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
    durationsSec: { min: 4, max: 30, default: 4 },
    resolutions: ['480p', '720p'],
    defaultResolution: '480p',
    aspectRatios: ['16:9'],
    framesPerSecond: 24,
    generatedAudio: true,
    motionControls: false,
    references: true,
    editing: true,
    extension: true,
  },
  dedicatedControls: [
    'BYTEPLUS_ARK_SEEDANCE_2_5_MODEL_ID',
    'SEEDANCE_2_5_BYTEPLUS_ENABLED',
    'SEEDANCE_2_5_PROVIDER',
    'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY',
    'SEEDANCE_2_5_BYTEPLUS_MODES',
  ],
  nextRequiredPhase: 'post_launch_monitoring',
} as const;
