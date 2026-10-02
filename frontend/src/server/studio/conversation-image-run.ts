import {withDbTransaction,isTransactionQueryExecutor} from '@/lib/db';
import {AgentApiError, toAgentApiFailure} from '@/server/agent-api/errors';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {ResolvedReference} from '@/server/agent-api/reference-types';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import type {StudioActionRequest, StudioActionResult} from '@/lib/studio/conversation-action-contract';
import {createStudioConversationDirector, type StudioResponseCreator} from './conversation-director';
import {createStudioActionExecutor} from './conversation-actions';
import {beginStudioAction, completeStudioAction, checkpointStudioResponse, readStudioConversationProject, saveStudioConversationMemory} from './conversation-run-repository';
import {attachImageQuote, persistImageDraft, type StoredImageTurn} from './image-conversation-repository';
import {imageRequestFromDraft,imageReferenceFingerprintFromReview, type ImageGenerationFactory} from './image-conversation-service';
import {studioMediaRequest, type StudioMediaFactories} from './conversation-media-generation';
import {draftSurface} from '@/lib/studio/image-conversation-contract';
import type {StudioMediaIntent} from '@/lib/studio/conversation-media-contract';
import type {TransactionQueryExecutor} from '@/lib/db';
import type {CanonicalAudioRequest} from '@/server/agent-api/audio-normalization';
import type {CanonicalGenerationRequest} from '@/server/agent-api/generation-types';
import type {McpGenerationQuote} from '@/server/agent-api/quote-repository';
import {listImageTurns} from './image-conversation-repository';
import {editStudioConversationTimeline} from './conversation-edit-command';
import {readStudioWorkspace} from './workspace-command';
import {StudioConnectedPersistenceError} from './montage-command';
import {discardStudioPreparedQuote} from './conversation-quote-command';
import {imageSelectionSchema} from '@/lib/studio/conversation-creation-contract';

async function prepareMediaAction(options: {
  actor: StudioGenerationActor; turn: StoredImageTurn; input: ImageTurnInput;
  referenceFingerprint: string; enabled: boolean; factories: StudioMediaFactories;
}, action: StudioMediaIntent, callId: string) {
  const {actor, turn, factories} = options;
  if (!turn.draft_json) await persistImageDraft(actor, turn, {reply: action.reply, image: null, media: action}, options.referenceFingerprint);
  const request = await studioMediaRequest(actor, action, options.input, factories, options.enabled);
  const onQuotePrepared = async (quote: McpGenerationQuote<CanonicalGenerationRequest | CanonicalAudioRequest>, executor: TransactionQueryExecutor) => {
    await attachImageQuote(actor, turn, quote.quoteId, executor);
    await completeStudioAction(actor, turn, callId, {ok: true, action: action.action, data: {
      quoteId: quote.quoteId, expiresAt: quote.expiresAt.toISOString(), requestHash: quote.requestHash, summary: quote.request,
      price: {amountCents: quote.priceCents, currency: quote.currency}, fundingMode: quote.fundingMode, confirmationRequired: true,
    }} as StudioActionResult, executor);
  };
  if (request.surface === 'video') return factories.video(actor, {enabled: options.enabled, onQuotePrepared}).prepare(request);
  return factories.audio(actor, {enabled: options.enabled, onQuotePrepared}).prepare(request);
}

