import type { GeneratePayload } from '@/lib/fal';
import type { Mode } from '@/types/engines';

export const GOOGLE_VERTEX_OMNI_PROVIDER = 'google_vertex_omni_direct' as const;

export type GoogleVertexOmniEngineId = 'gemini-omni-flash';
export type GoogleVertexOmniMode = Extract<Mode, 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'retake'>;

export type GoogleVertexOmniModelRoute = {
  engineId: GoogleVertexOmniEngineId;
  providerModel: string;
  launchStage: 'preview';
  supportedModes: GoogleVertexOmniMode[];
  aspectRatios: Array<'16:9' | '9:16'>;
};

export type GoogleVertexOmniSupportResult =
  | { supported: true; route: GoogleVertexOmniModelRoute }
  | { supported: false; reason: string; route: GoogleVertexOmniModelRoute | null };

const GOOGLE_VERTEX_OMNI_ROUTES: Record<GoogleVertexOmniEngineId, GoogleVertexOmniModelRoute> = {
  'gemini-omni-flash': {
    engineId: 'gemini-omni-flash',
    providerModel: 'gemini-omni-flash-preview',
    launchStage: 'preview',
    supportedModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'retake'],
    aspectRatios: ['16:9', '9:16'],
  },
};

const SUPPORTED_ASPECT_RATIOS = new Set(['16:9', '9:16']);

export function isGoogleVertexOmniEngine(engineId: string): engineId is GoogleVertexOmniEngineId {
  return engineId in GOOGLE_VERTEX_OMNI_ROUTES;
}

export function resolveGoogleVertexOmniModelRoute(engineId: string): GoogleVertexOmniModelRoute {
  if (!isGoogleVertexOmniEngine(engineId)) {
    throw new Error(`Unsupported Google Vertex Omni engine: ${engineId}`);
  }
  return GOOGLE_VERTEX_OMNI_ROUTES[engineId];
}

export function isGoogleVertexOmniModeSupported(engineId: string, mode: Mode | string): boolean {
  if (!isGoogleVertexOmniEngine(engineId)) return false;
  return GOOGLE_VERTEX_OMNI_ROUTES[engineId].supportedModes.includes(mode as GoogleVertexOmniMode);
}

export function resolveGoogleVertexOmniSupport(params: {
  engineId: string;
  mode: Mode | string;
  aspectRatio?: string | null;
  prompt?: string | null;
  negativePrompt?: string | null;
  seed?: number | null;
  falPayload?: GeneratePayload;
}): GoogleVertexOmniSupportResult {
  const route = isGoogleVertexOmniEngine(params.engineId) ? GOOGLE_VERTEX_OMNI_ROUTES[params.engineId] : null;
  if (!route) {
    return { supported: false, route: null, reason: 'unsupported_engine' };
  }
  if (!route.supportedModes.includes(params.mode as GoogleVertexOmniMode)) {
    return { supported: false, route, reason: 'unsupported_mode' };
  }
  const aspectRatio = params.aspectRatio ?? params.falPayload?.aspectRatio ?? null;
  if (aspectRatio && !SUPPORTED_ASPECT_RATIOS.has(aspectRatio)) {
    return { supported: false, route, reason: 'aspect_ratio_not_supported' };
  }
  if (params.negativePrompt?.trim()) {
    return { supported: false, route, reason: 'negative_prompt_not_supported' };
  }
  if (typeof params.seed === 'number' || typeof params.falPayload?.seed === 'number') {
    return { supported: false, route, reason: 'seed_not_supported' };
  }
  if (params.falPayload?.endImageUrl) {
    return { supported: false, route, reason: 'first_last_frame_not_supported' };
  }
  if (params.falPayload?.audioUrl) {
    return { supported: false, route, reason: 'audio_reference_not_supported' };
  }
  return { supported: true, route };
}
