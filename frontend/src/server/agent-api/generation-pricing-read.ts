import { resolveCanonicalFluxLineage } from './generation-flux-lineage';
import { fluxDraftQuoteBinding } from '@/server/flux-draft-cache';
import { isFluxLtxSourceOperation } from '@/lib/flux-ltx-operations';
import { isH3SourceOperation } from '@/lib/h3-source-operations';
import { resolveCanonicalLumaLineage, lumaLineageQuoteBinding } from './generation-luma-lineage';
import { generationOperationQuoteBinding } from './generation-operation-facts';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import { toEngineGenerationMode } from './generation-mode-aliases';
import {videoDurationPolicy} from '@/lib/video-workflow-capabilities';
import { seedanceWorkflowCandidate } from './seedance-workflow-capabilities';
import { resolveAgentSeedanceWorkflow, seedanceWorkflowQuoteBinding } from './seedance-workflow';
import {retireMembershipPricing} from '@/lib/membership-policy';
import {isGptImageFamilyEngineId} from '@/lib/image/gptImage2';
import type {MembershipPricingContext} from '@/server/membership/user-membership-status';
import {computeGenerationCatalogRevision} from './catalog-revision';
import {AgentApiError,withMediaNeutralReferenceMessage} from './errors';
import {GenerationCapabilityError,validateCanonicalGenerationCapabilities,type ReferenceConstraintFailure} from './generation-capability-validation';
import {requireGenerationActor,studioReferenceFingerprint,type GenerationActor} from './generation-actor';
import type {CanonicalGenerationRequest} from './generation-types';
import type {AgentPublicGenerationEngine} from './model-catalog';
import type {GenerationPricingResult} from './generation-pricing';
import type {ResolvedReference} from './reference-types';
import {assertGenerationReferenceUrls,resolveGenerationReferencesForActor} from './resolve-generation-references';
import type {PrepareGenerationDependencies} from './prepare-generation';

export type GenerationPricingReadDependencies=Pick<PrepareGenerationDependencies,'resolveFluxLineage' | 'listPublicEngines' | 'resolveGenerationReferences' | 'resolveRequestExecutability' | 'resolveMembershipPricing' | 'priceGeneration'>;

// Error presentation only: never expose provider aliases, arbitrary field names or values.
const PUBLIC_CANONICAL_PARAMETER_FIELDS = new Set([
  'engineId','mode','prompt','settings','references','outputCount',
  'aspectRatio','audio','durationSec','resolution','fps','loop','seed',
  'safetyTolerance','keepAudio','audioSetting','personGeneration','compressionQuality',
  'promptAudioDirection','promptCameraDirection','promptEditInstruction',
  'cameraFixed','cfgScale','contextSec','cropEndX','cropEndY','cropStartX','cropStartY',
  'documentUrl','enablePromptExpansion','guidanceScale','hdr','negativePrompt','numFrames',
  'promptExpansionMode','reframeGridPositionX','reframeGridPositionY','retakeMode','safetyChecker',
  'shotType','webpageUrl','sourcePositionHeight','sourcePositionWidth','sourcePositionX','sourcePositionY',
  'startTimeSec','extendPosition','modifyStrength','multiPrompt','exrExport','editDepthBlur','editFace',
  'reasoningLevel','keyframeIndexes','editKeyframeIndexes','editNormalsAugmentation','editPoseStrength','editStrength','editTrajectorySparsity',
  'enableWebSearch','limitGenerations','imageHeight','imageWidth','outputFormat','quality','style','thinkingLevel','watermark',
]);

function invalidParameter(field?: string): never {
  const message = field && PUBLIC_CANONICAL_PARAMETER_FIELDS.has(field)
    ? `The generation field "${field}" is invalid or missing for the selected model.`
    : 'One or more generation settings are invalid for the selected model.';
  throw new AgentApiError('PARAMETER_INVALID',message);
}

// Fixed public guidance only. Never forward stored names, URLs, IDs or provider fields.
const REFERENCE_CONSTRAINT_MESSAGES: Record<ReferenceConstraintFailure, string> = {
  metadata_unverified: 'Reference file metadata is unverified. Re-import the original file before preparing another quote.',
  dimensions_unverified: 'Reference dimensions are unverified. Re-import the original file before preparing another quote.',
  duration_unverified: 'Reference duration is unverified. Re-import the original file before preparing another quote.',
  duration_unsupported: 'Reference duration is outside the selected model mode limits. Check get_model_details and choose a supported clip.',
  combined_duration_exceeded: 'Combined reference duration exceeds the selected model mode limit. Remove or shorten clips using the limits in get_model_details.',
  size_exceeded: 'Reference file size exceeds the selected model mode limit. Check get_model_details and import a smaller file.',
  format_unsupported: 'Reference file format is unsupported for the selected model mode. Check get_model_details and import a supported format.',
  image_aspect_ratio_unsupported: 'Reference image aspect ratio is outside the selected model mode limits. Check get_model_details and import a supported image.',
  image_dimensions_too_small: 'The reference image is too small for the selected model mode. Check get_model_details and import a larger original image.',
};

