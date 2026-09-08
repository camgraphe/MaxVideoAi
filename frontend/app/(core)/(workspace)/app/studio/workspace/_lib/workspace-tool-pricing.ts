import {
  getAudioPackConfig,
  type AudioPackId,
} from '@/lib/audio-generation';
import { quotePublicAudioPricingSnapshot } from '@/lib/pricing-public-quote';
import { getCharacterFormatMultiplier } from '@/lib/character-builder';
import {
  ANGLE_MULTI_OUTPUT_COUNT,
  applyCinemaSafeParams,
  getAngleBillingProductKeyForEngine,
  resolveAngleEngineForParams,
} from '@/lib/tools-angle';
import type { AngleToolEngineId } from '@/types/tools-angle';
import type {
  WorkspaceEdgeKind,
  WorkspacePricingEstimate,
  WorkspaceShotSettings,
  WorkspaceShotValidation,
  WorkspaceWorkflowType,
} from './workspace-types';
import { resolveWorkspaceBlockPolicy } from './models/workspace-block-capability-policy';
import {
  blockedWorkspacePricingEstimate,
  readyWorkspacePricingEstimate,
  unavailableWorkspacePricingEstimate,
} from './workspace-pricing';
import { normalizeWorkspaceCharacterBuilderSettings } from './workspace-tool-settings';

export { blockedWorkspacePricingEstimate } from './workspace-pricing';

export type WorkspaceToolBillingProductRequest = {
  productKey: string;
  quantity: number;
};

export type WorkspaceBillingProductResponse = {
  ok: boolean;
  product?: {
    productKey: string;
    currency: string;
    unitKind: string;
    unitPriceCents: number;
  };
  error?: string;
};

function audioPackForWorkflowType(workflowType: WorkspaceWorkflowType): AudioPackId {
  if (workflowType === 'cinematic_audio') return 'cinematic';
  if (workflowType === 'cinematic_voiceover') return 'cinematic_voice';
  if (workflowType === 'voiceover_generation') return 'voice_only';
  if (workflowType === 'sfx_generation') return 'sfx_only';
  return 'music_only';
}

function characterBuilderBillingProductRequest(
  settings: WorkspaceShotSettings
): WorkspaceToolBillingProductRequest {
  const characterSettings = normalizeWorkspaceCharacterBuilderSettings(settings.toolSettings?.characterBuilder);
  const multiplier = getCharacterFormatMultiplier(characterSettings.formatMode, characterSettings.qualityMode);
  return {
    productKey: characterSettings.qualityMode === 'final' ? 'character-final' : 'character-draft',
    quantity: multiplier * characterSettings.generateCount,
  };
}

function estimateAudioPricing(settings: WorkspaceShotSettings, prompt: string): WorkspacePricingEstimate {
  const pack = audioPackForWorkflowType(settings.workflowType);
  const config = getAudioPackConfig(pack);
  const audioSettings = settings.toolSettings?.audio;
  const pricing = quotePublicAudioPricingSnapshot({
    pack,
    durationSec: settings.durationSec,
    mood: config.requiresMood ? audioSettings?.mood ?? 'epic' : null,
    voiceMode: config.includesVoice ? 'standard' : null,
    script: config.includesVoice ? prompt : null,
    musicEnabled: settings.workflowType === 'sfx_generation' ? false : audioSettings?.musicEnabled ?? config.defaultMusicEnabled,
  });
  return readyWorkspacePricingEstimate(pricing.totalCents, pricing.currency, pricing);
}

function angleEngineIdForSettings(settings: WorkspaceShotSettings): AngleToolEngineId {
  return settings.modelId === 'angle-qwen-multiple-angles'
    ? 'qwen-multiple-angles'
    : 'flux-multiple-angles';
}

function angleBillingProductRequest(
  settings: WorkspaceShotSettings
): WorkspaceToolBillingProductRequest {
  const angle = settings.toolSettings?.angle;
  const applied = applyCinemaSafeParams({
    rotation: angle?.rotation ?? 35,
    tilt: angle?.tilt ?? 0,
    zoom: angle?.zoom ?? 1,
  }, angle?.safeMode !== false);
  const generateBestAngles = angle?.generateBestAngles === true;
  const engineId = resolveAngleEngineForParams(angleEngineIdForSettings(settings), applied);
  return {
    productKey: getAngleBillingProductKeyForEngine(engineId, generateBestAngles),
    quantity: generateBestAngles ? ANGLE_MULTI_OUTPUT_COUNT : 1,
  };
}

export function buildWorkspaceToolBillingProductRequest(
  settings: WorkspaceShotSettings
): WorkspaceToolBillingProductRequest | null {
  if (settings.toolKind === 'character-builder') return characterBuilderBillingProductRequest(settings);
  if (settings.toolKind === 'angle') return angleBillingProductRequest(settings);
  return null;
}

export function formatWorkspaceBillingProductPricingEstimate(
  request: WorkspaceToolBillingProductRequest,
  response: WorkspaceBillingProductResponse
): WorkspacePricingEstimate {
  const product = response.product;
  if (!response.ok || !product || product.productKey !== request.productKey) {
    return unavailableWorkspacePricingEstimate(response.error ?? 'Server catalog price is unavailable.');
  }
  const quantity = product.unitKind === 'run' ? 1 : request.quantity;
  return readyWorkspacePricingEstimate(
    Math.max(0, Math.round(product.unitPriceCents)) * Math.max(1, Math.round(quantity)),
    product.currency
  );
}

export function buildWorkspaceToolPricingEstimate({
  settings,
  validation,
  prompt,
  connectedInputs,
}: {
  settings: WorkspaceShotSettings;
  validation: WorkspaceShotValidation;
  prompt: string;
  connectedInputs: WorkspaceEdgeKind[];
}): WorkspacePricingEstimate | null {
  const policy = resolveWorkspaceBlockPolicy({
    settings,
    capability: validation.capability,
    connectedInputs,
  });
  const characterCanPriceFromScratch =
    settings.toolKind === 'character-builder' &&
    validation.missingInputs.length === 0 &&
    validation.incompatibleInputs.length === 0;
  if (!validation.canGenerate && !characterCanPriceFromScratch) {
    return blockedWorkspacePricingEstimate(validation, policy.disabledReason);
  }
  if (settings.family === 'chat' || policy.outputMediaKind === 'text' || policy.pricingRelevantFields.length === 0) {
    return unavailableWorkspacePricingEstimate('Studio chat pricing is unavailable until chat media context generation is implemented.');
  }
  if (settings.toolKind === 'character-builder' || settings.toolKind === 'angle') return null;
  if (settings.family === 'upscale') {
    return unavailableWorkspacePricingEstimate(
      'Upscale pricing requires source metadata and server pricing context.'
    );
  }
  if (settings.family === 'audio') return estimateAudioPricing(settings, prompt);
  return null;
}
