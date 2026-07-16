import { computeConfiguredPreflight } from '@/server/engines';
import {
  estimateImageGeneration,
  type ImageEstimateInput,
} from '@/server/images/estimate-image-generation';
import type { PreflightRequest, PreflightResponse, PricingSnapshot } from '@/types/engines';
import type { ImageGenerationMode, ImageGenerationRequest } from '@/types/image-generation';

import type { CanonicalGenerationRequest } from './generation-types';
import type { AuthoritativeMembershipTier } from '../membership/user-membership-status';

export type GenerationPricingResult = {
  priceCents: number;
  currency: string;
  membershipTier: AuthoritativeMembershipTier;
  pricingSnapshot: Record<string, unknown>;
};

export type GenerationPricingDependencies = {
  computeVideoPreflight(request: PreflightRequest): Promise<PreflightResponse>;
  estimateImage(
    input: ImageEstimateInput,
  ): Promise<Awaited<ReturnType<typeof estimateImageGeneration>>>;
};

const defaultDependencies: GenerationPricingDependencies = {
  computeVideoPreflight: computeConfiguredPreflight,
  estimateImage: estimateImageGeneration,
};

function requiredString(
  settings: CanonicalGenerationRequest['settings'],
  key: string,
): string {
  const value = settings[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Canonical pricing input is incomplete.');
  }
  return value;
}

function requiredPositiveInteger(
  settings: CanonicalGenerationRequest['settings'],
  key: string,
): number {
  const value = settings[key];
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error('Canonical pricing input is incomplete.');
  }
  return value as number;
}

function optionalString(
  settings: CanonicalGenerationRequest['settings'],
  key: string,
): string | undefined {
  const value = settings[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function pricingRecord(snapshot: PricingSnapshot): Record<string, unknown> {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Canonical pricing snapshot is unavailable.');
  }
  return snapshot as unknown as Record<string, unknown>;
}

function validatePricingResult(
  snapshot: PricingSnapshot,
  membershipTier: AuthoritativeMembershipTier,
  expectedTotal?: number,
  expectedCurrency?: string,
): GenerationPricingResult {
  const priceCents = snapshot.totalCents;
  const currency = snapshot.currency;
  if (
    !Number.isSafeInteger(priceCents)
    || priceCents < 0
    || typeof currency !== 'string'
    || !/^[A-Z]{3}$/u.test(currency)
    || snapshot.membershipTier !== membershipTier
    || (expectedTotal !== undefined && expectedTotal !== priceCents)
    || (expectedCurrency !== undefined && expectedCurrency !== currency)
  ) {
    throw new Error('Canonical pricing result is inconsistent.');
  }
  return { priceCents, currency, membershipTier, pricingSnapshot: pricingRecord(snapshot) };
}

export async function priceCanonicalGeneration(
  request: CanonicalGenerationRequest,
  membershipTier: AuthoritativeMembershipTier,
  dependencies: GenerationPricingDependencies = defaultDependencies,
): Promise<GenerationPricingResult> {
  if (request.surface === 'video') {
    const settings = request.settings;
    const result = await dependencies.computeVideoPreflight({
      engine: request.engineId,
      mode: request.mode,
      durationSec: requiredPositiveInteger(settings, 'durationSec'),
      resolution: requiredString(settings, 'resolution') as PreflightRequest['resolution'],
      aspectRatio: requiredString(settings, 'aspectRatio') as PreflightRequest['aspectRatio'],
      fps: typeof settings.fps === 'number' ? settings.fps : 24,
      ...(typeof settings.loop === 'boolean' ? { loop: settings.loop } : {}),
      ...(typeof settings.audio === 'boolean' ? { audio: settings.audio } : {}),
      user: { memberTier: membershipTier },
    });
    if (!result.ok || !result.pricing || result.total === undefined || !result.currency) {
      throw new Error('Canonical video pricing is unavailable.');
    }
    return validatePricingResult(result.pricing, membershipTier, result.total, result.currency);
  }

  const settings = request.settings;
  const result = await dependencies.estimateImage({
    engineId: request.engineId,
    mode: request.mode as ImageGenerationMode,
    numImages: request.outputCount,
    resolution: requiredString(settings, 'resolution'),
    quality: optionalString(settings, 'quality') as ImageGenerationRequest['quality'],
    aspectRatio: optionalString(settings, 'aspectRatio'),
    referenceImageCount: request.references.length,
    referenceImageSizes: [],
    membershipTier,
  });
  return validatePricingResult(result.pricing, membershipTier);
}
