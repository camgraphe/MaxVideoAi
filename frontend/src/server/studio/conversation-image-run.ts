import {assertStudioTaskExecution,setStudioTaskPhase,type StudioTaskExecution} from "./tasks/execution";
import {StudioTaskStop} from "./tasks/policy";
import {recallStudioTaskMemory} from "./tasks/memory";
import {studioTaskStopDraft} from "./tasks/stop-draft";
import {replayStudioTaskAction} from './tasks/action-replay';
import {customerDisplayPrice} from '@/lib/customer-price-presentation';
import OpenAI from 'openai';
import type {ResponseCreateParamsNonStreaming} from 'openai/resources/responses/responses';
import {studioTokenCountInput} from './assistance-token-count';
import {openStudioAssistanceTurn,type StudioLunaFallback} from './assistance-ledger';
import {readStudioTaskUsage} from './tasks/repository';
import {studioAssistancePolicy,type StudioAssistancePolicy} from './assistance-policy';
import {prepareStudioTimelineExport,readStudioTimelineExport,asStudioExportAgentError,type StudioExportDependencies} from './conversation-export-command';
import {withDbTransaction,isTransactionQueryExecutor} from '@/lib/db';
import {AgentApiError, toAgentApiFailure} from '@/server/agent-api/errors';
import {generationComparisonCatalogFingerprint} from '@/server/agent-api/generation-price-comparison';
import {getActiveAccountRestrictionStrict} from '@/server/fraud-cleanup/restrictions';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {ResolvedReference} from '@/server/agent-api/reference-types';
import type {ImageTurnInput,ImageConversationHistoryTurn,StudioConversationHistoryFacts} from '@/lib/studio/image-conversation-contract';
import type {StudioActionRequest, StudioActionResult} from '@/lib/studio/conversation-action-contract';
import {createStudioConversationDirector, type StudioResponseCreator} from './conversation-director';
import {createStudioActionExecutor} from './conversation-actions';
import {createStudioAnalysisService} from './media-analysis/service';
import {studioAnalysisPolicy} from './media-analysis/policy';
import {beginStudioAction, completeStudioAction, checkpointStudioResponse, readCompletedStudioAction, readStudioConversationProject, saveStudioConversationMemory} from './conversation-run-repository';
import {attachImageQuote, persistImageDraft, type StoredImageTurn} from './image-conversation-repository';
import {imageRequestFromDraft,imageReferenceFingerprintFromReview, type ImageGenerationFactory} from './image-conversation-service';
import {validateStudioMediaRequest, type StudioMediaFactories} from './conversation-media-generation';
import {validateStudioPreparationInput} from './conversation-preparation-validation';
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
  references:ResolvedReference[];
  referenceFingerprint: string; enabled: boolean; factories: StudioMediaFactories;
}, action: StudioMediaIntent, callId: string) {
  const {actor, turn, factories} = options;
  const selection = await validateStudioMediaRequest(actor, action, options.input, factories, options.enabled,{reviewedReferences:options.references});
  if (!turn.draft_json) await persistImageDraft(actor, turn, {reply: action.reply, image: null, media: action}, options.referenceFingerprint);
  const request = await selection.materialize();
  const onQuotePrepared = async (quote: McpGenerationQuote<CanonicalGenerationRequest | CanonicalAudioRequest>, executor: TransactionQueryExecutor) => {
    await attachImageQuote(actor, turn, quote.quoteId, executor);
    await completeStudioAction(actor, turn, callId, {ok: true, action: action.action, data: {
      quoteId: quote.quoteId, expiresAt: quote.expiresAt.toISOString(), requestHash: quote.requestHash, summary: quote.request,
      price: customerDisplayPrice(quote.priceCents,quote.currency), fundingMode: quote.fundingMode, confirmationRequired: true,
    }} as StudioActionResult, executor);
  };
  if (request.surface === 'video') return factories.video(actor, {enabled: options.enabled, onQuotePrepared,expectedReferenceFingerprint:selection.referenceFingerprint?.()}).prepare(request);
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
          price: customerDisplayPrice(quote.priceCents,quote.currency), fundingMode: quote.fundingMode, confirmationRequired: true,
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
  history: ImageConversationHistoryTurn[]; enabled: boolean;
  historyFacts?:StudioConversationHistoryFacts;
  factory: ImageGenerationFactory; createResponse?: StudioResponseCreator;
  responseReplayOnly?: boolean;
  taskExecution?:StudioTaskExecution;
  assistancePolicy?: StudioAssistancePolicy;countInputTokens?: (params: ResponseCreateParamsNonStreaming) => Promise<number>;
  factories?: StudioMediaFactories; mediaEnabled?: boolean;editingEnabled?: boolean;exportsEnabled?: boolean;
  requestOrigin?: string;exportDependencies?: Partial<StudioExportDependencies>;
}) {
  const {actor, turn, input, factory} = options;
  const generation = factory(actor, {enabled: options.enabled});
  const policy = options.assistancePolicy ?? studioAssistancePolicy();
  // Injected response creators are offline qualification seams. Native dispatch always requires the monetary gate.
  const assistance = policy.enabled || !options.createResponse ? await openStudioAssistanceTurn(actor,turn.request_id,policy) : null;
  const usedLuna=options.taskExecution&&policy.credits&&assistance?.model==='gpt-6.1-sol'
    ? (await readStudioTaskUsage({user_id:actor.userId,project_id:actor.projectId,request_id:options.taskExecution.taskRequestId})).usedLuna : false;
  let currentModel=usedLuna?'gpt-6-luna' as const:assistance?.model??'gpt-6.1-sol';
  const analysisPolicy=studioAnalysisPolicy();
  const analysisEnabled=!!analysisPolicy&&policy.credits===true;
  const analysis=createStudioAnalysisService(actor,{assistancePolicy:policy});
  const director = createStudioConversationDirector({model: assistance?.model,modelForNextCall:()=>currentModel,createResponse: options.createResponse, mediaEnabled: options.mediaEnabled,editingEnabled: options.editingEnabled,exportsEnabled: options.exportsEnabled,analysisEnabled,analysisProfiles:{video:!!analysisPolicy?.video,audio:!!analysisPolicy?.audio},assistanceCreditsEnabled:policy.credits===true,taskExecution:options.taskExecution});
  let currentCallId: string;
  const execute = createStudioActionExecutor(actor, {enabled: options.enabled, generation, factories: options.factories, mediaEnabled: options.mediaEnabled,
    recallProject:options.taskExecution?text=>recallStudioTaskMemory(actor,text):undefined,
    analysisEnabled,
    readAnalysis:id=>analysis.read(id),
    prepareAnalysis:async action=>{
      const request={ref:action.ref,...(action.modality?{modality:action.modality}:{}),goal:action.goal,reason:action.reason,startSec:action.startSec,endSec:action.endSec};
      const ref=request.ref;
      if(ref.type==='asset'&&!options.references.some(item=>item.assetId===ref.assetId&&item.mediaKind===ref.kind))throw new AgentApiError('REFERENCE_INVALID','Attach the selected media before preparing its analysis.');
      return analysis.prepare(request,turn.request_id+':'+currentCallId.slice(0,80),async(quote,executor)=>{
        await completeStudioAction(actor,turn,currentCallId,{ok:true,action:'analysis.prepare',data:quote},executor);
      });
    },
    attachedImageIds: input.references,attachedMedia:options.references,
    editingEnabled: options.editingEnabled,exportsEnabled: options.exportsEnabled,
    prepareExport: async action => {
      try {return await prepareStudioTimelineExport({userId: actor.userId,authOrigin: 'studio-session',clientId: null},{projectId: actor.projectId,sequenceId: action.sequenceId,expectedRevision: action.expectedRevision,qualityPreset: action.qualityPreset,includeAudio: action.includeAudio,idempotencyKey: turn.request_id+':'+currentCallId.slice(0,80)}, {
        ...options.exportDependencies,enabled: options.enabled && options.editingEnabled === true && options.exportsEnabled === true,requestOrigin: options.requestOrigin ?? 'https://maxvideoai.com',
        onPrepared: async (quote,executor) => {await completeStudioAction(actor,turn,currentCallId,{ok: true,action: 'export.prepare',data: quote},executor);},
      });} catch(error) {throw asStudioExportAgentError(error);}
    },
    readExport: async quoteId => {
      try {return await readStudioTimelineExport({userId: actor.userId,authOrigin: 'studio-session',clientId: null},{projectId: actor.projectId,quoteId},{...options.exportDependencies,enabled: options.enabled && options.editingEnabled === true && options.exportsEnabled === true,requestOrigin: options.requestOrigin ?? 'https://maxvideoai.com'});} catch(error) {throw asStudioExportAgentError(error);}
    },
    discardQuote: quoteId => withDbTransaction(async executor => {
      const data = await discardStudioPreparedQuote(actor,turn,quoteId,executor);
      await completeStudioAction(actor,turn,currentCallId,{ok: true,action: 'quote.discard',data},executor);
      return data;
    }),
    editTimeline: async action => {
      const insertedRefs=action.edit.kind==='insert'?[action.edit.ref]:action.edit.kind==='assemble'?action.edit.clips.map(clip=>clip.ref):[];
      let projectRefs:Set<string>|undefined;
      for(const ref of insertedRefs.filter(ref=>ref.type==='asset')){
        const attached = ref.kind === 'image' ? input.references.includes(ref.assetId) : input.attachments?.some(item => item.type === 'asset' && item.assetId === ref.assetId && item.kind === ref.kind);
        if (!attached) {
          if(!projectRefs){
            const existing = await readStudioWorkspace(actor,actor.projectId);
            const assets = (existing.project.workspaceState as {projectAssets?: {ref?: unknown}[]}).projectAssets ?? [];
            projectRefs=new Set(assets.map(asset=>JSON.stringify(asset.ref)));
          }
          if (!projectRefs.has(JSON.stringify(ref))) throw new AgentApiError('REFERENCE_INVALID','Attach this library media before inserting it.');
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
      // Validate selection before saving intent. Catalog/ownership failures remain terminal.
      const catalog = await generation.catalog();
      const request = validateStudioPreparationInput(() => imageRequestFromDraft(draft, input, catalog));
      const expectedReferenceFingerprint = imageReferenceFingerprintFromReview(request,options.references);
      // Once preparation can mutate state, recovery must preserve this exact intent.
      await persistImageDraft(actor, turn, draft, options.referenceFingerprint);
      return factory(actor, {enabled: options.enabled, expectedReferenceFingerprint,
        onQuotePrepared: async (quote, executor) => {
          await attachImageQuote(actor, turn, quote.quoteId, executor);
          await completeStudioAction(actor, turn, currentCallId, {ok: true, action: 'image.prepare', data: {
            quoteId: quote.quoteId, expiresAt: quote.expiresAt.toISOString(), requestHash: quote.requestHash,
            summary: quote.request, price: customerDisplayPrice(quote.priceCents,quote.currency), fundingMode: quote.fundingMode, confirmationRequired: true,
          }}, executor);
        },
      }).prepare(request);
    },
  });
  const draft = await director({message: input.message, history: options.history, references: options.references, referenceMentions: input.referenceMentions, historyFacts: options.historyFacts,
    project: await readStudioConversationProject(actor,{exportsEnabled:options.editingEnabled&&options.exportsEnabled,...(options.taskExecution?{taskContext:{message:input.message,requestId:options.taskExecution.taskRequestId}}:{})}),
    checkpoint: async (index, create, params, checkpointOptions) => {
      let solBounds:StudioLunaFallback['solBounds'];
      let lunaFallback:StudioLunaFallback|undefined=currentModel==='gpt-6-luna'&&assistance?.model==='gpt-6.1-sol'?{}:undefined;
      const checkpoint=()=>checkpointStudioResponse(actor, turn, index, create, assistance ? {prepare: async () => {
      if (await getActiveAccountRestrictionStrict(actor.userId)) {
        throw new AgentApiError('ACCOUNT_RESTRICTED','This account is temporarily restricted. Open MaxVideoAI for help.');
      }
      if(options.taskExecution){await assertStudioTaskExecution(actor,options.taskExecution);await setStudioTaskPhase(actor,options.taskExecution,"thinking");}
      if (!params) throw new AgentApiError('INTERNAL_ERROR','Studio is missing its model request bounds.');
      if(lunaFallback){
        params.max_output_tokens=Math.min(params.max_output_tokens??2200,2200);
        params.reasoning={effort:params.reasoning?.effort==='low'?'low':'medium'};
        checkpointOptions?.prepareLunaInput?.();
        params.instructions=(params.instructions??'')+'\nStudio has continued this task with sponsored GPT-6 Luna because the next Sol call could not be funded. Continue the remaining client request from the saved work. This assistance change does not authorize a different generation model, a credit purchase or a media confirmation.';
      }
      if (!options.countInputTokens && options.createResponse) throw new AgentApiError('ENGINE_UNAVAILABLE','Offline Studio metering requires an injected token counter.');
      const inputTokens = options.countInputTokens ? await options.countInputTokens(params) : (await new OpenAI({apiKey: process.env.OPENAI_API_KEY,maxRetries: 0,timeout: 15000}).responses.inputTokens.count(studioTokenCountInput(params))).input_tokens;
      if (!Number.isSafeInteger(inputTokens) || inputTokens < 0 || inputTokens > 272000) throw new AgentApiError('PARAMETER_INVALID','This Studio context exceeds the supported assistance limit.');
      if(options.taskExecution&&inputTokens>options.taskExecution.profile.maxInputTokens)throw new StudioTaskStop("context","The current context exceeds this task allowance.");
      const outputTokens=params.max_output_tokens??2200;
      if(currentModel==='gpt-6.1-sol')solBounds={inputTokens,outputTokens};
      return {policy,inputTokens,outputTokens,lunaFallback};
    }} : undefined, {replayOnly: options.responseReplayOnly || checkpointOptions?.replayOnly});
      try{return await checkpoint();}
      catch(error){
        const action=error instanceof AgentApiError?error.nextAction:undefined;
        if(!options.taskExecution||!policy.credits||currentModel!=='gpt-6.1-sol'||!params||!solBounds
          ||options.responseReplayOnly||checkpointOptions?.replayOnly||options.taskExecution.recoveryOnly
          ||!(error instanceof AgentApiError)||error.code!=='SPENDING_LIMIT_EXCEEDED'||action?.type!=='studio_assistance'
          ||typeof action.reason!=='string'||!['included_exhausted','paid_budget_exhausted'].includes(action.reason))throw error;
        // The declined reservation created no response/call. Retry this same step once with Luna.
        currentModel='gpt-6-luna';lunaFallback={solBounds};
        params.model=currentModel;params.max_output_tokens=Math.min(params.max_output_tokens??2200,2200);params.reasoning={effort:params.reasoning?.effort==='low'?'low':'medium'};
        return checkpoint();
      }
    },
    readCompletedAction: (callId,action)=>readCompletedStudioAction(actor,turn,callId,action),
    comparisonCatalogFingerprint: async action=>{
      const service=action.surface==='image'?generation:options.mediaEnabled&&options.factories?options.factories.video(actor,{enabled:options.enabled}):null;
      return service?generationComparisonCatalogFingerprint(action,await service.catalog()):null;
    },
    execute: async (callId: string, action: StudioActionRequest): Promise<StudioActionResult> => {
      if(options.taskExecution)await setStudioTaskPhase(actor,options.taskExecution,action.action.endsWith(".prepare")?"preparing":action.action==="timeline.edit"?"editing":"reading");
      const prior = await beginStudioAction(actor, turn, callId, action);
      if (prior) return prior;
      if(options.taskExecution){
        const saved=await replayStudioTaskAction(actor,options.taskExecution,callId,action);
        if(saved){await completeStudioAction(actor,turn,callId,saved);return saved;}
      }
      currentCallId = callId;
      if (action.action === 'project.remember') {
        // A lost ACK must not replay a memory update with a now-stale revision.
        try {
          return await withDbTransaction(async executor => {
            const memory = await saveStudioConversationMemory(actor, {revision: action.revision, brief: action.brief, decisions: action.decisions, projectTitle: action.projectTitle}, executor);
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
  }).catch(async (error: unknown) => {
    if(options.taskExecution&&(error instanceof StudioTaskStop||error instanceof AgentApiError&&["SPENDING_LIMIT_EXCEEDED","ACCOUNT_RESTRICTED"].includes(error.code))){
      const paused=await studioTaskStopDraft(actor,options.taskExecution,error);
      return paused;
    }
    if (error instanceof AgentApiError && error.nextAction?.type === 'studio_assistance' && error.nextAction.canStartFollowup === true) {
      // All prior model calls settled. Close this partial request without replaying its completed actions.
      // Keeping the original user message and this reply in ready history gives a new explicit follow-up context.
      await persistImageDraft(actor,turn,{image: null,reply: `${error.message} This message is not finished. Earlier completed work remains saved. Send a follow-up to continue from the current project; do not repeat completed changes.`},options.referenceFingerprint);
    }
    throw error;
  });
  if(options.taskExecution&&draft.continuation&&!draft.continuation.lastError?.code){
    const localized=await studioTaskStopDraft(actor,options.taskExecution,new StudioTaskStop(draft.continuation.reason==='output_limit'?'output':'steps','Task allowance reached'));
    draft.reply=localized.reply;draft.continuation={...localized.continuation!,completedEdits:draft.continuation.completedEdits};
  }
  if (!draft.image && !draft.media) await persistImageDraft(actor, turn, draft, options.referenceFingerprint);
  return draft;
}
