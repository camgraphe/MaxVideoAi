import type { Mode } from '@/types/engines';

export const LUMA_DIRECT_PROVIDER = 'luma_direct' as const;

export type LumaDirectEngineId = 'lumaRay3_2' | 'luma-ray-3-2';
export type LumaDirectMode = Extract<Mode, 't2v' | 'i2v' | 'v2v' | 'reframe'>;
export type LumaDirectGenerationType = 'video' | 'video_edit' | 'video_reframe';

export type LumaDirectModelRoute = {
  engineId: 'lumaRay3_2';
  aliases: LumaDirectEngineId[];
  providerModel: 'ray-3.2';
  supportedModes: LumaDirectMode[];
  falFallbackModelIds: Record<LumaDirectMode, string>;
};

const LUMA_RAY32_ROUTE: LumaDirectModelRoute = {
  engineId: 'lumaRay3_2',
  aliases: ['lumaRay3_2', 'luma-ray-3-2'],
  providerModel: 'ray-3.2',
  supportedModes: ['t2v', 'i2v', 'v2v', 'reframe'],
  falFallbackModelIds: {
    t2v: 'luma/agent/ray/v3.2/text-to-video',
    i2v: 'luma/agent/ray/v3.2/image-to-video',
    v2v: 'luma/agent/ray/v3.2/video-to-video',
    reframe: 'luma/agent/ray/v3.2/reframe',
  },
};

const LUMA_DIRECT_ROUTES_BY_ALIAS = new Map<string, LumaDirectModelRoute>(
  LUMA_RAY32_ROUTE.aliases.map((alias) => [alias, LUMA_RAY32_ROUTE])
);

export function isLumaDirectEngine(engineId: string | null | undefined): engineId is LumaDirectEngineId {
  return Boolean(engineId && LUMA_DIRECT_ROUTES_BY_ALIAS.has(engineId));
}

export function resolveLumaDirectModelRoute(engineId: string): LumaDirectModelRoute {
  const route = LUMA_DIRECT_ROUTES_BY_ALIAS.get(engineId);
  if (!route) {
    throw new Error(`Unsupported Luma direct engine: ${engineId}`);
  }
  return route;
}

export function isLumaDirectModeSupported(
  engineId: string | null | undefined,
  mode: Mode | string | null | undefined
): boolean {
  if (!isLumaDirectEngine(engineId) || !mode) return false;
  return resolveLumaDirectModelRoute(engineId).supportedModes.includes(mode as LumaDirectMode);
}

export function resolveLumaDirectGenerationType(mode: Mode | string): LumaDirectGenerationType {
  if (mode === 't2v' || mode === 'i2v') return 'video';
  if (mode === 'v2v') return 'video_edit';
  if (mode === 'reframe') return 'video_reframe';
  throw new Error(`Unsupported Luma Ray 3.2 mode: ${mode}`);
}
