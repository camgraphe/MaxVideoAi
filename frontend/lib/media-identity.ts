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
