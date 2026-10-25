import { isLumaSourceVideoMode, validateLumaSourceVideoTiming, lumaModifyTariffDurationSec } from '@/lib/luma-source-video';
import type { CanonicalGenerationRequest } from './generation-types';
import type { ResolvedReference } from './reference-types';

/** Shared by estimates and locked transaction repricing; unresolved URLs cannot establish timing. */
export function assertCanonicalLumaSourceTiming(request: CanonicalGenerationRequest, resolvedReferences?: readonly ResolvedReference[]): number | undefined {
  if (!isLumaSourceVideoMode(request.engineId, request.mode)) return;
  const sources = request.references.filter(reference => reference.role === 'source');
  const source = sources[0];
  if (sources.length !== 1 || source.kind !== 'asset') throw new Error('One owned Luma source video is required.');
  const matches = resolvedReferences?.filter(resolved => resolved.assetId === source.assetId
    && resolved.role === source.role && resolved.slot === source.slot && resolved.mediaKind === 'video');
  if (matches?.length !== 1) throw new Error('Exact owned Luma source metadata is required.');
  const error = validateLumaSourceVideoTiming({ engineId: request.engineId, mode: request.mode,
    sourceDurationSec: matches[0]!.durationSec, durationSec: Number(request.settings.durationSec) });
  if (error) throw new Error(error);
  return request.mode === 'v2v' ? lumaModifyTariffDurationSec(matches[0]!.durationSec!) : undefined;
}
