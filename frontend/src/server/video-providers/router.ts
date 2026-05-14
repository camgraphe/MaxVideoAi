import type { Mode } from '@/types/engines';
import { isKlingDirectEngine, isKlingDirectModeSupported } from './kling-direct/model-map';

type RoutingEnv = Partial<Record<
  | 'KLING_DIRECT_ENABLED'
  | 'KLING_DIRECT_PUBLIC_ROUTING_ENABLED'
  | 'KLING_DIRECT_FALLBACK_TO_FAL_ENABLED'
  | 'KLING_DIRECT_ADMIN_ONLY',
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
  if (!isKlingDirectEngine(params.engineId)) return falOnly;
  if (!isKlingDirectModeSupported(params.mode)) return falOnly;
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
  };
}
