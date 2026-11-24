import { draftSurface } from '@/lib/studio/image-conversation-contract';
import { AgentApiError } from '@/server/agent-api/errors';
import type { StudioGenerationActor } from '@/server/agent-api/generation-actor';
import { stableJson } from '@/server/agent-api/generation-normalization';
import type { McpGenerationQuote } from '@/server/agent-api/quote-repository';
import type { TransactionQueryExecutor } from '@/lib/db';
import type { StudioMediaFactories } from './conversation-media-generation';
import { attachImageQuote, type StoredImageTurn } from './image-conversation-repository';

/** Reprice the request the customer reviewed, including any defaults chosen by the original catalog. */
export async function renewReviewedStudioGeneration(
  actor: StudioGenerationActor,
  turn: StoredImageTurn,
  originalQuoteId: string,
  factories: StudioMediaFactories,
  enabled: boolean,
  mediaEnabled: boolean,
) {
  const surface = draftSurface(turn.draft_json);
  const options = { enabled: enabled && (surface === 'image' || mediaEnabled) };
  const original = await factories[surface](actor, options).getQuote(originalQuoteId);
  if (
    !original ||
    original.jobId ||
    !(
      original.state === 'expired' ||
      (original.state === 'prepared' && original.expiresAt.getTime() <= Date.now())
    )
  )
    throw new AgentApiError('QUOTE_EXPIRED', 'Only an expired, unused quote can be renewed.');
  const { request: frozen, requestHash, pricingSnapshot } = original;
  function sourceFacts(snapshot: Record<string, unknown>) {
    return frozen.surface === 'audio'
      ? (snapshot.mcpAudio as { references?: unknown } | undefined)?.references
      : snapshot.studioReferenceFingerprint;
  }
  const originalFacts = sourceFacts(pricingSnapshot);
  const onQuotePrepared = async (
    fresh: Pick<McpGenerationQuote, 'quoteId' | 'requestHash' | 'pricingSnapshot'>,
    executor: TransactionQueryExecutor,
  ) => {
    if (fresh.requestHash !== requestHash)
      throw new AgentApiError(
        'QUOTE_EXPIRED',
        'The saved settings are no longer available. Review a new preparation.',
      );
    const currentFacts = sourceFacts(fresh.pricingSnapshot);
    if (
      frozen.references.length &&
      (!originalFacts || !currentFacts || stableJson(originalFacts) !== stableJson(currentFacts))
    )
      throw new AgentApiError('REFERENCE_INVALID', 'The saved sources changed. Review them in the project.');
    // Quote insert and turn backlink commit together after current source and catalog validation.
    await attachImageQuote(actor, turn, fresh.quoteId, executor, true);
  };
  const current = { ...options, onQuotePrepared };
  if (frozen.surface === 'audio') return factories.audio(actor, current).prepare(frozen);
  return factories[frozen.surface](actor, current).prepare(frozen);
}
