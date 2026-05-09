import { getSoraVariantForEngine, parseSoraRequest, type SoraRequest } from '@/lib/sora';
import type { EngineCaps, Mode } from '@/types/engines';

type RequestOptionsFailure = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
  metric?: {
    errorCode: string;
    meta?: Record<string, unknown>;
  };
};

export function buildSoraRequestOptions(params: {
  body: Record<string, unknown>;
  engine: EngineCaps;
  mode: Mode;
  prompt: string;
  requestedResolution: string;
  rawAspectRatio: string | null;
  durationSec: number;
}):
  | {
      ok: true;
      soraRequest: SoraRequest;
    }
  | RequestOptionsFailure {
  const variant = getSoraVariantForEngine(params.engine.id);
  const fallbackAspect = params.mode === 'i2v' ? 'auto' : '16:9';
  const soraDefaultResolution =
    params.engine.resolutions.find((value) => value !== 'auto') ?? params.engine.resolutions[0] ?? '720p';
  const candidate: Record<string, unknown> = {
    variant,
    mode: params.mode,
    prompt: params.prompt,
    resolution:
      params.requestedResolution === 'auto' && params.mode === 't2v'
        ? soraDefaultResolution
        : params.requestedResolution,
    aspect_ratio: params.rawAspectRatio ?? fallbackAspect,
    duration: params.durationSec,
    api_key:
      typeof params.body.apiKey === 'string' && params.body.apiKey.trim().length ? params.body.apiKey.trim() : undefined,
  };

  if (params.mode === 'i2v') {
    const imageUrl =
      typeof params.body.imageUrl === 'string' && params.body.imageUrl.trim().length
        ? params.body.imageUrl.trim()
        : typeof params.body.image_url === 'string' && params.body.image_url.trim().length
          ? params.body.image_url.trim()
          : undefined;
    if (!imageUrl) {
      return {
        ok: false,
        status: 400,
        metric: {
          errorCode: 'IMAGE_URL_REQUIRED',
          meta: { engineId: params.engine.id, mode: params.mode },
        },
        body: { ok: false, error: 'Image URL is required for Sora image-to-video' },
      };
    }
    candidate.image_url = imageUrl;
  }

  try {
    return { ok: true, soraRequest: parseSoraRequest(candidate) };
  } catch (error) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: 'Invalid Sora payload',
        details: error instanceof Error ? error.message : undefined,
      },
    };
  }
}
