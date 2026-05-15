import type { Mode } from '@/types/engines';

export const KLING_DIRECT_PROVIDER = 'kling_direct' as const;

export type KlingDirectEngineId = 'kling-3-standard' | 'kling-3-pro' | 'kling-3-4k';
export type KlingDirectMode = 'std' | 'pro' | '4k';
export type KlingDirectEndpointFamily = 'video-v3';
export type KlingDirectSubmitMode = 't2v' | 'i2v';
export type KlingDirectEndpointPath = '/v1/videos/text2video' | '/v1/videos/image2video';

export type KlingDirectModelRoute = {
  engineId: KlingDirectEngineId;
  endpointFamily: KlingDirectEndpointFamily;
  createPaths: Record<KlingDirectSubmitMode, KlingDirectEndpointPath>;
  pollPathPrefixes: Record<KlingDirectSubmitMode, KlingDirectEndpointPath>;
  providerModel: 'kling-v3';
  mode: KlingDirectMode;
};

const KLING_V3_ENDPOINTS: Record<KlingDirectSubmitMode, KlingDirectEndpointPath> = {
  t2v: '/v1/videos/text2video',
  i2v: '/v1/videos/image2video',
};

const KLING_DIRECT_MODEL_ROUTES: Record<KlingDirectEngineId, KlingDirectModelRoute> = {
  'kling-3-standard': {
    engineId: 'kling-3-standard',
    endpointFamily: 'video-v3',
    createPaths: KLING_V3_ENDPOINTS,
    pollPathPrefixes: KLING_V3_ENDPOINTS,
    providerModel: 'kling-v3',
    mode: 'std',
  },
  'kling-3-pro': {
    engineId: 'kling-3-pro',
    endpointFamily: 'video-v3',
    createPaths: KLING_V3_ENDPOINTS,
    pollPathPrefixes: KLING_V3_ENDPOINTS,
    providerModel: 'kling-v3',
    mode: 'pro',
  },
  'kling-3-4k': {
    engineId: 'kling-3-4k',
    endpointFamily: 'video-v3',
    createPaths: KLING_V3_ENDPOINTS,
    pollPathPrefixes: KLING_V3_ENDPOINTS,
    providerModel: 'kling-v3',
    mode: '4k',
  },
};

export function isKlingDirectEngine(engineId: string | null | undefined): engineId is KlingDirectEngineId {
  return Boolean(engineId && engineId in KLING_DIRECT_MODEL_ROUTES);
}

export function isKlingDirectModeSupported(mode: Mode | string | null | undefined): boolean {
  return mode === 't2v' || mode === 'i2v';
}

export function resolveKlingDirectModelRoute(engineId: string): KlingDirectModelRoute {
  if (!isKlingDirectEngine(engineId)) {
    throw new Error(`Unsupported Kling direct engine: ${engineId}`);
  }
  return KLING_DIRECT_MODEL_ROUTES[engineId];
}

export function resolveKlingDirectSubmitMode(mode: Mode | string): KlingDirectSubmitMode {
  if (mode === 'i2v') return 'i2v';
  if (mode === 't2v') return 't2v';
  throw new Error(`Unsupported Kling direct submit mode: ${mode}`);
}

export function resolveKlingDirectCreatePath(route: KlingDirectModelRoute, mode: Mode | string): KlingDirectEndpointPath {
  return route.createPaths[resolveKlingDirectSubmitMode(mode)];
}

export function resolveKlingDirectPollPathPrefix(
  route: KlingDirectModelRoute,
  mode: Mode | string
): KlingDirectEndpointPath {
  return route.pollPathPrefixes[resolveKlingDirectSubmitMode(mode)];
}
