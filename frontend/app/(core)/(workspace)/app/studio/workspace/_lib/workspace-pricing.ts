import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { PreflightRequest, PreflightResponse } from '@/types/engines';
import { resolveWorkspaceGenerationMode, workspaceAudioEnabledForRequest } from './workspace-capabilities';
import type {
  WorkspaceEdgeKind,
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
}: BuildWorkspaceShotPreflightRequestOptions): PreflightRequest {
  const audioEnabled = workspaceAudioEnabledForRequest(settings, capability);
  return {
    engine: settings.modelId,
    mode: resolveWorkspaceGenerationMode({
      settings,
      connectedInputs,
      capability,
    }),
    durationSec: settings.durationSec,
    resolution: settings.resolution,
    aspectRatio: settings.aspectRatio,
    fps: settings.fps,
    seedLocked: typeof settings.seed === 'number',
    ...(typeof audioEnabled === 'boolean' ? { audio: audioEnabled } : {}),
    user: { memberTier },
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

export function errorWorkspacePricingEstimate(error: unknown): WorkspacePricingEstimate {
  return unavailableWorkspacePricingEstimate(error instanceof Error ? error.message : 'Unable to compute pricing');
}
