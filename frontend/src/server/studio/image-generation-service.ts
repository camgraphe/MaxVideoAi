import { isWorkspaceModelCertifiedForBlock } from "@/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-certification";
import {
  requireGenerationActor,
  studioReferenceFingerprint,
  type StudioGenerationActor,
} from "@/server/agent-api/generation-actor";
import { AgentApiError } from "@/server/agent-api/errors";
import {
  createPrepareGenerationForActorService,
  type PrepareGenerationDependencies,
  type PrepareGenerationInput,
} from "@/server/agent-api/prepare-generation";
import {
  createConfirmGenerationForActorService,
  type ConfirmGenerationDependencies,
  type ConfirmGenerationInput,
} from "@/server/agent-api/confirm-generation";
import {
  createQuoteRepository,
  generationQuoteCodec,
  type McpGenerationQuote,
} from "@/server/agent-api/quote-repository";
import { getGenerationStatus } from "@/server/generations/generation-status";
import {
  listPublicAgentGenerationEngines,
  listPublicAgentGenerationEnginesInExecutor,
  type AgentPublicGenerationEngine,
} from "@/server/agent-api/model-catalog";
import { resolveOwnedReferenceAssetForActor } from "@/server/agent-api/reference-assets";
import type { CanonicalGenerationRequest } from "@/server/agent-api/generation-types";
import type { ResolvedReference } from "@/server/agent-api/reference-types";
import { withDbTransaction, type TransactionQueryExecutor } from "@/lib/db";
import { resolveStudioMedia } from "./media-resolver";

function certified(catalog: AgentPublicGenerationEngine[]) {
  return catalog
    .filter((candidate) => candidate.surface === "image")
    .map((candidate) => ({
      ...candidate,
      publicModes: candidate.publicModes
        .filter((mode) => mode === "t2i" || mode === "i2i")
        .filter((mode) =>
          isWorkspaceModelCertifiedForBlock({
            modelId: candidate.engine.id,
            presetId: mode === "t2i" ? "generate-image" : "modify-image",
            workflowType: mode === "t2i" ? "text_to_image" : "image_to_image",
          }),
        ),
    }))
    .filter((candidate) => candidate.publicModes.length > 0);
}

export type StudioImageGenerationOptions = {
  enabled: boolean;
  expectedReferenceFingerprint?: string;
  prepareDependencies?: Partial<
    Omit<PrepareGenerationDependencies, "trialRiskContext">
  >;
  confirmDependencies?: Partial<
    Omit<ConfirmGenerationDependencies, "trialRiskContext">
  >;
  onQuotePrepared?(
    quote: McpGenerationQuote,
    executor: TransactionQueryExecutor,
  ): Promise<void>;
};