export async function resumeStudioImageAction(options: {
  actor: StudioGenerationActor; turn: StoredImageTurn; input: ImageTurnInput;
  references: ResolvedReference[]; referenceFingerprint: string; enabled: boolean; factory: ImageGenerationFactory;
  factories?: StudioMediaFactories; mediaEnabled?: boolean;
}) {
  const {actor, turn, factory} = options;
  const draft = turn.draft_json;
  if (draft?.media) {
    if (!options.mediaEnabled || !options.factories) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Studio media tools are unavailable.');
    const callId = 'resume-quote-' + turn.lease_id;
    const prior = await beginStudioAction(actor, turn, callId, draft.media);
    if (prior) return prior;
    try {return await prepareMediaAction({...options, factories: options.factories}, draft.media, callId);}
    catch (error) {
      await completeStudioAction(actor, turn, callId, {...toAgentApiFailure(error instanceof AgentApiError ? error : new AgentApiError('INTERNAL_ERROR', 'Studio could not prepare this saved media.', true)), action: draft.media.action});
      throw error;
    }
  }
  if (!draft?.image) throw new AgentApiError('PARAMETER_INVALID', 'No saved image direction is available.');
  const action: StudioActionRequest = {action: 'image.prepare', reply: draft.reply, ...draft.image};
  const callId = 'resume-quote-' + turn.lease_id;
  const prior = await beginStudioAction(actor, turn, callId, action);
  if (prior) return prior;
  try {
    const generation = factory(actor, {enabled: options.enabled});
    const request = imageRequestFromDraft(draft, options.input, await generation.catalog());
    return await factory(actor, {enabled: options.enabled, expectedReferenceFingerprint: imageReferenceFingerprintFromReview(request,options.references),
      onQuotePrepared: async (quote, executor) => {
        await attachImageQuote(actor, turn, quote.quoteId, executor);
        await completeStudioAction(actor, turn, callId, {ok: true, action: 'image.prepare', data: {
          quoteId: quote.quoteId, expiresAt: quote.expiresAt.toISOString(), requestHash: quote.requestHash, summary: quote.request,
          price: {amountCents: quote.priceCents, currency: quote.currency}, fundingMode: quote.fundingMode, confirmationRequired: true,
        }}, executor);
      },
    }).prepare(request);
  } catch (error) {
    const failure: StudioActionResult = {...toAgentApiFailure(error instanceof AgentApiError ? error : new AgentApiError('INTERNAL_ERROR', 'Studio could not prepare this saved image.', true)), action: 'image.prepare'};
    await completeStudioAction(actor, turn, callId, failure);
    throw error;
  }
}

