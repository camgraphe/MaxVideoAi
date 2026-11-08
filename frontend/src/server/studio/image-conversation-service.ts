import {createCharacterStudioIntegration} from '@/server/character-studio/integration';
import {isStudioCharacterEnabled} from './feature-access';
import type {StudioCharacterFactory} from './conversation-character';
import type {StudioTaskExecution} from "./tasks/execution";
import {customerDisplayPrice} from '@/lib/customer-price-presentation';
import type {StudioExportDependencies} from './conversation-export-command';
import {recordedStudioOutputDuration,recordedStudioSourceVideoOutput} from './conversation-quote-facts';
import {projectStudioQuoteDirections,readStudioHistoricalEstimates} from './conversation-history-facts';
import { getBaseEngineIncludingHidden } from "@/lib/engines";
import { z } from "zod";
import {
  imageTurnInputSchema,
  type ImageConversation,
  type ImageConversationTurn,
  type ImageDraft,
  draftSurface, hasDraftCreation,
} from "@/lib/studio/image-conversation-contract";
import {
  studioReferenceFingerprint,
  type StudioGenerationActor,
} from "@/server/agent-api/generation-actor";
import { AgentApiError } from "@/server/agent-api/errors";
import { createStudioImageGenerationService } from "./image-generation-service";
import {
  draftStudioImage,
  type ImageDirector,
} from "./image-conversation-director";
import { runMeteredImageDirector } from "./image-model-usage";
import { runStudioImageActions, resumeStudioImageAction } from "./conversation-image-run";
import {readStudioExtensionAssembly} from './conversation-extension-assembly';
import type { StudioResponseCreator } from "./conversation-director";
import {
  claimImageTurn,
  persistImageDraft,
  attachImageQuote,
  failImageTurn,
  listImageTurns,
  readImageConversationProject,
  type StoredImageTurn,
} from "./image-conversation-repository";
import {defaultStudioMediaFactories, type StudioMediaFactories} from './conversation-media-generation';
import {resolveStudioConversationAttachments,type StudioAttachmentFactsDependencies} from './conversation-attachment-facts';
import {buildStudioGenerationMediaAccess} from './generation-media-access';
import {projectStudioReply} from '@/lib/studio/conversation-reply';
import {imageRequestFromDraft,imageReferenceFingerprintFromReview} from './conversation-image-request';
export {imageRequestFromDraft,imageReferenceFingerprintFromReview} from './conversation-image-request';

export const imageConfirmationSchema = z
  .object({
    requestId: z.string().uuid(),
    quoteId: z.string().uuid(),
    confirmed: z.literal(true),
    amountCents:z.number().int().nonnegative().optional(),
    currency:z.literal('USD').optional(),
  })
  .strict()
  .refine(value => (value.amountCents === undefined) === (value.currency === undefined));
