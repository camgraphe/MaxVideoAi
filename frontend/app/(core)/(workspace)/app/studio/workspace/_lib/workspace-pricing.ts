import type { PricingSnapshot } from '@maxvideoai/pricing';
import { STORYBOARD_TEMPLATE_SIZES, getStoryboardOutputConfig } from '@/components/tools/storyboard/_lib/storyboard-templates';
import { STORYBOARD_SOURCE } from '@/lib/storyboard-pricing';
import type { ImageGenerationRequest } from '@/types/image-generation';
import type { PreflightRequest, PreflightResponse } from '@/types/engines';
import { resolveWorkspaceBlockPolicy } from './models/workspace-block-capability-policy';
import { resolveWorkspaceGenerationFacts } from './workspace-generation-facts';
import { buildWorkspaceImageGenerationRequest } from './workspace-tool-requests';
import type {
  WorkspaceEdgeKind,
  WorkspaceGenerationMediaInput,
  WorkspaceModelCapability,
  WorkspacePricingEstimate,
  WorkspaceShotSettings,
  WorkspaceShotValidation,
} from './workspace-types';

type BuildWorkspaceShotPreflightRequestOptions = {
  settings: WorkspaceShotSettings;
  connectedInputs: WorkspaceEdgeKind[];
  capability: WorkspaceModelCapability | null;
  memberTier?: string;
  mediaInputs?: WorkspaceGenerationMediaInput[];
};

export type WorkspaceStoryboardImageEstimateRequest = {
  engineId: 'gpt-image-2';
  mode: 'i2i';
  numImages: 1;
  referenceImageSizes: Array<{ width: number; height: number }>;
  resolution: string;
  customImageSize: { width: number; height: number } | null;
  quality: 'medium' | 'high';
  source: typeof STORYBOARD_SOURCE;
  metadata: {
    storyboard: {
      role: 'board';
      targetModel: 'seedance' | 'kling';
    };
  };
  aspectRatio: '16:9' | '9:16';
};

export type WorkspaceImageEstimateRequest = Pick<
  ImageGenerationRequest,
  'aspectRatio' | 'customImageSize' | 'enableWebSearch' | 'imageUrls' | 'mode' | 'quality' | 'referenceImageSizes' | 'resolution'
> & {
  engineId: string;
  numImages: number;
};

export type WorkspaceImagePricingEstimateResponse = {
  ok?: boolean;
  pricing?: PricingSnapshot | null;
  error?: string;
  message?: string;
};

function formatMoney(totalCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(totalCents / 100);
  } catch {
    return `$${(totalCents / 100).toFixed(2)}`;
  }
}

function preflightErrorMessage(response: PreflightResponse): string {
  return (
    (typeof response.error?.message === 'string' && response.error.message.trim().length
      ? response.error.message.trim()
      : undefined) ??
    response.messages?.find((entry) => typeof entry === 'string' && entry.trim().length)?.trim() ??
    'Unable to compute pricing'
  );
}

export function readyWorkspacePricingEstimate(
  totalCents: number,
  currency = 'USD',
  pricing?: PricingSnapshot | null
): WorkspacePricingEstimate {
  return {
    status: 'ready',
    label: `Est. ${formatMoney(totalCents, currency)}`,
    totalCents,
    currency,
    pricing,
  };
}

export function blockedWorkspacePricingEstimate(
  validation: WorkspaceShotValidation,
  reason?: string
): WorkspacePricingEstimate {
  return {
    status: 'blocked',
    label: validation.missingInputs.length ? 'Connect input' : 'Needs attention',
    error: reason ?? [...validation.missingInputs, ...validation.incompatibleInputs].join(', '),
  };
}

export function unavailableWorkspacePricingEstimate(
  error: string,
  options?: Pick<WorkspacePricingEstimate, 'currency' | 'pricing'>
): WorkspacePricingEstimate {
  return {
    status: 'error',
    label: 'Price unavailable',
    error,
    ...options,
  };
}

export function buildWorkspaceShotPreflightRequest({
  settings,
  connectedInputs,
  capability,
  memberTier = 'Member',
  mediaInputs,
}: BuildWorkspaceShotPreflightRequestOptions): PreflightRequest {
  const facts = resolveWorkspaceGenerationFacts({ settings, connectedInputs, capability, mediaInputs });
  return {
    engine: settings.modelId,
    mode: facts.mode,
    durationSec: facts.durationSec,
    resolution: facts.resolution,
    aspectRatio: facts.aspectRatio,
    fps: facts.fps,
    seedLocked: typeof settings.seed === 'number',
    ...(typeof facts.audio === 'boolean' ? { audio: facts.audio } : {}),
    hasVideoInput: facts.hasVideoInput,
    inputs: facts.assignments.flatMap((assignment) => assignment.assetId ? [{
      assetId: assignment.assetId,
      slotId: assignment.fieldId,
      kind: assignment.kind,
      url: assignment.url,
    }] : []),
    user: { memberTier },
  };
}

