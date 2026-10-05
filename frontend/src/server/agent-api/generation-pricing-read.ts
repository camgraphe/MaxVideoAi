import {retireMembershipPricing} from '@/lib/membership-policy';
import {isGptImageFamilyEngineId} from '@/lib/image/gptImage2';
import type {MembershipPricingContext} from '@/server/membership/user-membership-status';
import {computeGenerationCatalogRevision} from './catalog-revision';
import {AgentApiError,withMediaNeutralReferenceMessage} from './errors';
import {GenerationCapabilityError,validateCanonicalGenerationCapabilities} from './generation-capability-validation';
import {requireGenerationActor,type GenerationActor} from './generation-actor';
import type {CanonicalGenerationRequest} from './generation-types';
import type {AgentPublicGenerationEngine} from './model-catalog';
import type {GenerationPricingResult} from './generation-pricing';
import type {ResolvedReference} from './reference-types';
import {resolveGenerationReferencesForActor} from './resolve-generation-references';
import type {PrepareGenerationDependencies} from './prepare-generation';

export type GenerationPricingReadDependencies=Pick<PrepareGenerationDependencies,'listPublicEngines' | 'resolveGenerationReferences' | 'resolveRequestExecutability' | 'resolveMembershipPricing' | 'priceGeneration'>;

// Error presentation only: never expose provider aliases, arbitrary field names or values.
const PUBLIC_CANONICAL_PARAMETER_FIELDS = new Set([
  'engineId','mode','prompt','settings','references','outputCount',
  'aspectRatio','audio','durationSec','resolution','fps','loop','seed',
  'cameraFixed','cfgScale','contextSec','cropEndX','cropEndY','cropStartX','cropStartY',
  'documentUrl','enablePromptExpansion','guidanceScale','hdr','negativePrompt','numFrames',
  'promptExpansionMode','reframeGridPositionX','reframeGridPositionY','retakeMode','safetyChecker',
  'shotType','webpageUrl','sourcePositionHeight','sourcePositionWidth','sourcePositionX','sourcePositionY',
  'startTimeSec','extendPosition','modifyStrength','multiPrompt','exrExport','editDepthBlur','editFace',
  'editKeyframeIndexes','editNormalsAugmentation','editPoseStrength','editStrength','editTrajectorySparsity',
  'enableWebSearch','limitGenerations','imageHeight','imageWidth','outputFormat','quality','style','thinkingLevel','watermark',
]);

function invalidParameter(field?: string): never {
  const message = field && PUBLIC_CANONICAL_PARAMETER_FIELDS.has(field)
    ? `The generation field "${field}" is invalid or missing for the selected model.`
    : 'One or more generation settings are invalid for the selected model.';
  throw new AgentApiError('PARAMETER_INVALID',message);
}

function validateCapabilities(
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
        throw new AgentApiError('REFERENCE_INVALID', 'The reference media is invalid for this model mode.');
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
  };
}

/** Shared read-only verification and canonical pricing. No quote, wallet or reservation writes. */
export async function readGenerationPricing(request: CanonicalGenerationRequest,principal: GenerationActor,dependencies: GenerationPricingReadDependencies) {
  requireGenerationActor(principal);
  const publicEngines = await dependencies.listPublicEngines();
  const candidate = publicEngines.find((entry) => entry.engine.id === request.engineId);
  if (!candidate || candidate.surface !== request.surface) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'The selected model is not publicly available.');
  }
  if (!candidate.publicModes.includes(request.mode)) {
    throw new AgentApiError('MODE_UNSUPPORTED', 'The selected model does not support this mode.');
  }
  validateCapabilities(request, candidate);
  validateRepresentablePricingFacts(request);
  let resolvedReferences: ResolvedReference[] = [];
  if (request.references.some((reference) => reference.kind === 'asset')) {
    try {
      const resolveReferences = dependencies.resolveGenerationReferences
        ?? ((currentRequest, currentPrincipal) =>
          resolveGenerationReferencesForActor(currentRequest, currentPrincipal));
      resolvedReferences = await resolveReferences(request, principal);
      validateCapabilities(request, candidate, resolvedReferences);
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
      { resolvedReferences, resolvedEngine: candidate.engine },
    );
  } catch {
    throw new AgentApiError(
      'PARAMETER_INVALID',
      'The selected settings cannot be priced for this model.',
    );
  }
  const pricingSnapshot = buildGenerationPricingSnapshot(pricing, request, catalogRevision, membership);
  return {pricing, pricingSnapshot, resolvedReferences, catalogRevision};
}