export type ImageGenerationFactory = typeof createStudioImageGenerationService;
export function createImageConversationService(
  actor: StudioGenerationActor,
  dependencies: {
    enabled: boolean;
    director?: ImageDirector;
    generationFactory?: ImageGenerationFactory;
    actionsEnabled?: boolean;
    taskExecution?:StudioTaskExecution;
    assistancePolicy?: import('./assistance-policy').StudioAssistancePolicy;
    countInputTokens?: (params: import('openai/resources/responses/responses').ResponseCreateParamsNonStreaming) => Promise<number>;
    createActionResponse?: StudioResponseCreator;
    mediaEnabled?: boolean;
    characterEnabled?: boolean;
    characterFactory?: StudioCharacterFactory;
    videoGenerationFactory?: StudioMediaFactories['video'];
    audioGenerationFactory?: StudioMediaFactories['audio'];
    editingEnabled?: boolean;
    exportsEnabled?: boolean;
    requestOrigin?: string;
    exportDependencies?: Partial<StudioExportDependencies>;
    attachmentFacts?:StudioAttachmentFactsDependencies;
  },
) {
  const factory =
    dependencies.generationFactory ?? createStudioImageGenerationService;
  const generation = factory(actor, { enabled: dependencies.enabled });
  const factories: StudioMediaFactories = {...defaultStudioMediaFactories, image: factory,
    video: dependencies.videoGenerationFactory ?? defaultStudioMediaFactories.video,
    audio: dependencies.audioGenerationFactory ?? defaultStudioMediaFactories.audio};
  const characterEnabled = dependencies.enabled && dependencies.actionsEnabled === true && dependencies.mediaEnabled === true &&
    (dependencies.characterEnabled ?? isStudioCharacterEnabled());
  const character = () => (dependencies.characterFactory ?? createCharacterStudioIntegration)(actor,{executionEnabled:characterEnabled});
  const serviceForDraft = (draft: ImageDraft | null) => {
    const surface = draftSurface(draft);
    return factories[surface](actor, {enabled: dependencies.enabled && (surface === 'image' || dependencies.mediaEnabled === true)});
  };
  async function wallet() {
    try {
      const summary = await generation.walletSummary();
      return Number.isSafeInteger(summary.balanceCents) &&
        summary.balanceCents >= 0
        ? { amountCents: summary.balanceCents, currency: summary.currency }
        : null;
    } catch {
      // A wallet read failure must not hide the saved conversation or enable a charge.
      return null;
    }
  }
  async function project() {
    if (!dependencies.enabled)
      throw new AgentApiError(
        "ENGINE_UNAVAILABLE",
        "The Studio image pilot is unavailable.",
      );
    return readImageConversationProject(actor.userId, actor.projectId);
  }
  async function projectTurn(
    turn: StoredImageTurn,
    readWallet: typeof wallet = wallet,
  ): Promise<ImageConversationTurn> {
    const expiredLease =
      turn.state === "thinking" &&
      new Date(turn.lease_expires_at).getTime() <= Date.now();
    const recast = turn.draft_json?.recast;
    const recastQuote = recast && turn.quote_id ? await character().getRecastQuote({quoteId:turn.quote_id}) : null;
    const quote = recast ? recastQuote : turn.quote_id ? await serviceForDraft(turn.draft_json).getQuote(turn.quote_id) : null;
    const videoPassage = recastQuote?.passages.video;
    const audioPassage = recastQuote?.passages.audio;
    if (turn.quote_id && !quote)
      throw new AgentApiError(
        "INTERNAL_ERROR",
        "The saved image quote is unavailable.",
      );
    const balance = quote ? await readWallet() : null;
    return {
      requestId: turn.request_id,
      message: turn.input_json.message,
      ...(turn.input_json.shotPlanRevision?{shotPlanRevision:turn.input_json.shotPlanRevision}:{}),
      references: turn.input_json.references,
      ...(turn.input_json.attachments ? {attachments: turn.input_json.attachments} : {}),
      ...(turn.input_json.referenceMentions ? {referenceMentions: turn.input_json.referenceMentions} : {}),
      ...(turn.input_json.renewedFromRequestId ? {renewedFromRequestId: turn.input_json.renewedFromRequestId} : {}),
      ...(turn.input_json.taskBudget?{taskBudget:turn.input_json.taskBudget}:{}),
      ...(turn.input_json.locale?{locale:turn.input_json.locale}:{}),
      reply: turn.draft_json ? projectStudioReply(turn.draft_json.reply) : null,
      ...(turn.draft_json?.exportQuote ? {exportQuote: turn.draft_json.exportQuote} : {}),
      ...(turn.draft_json?.analysisQuote ? {analysisQuote:turn.draft_json.analysisQuote} : {}),
      ...(turn.draft_json?.continuation ? {continuation: turn.draft_json.continuation} : {}),
      ...(turn.draft_json?.extensionAssembly?{extensionAssembly:await readStudioExtensionAssembly(actor,turn.request_id,turn.draft_json.extensionAssembly)}:{}),
      state: expiredLease ? "failed" : turn.state,
      retryable: expiredLease || turn.state === "failed",
      quote: quote
        ? {
            quoteId: quote.quoteId,
            expiresAt: quote.expiresAt.toISOString(),
            requestHash: quote.requestHash,
            summary: quote.request,
            ...(quote.request.surface==='video'&&recordedStudioOutputDuration(quote.pricingSnapshot)!==undefined
              ? {outputDurationSec:recordedStudioOutputDuration(quote.pricingSnapshot)} : {}),
            ...(quote.request.surface==='video'&&recordedStudioSourceVideoOutput(quote.pricingSnapshot)
              ? {sourceVideoOutput:recordedStudioSourceVideoOutput(quote.pricingSnapshot)} : {}),
            price: customerDisplayPrice(quote.priceCents,quote.currency),
            fundingMode: "wallet",
            confirmationRequired: true,
            wallet: balance?.currency === quote.currency ? balance : null,
            state:
              quote.state === "prepared" &&
              quote.expiresAt.getTime() <= Date.now()
                ? "expired"
                : quote.state,
            modelLabel: recast ? 'Character Recast' : getBaseEngineIncludingHidden(quote.request.engineId)?.label ?? quote.request.engineId,
            ...(recast ? {recast:{
              ...(videoPassage ? {videoRange:{startSec:videoPassage.startSec,endSec:videoPassage.endSec}} : {}),
              ...(audioPassage ? {audioRange:{startSec:audioPassage.startSec,endSec:audioPassage.endSec}} : {}),
              confirmationEnabled:characterEnabled,
            }} : {}),
          }
        : null,
      generation: quote?.jobId ? await buildStudioGenerationMediaAccess(actor.userId, recast
        ? await character().recoverRecast({quoteId:quote.quoteId}) : await serviceForDraft(turn.draft_json).recover(quote.quoteId)) : null,
      createdAt: new Date(turn.created_at).toISOString(),
    };
  }
  return {
    async read(): Promise<ImageConversation> {
      const owned = await project();
      const turns = await listImageTurns(actor);
      // Share this read across the returned turns, never across requests or refreshes.
      let balance: ReturnType<typeof wallet> | undefined;
      const readWallet = () => (balance ??= wallet());
      return {
        projectId: actor.projectId,
        projectName: owned.name,
        turns: await Promise.all(
          turns.reverse().map((turn) => projectTurn(turn, readWallet)),
        ),
      };
    },
    async submit(value: unknown) {
      await project();
      const input = imageTurnInputSchema.parse(value);
      if (input.attachments?.length && (!dependencies.actionsEnabled || !dependencies.mediaEnabled))
        throw new AgentApiError('ENGINE_UNAVAILABLE', 'Video and audio attachments are unavailable in this image pilot.');
      const { turn, claimed, responseReplayOnly } = await claimImageTurn(actor, input, {allowRecordedResponseRecovery: dependencies.actionsEnabled === true,taskWorkerId:dependencies.taskExecution?.workerId});
      if (!claimed) return projectTurn(turn);
      try {
        const refs = await generation.resolveReferences({
          schemaVersion: 1,
          surface: "image",
          engineId: "gpt-image-2",
          mode: input.references.length ? "i2i" : "t2i",
          prompt: input.message,
          settings: {},
          references: input.references.map((assetId) => ({
            kind: "asset",
            assetId,
            role: "reference",
          })),
          outputCount: 1,
        });
        refs.push(...await resolveStudioConversationAttachments(actor,input.attachments??[],{
          ...dependencies.attachmentFacts,qualifyMissingVideoFacts:!turn.draft_json&&!responseReplayOnly,
        }));
        const referenceFingerprint = studioReferenceFingerprint(refs);
        if (
          turn.draft_json &&
          turn.draft_reference_fingerprint !== referenceFingerprint
        )
          throw new AgentApiError(
            "REFERENCE_INVALID",
            "The references changed. Send a new message so Studio can review them again.",
          );
        const history = (await listImageTurns(actor))
          .filter(
            (saved) =>
              saved.request_id !== turn.request_id && saved.state === "ready",
          )
          .reverse();
        const useActions = !turn.draft_json && dependencies.actionsEnabled === true;
        const recentHistory=history.slice(-(dependencies.taskExecution?.profile.historyTurns??8));
        const historyFacts=useActions?{quoteDirections:projectStudioQuoteDirections(recentHistory),estimates:await readStudioHistoricalEstimates(actor,recentHistory.map(saved=>saved.request_id))}:undefined;
        if (!turn.draft_json && !useActions && !dependencies.director) throw new AgentApiError('ENGINE_UNAVAILABLE','Enable the metered Studio conversation before requesting assistance.');
        const draft =
          turn.draft_json ??
          (useActions ? await runStudioImageActions({
            actor, turn, input, references: refs, referenceFingerprint, responseReplayOnly,
            historyFacts,
            history: history.map(saved => ({message: saved.input_json.message, reply: saved.draft_json ? projectStudioReply(saved.draft_json.reply) : null,
              ...(saved.input_json.referenceMentions ? {referenceMentions: saved.input_json.referenceMentions} : {})})),
            taskExecution:dependencies.taskExecution, enabled: dependencies.enabled, factory, createResponse: dependencies.createActionResponse,assistancePolicy: dependencies.assistancePolicy,countInputTokens: dependencies.countInputTokens,
            factories, mediaEnabled: dependencies.mediaEnabled,characterEnabled,characterFactory:dependencies.characterFactory,editingEnabled: dependencies.editingEnabled,exportsEnabled: dependencies.exportsEnabled,requestOrigin: dependencies.requestOrigin,exportDependencies: dependencies.exportDependencies,
          }) : await runMeteredImageDirector(
            actor,
            turn,
            dependencies.director ?? draftStudioImage,
            input,
            history.map((saved) => ({
              message: saved.input_json.message,
              reply: saved.draft_json ? projectStudioReply(saved.draft_json.reply) : null,
              ...(saved.input_json.referenceMentions ? {referenceMentions: saved.input_json.referenceMentions} : {}),
            })),
            refs,
          ));
        if (!turn.draft_json && !useActions)
          await persistImageDraft(actor, turn, draft, referenceFingerprint);
        if (hasDraftCreation(draft) && !useActions) {
          if (dependencies.actionsEnabled) {
            await resumeStudioImageAction({actor, turn, input, references: refs, referenceFingerprint, enabled: dependencies.enabled, factory, factories, mediaEnabled: dependencies.mediaEnabled,characterEnabled,characterFactory:dependencies.characterFactory,editingEnabled:dependencies.editingEnabled});
          } else {
          const request = imageRequestFromDraft(
            draft,
            input,
            await generation.catalog(),
          );
          await factory(actor, {
            enabled: dependencies.enabled,
            expectedReferenceFingerprint: imageReferenceFingerprintFromReview(request,refs),
            onQuotePrepared: (quote, executor) =>
              attachImageQuote(actor, turn, quote.quoteId, executor),
          }).prepare(request);
          }
        }
        const saved = (await listImageTurns(actor)).find(
          (saved) => saved.request_id === turn.request_id,
        );
        if (!saved)
          throw new AgentApiError(
            "INTERNAL_ERROR",
            "The image message could not be recovered.",
          );
        return projectTurn(saved);
      } catch (error) {
        await failImageTurn(actor, turn);
        throw error;
      }
    },
    async confirm(value: unknown) {
      await project();
      const input = imageConfirmationSchema.parse(value);
      const turn = (await listImageTurns(actor)).find(
        (turn) => turn.request_id === input.requestId,
      );
      if (!turn || turn.state !== "ready" || turn.quote_id !== input.quoteId)
        throw new AgentApiError(
          "QUOTE_EXPIRED",
          "Review the image quote in this project before confirming.",
        );
      if (turn.draft_json?.recast) {
        if (input.amountCents === undefined || input.currency !== 'USD')
          throw new AgentApiError('PARAMETER_INVALID','Review the exact Recast amount before confirming.');
        return buildStudioGenerationMediaAccess(actor.userId,await character().confirmRecast({
          quoteId:input.quoteId,confirmed:true,amountCents:input.amountCents,currency:input.currency,
        }));
      }
      if (input.amountCents !== undefined) throw new AgentApiError('PARAMETER_INVALID','This quote is not a Recast quote.');
      return serviceForDraft(turn.draft_json).confirm({ quoteId: input.quoteId, confirmed: true });
    },
  };
}
