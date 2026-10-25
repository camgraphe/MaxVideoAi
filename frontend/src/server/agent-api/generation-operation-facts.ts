import { isFluxLtxSourceOperation, validateFluxLtxSource } from '@/lib/flux-ltx-operations';
import { isH3SourceOperation, validateH3Source } from '@/lib/h3-source-operations';
import { isElementReference } from '@/lib/kling-owned-elements';
import { createHash } from 'node:crypto';
import { videoOperationTariffIdentity, validateKlingEditSource } from '@/lib/video-operation';
import type { CanonicalGenerationRequest } from './generation-types';
import type { ResolvedReference } from './reference-types';

/** Exact owned source timing, never a caller duration or rounded placeholder. */
export function canonicalOperationSourceDuration(request: CanonicalGenerationRequest, references?: readonly ResolvedReference[], fluxDraftSource?: import('@/server/flux-draft-cache').QualifiedFluxDraftSource): number | undefined {
  if (request.operation==='flux-draft-enhance') {
    if(!fluxDraftSource||fluxDraftSource.jobId!==request.sourceJobId||(request.sourceOutputId&&fluxDraftSource.outputId!==request.sourceOutputId)) throw new Error('Qualified paired Draft duration is required.');
    return fluxDraftSource.durationSec;
  }
  if (request.operation !== 'kling-edit' && !isH3SourceOperation(request.operation) && !isFluxLtxSourceOperation(request.operation)) return undefined;
  const sources = request.references.filter(reference => reference.role === 'source');
  if (sources.length !== 1 || sources[0]!.kind !== 'asset') throw new Error('This operation requires one owned source video.');
  const source = sources[0]!;
  const matches = references?.filter(reference => reference.assetId === source.assetId && reference.role === 'source'
    && reference.slot === source.slot && reference.mediaKind === 'video') ?? [];
  const duration = matches[0]?.durationSec;
  if (matches.length !== 1 || typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('This operation requires verified source timing.');
  }
  const sourceError = isFluxLtxSourceOperation(request.operation) ? validateFluxLtxSource(request.operation,matches[0]) : isH3SourceOperation(request.operation) ? validateH3Source(request.operation,matches[0]) : validateKlingEditSource(matches[0]);
  if (sourceError) throw new Error(sourceError);
  return duration;
}

export function generationOperationQuoteBinding(request: CanonicalGenerationRequest, references: readonly ResolvedReference[], fluxDraftSource?: import('@/server/flux-draft-cache').QualifiedFluxDraftSource) {
  const identity = videoOperationTariffIdentity(request.engineId, request.mode, request.operation);
  const elementsBinding = request.elements ? { elementsFingerprint: createHash('sha256').update(JSON.stringify(references.filter(ref => isElementReference(ref, request.elements)))).digest('hex') } : {};
  if (!identity) return elementsBinding;
  const sourceDurationSec = canonicalOperationSourceDuration(request, references,fluxDraftSource);
  const sources = references.filter(reference => reference.role === 'source').map(reference => ({
    assetId: reference.assetId, url: reference.storageUrl, durationSec: reference.durationSec,
    sourceSha256: reference.sourceSha256, decodedFrameCount: reference.decodedFrameCount, fps: reference.fps, constantFrameRate: reference.constantFrameRate,
    width: reference.width, height: reference.height, mimeType: reference.mimeType, sizeBytes: reference.sizeBytes,
  }));
  return { ...elementsBinding, videoOperation: { ...identity, ...(sourceDurationSec !== undefined ? { sourceDurationSec } : {}),
    sourceFingerprint: createHash('sha256').update(JSON.stringify(sources)).digest('hex') } };
}
