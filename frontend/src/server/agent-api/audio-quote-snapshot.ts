import { createHash } from 'node:crypto';

import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { ToolAssetRef } from '@/lib/toolbox/contract';
import type { PreparedAudioRun } from '@/server/audio/audio-run-reservation';

import { stableJson } from './generation-normalization';

export type ResolvedAudioReference = {
  role: 'source_video' | 'voice_sample';
  asset: ToolAssetRef;
  originalUrl: string;
  mimeType: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
};

export type AudioQuoteExecutionEvidence = {
  schemaVersion: 1;
  requestHash: string;
  references: ResolvedAudioReference[];
  durationSec: number;
  aspectRatio: string | null;
  sourceProbe: { durationSec: number; width: number; height: number; hasAudio: boolean } | null;
  inputKey: string;
  evidenceHash: string;
};

export type AudioQuotePricingSnapshot = PricingSnapshot & Record<string, unknown> & {
  mcpAudio: AudioQuoteExecutionEvidence;
};

type EvidenceWithoutHash = Omit<AudioQuoteExecutionEvidence, 'evidenceHash'>;

function evidenceHash(value: EvidenceWithoutHash): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function buildAudioQuotePricingSnapshot(input: {
  requestHash: string;
  references: ResolvedAudioReference[];
  prepared: PreparedAudioRun;
}): AudioQuotePricingSnapshot {
  const evidence: EvidenceWithoutHash = {
    schemaVersion: 1,
    requestHash: input.requestHash,
    references: input.references,
    durationSec: input.prepared.durationSec,
    aspectRatio: input.prepared.aspectRatio,
    sourceProbe: input.prepared.sourceProbe,
    inputKey: input.prepared.inputKey,
  };
  return {
    ...input.prepared.pricingSnapshot,
    mcpAudio: { ...evidence, evidenceHash: evidenceHash(evidence) },
  };
}

export function parseAudioQuoteExecutionEvidence(value: Record<string, unknown>): AudioQuoteExecutionEvidence {
  const evidence = value.mcpAudio;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('Audio quote execution evidence is unavailable.');
  }
  const parsed = evidence as AudioQuoteExecutionEvidence;
  const { evidenceHash: storedHash, ...unsigned } = parsed;
  if (parsed.schemaVersion !== 1
    || typeof parsed.requestHash !== 'string'
    || !Array.isArray(parsed.references)
    || !Number.isFinite(parsed.durationSec)
    || parsed.durationSec <= 0
    || typeof parsed.inputKey !== 'string'
    || !/^[a-f0-9]{64}$/u.test(storedHash)
    || evidenceHash(unsigned) !== storedHash) {
    throw new Error('Audio quote execution evidence is invalid.');
  }
  return parsed;
}

export function sameAudioReferenceEvidence(
  prepared: readonly ResolvedAudioReference[],
  current: readonly ResolvedAudioReference[],
): boolean {
  return stableJson(prepared) === stableJson(current);
}
