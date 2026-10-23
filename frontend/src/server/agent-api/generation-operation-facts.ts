import { createHash } from 'node:crypto';
import { videoOperationTariffIdentity, validateKlingEditSource } from '@/lib/video-operation';
import type { CanonicalGenerationRequest } from './generation-types';
import type { ResolvedReference } from './reference-types';

/** Exact owned source timing, never a caller duration or rounded placeholder. */
export function canonicalOperationSourceDuration(request: CanonicalGenerationRequest, references?: readonly ResolvedReference[]): number | undefined {
  if (request.operation !== 'kling-edit') return undefined;
  const sources = request.references.filter(reference => reference.role === 'source');
  if (sources.length !== 1 || sources[0]!.kind !== 'asset') throw new Error('Kling Edit requires one owned source video.');
  const source = sources[0]!;
  const matches = references?.filter(reference => reference.assetId === source.assetId && reference.role === 'source'
    && reference.slot === source.slot && reference.mediaKind === 'video') ?? [];
  const duration = matches[0]?.durationSec;
  if (matches.length !== 1 || typeof duration !== 'number' || !Number.isFinite(duration) || duration < 3 || duration > 15) {
    throw new Error('Kling Edit requires verified source timing from 3 to 15 seconds.');
  }
  const sourceError = validateKlingEditSource(matches[0]);
  if (sourceError) throw new Error(sourceError);
  return duration;
}

export function generationOperationQuoteBinding(request: CanonicalGenerationRequest, references: readonly ResolvedReference[]) {
  const identity = videoOperationTariffIdentity(request.engineId, request.mode, request.operation);
  if (!identity) return {};
  const sourceDurationSec = canonicalOperationSourceDuration(request, references);
  const sources = references.filter(reference => reference.role === 'source').map(reference => ({
    assetId: reference.assetId, url: reference.storageUrl, durationSec: reference.durationSec,
    width: reference.width, height: reference.height, mimeType: reference.mimeType, sizeBytes: reference.sizeBytes,
  }));
  return { videoOperation: { ...identity, ...(sourceDurationSec !== undefined ? { sourceDurationSec } : {}),
    sourceFingerprint: createHash('sha256').update(JSON.stringify(sources)).digest('hex') } };
}
