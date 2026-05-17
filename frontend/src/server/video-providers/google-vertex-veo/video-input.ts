import { randomUUID } from 'node:crypto';
import type { GoogleVertexVeoClient } from './client';
import { GoogleVertexVeoError } from './errors';

export type GoogleVideo = {
  mimeType: 'video/mp4';
  gcsUri: string;
};

const MAX_EXTEND_VIDEO_BYTES = 256 * 1024 * 1024;

function parseGcsPrefix(value: string | undefined): { bucket: string; prefix: string } | null {
  const normalized = (value ?? '').trim().replace(/\/+$/, '');
  const match = normalized.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) return null;
  return { bucket: match[1], prefix: match[2] ? `${match[2]}/` : '' };
}

function inferVideoMime(url: string, responseMime?: string | null): string {
  const mime = responseMime?.split(';')[0]?.trim().toLowerCase();
  if (mime) return mime;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.mp4')) return 'video/mp4';
  } catch {
    return 'application/octet-stream';
  }
  return 'application/octet-stream';
}

export async function fetchVideoAsGoogleVideo(params: {
  url: string;
  client?: GoogleVertexVeoClient;
  inputGcsPrefix?: string;
}): Promise<GoogleVideo> {
  if (params.url.startsWith('gs://')) {
    if (!params.url.toLowerCase().endsWith('.mp4')) {
      throw new GoogleVertexVeoError('Google Vertex Veo Extend requires an MP4 source video.', {
        code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
        errorClass: 'unsupported_params',
        raw: { source: 'gcs' },
      });
    }
    return { gcsUri: params.url, mimeType: 'video/mp4' };
  }

  const staging = parseGcsPrefix(params.inputGcsPrefix);
  if (!staging) {
    throw new GoogleVertexVeoError('GOOGLE_VERTEX_VEO_INPUT_GCS_URI is required for Google direct Extend.', {
      code: 'GOOGLE_VERTEX_VEO_INPUT_GCS_URI_MISSING',
      errorClass: 'unsupported_params',
    });
  }
  if (!params.client) {
    throw new GoogleVertexVeoError('Google Vertex Veo Extend input staging client is missing.', {
      code: 'GOOGLE_VERTEX_VEO_INPUT_GCS_CLIENT_MISSING',
      errorClass: 'provider_error',
    });
  }

  const response = await fetch(params.url, { cache: 'no-store' });
  if (!response.ok) {
    throw new GoogleVertexVeoError('Failed to fetch source video for Google Vertex Veo Extend.', {
      status: response.status,
      code: 'GOOGLE_VERTEX_VEO_VIDEO_FETCH_FAILED',
      errorClass: response.status >= 500 ? 'provider_unavailable' : 'invalid_request',
    });
  }
  const mime = inferVideoMime(params.url, response.headers.get('content-type'));
  if (mime !== 'video/mp4') {
    throw new GoogleVertexVeoError('Google Vertex Veo Extend requires an MP4 source video.', {
      code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
      errorClass: 'unsupported_params',
      raw: { mime },
    });
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_EXTEND_VIDEO_BYTES) {
    throw new GoogleVertexVeoError('Google Vertex Veo Extend source video is too large.', {
      code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
      errorClass: 'unsupported_params',
      raw: { contentLength },
    });
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > MAX_EXTEND_VIDEO_BYTES) {
    throw new GoogleVertexVeoError('Google Vertex Veo Extend source video is empty or too large.', {
      code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
      errorClass: 'unsupported_params',
      raw: { byteLength: data.length },
    });
  }

  const objectName = `${staging.prefix}veo-inputs/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.mp4`;
  const gcsUri = `gs://${staging.bucket}/${objectName}`;
  await params.client.uploadGcsObject({ gcsUri, data, mime: 'video/mp4' });
  return { gcsUri, mimeType: 'video/mp4' };
}
