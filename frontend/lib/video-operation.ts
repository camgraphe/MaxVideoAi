import { effectiveLumaEditValues } from '../src/lib/luma-edit-controls';
import type { EngineCaps, EngineInputSchema, EngineModeUiCaps, Mode } from '@/types/engines';

export const VIDEO_OPERATIONS = ['kling-reference', 'kling-edit', 'luma-extend'] as const;
export type VideoOperation = (typeof VIDEO_OPERATIONS)[number];
export type VideoOperationCaps = {
  operation: VideoOperation;
  mode: 'v2v' | 'extend';
  label: string;
  defaultForMode?: boolean;
  inputSchema: EngineInputSchema;
  ui: EngineModeUiCaps;
  promptRequired: boolean;
  transport?: 'fal' | 'luma_agents_direct';
  endpoint?: string;
};
const KLING_OMNI_IDS = new Set(['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k']);

/** Omission is intentionally not normalized to Reference: old JSON and receipts stay stable. */
export function normalizeVideoOperation(engineId: string, mode: string, value: unknown): VideoOperation | undefined {
  if (value === undefined) return undefined;
  if (engineId === 'luma-ray-3-2' && mode === 'extend' && value === 'luma-extend') return value;
  if (!KLING_OMNI_IDS.has(engineId) || mode !== 'v2v'
    || (value !== 'kling-reference' && value !== 'kling-edit')) {
    throw new Error('Unsupported video operation for this engine and mode.');
  }
  return value;
}

export function videoOperationEndpoint(engineId: string, mode: string, value: unknown): string | undefined {
  const operation = normalizeVideoOperation(engineId, mode, value);
  if (operation === 'luma-extend') return undefined;
  if (!operation && engineId === 'kling-o3-4k' && mode === 'v2v') return 'fal-ai/kling-video/o3/4k/video-to-video/reference';
  if (!operation || (operation === 'kling-reference' && engineId !== 'kling-o3-4k')) return undefined;
  const tier = engineId.slice('kling-o3-'.length);
  return `fal-ai/kling-video/o3/${tier}/video-to-video/${operation === 'kling-edit' ? 'edit' : 'reference'}`;
}

/** Full schemas, never a partial overlay that leaks requested timing into Edit. */
export function buildKlingOperationCaps(engine: EngineCaps): Partial<Record<VideoOperation, VideoOperationCaps>> {
  const resolution = engine.id === 'kling-o3-4k' ? '4k' : engine.id === 'kling-o3-standard' ? '720p' : '1080p';
  const editSchema: EngineInputSchema = {
    required: [
      { id: 'prompt', type: 'text', label: 'Edit instruction', modes: ['v2v'] },
      { id: 'video_url', type: 'video', label: 'Source video', description: 'Owned 3–15 second video; width and height must each be 720–3840 pixels.', modes: ['v2v'], requiredInModes: ['v2v'],
        source: 'either', minCount: 1, maxCount: 1, minDurationSec: 3, maxDurationSec: 15, maxSizeMB: 200,
        acceptedFileExtensions: ['mp4', 'mov'], acceptedMimeTypes: ['video/mp4', 'video/quicktime'] },
    ],
    optional: [
      { id: 'image_urls', type: 'image', label: 'Reference images', modes: ['v2v'], source: 'either',
        minCount: 0, maxCount: 4, slotLabelPattern: '@Image{n}' },
      { id: 'enable_safety_checker', type: 'boolean', label: 'Safety checker', modes: ['v2v'], default: true },
      { id: 'shot_type', type: 'enum', label: 'Shot type', modes: ['v2v'], values: ['customize'], default: 'customize' },
      { id: 'keep_audio', type: 'boolean', label: 'Keep source audio', modes: ['v2v'], default: true },
      { id: 'resolution', type: 'enum', label: 'Resolution', modes: ['v2v'], values: [resolution], default: resolution },
    ],
    constraints: { ...engine.inputSchema?.constraints, maxVideoSizeMB: 200, ownedAssetModes: ['v2v'] },
  };
  const ui: EngineModeUiCaps = { modes: ['v2v'], durationPolicy: 'source_video', resolution: [resolution],
    resolutionLocked: true, maxUploadMB: 200, audioToggle: false,
    notes: 'Edits a 3–15 second source with each side between 720 and 3840 pixels, preserving its timing and framing. Up to four images and elements combined.' };
  return {
    'kling-reference': { operation: 'kling-reference', mode: 'v2v', label: 'Reference', defaultForMode: true,
      inputSchema: engine.inputSchema!, ui: engine.modeCaps!.v2v!, promptRequired: true,
      ...(engine.id === 'kling-o3-4k' ? { transport: 'fal' as const,
        endpoint: videoOperationEndpoint(engine.id, 'v2v', 'kling-reference') } : {}) },
    'kling-edit': { operation: 'kling-edit', mode: 'v2v', label: 'Edit', inputSchema: editSchema, ui,
      promptRequired: true, transport: 'fal', endpoint: videoOperationEndpoint(engine.id, 'v2v', 'kling-edit') },
  };
}

