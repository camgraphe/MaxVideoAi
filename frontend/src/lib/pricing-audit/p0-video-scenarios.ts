import type { Mode } from '@/types/engines';

export type P0VideoPricingScenario = {
  id: string;
  engineId: string;
  mode: Mode;
  durationSec: number;
  inputAudioDurationSec?: number;
  resolution: string;
  referenceImageCount?: number;
  common720?: boolean;
};

/**
 * Frozen normalized inputs shared by pricing audit, launch checks, and public-page work.
 * Vendor totals intentionally remain owned by the pricing definition and its literal tests.
 */
export const P0_VIDEO_PRICING_SCENARIOS = [
  { id: 'wan-3:t2v:6:480p', engineId: 'wan-3', mode: 't2v', durationSec: 6, resolution: '480p' },
  { id: 'wan-3:t2v:6:720p', engineId: 'wan-3', mode: 't2v', durationSec: 6, resolution: '720p', common720: true },
  { id: 'wan-3:t2v:6:1080p', engineId: 'wan-3', mode: 't2v', durationSec: 6, resolution: '1080p' },
  { id: 'wan-3-prime:t2v:6:480p', engineId: 'wan-3-prime', mode: 't2v', durationSec: 6, resolution: '480p' },
  { id: 'wan-3-prime:t2v:6:720p', engineId: 'wan-3-prime', mode: 't2v', durationSec: 6, resolution: '720p', common720: true },
  { id: 'wan-3-prime:t2v:6:1080p', engineId: 'wan-3-prime', mode: 't2v', durationSec: 6, resolution: '1080p' },
  { id: 'ltx-2-5-fast:t2v:6:720p', engineId: 'ltx-2-5-fast', mode: 't2v', durationSec: 6, resolution: '720p', common720: true },
  { id: 'ltx-2-5-fast:t2v:6:1080p', engineId: 'ltx-2-5-fast', mode: 't2v', durationSec: 6, resolution: '1080p' },
  { id: 'ltx-2-5-fast:t2v:6:1440p', engineId: 'ltx-2-5-fast', mode: 't2v', durationSec: 6, resolution: '1440p' },
  { id: 'ltx-2-5-fast:t2v:6:2160p', engineId: 'ltx-2-5-fast', mode: 't2v', durationSec: 6, resolution: '2160p' },
  { id: 'ltx-2-5-fast:i2v:6:720p', engineId: 'ltx-2-5-fast', mode: 'i2v', durationSec: 6, resolution: '720p' },
  { id: 'ltx-2-5-fast:a2v:6:1080p:audio9', engineId: 'ltx-2-5-fast', mode: 'a2v', durationSec: 6, inputAudioDurationSec: 9, resolution: '1080p' },
  { id: 'ltx-2-5-pro:t2v:6:720p', engineId: 'ltx-2-5-pro', mode: 't2v', durationSec: 6, resolution: '720p', common720: true },
  { id: 'ltx-2-5-pro:t2v:6:1080p', engineId: 'ltx-2-5-pro', mode: 't2v', durationSec: 6, resolution: '1080p' },
  { id: 'ltx-2-5-pro:i2v:6:720p', engineId: 'ltx-2-5-pro', mode: 'i2v', durationSec: 6, resolution: '720p' },
  { id: 'ltx-2-5-pro:a2v:6:1080p:audio9', engineId: 'ltx-2-5-pro', mode: 'a2v', durationSec: 6, inputAudioDurationSec: 9, resolution: '1080p' },
  { id: 'grok-imagine-video-1-5:t2v:6:480p', engineId: 'grok-imagine-video-1-5', mode: 't2v', durationSec: 6, resolution: '480p' },
  { id: 'grok-imagine-video-1-5:t2v:6:720p', engineId: 'grok-imagine-video-1-5', mode: 't2v', durationSec: 6, resolution: '720p', common720: true },
  { id: 'grok-imagine-video-1-5:t2v:6:1080p', engineId: 'grok-imagine-video-1-5', mode: 't2v', durationSec: 6, resolution: '1080p' },
  { id: 'grok-imagine-video-1-5:i2v:6:720p', engineId: 'grok-imagine-video-1-5', mode: 'i2v', durationSec: 6, resolution: '720p' },
  { id: 'grok-imagine-video-1-5:ref2v:6:480p:refs1', engineId: 'grok-imagine-video-1-5', mode: 'ref2v', durationSec: 6, resolution: '480p', referenceImageCount: 1 },
  { id: 'grok-imagine-video-1-5:ref2v:6:720p:refs3', engineId: 'grok-imagine-video-1-5', mode: 'ref2v', durationSec: 6, resolution: '720p', referenceImageCount: 3 },
  { id: 'flux-3:t2v:6:720p', engineId: 'flux-3', mode: 't2v', durationSec: 6, resolution: '720p', common720: true },
  { id: 'flux-3:t2v:6:1080p', engineId: 'flux-3', mode: 't2v', durationSec: 6, resolution: '1080p' },
  { id: 'flux-3:i2v:6:720p', engineId: 'flux-3', mode: 'i2v', durationSec: 6, resolution: '720p' },
  { id: 'flux-3:fl2v:6:720p', engineId: 'flux-3', mode: 'fl2v', durationSec: 6, resolution: '720p' },
  { id: 'flux-3:extend:6:720p', engineId: 'flux-3', mode: 'extend', durationSec: 6, resolution: '720p' },
  { id: 'flux-3:extend:6:1080p', engineId: 'flux-3', mode: 'extend', durationSec: 6, resolution: '1080p' },
  { id: 'flux-3-draft:t2v:6:720p', engineId: 'flux-3-draft', mode: 't2v', durationSec: 6, resolution: '720p', common720: true },
  { id: 'flux-3-draft:i2v:6:720p', engineId: 'flux-3-draft', mode: 'i2v', durationSec: 6, resolution: '720p' },
  { id: 'flux-3-draft:fl2v:6:720p', engineId: 'flux-3-draft', mode: 'fl2v', durationSec: 6, resolution: '720p' },
  { id: 'flux-3-draft:extend:6:720p', engineId: 'flux-3-draft', mode: 'extend', durationSec: 6, resolution: '720p' },
] as const satisfies readonly P0VideoPricingScenario[];