export function validateGenerationPricingCapabilities(
  request: CanonicalGenerationRequest,
  candidate: AgentPublicGenerationEngine,
  resolvedReferences?: readonly ResolvedReference[],
): void {
  try {
    validateCanonicalGenerationCapabilities(
      request,
      candidate,
      resolvedReferences ? { resolvedReferences } : {},
    );
  } catch (error) {
    if (error instanceof GenerationCapabilityError) {
      if (error.kind === 'reference_required') {
        throw new AgentApiError('REFERENCE_REQUIRED', 'This generation mode requires reference media.');
      }
      if (error.kind === 'reference_invalid') {
        throw new AgentApiError('REFERENCE_INVALID', error.referenceFailure
          ? REFERENCE_CONSTRAINT_MESSAGES[error.referenceFailure]
          : 'The reference media is invalid for this model mode.');
      }
      invalidParameter(error.field);
    }
    throw error;
  }
}

function validateRepresentablePricingFacts(request: CanonicalGenerationRequest): void {
  const resolution = request.settings.resolution;
  if (
    request.surface === 'image'
    && isGptImageFamilyEngineId(request.engineId)
    && request.mode === 'i2i'
    && resolution === 'auto'
    && request.references.some((reference) => reference.role !== 'mask' && reference.kind !== 'asset')
  ) {
    invalidParameter();
  }
}

function requireMembershipPricing(value: MembershipPricingContext): MembershipPricingContext {
  if (
    !value
    || !['member', 'plus', 'pro'].includes(value.tier)
    || value.source !== 'app_receipts_rolling_30d'
    || !Number.isSafeInteger(value.spent30Cents)
    || value.spent30Cents < 0
    || !Number.isSafeInteger(value.thresholdCents)
    || value.thresholdCents < 0
    || typeof value.discountPercent !== 'number'
    || !Number.isFinite(value.discountPercent)
    || value.discountPercent < 0
    || value.discountPercent > 1
  ) {
    throw new AgentApiError('INTERNAL_ERROR', 'The account membership price is unavailable.');
  }
  return retireMembershipPricing(value);
}

export function buildGenerationPricingSnapshot(
  pricing: GenerationPricingResult,
  request: CanonicalGenerationRequest,
  catalogRevision: string,
  membership: MembershipPricingContext,
  resolvedReferences: readonly ResolvedReference[] = [],
): Record<string, unknown> {
  if (
    !Number.isSafeInteger(pricing.priceCents)
    || pricing.priceCents < 0
    || typeof pricing.currency !== 'string'
    || !/^[A-Z]{3}$/u.test(pricing.currency)
    || !pricing.pricingSnapshot
    || typeof pricing.pricingSnapshot !== 'object'
    || Array.isArray(pricing.pricingSnapshot)
    || pricing.membershipTier !== membership.tier
  ) {
    throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
  }
  let canonicalPricing: unknown;
  try {
    canonicalPricing = JSON.parse(JSON.stringify(pricing.pricingSnapshot));
  } catch {
    throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
  }
  if (!canonicalPricing || typeof canonicalPricing !== 'object' || Array.isArray(canonicalPricing)) {
    throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
  }
  const canonicalRecord = canonicalPricing as Record<string, unknown>;
  if (
    canonicalRecord.totalCents !== pricing.priceCents
    || canonicalRecord.currency !== pricing.currency
    || canonicalRecord.membershipTier !== membership.tier
  ) {
    throw new AgentApiError('INTERNAL_ERROR', 'The current generation price is unavailable.');
  }
  return {
    schemaVersion: 1,
    catalogRevision,
    surface: request.surface,
    engineId: request.engineId,
    membership,
    canonicalPricing: canonicalRecord,
    ...(request.engineId==='kling-v4'?{klingV4ReferenceFingerprint:studioReferenceFingerprint(resolvedReferences)}:{}),
  };
}

