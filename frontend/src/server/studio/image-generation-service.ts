import { isWorkspaceModelCertifiedForBlock, isStudioConversationVideoModeCertified } from "@/app/(core)/(workspace)/app/studio/workspace/_lib/models/workspace-model-certification";
import {recordedStudioOutputDuration} from './conversation-quote-facts';
import {
  requireGenerationActor,
  requireStudioGenerationRequest,
  isStudioGenerationMode,
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
import { getWalletSummary } from "@/server/wallet-summary";
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import {STUDIO_CONVERSATION_MAX_REFERENCES} from '@/lib/studio/conversation-creation-contract';
import type {StudioPricingEstimate} from '@/lib/studio/conversation-pricing-contract';
import {GenerationNormalizationError,normalizeGenerationRequest} from '@/server/agent-api/generation-normalization';
import {readGenerationPricing} from '@/server/agent-api/generation-pricing-read';
import {priceCanonicalGeneration} from '@/server/agent-api/generation-pricing';
import {getUserMembershipStatus} from '@/server/membership/user-membership-status';
import {resolveAgentGenerationRequestExecutability} from '@/server/agent-runtime/model-executability';

function certified(catalog: AgentPublicGenerationEngine[], surface: 'image' | 'video') {
  return catalog
    .filter((candidate) => candidate.surface === surface)
    .map((candidate) => ({
      ...candidate,
      publicModes: candidate.publicModes
        .filter((mode) => Boolean(candidate.modeCaps[mode]))
        .filter((mode) => isStudioGenerationMode(surface,mode))
        .filter(mode => {
          const details=projectAgentModelModeDetails(candidate,mode);
          return !details.settings.some(setting=>setting.required && setting.type==='multi_prompt')
            && !details.references.some(ref=>ref.required && ((surface==='image'&&ref.type!=='image') || (ref.min ?? 1)>STUDIO_CONVERSATION_MAX_REFERENCES));
        })
        .filter((mode) =>
          surface === 'video' ? isStudioConversationVideoModeCertified(candidate.engine.id, mode) : isWorkspaceModelCertifiedForBlock({
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
  return createStudioVisualGenerationService(actor, options, 'image');
}

export function createStudioVideoGenerationService(
  actor: StudioGenerationActor,
  options: StudioImageGenerationOptions,
) {
  return createStudioVisualGenerationService(actor, options, 'video');
}

function createStudioVisualGenerationService(
  actor: StudioGenerationActor,
  options: StudioImageGenerationOptions,
  surface: 'image' | 'video',
) {
  requireGenerationActor(actor);
  if (actor.authMethod !== "studio-session")
    throw new AgentApiError("AUTH_REQUIRED", "Studio session required.");
  const quotes = createQuoteRepository({...generationQuoteCodec, surfaces: [surface]}, {
    origin: "studio-session",
    projectId: actor.projectId,
  });
  const accountUrl = "https://maxvideoai.com/account/connections";
  const prepareDeps = options.prepareDependencies ?? {};
  const confirmDeps = options.confirmDependencies ?? {};
  const catalog = async () => certified(await (prepareDeps.listPublicEngines ?? listPublicAgentGenerationEngines)(),surface);
  async function resolveReferences(
    request: CanonicalGenerationRequest,
    executor?: TransactionQueryExecutor,
  ): Promise<ResolvedReference[]> {
    const references: ResolvedReference[] = [];
    for (const reference of request.references) {
      if (reference.kind !== "asset")
        throw new AgentApiError(
          "REFERENCE_INVALID",
          "Select owned reference media from your library.",
        );
      try {
        const observed = await resolveOwnedReferenceAssetForActor(
          actor,
          reference.assetId,
          executor ? { executor } : {},
        );
        const ref = { type: 'asset', assetId: reference.assetId, kind: observed.mediaKind };
        await resolveStudioMedia(
          actor.userId,
          ref,
          executor ? (sql, params) => executor.query(sql, params) : undefined,
          { lockAsset: !!executor },
        );
        // Confirmation locks the strict asset and source provenance first.
        // Read canonical facts again under that lock; the initial kind lookup
        // must never supply stale URL/duration facts to pricing or dispatch.
        const asset=executor?await resolveOwnedReferenceAssetForActor(actor,reference.assetId,{executor}):observed;
        if (surface==='image'&&asset.mediaKind !== "image") throw new Error("IMAGE_REQUIRED");
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
          surface,
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
          surface,
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
    walletSummary: () =>
      (prepareDeps.getWalletSummary ?? getWalletSummary)(actor.userId),
    catalog,
    async estimate(input: PrepareGenerationInput): Promise<StudioPricingEstimate> {
      if (!options.enabled) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio estimates are unavailable.');
      let request: CanonicalGenerationRequest;
      try {request=normalizeGenerationRequest(input);} catch (error) {
        if (error instanceof GenerationNormalizationError && error.field==='settings' && input.surface==='video' && Object.prototype.hasOwnProperty.call(input.settings ?? {},'duration')) {
          throw new AgentApiError('PARAMETER_INVALID','Use the video setting durationSec (seconds), not duration. Choose a supported value from model_details and retry pricing_read.');
        }
        throw new AgentApiError('PARAMETER_INVALID','The pricing scenario is invalid.');
      }
      requireStudioGenerationRequest(request);
      const settings: Record<string,string|number|boolean|null>={};
      for (const [key,value] of Object.entries(request.settings)) {
        if (value!==null && typeof value!=='string' && typeof value!=='number' && typeof value!=='boolean') throw new AgentApiError('PARAMETER_INVALID','Structured settings cannot be estimated in this Studio workflow.');
        settings[key]=value;
      }
      if (request.surface!==surface) throw new AgentApiError('ENGINE_UNAVAILABLE','This model is not available in this Studio catalog.');
      const {pricing}=await readGenerationPricing(request,actor,{
        listPublicEngines:catalog,resolveGenerationReferences:request=>resolveReferences(request),
        resolveMembershipPricing:prepareDeps.resolveMembershipPricing ?? (async userId=>(await getUserMembershipStatus(userId)).pricing),
        priceGeneration:prepareDeps.priceGeneration ?? ((request,tier,context)=>priceCanonicalGeneration(request,tier,undefined,context)),
        resolveRequestExecutability:prepareDeps.resolveRequestExecutability ?? ((request,candidate,references)=>resolveAgentGenerationRequestExecutability(request,candidate.engine,references)),
      });
      const outputDurationSec=request.surface==='video'
        ? recordedStudioOutputDuration({canonicalPricing:pricing.pricingSnapshot}) : undefined;
      return {modelId:request.engineId,surface:request.surface,mode:request.mode,settings,outputCount:1,referenceCount:request.references.length,
        ...(outputDurationSec!==undefined ? {outputDurationSec} : {}),
        price:{amountCents:pricing.priceCents,currency:pricing.currency},estimatedAt:(prepareDeps.now?.() ?? new Date()).toISOString(),quoteRequired:true};
    },
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
