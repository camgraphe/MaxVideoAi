import type { ToolAssetRef } from '@/lib/toolbox/contract';

/** Evidence recorded by the source probe, never requested generation settings. */
export type MediaFacts = { source: 'probe'; durationSec?: number; width?: number; height?: number; hasAudio?: boolean };

export function readMediaFacts(value: unknown): MediaFacts | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.source !== 'probe') return undefined;
  const facts: MediaFacts = { source: 'probe' };
  for (const key of ['durationSec', 'width', 'height'] as const) {
    const field = record[key];
    if (typeof field === 'number' && Number.isFinite(field) && field > 0) facts[key] = field;
  }
  if (typeof record.hasAudio === 'boolean') facts.hasAudio = record.hasAudio;
  return Object.keys(facts).length > 1 ? facts : undefined;
}

export function canonicalMediaAssetFields(value: unknown, kind: ToolAssetRef['kind']): { assetId?: string; ref?: ToolAssetRef } {
  if (typeof value !== 'string' || !/^ma_[a-f0-9]{32}$/u.test(value)) return {};
  return { assetId: value, ref: { type: 'asset', assetId: value, kind } };
}

/** Resolve public source identity without changing the row ID used for mutations. */
export function resolveMediaSourceRef(value: unknown, kind: ToolAssetRef['kind']): ToolAssetRef | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const asset = value as Record<string, unknown>;
  if (asset.kind != null && asset.kind !== kind) return undefined;
  const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 256 && id === id.trim();
  const publicRef = canonicalMediaAssetFields(asset.assetId, kind).ref;
  if (asset.assetId != null && !publicRef) return undefined;
  if (asset.ref != null) {
    if (typeof asset.ref !== 'object' || Array.isArray(asset.ref)) return undefined;
    const ref = asset.ref as Record<string, unknown>;
    if (ref.kind !== kind) return undefined;
    if (ref.type === 'asset') {
      const canonical = canonicalMediaAssetFields(ref.assetId, kind).ref;
      if (!canonical || (publicRef?.type === 'asset' && publicRef.assetId !== ref.assetId)) return undefined;
      return canonical;
    }
    if (ref.type !== 'job-output' || publicRef || !validId(ref.jobId) || !validId(ref.outputId)
      || (asset.jobId != null && asset.jobId !== ref.jobId)
      || (asset.sourceOutputId != null && asset.sourceOutputId !== ref.outputId)) return undefined;
    return { type: 'job-output', jobId: ref.jobId, outputId: ref.outputId, kind };
  }
  if (publicRef) return publicRef;
  const legacyCanonical = canonicalMediaAssetFields(asset.id, kind).ref;
  if (legacyCanonical) return legacyCanonical;
  if (validId(asset.jobId) && validId(asset.sourceOutputId)) return { type: 'job-output', jobId: asset.jobId, outputId: asset.sourceOutputId, kind };
  return undefined;
}