/** Shared read-only verification and canonical pricing. No quote, wallet or reservation writes. */
export async function readGenerationPricing(request: CanonicalGenerationRequest,principal: GenerationActor,dependencies: GenerationPricingReadDependencies) {
  requireGenerationActor(principal);
  const fluxDraftSource = await (dependencies.resolveFluxLineage ?? resolveCanonicalFluxLineage)(request,principal);
  const lumaSource = await resolveCanonicalLumaLineage(request, principal);
  const inherited = await resolveAgentSeedanceWorkflow(request, principal.userId);
  request = inherited.request;
  const finalFacts = inherited.workflow?.finalFacts;
  const publicEngines = await dependencies.listPublicEngines();
  const publicCandidate = publicEngines.find((entry) => entry.engine.id === request.engineId);
  let candidate = publicCandidate ? seedanceWorkflowCandidate(request, publicCandidate) : undefined;
  if (!candidate || candidate.surface !== request.surface) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'The selected model is not publicly available.');
  }
  try {
    const engine = resolveVideoOperationEngine(candidate.engine, toEngineGenerationMode(request.engineId, request.mode), request.operation);
    if (engine !== candidate.engine) {
      const mode = toEngineGenerationMode(request.engineId, request.mode);
      candidate = { ...candidate, engine, modeCaps: { ...candidate.modeCaps, [request.mode]: engine.modeCaps?.[mode] } };
    }
  } catch { throw new AgentApiError('PARAMETER_INVALID', 'Invalid video operation.'); }
  if (!candidate.publicModes.includes(request.mode)) {
    throw new AgentApiError('MODE_UNSUPPORTED', 'The selected model does not support this mode.');
  }
  if (!finalFacts) validateGenerationPricingCapabilities(request, candidate);
  validateRepresentablePricingFacts(request);
  assertGenerationReferenceUrls(request);
  let resolvedReferences: ResolvedReference[] = [];
  if (request.references.some((reference) => reference.kind === 'asset')) {
    try {
      const resolveReferences = dependencies.resolveGenerationReferences
        ?? ((currentRequest, currentPrincipal) =>
          resolveGenerationReferencesForActor(currentRequest, currentPrincipal));
      resolvedReferences = await resolveReferences(request, principal);
      if (request.surface === 'video' && request.operation !== 'kling-edit' && !isH3SourceOperation(request.operation) && !isFluxLtxSourceOperation(request.operation) && request.settings.durationSec === undefined
        && videoDurationPolicy(candidate.engine, request.mode, candidate.modeCaps[request.mode]) === 'source_video') {
        const source = resolvedReferences.filter(reference => reference.role === 'source' && reference.mediaKind === 'video');
        if (source.length !== 1 || typeof source[0].durationSec !== 'number'
          || !Number.isFinite(source[0].durationSec) || source[0].durationSec <= 0) {
          throw new AgentApiError('REFERENCE_INVALID', REFERENCE_CONSTRAINT_MESSAGES.duration_unverified);
        }
        // Dispatch uses an integer placeholder; exact measured source timing remains in pricing context.
        request = { ...request, settings: { ...request.settings, durationSec: Math.ceil(source[0].durationSec) } };
      }
      validateGenerationPricingCapabilities(request, candidate, resolvedReferences);
    } catch (error) {
      if (error instanceof AgentApiError) {
        throw request.mode === 'v2v' || request.mode === 'extend'
          ? withMediaNeutralReferenceMessage(error)
          : error;
      }
      throw new AgentApiError('INTERNAL_ERROR', 'The reference media could not be verified.');
    }
  }
  const executionReadiness = dependencies.resolveRequestExecutability?.(
    request,
    candidate,
    resolvedReferences,
  );
  if (executionReadiness && !executionReadiness.executable) {
    if (executionReadiness.reason === 'profile_invalid') invalidParameter();
    throw new AgentApiError(
      'ENGINE_UNAVAILABLE',
      'The selected model cannot execute these settings right now.',
    );
  }

  const catalogRevision = computeGenerationCatalogRevision(publicEngines);
  let membership: MembershipPricingContext;
  try {
    membership = requireMembershipPricing(
      await dependencies.resolveMembershipPricing(principal.userId),
    );
  } catch (error) {
    if (error instanceof AgentApiError) throw error;
    throw new AgentApiError('INTERNAL_ERROR', 'The account membership price is unavailable.');
  }
  let pricing: GenerationPricingResult;
  try {
    pricing = await dependencies.priceGeneration(
      request,
      membership.tier,
      { resolvedReferences, resolvedEngine: candidate.engine, seedanceFinalFacts: finalFacts, fluxDraftSource },
    );
  } catch {
    throw new AgentApiError(
      'PARAMETER_INVALID',
      'The selected settings cannot be priced for this model.',
    );
  }
  const pricingSnapshot = { ...buildGenerationPricingSnapshot(pricing, request, catalogRevision, membership, resolvedReferences),
    ...generationOperationQuoteBinding(request, resolvedReferences,fluxDraftSource),
    ...lumaLineageQuoteBinding(lumaSource, request.settings.extendDirection), ...fluxDraftQuoteBinding(fluxDraftSource),
    ...seedanceWorkflowQuoteBinding(inherited.workflow) };
  return {pricing, pricingSnapshot, resolvedReferences, catalogRevision, request, workflow: inherited.workflow, resolvedEngine: candidate.engine};
}
