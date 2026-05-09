import type { VideoAgentSettings } from './video-agent-config';
import type { CommercialVideoAgentBrief } from './video-agent-brief';
import type { CommercialVideoScenario } from './commercial-video-scenario';

function listOrFallback(items: string[], fallback: string): string {
  return items.length ? items.join(', ') : fallback;
}

function timelineLines(scenario: CommercialVideoScenario): string[] {
  return scenario.timeline.map(
    (item) => `${item.timeRange}: ${item.beat} - ${item.visualAction} Camera: ${item.camera}.`
  );
}

export function buildSeedanceCommercialPrompt(
  brief: CommercialVideoAgentBrief,
  scenario: CommercialVideoScenario,
  settings: VideoAgentSettings
): string {
  return [
    `Create a ${settings.durationSec}-second commercial video for ${brief.productOrOffer}, aimed at ${brief.audience}.`,
    `Scene: ${scenario.location}.`,
    `Visual style: ${brief.visualStyle}.`,
    'Timeline:',
    ...timelineLines(scenario),
    `Camera: ${scenario.camera}, one coherent camera language across the clip.`,
    `Lighting: ${scenario.lighting}.`,
    `Mood: ${scenario.mood}.`,
    `Composition: ${scenario.composition}.`,
    `Pacing: clear, commercial, readable, and realistic for ${settings.durationSec} seconds.`,
    `Audio: ${scenario.audioDirection}.`,
    `Must include: ${listOrFallback(brief.mustInclude, 'clear product focus, polished camera movement, final hero shot')}.`,
    `Avoid: ${listOrFallback(brief.avoid, 'fake logos, long readable text, crowded background, celebrities, copyrighted characters')}.`,
    'Brand safety: Use original generic branding only. Do not include celebrities, copyrighted characters, real third-party logos, protected brand designs, or misleading claims.',
    `Final frame: ${scenario.finalFrame}.`,
  ].join('\n');
}
