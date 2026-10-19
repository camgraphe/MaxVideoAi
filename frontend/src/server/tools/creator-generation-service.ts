import type { TransactionQueryExecutor } from '@/lib/db';
import { AgentApiError } from '@/server/agent-api/errors';
import { requireGenerationActor, requireStudioGenerationRequest, studioReferenceFingerprint, type GenerationActor } from '@/server/agent-api/generation-actor';
import { normalizeGenerationRequest } from '@/server/agent-api/generation-normalization';
import { createPrepareGenerationForActorService, type PrepareGenerationDependencies, type PrepareGenerationInput } from '@/server/agent-api/prepare-generation';
import { createConfirmGenerationForActorService, type ConfirmGenerationDependencies, type ConfirmGenerationInput } from '@/server/agent-api/confirm-generation';
import { createQuoteRepository, generationQuoteCodec, type GenerationQuoteScope, type McpGenerationQuote } from '@/server/agent-api/quote-repository';
import { resolveOwnedReferenceAssetForActor } from '@/server/agent-api/reference-assets';
import type { ResolvedReference } from '@/server/agent-api/reference-types';
import type { CanonicalGenerationRequest } from '@/server/agent-api/generation-types';
import { getGenerationStatus } from '@/server/generations/generation-status';
import { resolveStudioMedia } from '@/server/studio/media-resolver';

export type CreatorGenerationOptions = {
  enabled: boolean;
  expectedReferenceFingerprint?: string;
  prepareDependencies?: Partial<Omit<PrepareGenerationDependencies, 'trialRiskContext'>>;
  confirmDependencies?: Partial<Omit<ConfirmGenerationDependencies, 'trialRiskContext'>>;
  onQuotePrepared?(quote: McpGenerationQuote, executor: TransactionQueryExecutor): Promise<void>;
};

/** Private transport adapter. Callers authorize the actor and choose a supported tool profile. */
export function createCreatorGenerationService(actor: GenerationActor, options: CreatorGenerationOptions) {
  requireGenerationActor(actor);
  const scope: GenerationQuoteScope = actor.authMethod === 'studio-session'
    ? { origin: 'studio-session', projectId: actor.projectId }
    : { origin: actor.authMethod };
  const quotes = createQuoteRepository(generationQuoteCodec, scope);
  const accountUrl = 'https://maxvideoai.com/account/connections';
  const context = { clientIp: null, userAgent: null };

  async function resolveReferences(request: CanonicalGenerationRequest, executor?: TransactionQueryExecutor): Promise<ResolvedReference[]> {
    requireStudioGenerationRequest(request);
    const references: ResolvedReference[] = [];
    for (const reference of request.references) {
      if (reference.kind !== 'asset') throw new AgentApiError('REFERENCE_INVALID', 'Choose owned media from your library.');
      try {
        const first = await resolveOwnedReferenceAssetForActor(actor, reference.assetId, executor ? { executor } : {});
        await resolveStudioMedia(actor.userId, { type: 'asset', assetId: reference.assetId, kind: first.mediaKind },
          executor ? (sql, params) => executor.query(sql, params) : undefined, { lockAsset: !!executor });
        const asset = executor ? await resolveOwnedReferenceAssetForActor(actor, reference.assetId, { executor }) : first;
        references.push({ ...asset, role: reference.role, ...(reference.slot === undefined ? {} : { slot: reference.slot }) });
      } catch {
        throw new AgentApiError('REFERENCE_INVALID', 'The selected source is unavailable. Choose it again from your library.');
      }
    }
    if (options.expectedReferenceFingerprint !== undefined && studioReferenceFingerprint(references) !== options.expectedReferenceFingerprint) {
      throw new AgentApiError('REFERENCE_INVALID', 'The selected source changed. Prepare a new quote.');
    }
    return references;
  }

  const prepare = createPrepareGenerationForActorService(accountUrl, context, {
    ...options.prepareDependencies,
    paidGenerationEnabled: () => options.enabled,
    // Tool operations have no trial preset. The original quote scope remains intact.
    getTrialEligibility: async () => ({ status: 'disabled' }),
    resolveGenerationReferences: request => resolveReferences(request),
    insertPreparedQuote: async (input, dependencies) => {
      const quote = await quotes.insertPreparedQuote(input, dependencies);
      await options.onQuotePrepared?.(quote, dependencies.executor as TransactionQueryExecutor);
      return quote;
    },
  });
  const confirm = createConfirmGenerationForActorService(accountUrl, context, {
    ...options.confirmDependencies,
    paidGenerationEnabled: () => options.enabled,
    trialGenerationEnabled: () => false,
    resolveGenerationReferences: (request, _actor, { executor }) => resolveReferences(request, executor),
    lockOwnedQuote: quotes.lockOwnedQuote,
    markQuoteExpired: quotes.markQuoteExpired,
    claimPreparedQuote: quotes.claimPreparedQuote,
    markQuoteAccepted: quotes.markQuoteAccepted,
    markQuoteFailed: quotes.markQuoteFailed,
  });
  return {
    async prepare(input: PrepareGenerationInput) {
      if (!options.enabled) throw new AgentApiError('ENGINE_UNAVAILABLE', 'This tool is currently unavailable.');
      let request: CanonicalGenerationRequest;
      try { request = normalizeGenerationRequest(input); } catch { throw new AgentApiError('PARAMETER_INVALID', 'The tool settings are invalid.'); }
      requireStudioGenerationRequest(request);
      return prepare(request, actor);
    },
    confirm: (input: ConfirmGenerationInput) => confirm(input, actor),
    status: (jobId: string) => getGenerationStatus({ userId: actor.userId, jobId }),
  };
}
