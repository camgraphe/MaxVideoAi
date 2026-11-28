import { isPurchaseRoutingEngine } from './video-purchase-decision';
import type { EngineCaps } from '@/types/engines';

/** Workspace controls use model capabilities. The customer price comes from the quote. */
export function customerEngineCatalogEntry(engine: EngineCaps): EngineCaps {
  if (!isPurchaseRoutingEngine(engine.id)) return engine;
  return {
    id: engine.id,
    label: engine.label,
    provider: engine.provider,
    brandId: engine.brandId,
    brandAssetPolicy: engine.brandAssetPolicy,
    iconUrl: engine.iconUrl,
    fallbackIcon: engine.fallbackIcon,
    version: engine.version,
    variant: engine.variant,
    isLab: engine.isLab,
    status: engine.status,
    latencyTier: engine.latencyTier,
    availability: engine.availability,
    avgDurationMs: engine.avgDurationMs,
    durationSampleCount: engine.durationSampleCount,
    timingCells: engine.timingCells,
    durationSource: engine.durationSource,
    modes: engine.modes,
    modeAvailability: engine.modeAvailability && Object.fromEntries(
      Object.entries(engine.modeAvailability).map(([mode, state]) => [mode, {
        available: state.available,
        reason: state.available ? 'available' : 'unavailable',
        inheritsSourceVideo: state.inheritsSourceVideo,
      }]),
    ),
    modeCaps: engine.modeCaps,
    activeVideoOperation: engine.activeVideoOperation,
    operationCaps: engine.operationCaps && Object.fromEntries(
      Object.entries(engine.operationCaps).map(([key, caps]) => [key, {
        operation: caps.operation,
        mode: caps.mode,
        label: caps.label,
        defaultForMode: caps.defaultForMode,
        inputSchema: caps.inputSchema,
        ui: caps.ui,
        promptRequired: caps.promptRequired,
        promptMaxChars: caps.promptMaxChars,
      }]),
    ),
    maxDurationSec: engine.maxDurationSec,
    resolutions: engine.resolutions,
    aspectRatios: engine.aspectRatios,
    fps: engine.fps,
    audio: engine.audio,
    upscale4k: engine.upscale4k,
    extend: engine.extend,
    motionControls: engine.motionControls,
    keyframes: engine.keyframes,
    params: engine.params,
    inputLimits: engine.inputLimits,
    inputSchema: engine.inputSchema,
    updatedAt: engine.updatedAt,
    ttlSec: engine.ttlSec,
  };
}
