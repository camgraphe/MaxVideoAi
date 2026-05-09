import type { VideoAgentSettings } from './video-agent-config';
import type { CommercialVideoAgentBrief } from './video-agent-brief';
import type { CommercialVideoScenario } from './commercial-video-scenario';

export type CommercialVideoReviewChecklist = {
  isPromptClear: boolean;
  hasSingleMainSubject: boolean;
  fitsSelectedDuration: boolean;
  hasRealisticNumberOfBeats: boolean;
  hasCoherentCameraDirection: boolean;
  hasOnePrimaryVisualStyle: boolean;
  hasClearLighting: boolean;
  hasClearMood: boolean;
  hasFinalFrame: boolean;
  hasShortCTA: boolean;
  hasAudioDirectionIfEnabled: boolean;
  isUnderstandableWithoutAudioIfAudioOff: boolean;
  respectsAspectRatio: boolean;
  avoidsOvercrowding: boolean;
  avoidsLongReadableText: boolean;
  avoidsThirdPartyLogos: boolean;
  avoidsCelebritiesAndLikeness: boolean;
  avoidsCopyrightedCharacters: boolean;
  avoidsMedicalOrFinancialClaims: boolean;
  avoidsUnsafeContent: boolean;
  usesSeedanceFriendlyStructure: boolean;
  settingsAreComplete: boolean;
  warningsAreListed: boolean;
};

function maxBeatsForDuration(durationSec: VideoAgentSettings['durationSec']): number {
  if (durationSec === 5) return 3;
  if (durationSec === 10) return 3;
  return 5;
}

function includesRisk(items: string[], pattern: RegExp): boolean {
  return items.some((item) => pattern.test(item));
}

export function reviewCommercialPromptPackage(
  brief: CommercialVideoAgentBrief,
  scenario: CommercialVideoScenario,
  settings: VideoAgentSettings,
  warningCount: number
): CommercialVideoReviewChecklist {
  const avoidText = brief.avoid;

  return {
    isPromptClear: Boolean(brief.productOrOffer && brief.scene && brief.visualStyle),
    hasSingleMainSubject: brief.productOrOffer.split(',').length <= 2,
    fitsSelectedDuration: scenario.timeline.length <= maxBeatsForDuration(settings.durationSec),
    hasRealisticNumberOfBeats: scenario.timeline.length >= 1 && scenario.timeline.length <= 5,
    hasCoherentCameraDirection: Boolean(scenario.camera),
    hasOnePrimaryVisualStyle: Boolean(brief.visualStyle) && brief.visualStyle.split(',').length <= 2,
    hasClearLighting: Boolean(scenario.lighting),
    hasClearMood: Boolean(scenario.mood),
    hasFinalFrame: Boolean(scenario.finalFrame),
    hasShortCTA: brief.cta.length > 0 && brief.cta.split(/\s+/).length <= 5,
    hasAudioDirectionIfEnabled: settings.audioEnabled ? Boolean(scenario.audioDirection) : true,
    isUnderstandableWithoutAudioIfAudioOff: settings.audioEnabled ? true : /without sound/i.test(scenario.audioDirection),
    respectsAspectRatio: scenario.composition.includes(settings.aspectRatio),
    avoidsOvercrowding: brief.mustInclude.length <= 6,
    avoidsLongReadableText: !includesRisk(avoidText, /\blong text|tiny text|unreadable text\b/i),
    avoidsThirdPartyLogos: !includesRisk(avoidText, /\bthird-party logo|real logo\b/i),
    avoidsCelebritiesAndLikeness: !includesRisk(avoidText, /\bcelebrity|likeness\b/i),
    avoidsCopyrightedCharacters: !includesRisk(avoidText, /\bcopyrighted|marvel|disney|pixar\b/i),
    avoidsMedicalOrFinancialClaims: !includesRisk(avoidText, /\bmedical|financial|guarantee|roi\b/i),
    avoidsUnsafeContent: true,
    usesSeedanceFriendlyStructure: Boolean(scenario.timeline.length && scenario.camera && scenario.finalFrame),
    settingsAreComplete: Boolean(settings.durationSec && settings.aspectRatio && settings.resolution),
    warningsAreListed: warningCount >= 0,
  };
}
