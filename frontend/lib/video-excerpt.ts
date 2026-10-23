import type { EngineCaps } from '@/types/engines';
import { getVideoWorkflowSourceField, type VideoSourceWorkflow } from '@/lib/video-source-workflow';
import { videoDurationPolicy } from '@/lib/video-workflow-capabilities';

// Operational budgets apply only to excerpt preparation, never model generation.
export const VIDEO_EXCERPT_PREPARATION_LIMITS = Object.freeze({ maxBytes: 100 * 1024 * 1024, maxSourceSec: 180, maxExcerptSec: 60, maxPixels: 16_777_216, maxFps: 120 });

export type VideoExcerptRange = { startSec: number; endSec: number };
export type VideoExcerptLimits = Readonly<{
  sourceFieldId: string;
  minDurationSec: number | null;
  maxDurationSec: number | null;
  maxSizeMB: number | null;
  durationPolicy: 'requested' | 'source_video' | 'source_audio';
}>;
const positive = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

/** Model input policy only. Worker preparation budgets must never become generation limits. */
export function getVideoExcerptLimits(engine: EngineCaps, mode: VideoSourceWorkflow): VideoExcerptLimits | null {
  if (!engine.modes.includes(mode) || engine.modeAvailability?.[mode]?.available === false) return null;
  const field = getVideoWorkflowSourceField(engine.inputSchema, mode);
  if (!field) return null;
  return {
    sourceFieldId: field.id,
    minDurationSec: positive(field.minDurationSec),
    maxDurationSec: positive(field.maxDurationSec) ?? positive(engine.inputLimits?.videoMaxDurationSec)
      ?? positive(engine.inputSchema?.constraints?.maxVideoDurationSec),
    maxSizeMB: positive(field.maxSizeMB) ?? positive(engine.inputLimits?.videoMaxMB)
      ?? positive(engine.inputSchema?.constraints?.maxVideoSizeMB),
    durationPolicy: videoDurationPolicy(engine, mode),
  };
}

export function validateVideoExcerptRange(range: VideoExcerptRange, sourceDurationSec: number, limits: VideoExcerptLimits): VideoExcerptRange {
  if (!range || !Number.isFinite(range.startSec) || !Number.isFinite(range.endSec)
    || !Number.isFinite(sourceDurationSec) || sourceDurationSec <= 0
    || range.startSec < 0 || range.endSec <= range.startSec || range.endSec > sourceDurationSec) {
    throw new Error('Choose a valid start and end within the source video.');
  }
  const length = range.endSec - range.startSec;
  if ((limits.minDurationSec !== null && length < limits.minDurationSec)
    || (limits.maxDurationSec !== null && length > limits.maxDurationSec)) {
    throw new Error('The selected excerpt does not meet this model’s source duration limits.');
  }
  return { startSec: range.startSec, endSec: range.endSec };
}
