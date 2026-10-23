import type { UploadedVideoAsset } from '@/lib/client-video-upload';
import type { ToolAssetRef } from '@/lib/toolbox/contract';
import type { VideoExcerptRange } from '@/lib/video-excerpt';
import type { Mode } from '@/types/engines';

/** Machine-readable failure; user copy is localized by the shared selector. */
export class VideoExcerptRequestError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number
  ) {
    super(code);
    this.name = 'VideoExcerptRequestError';
  }
}

async function requestExcerptJson(
  path: string, input: object,
  request: typeof fetch
) {
  let response: Response;
  try {
    response = await request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error;
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    throw new VideoExcerptRequestError(code === 'UNAUTHORIZED' ? 'AUTH_REQUIRED' : 'NETWORK_ERROR');
  }
  const result = await response.json().catch(() => null);
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new VideoExcerptRequestError('MALFORMED_RESPONSE', response.status);
  if (!response.ok || result.ok !== true) {
    const code =
      typeof result.error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,127}$/.test(result.error.code)
        ? result.error.code
        : response.status === 401
          ? 'AUTH_REQUIRED'
          : 'PREPARATION_FAILED';
    throw new VideoExcerptRequestError(code, response.status);
  }
  return { result, status: response.status };
}

export async function requestVideoExcerpt(
  input: { source: ToolAssetRef; engineId: string; mode: Mode; fieldId?: string; range: VideoExcerptRange },
  request: typeof fetch
) {
  const { result, status } = await requestExcerptJson(`/api/uploads/${input.source.kind === 'audio' ? 'audio' : 'video'}/excerpt`, input, request);
  const asset = result.asset as UploadedVideoAsset;
  if (!asset?.id || !asset.url || !Number.isFinite(asset.durationSec) || asset.durationSec! <= 0)
    throw new VideoExcerptRequestError('MALFORMED_RESPONSE', status);
  return { asset };
}


export async function requestVideoExcerptSource(source: ToolAssetRef, request: typeof fetch): Promise<string> {
  const { result, status } = await requestExcerptJson(`/api/uploads/${source.kind === 'audio' ? 'audio' : 'video'}/excerpt/source`, { source }, request);
  if (typeof result.previewUrl !== 'string' || !/^https?:\/\//.test(result.previewUrl))
    throw new VideoExcerptRequestError('MALFORMED_RESPONSE', status);
  return result.previewUrl;
}