const IMAGE_REFERENCE_INPUTS = new Set<WorkspaceEdgeKind>([
  'start_image',
  'end_image',
  'product',
  'reference',
  'style',
  'character',
  'logo',
]);

export function buildWorkspaceImageEstimateRequest({
  settings,
  connectedInputs,
  capability,
}: BuildWorkspaceShotPreflightRequestOptions): WorkspaceImageEstimateRequest {
  const referenceImages = connectedInputs
    .filter((kind) => IMAGE_REFERENCE_INPUTS.has(kind))
    .map((_kind, index) => `https://studio.invalid/reference-${index + 1}.png`);
  const policy = resolveWorkspaceBlockPolicy({ settings, connectedInputs, capability });
  const request = buildWorkspaceImageGenerationRequest({
    settings,
    prompt: '',
    referenceImages,
    policy,
  });
  return {
    engineId: request.engineId ?? settings.modelId,
    mode: request.mode,
    numImages: request.numImages ?? 1,
    ...(request.imageUrls ? { imageUrls: request.imageUrls } : {}),
    ...(request.referenceImageSizes ? { referenceImageSizes: request.referenceImageSizes } : {}),
    ...(request.resolution ? { resolution: request.resolution } : {}),
    ...(request.customImageSize ? { customImageSize: request.customImageSize } : {}),
    ...(request.quality ? { quality: request.quality } : {}),
    ...(request.aspectRatio ? { aspectRatio: request.aspectRatio } : {}),
    ...(typeof request.enableWebSearch === 'boolean' ? { enableWebSearch: request.enableWebSearch } : {}),
  };
}

export function buildWorkspaceStoryboardImageEstimateRequest({
  settings,
}: {
  settings: WorkspaceShotSettings;
}): WorkspaceStoryboardImageEstimateRequest {
  const storyboardSettings = settings.toolSettings?.storyboard;
  const orientation = storyboardSettings?.orientation ?? 'landscape';
  const tier = storyboardSettings?.tier ?? '4k';
  const targetModel = storyboardSettings?.targetModel ?? 'seedance';
  const outputConfig = getStoryboardOutputConfig(tier, orientation);

  return {
    engineId: 'gpt-image-2',
    mode: 'i2i',
    numImages: 1,
    referenceImageSizes: [STORYBOARD_TEMPLATE_SIZES[orientation]],
    resolution: outputConfig.resolution,
    customImageSize: outputConfig.customImageSize,
    quality: outputConfig.quality,
    source: STORYBOARD_SOURCE,
    metadata: { storyboard: { role: 'board', targetModel } },
    aspectRatio: orientation === 'portrait' ? '9:16' : '16:9',
  };
}

export function loadingWorkspacePricingEstimate(previous?: WorkspacePricingEstimate): WorkspacePricingEstimate {
  return {
    status: 'loading',
    label: previous?.status === 'ready' ? previous.label : 'Estimating...',
    totalCents: previous?.totalCents,
    currency: previous?.currency,
    pricing: previous?.pricing,
  };
}

export function formatWorkspacePricingEstimate(response: PreflightResponse): WorkspacePricingEstimate {
  const totalCents = typeof response.total === 'number' ? response.total : response.pricing?.totalCents;
  const currency = response.currency ?? response.pricing?.currency ?? 'USD';
  if (response.ok && typeof totalCents === 'number') {
    return readyWorkspacePricingEstimate(totalCents, currency, response.pricing ?? null);
  }
  return unavailableWorkspacePricingEstimate(preflightErrorMessage(response), {
    currency,
    pricing: response.pricing ?? null,
  });
}

export function formatWorkspaceImagePricingEstimate(
  response: WorkspaceImagePricingEstimateResponse
): WorkspacePricingEstimate {
  const pricing = response.pricing ?? null;
  if (response.ok && typeof pricing?.totalCents === 'number') {
    return readyWorkspacePricingEstimate(pricing.totalCents, pricing.currency ?? 'USD', pricing);
  }
  return unavailableWorkspacePricingEstimate(
    response.message ?? response.error ?? 'Unable to estimate image pricing',
    { currency: pricing?.currency, pricing }
  );
}

export function errorWorkspacePricingEstimate(error: unknown): WorkspacePricingEstimate {
  return unavailableWorkspacePricingEstimate(error instanceof Error ? error.message : 'Unable to compute pricing');
}
