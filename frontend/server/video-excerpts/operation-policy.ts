import type { EngineCaps, Mode } from '@/types/engines';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import { getMediaExcerptLimits, getVideoExcerptLimits } from '@/lib/video-excerpt';
import { isVideoSourceWorkflow } from '@/lib/video-source-workflow';
import { VideoExcerptError } from './media';

/** Resolve the same strict operation schema at admission and immediately before/after storage. */
export function excerptOperationPolicy(engine: EngineCaps | undefined | null, input: {
  mode: Mode; operation?: unknown; fieldId?: string;
}, kind: 'video' | 'audio') {
  if (!engine) throw new VideoExcerptError('ENGINE_UNAVAILABLE', 'The selected model is unavailable.');
  let effective: EngineCaps;
  try { effective = resolveVideoOperationEngine(engine, input.mode, input.operation); }
  catch { throw new VideoExcerptError('PARAMETER_INVALID', 'Choose a supported operation for this model and mode.'); }
  // Provider generation/cache lineage cannot be manufactured by an uploaded derivative.
  if ((engine.id === 'luma-ray-3-2' && input.mode === 'extend') || input.operation === 'flux-draft-enhance')
    throw new VideoExcerptError('PARAMETER_INVALID', 'Choose an eligible owned generation for this operation.');
  const fieldId = input.fieldId;
  if (fieldId && ![...(effective.inputSchema?.required ?? []), ...(effective.inputSchema?.optional ?? [])]
    .some(field => field.id === fieldId && field.type === kind && (!field.modes?.length || field.modes.includes(input.mode))))
    throw new VideoExcerptError('PARAMETER_INVALID', 'Choose a supported media input for this operation.');
  const limits = fieldId ? getMediaExcerptLimits(effective, input.mode, fieldId)
    : kind === 'video' && isVideoSourceWorkflow(input.mode) ? getVideoExcerptLimits(effective, input.mode) : null;
  if (!limits) throw new VideoExcerptError('ENGINE_UNAVAILABLE', 'This media input is unavailable.');
  return limits;
}
