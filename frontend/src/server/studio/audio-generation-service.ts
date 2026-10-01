import {isWorkspaceModelCertifiedForBlock} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-certification';
import {withDbTransaction, type TransactionQueryExecutor} from '@/lib/db';
import {AgentApiError} from '@/server/agent-api/errors';
import {requireAudioGenerationActor, type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {listAudioCapabilities} from '@/server/agent-api/audio-capabilities';
import {audioQuoteRepositoryForActor} from '@/server/agent-api/audio-quote-repository';
import {resolveOwnedAudioReferenceForActor} from '@/server/agent-api/audio-reference-assets';
import {createPrepareAudioGenerationForActorService, type PrepareAudioGenerationDependencies, type PrepareAudioGenerationInput} from '@/server/agent-api/prepare-audio-generation';
import {createConfirmAudioGenerationForActorService, type ConfirmAudioGenerationDependencies, type ConfirmAudioGenerationInput} from '@/server/agent-api/confirm-audio-generation';
import type {CanonicalAudioRequest} from '@/server/agent-api/audio-normalization';
import type {McpGenerationQuote} from '@/server/agent-api/quote-repository';
import {getGenerationStatus} from '@/server/generations/generation-status';
import {getWalletSummary} from '@/server/wallet-summary';
import {readImageConversationProject} from './image-conversation-repository';
import {resolveStudioMedia} from './media-resolver';

function qualified(capabilities: ReturnType<typeof listAudioCapabilities>) {
  return {...capabilities, modes: capabilities.modes.filter(mode => (mode.mode === 'voice_only' || mode.mode === 'music_only') && isWorkspaceModelCertifiedForBlock({
    modelId: mode.engineId, presetId: mode.mode === 'voice_only' ? 'audio-voiceover' : 'audio-music',
    workflowType: mode.mode === 'voice_only' ? 'voiceover_generation' : 'music_generation',
  }))};
}

export type StudioAudioGenerationOptions = {
  enabled: boolean;
  prepareDependencies?: Partial<PrepareAudioGenerationDependencies>;
  confirmDependencies?: Partial<ConfirmAudioGenerationDependencies>;
  onQuotePrepared?(quote: McpGenerationQuote<CanonicalAudioRequest>, executor: TransactionQueryExecutor): Promise<void>;
};

/** Shares Audio validation, quote snapshots, reservation, execution and refund with OAuth. */
export function createStudioAudioGenerationService(actor: StudioGenerationActor, options: StudioAudioGenerationOptions) {
  requireAudioGenerationActor(actor);
  if (actor.authMethod !== 'studio-session') throw new AgentApiError('AUTH_REQUIRED', 'Studio session required.');
  const quotes = audioQuoteRepositoryForActor(actor);
  const prepareDeps = options.prepareDependencies ?? {};
  const confirmDeps = options.confirmDependencies ?? {};
  const resolve: PrepareAudioGenerationDependencies['resolveReference'] = async (_actor, reference) => {
    await resolveStudioMedia(actor.userId, reference.asset);
    return resolveOwnedAudioReferenceForActor(actor, reference);
  };
  const prepare = createPrepareAudioGenerationForActorService('https://maxvideoai.com/account/connections', {
    ...prepareDeps, paidGenerationEnabled: () => options.enabled,
    listCapabilities: () => qualified((prepareDeps.listCapabilities ?? listAudioCapabilities)()), resolveReference: prepareDeps.resolveReference ?? resolve,
    insertPreparedQuote: async (input, dependencies) => {
      const quote = await quotes.insertPreparedQuote(input, dependencies);
      if (options.onQuotePrepared) await options.onQuotePrepared(quote, dependencies.executor as TransactionQueryExecutor);
      return quote;
    },
  });
  const confirm = createConfirmAudioGenerationForActorService('https://maxvideoai.com/account/connections', {
    ...confirmDeps, paidGenerationEnabled: () => options.enabled,
    listCapabilities: () => qualified((confirmDeps.listCapabilities ?? listAudioCapabilities)()),
    resolveReference: confirmDeps.resolveReference ?? (async (_actor, reference, {executor}) => {
      await resolveStudioMedia(actor.userId, reference.asset, (sql, values) => executor.query(sql, values), {lockAsset: true});
      return resolveOwnedAudioReferenceForActor(actor, reference, {executor});
    }),
  });
  const project = () => readImageConversationProject(actor.userId, actor.projectId);
  const owner = (quoteId: string) => ({quoteId, userId: actor.userId, oauthClientId: null});
  return {
    walletSummary: () => (prepareDeps.getWalletSummary ?? getWalletSummary)(actor.userId),
    catalog: async () => {await project(); return qualified((prepareDeps.listCapabilities ?? listAudioCapabilities)());},
    async prepare(input: PrepareAudioGenerationInput) {await project(); return prepare(input, actor);},
    async confirm(input: ConfirmAudioGenerationInput) {
      await project();
      try {return await confirm(input, actor);}
      catch (error) {
        if (error instanceof AgentApiError && ['QUOTE_EXPIRED','REFERENCE_INVALID'].includes(error.code))
          await withDbTransaction(executor => quotes.invalidatePreparedQuote(owner(input.quoteId), {executor, expiredAt: new Date()}));
        throw error;
      }
    },
    async getQuote(quoteId: string) {await project(); return quotes.getOwnedQuote(owner(quoteId));},
    async recover(quoteId: string) {
      await project();
      const quote = await quotes.getOwnedQuote(owner(quoteId));
      if (!quote) throw new AgentApiError('QUOTE_EXPIRED', 'This Audio quote is not available in this project.');
      return quote.jobId ? getGenerationStatus({userId: actor.userId, jobId: quote.jobId}) : null;
    },
  };
}
