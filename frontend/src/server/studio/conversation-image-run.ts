import {withDbTransaction} from '@/lib/db';
import {AgentApiError, toAgentApiFailure} from '@/server/agent-api/errors';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {ResolvedReference} from '@/server/agent-api/reference-types';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import type {StudioActionRequest, StudioActionResult} from '@/lib/studio/conversation-action-contract';
import {createStudioConversationDirector, type StudioResponseCreator} from './conversation-director';
import {createStudioActionExecutor} from './conversation-actions';
import {beginStudioAction, completeStudioAction, checkpointStudioResponse, readStudioConversationProject, saveStudioConversationMemory} from './conversation-run-repository';
import {attachImageQuote, persistImageDraft, type StoredImageTurn} from './image-conversation-repository';
import {imageRequestFromDraft, type ImageGenerationFactory} from './image-conversation-service';

export async function resumeStudioImageAction(options: {
  actor: StudioGenerationActor; turn: StoredImageTurn; input: ImageTurnInput;
  referenceFingerprint: string; enabled: boolean; factory: ImageGenerationFactory;
}) {
  const {actor, turn, factory} = options;
  const draft = turn.draft_json;
  if (!draft?.image) throw new AgentApiError('PARAMETER_INVALID', 'No saved image direction is available.');
  const action: StudioActionRequest = {action: 'image.prepare', reply: draft.reply, prompt: draft.image.prompt, aspectRatio: draft.image.aspectRatio};
  const callId = 'resume-quote-' + turn.lease_id;
  const prior = await beginStudioAction(actor, turn, callId, action);
  if (prior) return prior;
  try {
    const generation = factory(actor, {enabled: options.enabled});
    const request = imageRequestFromDraft(draft, options.input, await generation.catalog());
    return await factory(actor, {enabled: options.enabled, expectedReferenceFingerprint: options.referenceFingerprint,
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
}) {
  const {actor, turn, input, factory} = options;
  const generation = factory(actor, {enabled: options.enabled});
  const director = createStudioConversationDirector({createResponse: options.createResponse});
  let currentCallId: string;
  const execute = createStudioActionExecutor(actor, {enabled: options.enabled, generation,
    prepareImage: async action => {
      const draft = {reply: action.reply, image: {prompt: action.prompt, aspectRatio: action.aspectRatio}};
      // Persist the selected prompt before preparation. A failed preparation resumes this same intent.
      await persistImageDraft(actor, turn, draft, options.referenceFingerprint);
      const request = imageRequestFromDraft(draft, input, await generation.catalog());
      return factory(actor, {enabled: options.enabled, expectedReferenceFingerprint: options.referenceFingerprint,
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
      if (action.action !== 'image.prepare' || !result.ok) await completeStudioAction(actor, turn, callId, result);
      return result;
    },
  });
  if (!draft.image) await persistImageDraft(actor, turn, draft, options.referenceFingerprint);
  return draft;
}