export function resolveVideoOperationEngine(engine: EngineCaps, mode: Mode, value?: unknown): EngineCaps {
  const operation = normalizeVideoOperation(engine.id, mode, value);
  if (!operation || operation === 'luma-extend') return engine;
  const caps = engine.operationCaps?.[operation];
  if (!caps || caps.mode !== mode) throw new Error('Video operation capabilities are unavailable.');
  return { ...engine, inputSchema: caps.inputSchema, resolutions: operation === 'kling-edit'
      ? (caps.ui.resolution as EngineCaps['resolutions'] | undefined) ?? engine.resolutions : engine.resolutions,
    inputLimits: { ...engine.inputLimits, ...(caps.transport === 'fal' ? { videoMaxDurationSec: 15 } : {}) },
    modeCaps: { ...engine.modeCaps, [mode]: caps.ui } };
}

/** New tariff identity never aliases historical Reference selectors. */
export function videoOperationTariffIdentity(engineId: string, mode: string, value?: unknown) {
  if (engineId === 'luma-ray-3-2' && mode === 'extend') {
    normalizeVideoOperation(engineId, mode, value);
    return { operation: 'luma-extend' as const, transport: 'luma_agents_direct' as const, endpoint: 'ray-3.2/video/generation-anchor' };
  }
  const endpoint = videoOperationEndpoint(engineId, mode, value);
  // 4K v2v has no historical contract, even when an older client omits operation.
  if (!endpoint && !(engineId === 'kling-o3-4k' && mode === 'v2v')) return undefined;
  return { operation: normalizeVideoOperation(engineId, mode, value) ?? 'kling-reference' as VideoOperation,
    transport: 'fal' as const,
    endpoint: endpoint ?? 'fal-ai/kling-video/o3/4k/video-to-video/reference' };
}

/** Keep inactive operation values in storage; filter only the outgoing payload. */
export function filterVideoOperationValues(engine: EngineCaps, mode: Mode, values: Record<string, unknown>) {
  if (engine.id === 'luma-ray-3-2') {
    const allowed = new Set([...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])].filter(field => !field.modes?.length || field.modes.includes(mode)).map(field => field.id));
    return effectiveLumaEditValues(Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key))));
  }
  if (!engine.operationCaps) return values;
  const allowed = new Set([...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])]
    .filter(field => !field.modes?.length || field.modes.includes(mode)).map(field => field.id));
  return Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
}

export function validateKlingEditSource(source: { durationSec?: number | null; width?: number | null; height?: number | null } | undefined): string | undefined {
  if (!source || typeof source.durationSec !== 'number' || !Number.isFinite(source.durationSec)
    || source.durationSec < 3 || source.durationSec > 15) return 'Kling Edit requires a verified 3–15 second source.';
  if (![source.width, source.height].every(side => typeof side === 'number' && Number.isFinite(side) && side >= 720 && side <= 3840)) {
    return 'Kling Edit requires verified source dimensions between 720 and 3840 pixels on each side.';
  }
  return undefined;
}

export function resolveVideoOperationRequestEngine(engine: EngineCaps, mode: Mode, body: Record<string, unknown>): EngineCaps {
  const resolved = resolveVideoOperationEngine(engine, mode, body.operation);
  if (body.operation === 'kling-edit' && ['duration', 'durationSec', 'durationOption', 'aspectRatio', 'fps', 'audio']
    .some(key => body[key] !== undefined)) {
    throw new Error('Kling Edit inherits source timing and framing; omit output duration, aspect ratio, fps and generated audio.');
  }
  return resolved;
}