/** Session adapter: canonical preparation, quote backlink and action receipt share one transaction. */
export async function runStudioImageActions(options: {
  actor: StudioGenerationActor; turn: StoredImageTurn; input: ImageTurnInput;
  references: ResolvedReference[]; referenceFingerprint: string;
  history: {message: string; reply: string | null}[]; enabled: boolean;
  factory: ImageGenerationFactory; createResponse?: StudioResponseCreator;
  factories?: StudioMediaFactories; mediaEnabled?: boolean;editingEnabled?: boolean;
}) {
  const {actor, turn, input, factory} = options;
  const generation = factory(actor, {enabled: options.enabled});
  const director = createStudioConversationDirector({createResponse: options.createResponse, mediaEnabled: options.mediaEnabled,editingEnabled: options.editingEnabled});
  let currentCallId: string;
  const execute = createStudioActionExecutor(actor, {enabled: options.enabled, generation, factories: options.factories, mediaEnabled: options.mediaEnabled,
    editingEnabled: options.editingEnabled,
    discardQuote: quoteId => withDbTransaction(async executor => {
      const data = await discardStudioPreparedQuote(actor,turn,quoteId,executor);
      await completeStudioAction(actor,turn,currentCallId,{ok: true,action: 'quote.discard',data},executor);
      return data;
    }),
    editTimeline: async action => {
      if (action.edit.kind === 'insert' && action.edit.ref.type === 'asset') {
        const ref = action.edit.ref;
        const attached = ref.kind === 'image' ? input.references.includes(ref.assetId) : input.attachments?.some(item => item.type === 'asset' && item.assetId === ref.assetId && item.kind === ref.kind);
        if (!attached) {
          const existing = await readStudioWorkspace(actor,actor.projectId);
          const assets = (existing.project.workspaceState as {projectAssets?: {ref?: unknown}[]}).projectAssets ?? [];
          if (!assets.some(asset => JSON.stringify(asset.ref) === JSON.stringify(ref))) throw new AgentApiError('REFERENCE_INVALID','Attach this library media before inserting it.');
        }
      }
      try {
        return await editStudioConversationTimeline(actor,{projectId: actor.projectId,sequenceId: action.sequenceId,expectedRevision: action.expectedRevision,edit: action.edit,idempotencyKey: turn.request_id + ':' + currentCallId.slice(0,80)}, {
          featureEnabled: options.editingEnabled,
          afterMutation: async (executor,data) => {if (!isTransactionQueryExecutor(executor)) throw new Error('A real transaction is required for the edit checkpoint.'); await completeStudioAction(actor,turn,currentCallId,{ok: true,action: 'timeline.edit',data},executor);},
        });
      } catch (error) {
        if (error instanceof StudioConnectedPersistenceError) throw new AgentApiError('PARAMETER_INVALID',error.code === 'STUDIO_REVISION_CONFLICT' ? 'The timeline changed after you read it. Read it again and preserve the manual edit.' : error.code);
        if (error instanceof Error && /MEDIA_|Invalid Studio|locked|duration|clip/i.test(error.message)) throw new AgentApiError('PARAMETER_INVALID',error.message);
        throw error;
      }
    },
    prepareMedia: async action => {
      if (!options.factories) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Studio media tools are unavailable.');
      return prepareMediaAction({...options, factories: options.factories}, action, currentCallId);
    },
    recover: async quoteId => {
      const saved = (await listImageTurns(actor)).find(turn => turn.quote_id === quoteId);
      if (!saved) throw new AgentApiError('QUOTE_EXPIRED', 'This generation is not available in this conversation.');
      const surface = draftSurface(saved.draft_json);
      return options.factories ? options.factories[surface](actor, {enabled: options.enabled}).recover(quoteId) : generation.recover(quoteId);
    },
    prepareImage: async action => {
      const draft = {reply: action.reply,image: imageSelectionSchema.strip().parse(action)};
      // Persist the selected prompt before preparation. A failed preparation resumes this same intent.
      await persistImageDraft(actor, turn, draft, options.referenceFingerprint);
      const request = imageRequestFromDraft(draft, input, await generation.catalog());
      return factory(actor, {enabled: options.enabled, expectedReferenceFingerprint: imageReferenceFingerprintFromReview(request,options.references),
        onQuotePrepared: async (quote, executor) => {
          await attachImageQuote(actor, turn, quote.quoteId, executor);
          await completeStudioAction(actor, turn, currentCallId, {ok: true, action: 'image.prepare', data: {
            quoteId: quote.quoteId, expiresAt: quote.expiresAt.toISOString(), requestHash: quote.requestHash,
            summary: quote.request, price: {amountCents: quote.priceCents, currency: quote.currency}, fundingMode: quote.fundingMode, confirmationRequired: true,
          }}, executor);
        },
      }).prepare(request);
    },
  });
  const draft = await director({message: input.message, history: options.history, references: options.references,
    project: await readStudioConversationProject(actor),
    checkpoint: (index, create) => checkpointStudioResponse(actor, turn, index, create),
    execute: async (callId: string, action: StudioActionRequest): Promise<StudioActionResult> => {
      const prior = await beginStudioAction(actor, turn, callId, action);
      if (prior) return prior;
      currentCallId = callId;
      if (action.action === 'project.remember') {
        // A lost ACK must not replay a memory update with a now-stale revision.
        try {
          return await withDbTransaction(async executor => {
            const memory = await saveStudioConversationMemory(actor, {revision: action.revision, brief: action.brief, decisions: action.decisions}, executor);
            const result: StudioActionResult = {ok: true, action: action.action, data: memory};
            await completeStudioAction(actor, turn, callId, result, executor);
            return result;
          });
        } catch (error) {
          if (!(error instanceof AgentApiError)) throw error;
          const failure: StudioActionResult = {...toAgentApiFailure(error), action: action.action};
          await completeStudioAction(actor, turn, callId, failure);
          return failure;
        }
      }
      const result = await execute(action);
      // Successful image preparation already checkpoints in the quote transaction.
      if ((!action.action.endsWith('.prepare') && action.action !== 'timeline.edit' && action.action !== 'quote.discard') || !result.ok) await completeStudioAction(actor, turn, callId, result);
      return result;
    },
  });
  if (!draft.image && !draft.media) await persistImageDraft(actor, turn, draft, options.referenceFingerprint);
  return draft;
}
