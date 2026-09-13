import { createQuoteRepository, generationQuoteCodec } from './quote-repository';
import { hashCanonicalAudioRequest, normalizeAudioGenerationRequest, type CanonicalAudioRequest } from './audio-normalization';
import type { CanonicalGenerationRequest, GenerationFundingMode } from './generation-types';

const audioQuoteCodec = {
  surfaces: ['audio'] as const,
  normalize: normalizeAudioGenerationRequest,
  hash: hashCanonicalAudioRequest,
  parseFunding(snapshot: Record<string, unknown>, priceCents: number, currency: string, mode: GenerationFundingMode) {
    if (mode !== 'wallet' || Object.prototype.hasOwnProperty.call(snapshot, 'funding')
      || snapshot.totalCents !== priceCents || snapshot.currency !== currency) throw new Error('Invalid audio quote funding snapshot.');
    return null;
  },
};

export const audioQuoteRepository = createQuoteRepository(audioQuoteCodec);
export type CanonicalAnyGenerationRequest = CanonicalGenerationRequest | CanonicalAudioRequest;

/** Mixed-surface readers share strict codecs; paid execution always uses its own repository. */
export const anyGenerationQuoteRepository = createQuoteRepository<CanonicalAnyGenerationRequest>({
  surfaces: ['video', 'image', 'audio'],
  normalize(value) {
    return typeof value === 'object' && value !== null && 'surface' in value && value.surface === 'audio'
      ? audioQuoteCodec.normalize(value) : generationQuoteCodec.normalize(value);
  },
  hash(value) { return value.surface === 'audio' ? audioQuoteCodec.hash(value) : generationQuoteCodec.hash(value); },
  parseFunding(snapshot, priceCents, currency, mode, request) {
    return request.surface === 'audio' ? audioQuoteCodec.parseFunding(snapshot, priceCents, currency, mode)
      : generationQuoteCodec.parseFunding(snapshot, priceCents, currency, mode, request);
  },
});
