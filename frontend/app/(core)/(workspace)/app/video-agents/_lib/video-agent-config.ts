export type VideoAgentType = 'commercial-video';
export type VideoAgentEngineFamily = 'seedance' | 'kling' | 'veo';
export type VideoAgentAspectRatio = '9:16' | '16:9' | '1:1';
export type VideoAgentResolution = '720p' | '1080p';

export type VideoAgentPreset = {
  id: string;
  label: string;
  shortLabel: string;
  agentType: VideoAgentType;
  engineFamily: VideoAgentEngineFamily;
  engineId: string;
  engineLabel: string;
  maxDurationSec: number;
};

export type VideoAgentSettings = {
  durationSec: 5 | 10 | 15;
  aspectRatio: VideoAgentAspectRatio;
  resolution: VideoAgentResolution;
  audioEnabled: boolean;
};

export const VIDEO_AGENT_PRESETS: VideoAgentPreset[] = [
  {
    id: 'commercial-seedance-2',
    label: 'Commercial Video Agent',
    shortLabel: 'Commercial',
    agentType: 'commercial-video',
    engineFamily: 'seedance',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    maxDurationSec: 15,
  },
];

export const DEFAULT_VIDEO_AGENT_SETTINGS: VideoAgentSettings = {
  durationSec: 10,
  aspectRatio: '9:16',
  resolution: '1080p',
  audioEnabled: true,
};

export const VIDEO_AGENT_DURATION_OPTIONS: VideoAgentSettings['durationSec'][] = [5, 10, 15];
export const VIDEO_AGENT_ASPECT_RATIO_OPTIONS: VideoAgentAspectRatio[] = ['9:16', '16:9', '1:1'];
export const VIDEO_AGENT_RESOLUTION_OPTIONS: VideoAgentResolution[] = ['720p', '1080p'];

const RESOLUTION_MULTIPLIER: Record<VideoAgentResolution, number> = {
  '720p': 0.72,
  '1080p': 1,
};

export function estimateVideoAgentPriceCents(settings: VideoAgentSettings): number {
  const baseCentsPerSecond = 24;
  const audioCents = settings.audioEnabled ? 0 : 0;
  return Math.ceil(settings.durationSec * baseCentsPerSecond * RESOLUTION_MULTIPLIER[settings.resolution] + audioCents);
}

export function formatVideoAgentPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
