import type { VideoAgentPreset, VideoAgentSettings } from './video-agent-config';
import type { CommercialVideoAgentBrief } from './video-agent-brief';
import { buildCommercialVideoScenario, type CommercialVideoScenario } from './commercial-video-scenario';
import { reviewCommercialPromptPackage, type CommercialVideoReviewChecklist } from './commercial-video-reviewer';
import { buildSeedanceCommercialPrompt } from './seedance-commercial-prompt';
import { reviewCommercialVideoRequest, type VideoAgentWarning } from './video-agent-safety';

export type CommercialVideoPromptSettings = {
  engineLabel: string;
  generationMode: 't2v';
  durationSec: VideoAgentSettings['durationSec'];
  aspectRatio: VideoAgentSettings['aspectRatio'];
  resolution: VideoAgentSettings['resolution'];
  audioEnabled: boolean;
  estimatedPriceCents: number;
};

export type CommercialVideoPromptPackage = {
  agent: 'commercial-video';
  videoEngine: 'seedance-2.0';
  imageEngine: null;
  mode: 'text-to-video';
  settings: CommercialVideoPromptSettings;
  clientBrief: CommercialVideoAgentBrief;
  structuredScenario: CommercialVideoScenario;
  finalPrompt: string;
  negativePromptOrAvoid: string[];
  warnings: VideoAgentWarning[];
  reviewChecklist: CommercialVideoReviewChecklist;
};

type CreateCommercialVideoPromptPackageInput = {
  brief: CommercialVideoAgentBrief;
  estimatedPriceCents: number;
  preset: VideoAgentPreset;
  settings: VideoAgentSettings;
};

export function createCommercialVideoPromptPackage({
  brief,
  estimatedPriceCents,
  preset,
  settings,
}: CreateCommercialVideoPromptPackageInput): CommercialVideoPromptPackage {
  const safetyReview = reviewCommercialVideoRequest(brief);
  const structuredScenario = buildCommercialVideoScenario(brief, settings);
  const finalPrompt = buildSeedanceCommercialPrompt(brief, structuredScenario, settings);
  const negativePromptOrAvoid = [
    ...brief.avoid,
    'celebrities',
    'copyrighted characters',
    'real third-party logos',
    'misleading claims',
    'long readable text',
  ].slice(0, 12);

  return {
    agent: 'commercial-video',
    videoEngine: 'seedance-2.0',
    imageEngine: null,
    mode: 'text-to-video',
    settings: {
      engineLabel: preset.engineLabel,
      generationMode: preset.generationMode,
      durationSec: settings.durationSec,
      aspectRatio: settings.aspectRatio,
      resolution: settings.resolution,
      audioEnabled: settings.audioEnabled,
      estimatedPriceCents,
    },
    clientBrief: brief,
    structuredScenario,
    finalPrompt,
    negativePromptOrAvoid,
    warnings: safetyReview.warnings,
    reviewChecklist: reviewCommercialPromptPackage(
      brief,
      structuredScenario,
      settings,
      safetyReview.warnings.length
    ),
  };
}
