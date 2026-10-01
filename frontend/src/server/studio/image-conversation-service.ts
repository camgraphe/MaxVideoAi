import { getBaseEngineIncludingHidden } from "@/lib/engines";
import { z } from "zod";
import {
  imageTurnInputSchema,
  type ImageConversation,
  type ImageConversationTurn,
  type ImageTurnInput,
  type ImageDraft,
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
import {
  claimImageTurn,
  persistImageDraft,
  attachImageQuote,
  failImageTurn,
  listImageTurns,
  readImageConversationProject,
  type StoredImageTurn,
} from "./image-conversation-repository";

export const imageConfirmationSchema = z
  .object({
    requestId: z.string().uuid(),
    quoteId: z.string().uuid(),
    confirmed: z.literal(true),
  })
  .strict();
export type ImageGenerationFactory = typeof createStudioImageGenerationService;
export function imageRequestFromDraft(
  draft: ImageDraft,
  input: ImageTurnInput,
  catalog: AgentPublicGenerationEngine[],
): CanonicalGenerationRequest {
  if (!draft.image)
    throw new AgentApiError("PARAMETER_INVALID", "No image was requested.");
  const mode = input.references.length ? "i2i" : "t2i";
  const candidate =
    catalog.find(
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
  const ratio = draft.image.aspectRatio;
  const choices =
    ratio === "1:1"
      ? ["1024x1024", "square_hd"]
      : ratio === "16:9"
        ? ["landscape_16_9", "1920x1080"]
        : ["portrait_16_9"];
  const allowed =
    candidate.modeCaps[mode]?.resolution ?? candidate.engine.resolutions;
  const resolution = choices.find((value) => allowed.includes(value));
  if (!resolution)
    throw new AgentApiError(
      "PARAMETER_INVALID",
      "This image format is unavailable.",
    );
  return {
    schemaVersion: 1,
    surface: "image",
    engineId: candidate.engine.id,
    mode,
    prompt: draft.image.prompt,
    settings: {
      aspectRatio: ratio,
      resolution,
      quality: "high",
      outputFormat: "png",
    },
    references: input.references.map((assetId) => ({
      kind: "asset",
      assetId,
      role: "reference",
    })),
    outputCount: 1,
  };
}
export function createImageConversationService(
  actor: StudioGenerationActor,
  dependencies: {
    enabled: boolean;
    director?: ImageDirector;
    generationFactory?: ImageGenerationFactory;
  },
) {
  const factory =
    dependencies.generationFactory ?? createStudioImageGenerationService;
  const generation = factory(actor, { enabled: dependencies.enabled });
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
      ? await generation.getQuote(turn.quote_id)
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
      reply: turn.draft_json?.reply ?? null,
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
      generation: quote?.jobId ? await generation.recover(quote.quoteId) : null,
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
        const draft =
          turn.draft_json ??
          (await (dependencies.director ?? draftStudioImage)(
            input,
            history.map((saved) => ({
              message: saved.input_json.message,
              reply: saved.draft_json?.reply ?? null,
            })),
            refs,
          ));
        if (!turn.draft_json)
          await persistImageDraft(actor, turn, draft, referenceFingerprint);
        if (draft.image) {
          const request = imageRequestFromDraft(
            draft,
            input,
            await generation.catalog(),
          );
          await factory(actor, {
            enabled: dependencies.enabled,
            expectedReferenceFingerprint: referenceFingerprint,
            onQuotePrepared: (quote, executor) =>
              attachImageQuote(actor, turn, quote.quoteId, executor),
          }).prepare(request);
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
      return generation.confirm({ quoteId: input.quoteId, confirmed: true });
    },
  };
}
