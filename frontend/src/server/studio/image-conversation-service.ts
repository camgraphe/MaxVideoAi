import type {StudioExportDependencies} from './conversation-export-command';
import { getBaseEngineIncludingHidden } from "@/lib/engines";
import { z } from "zod";
import {
  imageTurnInputSchema,
  type ImageConversation,
  type ImageConversationTurn,
  type ImageTurnInput,
  type ImageDraft,
  draftSurface, hasDraftCreation,
} from "@/lib/studio/image-conversation-contract";
import {
  studioReferenceFingerprint,
  type StudioGenerationActor,
} from "@/server/agent-api/generation-actor";
import { AgentApiError } from "@/server/agent-api/errors";
import type { CanonicalGenerationRequest } from "@/server/agent-api/generation-types";
import type { AgentPublicGenerationEngine } from "@/server/agent-api/model-catalog";
import { createStudioImageGenerationService } from "./image-generation-service";
import {
  draftStudioImage,
  type ImageDirector,
} from "./image-conversation-director";
import { runMeteredImageDirector } from "./image-model-usage";
import { runStudioImageActions, resumeStudioImageAction } from "./conversation-image-run";
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
import {resolveStudioMedia} from './media-resolver';
import type {ResolvedReference} from '@/server/agent-api/reference-types';
import {buildStudioGenerationMediaAccess} from './generation-media-access';
import {conversationSelectionSettings,imageSelectionSchema} from '@/lib/studio/conversation-creation-contract';
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import {GenerationNormalizationError,normalizeGenerationRequest} from '@/server/agent-api/generation-normalization';
import {GenerationCapabilityError,validateCanonicalGenerationCapabilities} from '@/server/agent-api/generation-capability-validation';
import {getDefaultResolution} from '@/lib/image/inputSchema';

export const imageConfirmationSchema = z
  .object({
    requestId: z.string().uuid(),
    quoteId: z.string().uuid(),
    confirmed: z.literal(true),
  })
  .strict();
