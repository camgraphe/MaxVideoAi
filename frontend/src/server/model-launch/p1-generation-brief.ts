import type {
  CanonicalGenerationRequest,
  CanonicalGenerationSettingValue,
} from '../agent-api/generation-types';
import { normalizeGenerationRequest } from '../agent-api/generation-normalization';

export type P1GenerationBrief = {
  modelId: string;
  prompt: string;
  mode: string;
  durationSec: number;
  aspectRatio: string;
  resolution: string;
  outputCount: number;
  intent: 'human' | 'scene' | 'product' | 'multishot';
  audio?: boolean;
  promptExpansionMode?: string;
  multiPrompt?: Array<{ prompt: string; durationSec: number }>;
};

export function projectP1GenerationBriefToCanonicalRequest(
  brief: P1GenerationBrief,
): CanonicalGenerationRequest {
  const settings: Record<string, CanonicalGenerationSettingValue> = {
    durationSec: brief.durationSec,
    resolution: brief.resolution,
    aspectRatio: brief.aspectRatio,
    ...(brief.audio === undefined ? {} : { audio: brief.audio }),
    ...(brief.promptExpansionMode === undefined
      ? {}
      : { promptExpansionMode: brief.promptExpansionMode }),
    ...(brief.multiPrompt?.length ? { multiPrompt: brief.multiPrompt } : {}),
  };

  return normalizeGenerationRequest({
    schemaVersion: 1,
    surface: 'video',
    engineId: brief.modelId,
    mode: brief.mode,
    prompt: brief.multiPrompt?.length ? '' : brief.prompt,
    settings,
    references: [],
    outputCount: brief.outputCount,
  });
}
