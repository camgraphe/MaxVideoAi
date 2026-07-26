/**
 * Documentation-only Seedance 2.5 launch gate.
 *
 * Runtime code must not import this file.
 * An executable engine entry can be authored only from official BytePlus
 * ModelArk documentation.
 */
export const seedance25EngineEvidenceGate = {
  canonicalEngineId: 'seedance-2-5',
  documentationOnly: true,
  runtimeEntryAllowed: false,
  requiredOfficialApiFacts: [
    'canonical BytePlus model ID and supported regions',
    'entitlement and release status',
    'supported input modes and payload roles',
    'duration, resolution, aspect-ratio, FPS, and audio options',
    'combined and per-media reference limits, formats, sizes, and durations',
    'prompt and reference anchor syntax plus ordering rules',
    'editing and extension semantics',
    'task status, webhook, output, expiration, and usage schemas',
    'moderation and provider error codes',
    'concurrency, RPM, quotas, and service tiers',
    'vendor pricing units, failure charging, and refund behavior',
    'written integration, redistribution, and trademark clearance',
  ],
  promotionOrder: [
    'hidden_execution',
    'admin_canary',
    'public_noindex',
    'public_indexed',
  ],
} as const;
