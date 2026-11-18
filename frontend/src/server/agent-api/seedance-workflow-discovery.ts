import type { AgentModelModeDetails, AgentGenerationMode } from './types';

export function seedanceWorkflowDiscovery(modes: readonly AgentGenerationMode[], availability: { mcp: boolean; web: boolean }) {
  return {
    available: availability.mcp,
    webAvailable: availability.web,
    webUrl: availability.web ? 'https://maxvideoai.com/app' : null,
    modes: modes.filter(mode => ['t2v','i2v','ref2v','v2v','extend'].includes(mode)),
    draft: { resolution: '480p' as const, outputCount: 1 as const, constraints: 'Use the selected mode settings and reference limits; native Draft fixes resolution and outputCount.', input: { seedanceWorkflow: { step: 'draft' as const } } },
    final: { resolution: '1080p' as const, resolutions: ['1080p', '4k'] as const, outputCount: 1 as const, source: 'owned_ready_draft_job' as const,
      inherited: ['prompt','mode','duration','framing','audio','references'],
      input: { seedanceWorkflow: { step: 'final' as const, draftJobId: '<MaxVideoAI Draft job ID>' }, settings: { resolution: '1080p' as const } } },
    validity: { days: 7, startsAt: 'server_request_started' as const, actualExpiry: 'get_generation_status.seedanceWorkflow.expiresAt' },
    pricing: 'Independent active Draft and final tariffs; each step needs a separate exact quote and explicit approval.',
    guidance: [
      'For a Seedance 2.5 1080p or 4K request, offer direct generation at that resolution or native Draft 480p followed by optional paid finalization at the selected resolution. Both final resolutions use 10-bit HEVC. Respect an explicit direct choice without repeating the offer.',
      'An explicit finalizable Draft request selects seedanceWorkflow.step=draft. Ordinary 480p is a separate offer and cannot be finalized by this workflow.',
      'Use prepare_generation and confirm_generation separately for each step. For final, supply the owned draftJobId and settings.resolution (1080p or 4k; default 1080p), and omit creative inputs; stored facts are inherited. Changing resolution requires a new quote and approval.',
      'Recover the Draft with get_generation_status or list_recent_generations. Only a ready, unexpired, unreserved Draft is eligible; recover an existing final instead of submitting another.',
      'Show returned Draft price, final supplement and total when available. Future final prices are current estimates until the separate final quote; no free finalization, unverified savings or pixel-for-pixel guarantee.',
      'When unavailable, say so. Offer the returned webUrl only when webAvailable is true; never replace native Draft with ordinary 480p.',
    ],
  };
}
export type SeedanceWorkflowDiscovery = ReturnType<typeof seedanceWorkflowDiscovery> & { modeDetails?: AgentModelModeDetails[] };
