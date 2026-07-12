import type { Mode } from '@/types/engines';
import { isGoogleVertexOmniEngine, isGoogleVertexOmniModeSupported } from './google-vertex-omni/model-map';
import { isGoogleVertexVeoEngine, isGoogleVertexVeoModeSupported } from './google-vertex-veo/model-map';
import { isKlingDirectEngine, isKlingDirectModeSupported } from './kling-direct/model-map';
import {
  isLumaAgentsVideoEngine,
  isLumaAgentsVideoModeSupported,
} from './luma-agents/model-map';

type RoutingEnv = Partial<Record<
  | 'KLING_DIRECT_ENABLED'
  | 'KLING_DIRECT_PUBLIC_ROUTING_ENABLED'
  | 'KLING_DIRECT_FALLBACK_TO_FAL_ENABLED'
  | 'KLING_DIRECT_FALLBACK_ON_CREDITS_DEPLETED_ENABLED'
  | 'KLING_DIRECT_ELEMENT_REGISTRATION_ENABLED'
  | 'KLING_DIRECT_ADMIN_ONLY'
  | 'LUMA_AGENTS_ENABLED'
  | 'LUMA_AGENTS_PUBLIC_ROUTING_ENABLED'
  | 'LUMA_AGENTS_ADMIN_ONLY'
  | 'LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED'
  | 'LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED'
  | 'LUMA_AGENTS_VIDEO_DIRECT_ENABLED'
  | 'GOOGLE_VERTEX_VEO_ENABLED'
  | 'GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED'
  | 'GOOGLE_VERTEX_VEO_PUBLIC_EXTEND_ROUTING_ENABLED'
  | 'GOOGLE_VERTEX_VEO_INPUT_GCS_URI'
  | 'GOOGLE_VERTEX_VEO_ADMIN_ONLY'
  | 'GOOGLE_VERTEX_OMNI_ENABLED'
  | 'GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED'
  | 'GOOGLE_VERTEX_OMNI_ADMIN_ONLY',
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
    }
  | {
      kind: 'google_vertex_omni_primary';
      primaryProvider: 'google_vertex_omni_direct';
    }
  | {
      kind: 'google_vertex_unavailable';
      reason: 'vertex_not_configured' | 'public_routing_disabled' | 'admin_only' | 'unsupported_mode';
    }
  | {
      kind: 'luma_agents_direct_primary';
      primaryProvider: 'luma_agents_direct';
      fallbackProvider: 'fal';
      fallbackEnabled: boolean;
      advancedDirectOnlyEnabled: boolean;
    };

function flagEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function readEnv(env: RoutingEnv | undefined, key: keyof RoutingEnv): string | undefined {
  return env?.[key] ?? process.env[key];
}

function isGcsUriConfigured(value: string | undefined): boolean {
  return /^gs:\/\/[^/]+(?:\/.*)?$/i.test((value ?? '').trim());
}

export function resolveVideoProviderRoutingPlan(params: {
  engineId: string;
  mode: Mode | string;
  isAdmin: boolean;
  env?: RoutingEnv;
}): VideoProviderRoutingPlan {
  const falOnly: VideoProviderRoutingPlan = { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false };
  if (isGoogleVertexOmniEngine(params.engineId)) {
    if (!isGoogleVertexOmniModeSupported(params.engineId, params.mode)) {
      return { kind: 'google_vertex_unavailable', reason: 'unsupported_mode' };
    }
    if (!flagEnabled(readEnv(params.env, 'GOOGLE_VERTEX_OMNI_ENABLED'))) {
      return { kind: 'google_vertex_unavailable', reason: 'vertex_not_configured' };
    }

    const omniPublicRoutingValue = readEnv(params.env, 'GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED');
    const publicRoutingEnabled = omniPublicRoutingValue == null ? true : flagEnabled(omniPublicRoutingValue);
    const adminOnly = flagEnabled(readEnv(params.env, 'GOOGLE_VERTEX_OMNI_ADMIN_ONLY') ?? 'false');
    if (adminOnly && !params.isAdmin) return { kind: 'google_vertex_unavailable', reason: 'admin_only' };
    if (!publicRoutingEnabled && !params.isAdmin) {
      return { kind: 'google_vertex_unavailable', reason: 'public_routing_disabled' };
    }

    return {
      kind: 'google_vertex_omni_primary',
      primaryProvider: 'google_vertex_omni_direct',
    };
  }

  if (isGoogleVertexVeoEngine(params.engineId)) {
    if (!isGoogleVertexVeoModeSupported(params.engineId, params.mode)) {
      return { kind: 'google_vertex_unavailable', reason: 'unsupported_mode' };
    }
    if (!flagEnabled(readEnv(params.env, 'GOOGLE_VERTEX_VEO_ENABLED'))) {
      return { kind: 'google_vertex_unavailable', reason: 'vertex_not_configured' };
    }

    const publicRoutingEnabled = flagEnabled(readEnv(params.env, 'GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED'));
    const publicExtendRoutingEnabled = flagEnabled(
      readEnv(params.env, 'GOOGLE_VERTEX_VEO_PUBLIC_EXTEND_ROUTING_ENABLED')
    );
    const publicExtendInputStagingConfigured = isGcsUriConfigured(
      readEnv(params.env, 'GOOGLE_VERTEX_VEO_INPUT_GCS_URI')
    );
    const publicExtendRouteReady =
      params.mode === 'extend' && publicExtendRoutingEnabled && publicExtendInputStagingConfigured;
    const publicRoutingReadyForMode =
      params.mode === 'extend'
        ? (publicRoutingEnabled || publicExtendRoutingEnabled) && publicExtendInputStagingConfigured
        : publicRoutingEnabled;
    const adminOnly = flagEnabled(readEnv(params.env, 'GOOGLE_VERTEX_VEO_ADMIN_ONLY') ?? 'true');
    if (adminOnly && !params.isAdmin && !publicExtendRouteReady) {
      return { kind: 'google_vertex_unavailable', reason: 'admin_only' };
    }
    if (!publicRoutingReadyForMode && !params.isAdmin) {
      return { kind: 'google_vertex_unavailable', reason: 'public_routing_disabled' };
    }

    return {
      kind: 'google_vertex_veo_primary',
      primaryProvider: 'google_vertex_veo_direct',
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

  if (isLumaAgentsVideoEngine(params.engineId)) {
    const advancedDirectOnlyEnabled = flagEnabled(
      readEnv(params.env, 'LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED')
    );
    if (!isLumaAgentsVideoModeSupported(params.mode)) {
      return falOnly;
    }
    if (!flagEnabled(readEnv(params.env, 'LUMA_AGENTS_ENABLED'))) return falOnly;
    if (!flagEnabled(readEnv(params.env, 'LUMA_AGENTS_VIDEO_DIRECT_ENABLED'))) return falOnly;

    const publicRoutingEnabled = flagEnabled(readEnv(params.env, 'LUMA_AGENTS_PUBLIC_ROUTING_ENABLED'));
    const adminOnly = flagEnabled(readEnv(params.env, 'LUMA_AGENTS_ADMIN_ONLY') ?? 'true');
    if (adminOnly && !params.isAdmin) return falOnly;
    if (!publicRoutingEnabled && !params.isAdmin) return falOnly;

    return {
      kind: 'luma_agents_direct_primary',
      primaryProvider: 'luma_agents_direct',
      fallbackProvider: 'fal',
      fallbackEnabled:
        (params.mode === 't2v' || params.mode === 'i2v') &&
        flagEnabled(readEnv(params.env, 'LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED')),
      advancedDirectOnlyEnabled,
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
