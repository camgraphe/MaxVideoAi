import { createHash } from 'node:crypto';

import { getAudioPackConfig } from '@/lib/audio-generation';
import { audioRequestToGenerationBody, hashCanonicalAudioRequest, type CanonicalAudioRequest } from '@/server/agent-api/audio-normalization';
import { parseAudioQuoteExecutionEvidence, type ResolvedAudioReference } from '@/server/agent-api/audio-quote-snapshot';
import { stableJson } from '@/server/agent-api/generation-normalization';
import type { McpGenerationQuote } from '@/server/agent-api/quote-repository';
import type { ReservedAudioRun } from './audio-run-reservation';
import { PLACEHOLDER_THUMB } from './audio-generate-jobs';
import { buildInitialAudioSettingsSnapshot } from './audio-generate-snapshots';
import { validateAudioGenerateRequest } from './audio-generate-validation';
import { audioQuoteInputKey } from './prepare-audio';

export function audioDispatchExecutionHash(execution: unknown): string {
  return createHash('sha256').update(stableJson(execution)).digest('hex');
}

function invalid(): never { throw new Error('Audio dispatch execution integrity is invalid.'); }
function equal(left: unknown, right: unknown): boolean { return stableJson(JSON.parse(JSON.stringify(left))) === stableJson(JSON.parse(JSON.stringify(right))); }

/** Restores only a fully quote-bound server reservation; never casts unverified JSON into provider input. */
export function validateAudioDispatchExecution(input: {
  execution: unknown; executionHash: string; requestHash: string; quoteId: string; userId: string; jobId: string;
  quote: McpGenerationQuote<CanonicalAudioRequest>; references: ResolvedAudioReference[];
}): ReservedAudioRun {
  const { quote } = input;
  if (audioDispatchExecutionHash(input.execution) !== input.executionHash
    || quote.quoteId !== input.quoteId || quote.userId !== input.userId || quote.jobId !== input.jobId
    || quote.requestHash !== input.requestHash || hashCanonicalAudioRequest(quote.request) !== input.requestHash) invalid();
  const evidence = parseAudioQuoteExecutionEvidence(quote.pricingSnapshot);
  if (evidence.requestHash !== input.requestHash || !equal(evidence.references, input.references)) invalid();
  const urls = Object.fromEntries(input.references.map(reference => [
    reference.role === 'source_video' ? 'sourceVideoUrl' : 'voiceSampleUrl', reference.originalUrl,
  ]));
  const normalized = validateAudioGenerateRequest(audioRequestToGenerationBody(quote.request, urls));
  const execution = input.execution as ReservedAudioRun;
  const prepared = execution?.prepared;
  if (!prepared || execution.userId !== input.userId || execution.jobId !== input.jobId
    || !equal(prepared.normalized, normalized) || !equal(prepared.packConfig, getAudioPackConfig(normalized.pack))
    || prepared.sourceJob !== null || prepared.sourceVideoUrl !== (urls.sourceVideoUrl ?? null)
    || prepared.durationSec !== evidence.durationSec || prepared.aspectRatio !== evidence.aspectRatio
    || !equal(prepared.sourceProbe, evidence.sourceProbe) || prepared.inputKey !== evidence.inputKey
    || prepared.inputKey !== audioQuoteInputKey(input.userId, normalized, evidence.durationSec)) invalid();
  const pricing = { ...quote.pricingSnapshot }; delete pricing.mcpAudio;
  if (!equal(prepared.pricingSnapshot, pricing) || !equal(JSON.parse(execution.pricingSnapshotJson), pricing)
    || pricing.totalCents !== quote.priceCents || pricing.currency !== quote.currency
    || execution.initialThumb !== PLACEHOLDER_THUMB
    || !equal(execution.initialSettingsSnapshot, buildInitialAudioSettingsSnapshot({ normalized,
      durationSec: evidence.durationSec, sourceJobId: null, sourceVideoUrl: urls.sourceVideoUrl ?? null }))) invalid();
  return execution;
}
