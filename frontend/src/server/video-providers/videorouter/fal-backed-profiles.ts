import { KLING_V4_ENDPOINTS } from '@/lib/kling-v4';
import { MINIMAX_H3_ENDPOINTS } from '@/config/fal-engines/minimax-h3';
import { KLING_V4_SANDBASE_MODEL, klingV4SandBasePlan, klingV4SandBaseReferences, klingV4SandBaseRequest, klingV4VideoRouterEnabled } from './kling-v4';
import { MINIMAX_H3_WAVESPEED_MODEL, minimaxH3WaveSpeedPlan, minimaxH3WaveSpeedReferences, minimaxH3WaveSpeedRequest, minimaxH3VideoRouterEnabled } from './minimax-h3';

const profiles = {
  'kling-v4': {
    providerModel: KLING_V4_SANDBASE_MODEL, falEndpoints: KLING_V4_ENDPOINTS,
    resolution: '720p', aspectRatio: '16:9', enabled: klingV4VideoRouterEnabled,
    references: klingV4SandBaseReferences, plan: klingV4SandBasePlan, request: klingV4SandBaseRequest,
  },
  'minimax-h3': {
    providerModel: MINIMAX_H3_WAVESPEED_MODEL, falEndpoints: MINIMAX_H3_ENDPOINTS,
    resolution: '480p', aspectRatio: '21:9', enabled: minimaxH3VideoRouterEnabled,
    references: minimaxH3WaveSpeedReferences, plan: minimaxH3WaveSpeedPlan, request: minimaxH3WaveSpeedRequest,
  },
} as const;

export function falBackedVideoRouterProfile(engineId: string) {
  return Object.hasOwn(profiles, engineId) ? profiles[engineId as keyof typeof profiles] : null;
}
