import type { Mode } from '@/types/engines';
import { isGoogleVertexVeoEngine, isGoogleVertexVeoModeSupported } from './google-vertex-veo/model-map';
import { isKlingDirectEngine, isKlingDirectModeSupported } from './kling-direct/model-map';
import { isLumaDirectEngine, isLumaDirectModeSupported } from './luma-direct/model-map';

type RoutingEnv = Partial<Record<
  | 'KLING_DIRECT_ENABLED'
  | 'KLING_DIRECT_PUBLIC_ROUTING_ENABLED'
  | 'KLING_DIRECT_FALLBACK_TO_FAL_ENABLED'
  | 'KLING_DIRECT_FALLBACK_ON_CREDITS_DEPLETED_ENABLED'
  | 'KLING_DIRECT_ELEMENT_REGISTRATION_ENABLED'
  | 'KLING_DIRECT_ADMIN_ONLY'
  | 'GOOGLE_VERTEX_VEO_ENABLED'
  | 'GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED'
  | 'GOOGLE_VERTEX_VEO_FALLBACK_TO_FAL_ENABLED'
  | 'GOOGLE_VERTEX_VEO_ADMIN_ONLY'
  | 'LUMA_DIRECT_ENABLED'
  | 'LUMA_DIRECT_PUBLIC_ROUTING_ENABLED'
  | 'LUMA_DIRECT_FALLBACK_TO_FAL_ENABLED'
  | 'LUMA_DIRECT_ADMIN_ONLY',
  string | undefined
>>;

export type VideoProviderRoutingPlan =
  | {
      kind: 'fal_only';
      primaryProvider: 'fal';
      fallbackEnabled: false;
    }
  | {
      kind: 'kling_direct_primary';
      primaryProvider: 'kling_direct';
      fallbackProvider: 'fal';
      fallbackEnabled: boolean;
      fallbackOnCreditsDepletedEnabled: boolean;
      elementRegistrationEnabled: boolean;
    }
  | {
      kind: 'google_vertex_veo_primary';
      primaryProvider: 'google_vertex_veo_direct';
      fallbackProvider: 'fal';
      fallbackEnabled: boolean;
    }
  | {
      kind: 'luma_direct_primary';
      primaryProvider: 'luma_direct';
      fallbackProvider: 'fal';
      fallbackEnabled: boolean;
    };

function flagEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function readEnv(env: RoutingEnv | undefined, key: keyof RoutingEnv): string | undefined {
  return env?.[key] ?? process.env[key];
}

export function resolveVideoProviderRoutingPlan(params: {
  engineId: string;
  mode: Mode | string;
  isAdmin: boolean;
  env?: RoutingEnv;
}): VideoProviderRoutingPlan {
  const falOnly: VideoProviderRoutingPlan = { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false };
  if (isLumaDirectEngine(params.engineId)) {
    if (!isLumaDirectModeSupported(params.engineId, params.mode)) return falOnly;
    if (!flagEnabled(readEnv(params.env, 'LUMA_DIRECT_ENABLED'))) return falOnly;

    const publicRoutingEnabled = flagEnabled(readEnv(params.env, 'LUMA_DIRECT_PUBLIC_ROUTING_ENABLED'));
    const adminOnly = flagEnabled(readEnv(params.env, 'LUMA_DIRECT_ADMIN_ONLY') ?? 'true');
    if (adminOnly && !params.isAdmin) return falOnly;
    if (!publicRoutingEnabled && !params.isAdmin) return falOnly;

    return {
      kind: 'luma_direct_primary',
      primaryProvider: 'luma_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: flagEnabled(readEnv(params.env, 'LUMA_DIRECT_FALLBACK_TO_FAL_ENABLED')),
    };
  }

  if (isGoogleVertexVeoEngine(params.engineId)) {
    if (!isGoogleVertexVeoModeSupported(params.engineId, params.mode)) return falOnly;
    if (!flagEnabled(readEnv(params.env, 'GOOGLE_VERTEX_VEO_ENABLED'))) return falOnly;

    const publicRoutingEnabled = flagEnabled(readEnv(params.env, 'GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED'));
    const adminOnly = flagEnabled(readEnv(params.env, 'GOOGLE_VERTEX_VEO_ADMIN_ONLY') ?? 'true');
    if (adminOnly && !params.isAdmin) return falOnly;
    if (!publicRoutingEnabled && !params.isAdmin) return falOnly;

    return {
      kind: 'google_vertex_veo_primary',
      primaryProvider: 'google_vertex_veo_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: flagEnabled(readEnv(params.env, 'GOOGLE_VERTEX_VEO_FALLBACK_TO_FAL_ENABLED')),
    };
  }

  if (isKlingDirectEngine(params.engineId)) {
    if (!isKlingDirectModeSupported(params.engineId, params.mode)) return falOnly;
    if (!flagEnabled(readEnv(params.env, 'KLING_DIRECT_ENABLED'))) return falOnly;

    const publicRoutingEnabled = flagEnabled(readEnv(params.env, 'KLING_DIRECT_PUBLIC_ROUTING_ENABLED'));
    const adminOnly = flagEnabled(readEnv(params.env, 'KLING_DIRECT_ADMIN_ONLY') ?? 'true');
    if (adminOnly && !params.isAdmin) return falOnly;
    if (!publicRoutingEnabled && !params.isAdmin) return falOnly;

    return {
      kind: 'kling_direct_primary',
      primaryProvider: 'kling_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: flagEnabled(readEnv(params.env, 'KLING_DIRECT_FALLBACK_TO_FAL_ENABLED')),
      fallbackOnCreditsDepletedEnabled: flagEnabled(
        readEnv(params.env, 'KLING_DIRECT_FALLBACK_ON_CREDITS_DEPLETED_ENABLED')
      ),
      elementRegistrationEnabled: flagEnabled(readEnv(params.env, 'KLING_DIRECT_ELEMENT_REGISTRATION_ENABLED')),
    };
  }

  return falOnly;
}

export function shouldRouteKlingDirectSourceElementsToFal(params: {
  providerRoutingPlan: VideoProviderRoutingPlan;
  elementCount: number;
}): boolean {
  return (
    params.providerRoutingPlan.kind === 'kling_direct_primary' &&
    params.elementCount > 0 &&
    !params.providerRoutingPlan.elementRegistrationEnabled
  );
}
