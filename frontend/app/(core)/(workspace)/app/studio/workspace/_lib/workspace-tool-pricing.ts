import {
  buildAudioPricingSnapshot,
  getAudioPackConfig,
  type AudioPackId,
} from '@/lib/audio-generation';
import { getCharacterFormatMultiplier } from '@/lib/character-builder';
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

const CHARACTER_DRAFT_CENTS = 8;
const CHARACTER_FINAL_CENTS = 15;

function audioPackForWorkflowType(workflowType: WorkspaceWorkflowType): AudioPackId {
  if (workflowType === 'cinematic_audio') return 'cinematic';
  if (workflowType === 'cinematic_voiceover') return 'cinematic_voice';
  if (workflowType === 'voiceover_generation') return 'voice_only';
  if (workflowType === 'sfx_generation') return 'sfx_only';
  return 'music_only';
}

function estimateCharacterBuilderPricing(settings: WorkspaceShotSettings): WorkspacePricingEstimate {
  const characterSettings = normalizeWorkspaceCharacterBuilderSettings(settings.toolSettings?.characterBuilder);
  const baseCents = characterSettings.qualityMode === 'final' ? CHARACTER_FINAL_CENTS : CHARACTER_DRAFT_CENTS;
  const multiplier = getCharacterFormatMultiplier(characterSettings.formatMode, characterSettings.qualityMode);
  return readyWorkspacePricingEstimate(baseCents * multiplier * characterSettings.generateCount);
}

function estimateAudioPricing(settings: WorkspaceShotSettings, prompt: string): WorkspacePricingEstimate {
  const pack = audioPackForWorkflowType(settings.workflowType);
  const config = getAudioPackConfig(pack);
  const audioSettings = settings.toolSettings?.audio;
  const pricing = buildAudioPricingSnapshot({
    pack,
    durationSec: settings.durationSec,
    mood: config.requiresMood ? audioSettings?.mood ?? 'epic' : null,
    voiceMode: config.includesVoice ? 'standard' : null,
    script: config.includesVoice ? prompt : null,
    musicEnabled: audioSettings?.musicEnabled ?? config.defaultMusicEnabled,
  });
  return readyWorkspacePricingEstimate(pricing.totalCents, pricing.currency, pricing);
}

function estimateAnglePricing(settings: WorkspaceShotSettings): WorkspacePricingEstimate {
  const isQwen = settings.modelId === 'angle-qwen-multiple-angles';
  const multi = settings.toolSettings?.angle?.generateBestAngles === true;
  if (isQwen) return readyWorkspacePricingEstimate(multi ? 40 : 7);
  return readyWorkspacePricingEstimate(multi ? 24 : 4);
}

function estimateUpscalePricing(settings: WorkspaceShotSettings): WorkspacePricingEstimate {
  const centsByModel: Record<string, number> = {
    'upscale-image-seedvr': 4,
    'upscale-image-topaz': 12,
    'upscale-image-recraft-crisp': 2,
    'upscale-video-seedvr': 25,
    'upscale-video-flashvsr': 18,
    'upscale-video-topaz': 80,
  };
  return readyWorkspacePricingEstimate(centsByModel[settings.modelId] ?? 4);
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
  if (settings.toolKind === 'character-builder') return estimateCharacterBuilderPricing(settings);
  if (settings.toolKind === 'angle') return estimateAnglePricing(settings);
  if (settings.family === 'upscale') return estimateUpscalePricing(settings);
  if (settings.family === 'audio') return estimateAudioPricing(settings, prompt);
  return null;
}