export type ImageGenerationFactory = typeof createStudioImageGenerationService;
/** Rebind selected canonical roles to the original reviewed facts, never to a fresh asset read. */
export function imageReferenceFingerprintFromReview(request: Pick<CanonicalGenerationRequest,'references'>, reviewed: readonly ResolvedReference[]): string {
  return studioReferenceFingerprint(request.references.map(reference => {
    const original=reference.kind === 'asset' ? reviewed.find(ref => ref.assetId === reference.assetId && ref.mediaKind === 'image') : undefined;
    if (!original) throw new AgentApiError('REFERENCE_INVALID','Studio has not reviewed this selected image.');
    const facts={...original};
    delete facts.slot;
    return {...facts,role: reference.role,...(reference.slot === undefined ? {} : {slot: reference.slot})};
  }));
}
export function imageRequestFromDraft(
  draft: ImageDraft,
  input: ImageTurnInput,
  catalog: AgentPublicGenerationEngine[],
): CanonicalGenerationRequest {
  if (!draft.image)
    throw new AgentApiError("PARAMETER_INVALID", "No image was requested.");
  const selection = imageSelectionSchema.parse(draft.image);
  const references: CanonicalGenerationRequest['references'] = selection.references == null
    ? input.references.map(assetId => ({kind: 'asset',assetId,role: 'reference'}))
    : selection.references.map(reference => {
      if (reference.ref.type !== 'asset' || !input.references.includes(reference.ref.assetId))
        throw new AgentApiError('REFERENCE_INVALID','Attach this library image before selecting it as a reference.');
      return {kind: 'asset',assetId: reference.ref.assetId,role: reference.role,...(reference.slot == null ? {} : {slot: reference.slot})};
    });
  const mode = selection.mode ?? (references.length ? "i2i" : "t2i");
  if (mode === 't2i' && references.length) throw new AgentApiError('REFERENCE_INVALID','Text-to-image does not use generation references.');
  const candidate =
    selection.modelId ? catalog.find(entry => entry.engine.id === selection.modelId && entry.publicModes.includes(mode)) : catalog.find(
      (entry) =>
        entry.engine.id === "gpt-image-2-5-flare" &&
        entry.publicModes.includes(mode),
    ) ??
    catalog.find(
      (entry) =>
        entry.engine.id === "gpt-image-2" && entry.publicModes.includes(mode),
    );
  if (!candidate)
    throw new AgentApiError(
      "ENGINE_UNAVAILABLE",
      "The Studio image model is unavailable.",
    );
  const ratio = selection.aspectRatio;
  const selected = conversationSelectionSettings(selection.settings);
  if (selected.aspectRatio !== undefined && selected.aspectRatio !== ratio)
    throw new AgentApiError('PARAMETER_INVALID','Choose one consistent image aspect ratio.');
  const choices: Record<string,string[]>={
    '1:1': ['1024x1024','square_hd'], '16:9': ['landscape_16_9','1920x1080'],
    '9:16': ['portrait_16_9'], '4:3': ['landscape_4_3','1024x768'], '3:4': ['portrait_4_3'],
    auto: [getDefaultResolution(candidate.engine,mode)],
  };
  const allowed =
    candidate.modeCaps[mode]?.resolution ?? candidate.engine.resolutions;
  const details = projectAgentModelModeDetails(candidate,mode);
  const resolution = selected.resolution ?? choices[ratio]?.find((value) => allowed.includes(value)) ?? details.resolutions[0];
  if (!resolution)
    throw new AgentApiError(
      "PARAMETER_INVALID",
      "This image format is unavailable.",
    );
  try {
  const request = normalizeGenerationRequest({
    schemaVersion: 1,
    surface: "image",
    engineId: candidate.engine.id,
    mode,
    prompt: draft.image.prompt,
    settings: {
      aspectRatio: ratio,
      resolution,
      ...(details.settings.some(setting => setting.key === 'quality') ? {quality: 'high'} : {}),
      ...(details.settings.some(setting => setting.key === 'outputFormat') ? {outputFormat: 'png'} : {}),
      ...selected,
    },
    references,
    outputCount: 1,
  });
  validateCanonicalGenerationCapabilities(request,candidate);
  return request;
  } catch (error) {
    if (error instanceof GenerationNormalizationError)
      throw new AgentApiError(error.field.startsWith('references') ? 'REFERENCE_INVALID' : 'PARAMETER_INVALID',error.message);
    if (error instanceof GenerationCapabilityError)
      throw new AgentApiError(error.kind === 'reference_required' ? 'REFERENCE_REQUIRED' : error.kind === 'reference_invalid' ? 'REFERENCE_INVALID' : 'PARAMETER_INVALID',`${error.field} is not supported for the selected model and mode.`);
    throw error;
  }
}
export function createImageConversationService(
  actor: StudioGenerationActor,
  dependencies: {
    enabled: boolean;
    director?: ImageDirector;
    generationFactory?: ImageGenerationFactory;
    actionsEnabled?: boolean;
    assistancePolicy?: import('./assistance-policy').StudioAssistancePolicy;
    countInputTokens?: (params: import('openai/resources/responses/responses').ResponseCreateParamsNonStreaming) => Promise<number>;
    createActionResponse?: StudioResponseCreator;
    mediaEnabled?: boolean;
    videoGenerationFactory?: StudioMediaFactories['video'];
    audioGenerationFactory?: StudioMediaFactories['audio'];
    editingEnabled?: boolean;
    exportsEnabled?: boolean;
    requestOrigin?: string;
    exportDependencies?: Partial<StudioExportDependencies>;
  },
) {
  const factory =
    dependencies.generationFactory ?? createStudioImageGenerationService;
  const generation = factory(actor, { enabled: dependencies.enabled });
  const factories: StudioMediaFactories = {...defaultStudioMediaFactories, image: factory,
    video: dependencies.videoGenerationFactory ?? defaultStudioMediaFactories.video,
    audio: dependencies.audioGenerationFactory ?? defaultStudioMediaFactories.audio};
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
    const quote = turn.quote_id
      ? await serviceForDraft(turn.draft_json).getQuote(turn.quote_id)
      : null;
    if (turn.quote_id && !quote)
      throw new AgentApiError(
        "INTERNAL_ERROR",
        "The saved image quote is unavailable.",
      );
    const balance = quote ? await readWallet() : null;
    return {
      requestId: turn.request_id,
      message: turn.input_json.message,
      references: turn.input_json.references,
      ...(turn.input_json.attachments ? {attachments: turn.input_json.attachments} : {}),
      ...(turn.input_json.referenceMentions ? {referenceMentions: turn.input_json.referenceMentions} : {}),
      ...(turn.input_json.renewedFromRequestId ? {renewedFromRequestId: turn.input_json.renewedFromRequestId} : {}),
      reply: turn.draft_json?.reply ?? null,
      ...(turn.draft_json?.exportQuote ? {exportQuote: turn.draft_json.exportQuote} : {}),
      ...(turn.draft_json?.continuation ? {continuation: turn.draft_json.continuation} : {}),
      state: expiredLease ? "failed" : turn.state,
      retryable: expiredLease || turn.state === "failed",
      quote: quote
        ? {
            quoteId: quote.quoteId,
            expiresAt: quote.expiresAt.toISOString(),
            requestHash: quote.requestHash,
            summary: quote.request,
            price: { amountCents: quote.priceCents, currency: quote.currency },
            fundingMode: "wallet",
            confirmationRequired: true,
            wallet: balance?.currency === quote.currency ? balance : null,
            state:
              quote.state === "prepared" &&
              quote.expiresAt.getTime() <= Date.now()
                ? "expired"
                : quote.state,
            modelLabel:
              getBaseEngineIncludingHidden(quote.request.engineId)?.label ??
              quote.request.engineId,
          }
        : null,
      generation: quote?.jobId ? await buildStudioGenerationMediaAccess(actor.userId, await serviceForDraft(turn.draft_json).recover(quote.quoteId)) : null,
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
      const { turn, claimed } = await claimImageTurn(actor, input);
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
        for (const attachment of input.attachments ?? []) {
          try {
            const media = await resolveStudioMedia(actor.userId, attachment);
            refs.push({assetId: attachment.type === 'asset' ? attachment.assetId : attachment.outputId,
              role: 'reference', mediaKind: media.kind, storageUrl: media.url, mimeType: media.mime,
              width: media.mediaFacts?.width ?? null, height: media.mediaFacts?.height ?? null, durationSec: media.mediaFacts?.durationSec ?? null,
              originalName: media.originalName ?? null} satisfies ResolvedReference);
          } catch {throw new AgentApiError('REFERENCE_INVALID', 'The attached media is no longer available.');}
        }
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
        if (!turn.draft_json && !useActions && !dependencies.director) throw new AgentApiError('ENGINE_UNAVAILABLE','Enable the metered Studio conversation before requesting assistance.');
        const draft =
          turn.draft_json ??
          (useActions ? await runStudioImageActions({
            actor, turn, input, references: refs, referenceFingerprint,
            history: history.map(saved => ({message: saved.input_json.message, reply: saved.draft_json?.reply ?? null,
              ...(saved.input_json.referenceMentions ? {referenceMentions: saved.input_json.referenceMentions} : {})})),
            enabled: dependencies.enabled, factory, createResponse: dependencies.createActionResponse,assistancePolicy: dependencies.assistancePolicy,countInputTokens: dependencies.countInputTokens,
            factories, mediaEnabled: dependencies.mediaEnabled,editingEnabled: dependencies.editingEnabled,exportsEnabled: dependencies.exportsEnabled,requestOrigin: dependencies.requestOrigin,exportDependencies: dependencies.exportDependencies,
          }) : await runMeteredImageDirector(
            actor,
            turn,
            dependencies.director ?? draftStudioImage,
            input,
            history.map((saved) => ({
              message: saved.input_json.message,
              reply: saved.draft_json?.reply ?? null,
              ...(saved.input_json.referenceMentions ? {referenceMentions: saved.input_json.referenceMentions} : {}),
            })),
            refs,
          ));
        if (!turn.draft_json && !useActions)
          await persistImageDraft(actor, turn, draft, referenceFingerprint);
        if (hasDraftCreation(draft) && !useActions) {
          if (dependencies.actionsEnabled) {
            await resumeStudioImageAction({actor, turn, input, references: refs, referenceFingerprint, enabled: dependencies.enabled, factory, factories, mediaEnabled: dependencies.mediaEnabled});
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
      return serviceForDraft(turn.draft_json).confirm({ quoteId: input.quoteId, confirmed: true });
    },
  };
}