/** Transport adapter: account/project come from server authorization, never from model arguments. */
export function createStudioImageGenerationService(
  actor: StudioGenerationActor,
  options: StudioImageGenerationOptions,
) {
  requireGenerationActor(actor);
  if (actor.authMethod !== "studio-session")
    throw new AgentApiError("AUTH_REQUIRED", "Studio session required.");
  const quotes = createQuoteRepository(generationQuoteCodec, {
    origin: "studio-session",
    projectId: actor.projectId,
  });
  const accountUrl = "https://maxvideoai.com/account/connections";
  const prepareDeps = options.prepareDependencies ?? {};
  const confirmDeps = options.confirmDependencies ?? {};
  async function resolveReferences(
    request: CanonicalGenerationRequest,
    executor?: TransactionQueryExecutor,
  ): Promise<ResolvedReference[]> {
    const references: ResolvedReference[] = [];
    for (const reference of request.references) {
      if (reference.kind !== "asset")
        throw new AgentApiError(
          "REFERENCE_INVALID",
          "Select an owned image from your library.",
        );
      const ref = { type: "asset", assetId: reference.assetId, kind: "image" };
      try {
        await resolveStudioMedia(
          actor.userId,
          ref,
          executor ? (sql, params) => executor.query(sql, params) : undefined,
          { lockAsset: !!executor },
        );
        const asset = await resolveOwnedReferenceAssetForActor(
          actor,
          reference.assetId,
          executor ? { executor } : {},
        );
        if (asset.mediaKind !== "image") throw new Error("IMAGE_REQUIRED");
        references.push({
          ...asset,
          role: reference.role,
          ...(reference.slot === undefined ? {} : { slot: reference.slot }),
        });
      } catch {
        throw new AgentApiError(
          "REFERENCE_INVALID",
          "The selected reference is no longer available.",
        );
      }
    }
    if (
      options.expectedReferenceFingerprint !== undefined &&
      studioReferenceFingerprint(references) !==
        options.expectedReferenceFingerprint
    )
      throw new AgentApiError(
        "REFERENCE_INVALID",
        "The references changed after Studio reviewed them. Send a new message to review them again.",
      );
    return references;
  }
  const prepare = createPrepareGenerationForActorService(
    accountUrl,
    { clientIp: null, userAgent: null },
    {
      ...prepareDeps,
      paidGenerationEnabled: () => options.enabled,
      listPublicEngines: async () =>
        certified(
          await (
            prepareDeps.listPublicEngines ?? listPublicAgentGenerationEngines
          )(),
        ),
      resolveGenerationReferences: (request) => resolveReferences(request),
      insertPreparedQuote: async (input, dependencies) => {
        const quote = await quotes.insertPreparedQuote(input, dependencies);
        if (options.onQuotePrepared)
          await options.onQuotePrepared(
            quote,
            dependencies.executor as TransactionQueryExecutor,
          );
        return quote;
      },
    },
  );
  const confirm = createConfirmGenerationForActorService(
    accountUrl,
    { clientIp: null, userAgent: null },
    {
      ...confirmDeps,
      paidGenerationEnabled: () => options.enabled,
      trialGenerationEnabled: () => false,
      listPublicEngines: async (dependencies) =>
        certified(
          await (
            confirmDeps.listPublicEngines ??
            ((deps) =>
              listPublicAgentGenerationEnginesInExecutor(deps.executor))
          )(dependencies),
        ),
      resolveGenerationReferences: (request, _actor, { executor }) =>
        resolveReferences(request, executor),
      lockOwnedQuote: quotes.lockOwnedQuote,
      markQuoteExpired: quotes.markQuoteExpired,
      claimPreparedQuote: quotes.claimPreparedQuote,
      markQuoteAccepted: quotes.markQuoteAccepted,
      markQuoteFailed: quotes.markQuoteFailed,
    },
  );
  return {
    catalog: async () =>
      certified(
        await (
          prepareDeps.listPublicEngines ?? listPublicAgentGenerationEngines
        )(),
      ),
    resolveReferences,
    prepare: (input: PrepareGenerationInput) => prepare(input, actor),
    async confirm(input: ConfirmGenerationInput) {
      try {
        return await confirm(input, actor);
      } catch (error) {
        if (
          error instanceof AgentApiError &&
          ["QUOTE_EXPIRED", "REFERENCE_INVALID"].includes(error.code)
        )
          await withDbTransaction((executor) =>
            quotes.invalidatePreparedQuote(
              {
                quoteId: input.quoteId,
                userId: actor.userId,
                oauthClientId: null,
              },
              { executor, expiredAt: new Date() },
            ),
          );
        throw error;
      }
    },
    getQuote: (quoteId: string) =>
      quotes.getOwnedQuote({
        quoteId,
        userId: actor.userId,
        oauthClientId: null,
      }),
    async recover(quoteId: string) {
      const quote = await quotes.getOwnedQuote({
        quoteId,
        userId: actor.userId,
        oauthClientId: null,
      });
      if (!quote)
        throw new AgentApiError(
          "QUOTE_EXPIRED",
          "This quote is not available in this project.",
        );
      return quote.jobId
        ? getGenerationStatus({ userId: actor.userId, jobId: quote.jobId })
        : null;
    },
  };
}
