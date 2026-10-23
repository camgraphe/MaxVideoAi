import type { EngineCaps, Mode } from '@/types/engines';
import { getVideoWorkflowSourceField, isVideoSourceWorkflow, type VideoSourceWorkflow } from '@/lib/video-source-workflow';
import { resolveEngineMediaFieldConstraint, validateMediaFileAgainstConstraint } from '@/lib/media-field-constraints';
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

/** The selected slot owns preparation policy, including reference clips in Create. */
export function getMediaExcerptLimits(engine: EngineCaps, mode: Mode, fieldId: string): VideoExcerptLimits | null {
  if (!engine.modes.includes(mode) || engine.modeAvailability?.[mode]?.available === false) return null;
  const field = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])]
    .find(value => value.id === fieldId && (value.type === 'video' || value.type === 'audio')
      && (!value.modes?.length || value.modes.includes(mode)));
  if (!field) return null;
  const constraint = resolveEngineMediaFieldConstraint({ engine, field });
  const audio = field.type === 'audio';
  // Do not offer preparation when our output format is not accepted by this field.
  if (!validateMediaFileAgainstConstraint({ name: audio ? 'excerpt.wav' : 'excerpt.mp4',
    mimeType: audio ? 'audio/wav' : 'video/mp4', sizeBytes: 1, constraint }).ok) return null;
  if (!audio && isVideoSourceWorkflow(mode) && getVideoWorkflowSourceField(engine.inputSchema, mode)?.id === fieldId)
    return getVideoExcerptLimits(engine, mode);
  return {
    sourceFieldId: fieldId,
    minDurationSec: positive(field.minDurationSec),
    maxDurationSec: positive(field.maxDurationSec) ?? positive(audio ? engine.inputLimits?.audioMaxDurationSec : engine.inputLimits?.videoMaxDurationSec)
      ?? positive(audio ? engine.inputSchema?.constraints?.maxAudioDurationSec : engine.inputSchema?.constraints?.maxVideoDurationSec),
    maxSizeMB: positive(constraint.maxSizeMB),
    durationPolicy: videoDurationPolicy(engine, mode),
  };
}

export function mediaExcerptNeedsSelection(engine: EngineCaps, mode: Mode,
  assets: Record<string, ({ durationSec?: number | null; excerptEditing?: boolean } | null)[]>) {
  return Object.entries(assets).some(([fieldId, entries]) => {
    const limits = getMediaExcerptLimits(engine, mode, fieldId);
    return entries.some(asset => asset?.excerptEditing || (limits && typeof asset?.durationSec === 'number'
      && ((limits.minDurationSec !== null && asset.durationSec < limits.minDurationSec)
        || (limits.maxDurationSec !== null && asset.durationSec > limits.maxDurationSec))));
  });
}

/** Unified Create can import a reference before its presence selects ref2v/a2v. */
export function getMediaExcerptImportMode(engine: EngineCaps, mode: Mode, fieldId: string): Mode | null {
  if (getMediaExcerptLimits(engine, mode, fieldId)) return mode;
  if (!['t2v', 'i2v', 'ref2v', 'fl2v'].includes(mode)) return null;
  return (['ref2v', 'a2v', 'i2v', 't2v'] as Mode[]).find(candidate => getMediaExcerptLimits(engine, candidate, fieldId)) ?? null;
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
