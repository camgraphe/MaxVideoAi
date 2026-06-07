import type { VideoProviderRoutingPlan } from '@/server/video-providers/router';
import { isGoogleVertexVeoEngine } from '@/server/video-providers/google-vertex-veo/model-map';
import type { Mode } from '@/types/engines';

const FAL_GOOGLE_VERTEX_VEO_EXTEND_RESOLUTION = '720p';

export function normalizeProviderRoutedResolution(params: {
  providerRoutingPlan: VideoProviderRoutingPlan;
  engineId: string;
  mode: Mode | string;
  pricingResolution: string;
  effectiveResolution: string;
}): { pricingResolution: string; effectiveResolution: string } {
  if (
    params.providerRoutingPlan.kind === 'fal_only' &&
    params.mode === 'extend' &&
    isGoogleVertexVeoEngine(params.engineId)
  ) {
    return {
      pricingResolution: FAL_GOOGLE_VERTEX_VEO_EXTEND_RESOLUTION,
      effectiveResolution: FAL_GOOGLE_VERTEX_VEO_EXTEND_RESOLUTION,
    };
  }

  return {
    pricingResolution: params.pricingResolution,
    effectiveResolution: params.effectiveResolution,
  };
}
