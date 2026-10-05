import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { extractStorageKeyFromUrl, ownedMediaStorageKeyForUrl, isAllowedAssetHost } from '@/server/storage';
import type { WorkspaceTimelineRenderManifest } from '../../../app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';

export const MAX_EXPORT_MEDIA_BYTES = 512 * 1024 * 1024;
export const MAX_EXPORT_AGGREGATE_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_EXPORT_MEDIA_URL_LENGTH = 4096;
const DEFAULT_MEDIA_PROBE_TIMEOUT_MS = 3000;
const MANIFEST_MEDIA_VALIDATION_DEADLINE_MS = 10_000;
const MAX_MEDIA_PROBE_CONCURRENCY = 4;

type ExportMediaKind = 'video' | 'audio' | 'image';
type ExportMediaRequirement = {
  mediaKind: ExportMediaKind;
  allowVideoContainerForAudio?: boolean;
};

function matchesExportMediaRequirement(contentType: string, requirement: ExportMediaRequirement): boolean {
  if (contentType.startsWith(`${requirement.mediaKind}/`)) return true;
  return requirement.mediaKind === 'audio'
    && requirement.allowVideoContainerForAudio === true
    && contentType === 'video/mp4';
}

function requestOriginUrl(requestOrigin: string): URL | null {
  try {
    return new URL(requestOrigin);
  } catch {
    return null;
  }
}

function normalizeApprovedExportMediaUrl(url: string, requestOrigin: string): string {
  if (!url || url.length > MAX_EXPORT_MEDIA_URL_LENGTH) throw new Error('EXPORT_MEDIA_URL_NOT_ALLOWED');
  const origin = requestOriginUrl(requestOrigin);
  let parsed: URL;
  try {
    parsed = new URL(url, origin ?? undefined);
  } catch {
    throw new Error('EXPORT_MEDIA_URL_NOT_ALLOWED');
  }
  if (parsed.username || parsed.password || parsed.hash) throw new Error('EXPORT_MEDIA_URL_NOT_ALLOWED');
  const sameOrigin = Boolean(origin && parsed.origin === origin.origin);
  const localDevelopmentOrigin = sameOrigin
    && process.env.NODE_ENV !== 'production'
    && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localDevelopmentOrigin)) {
    throw new Error('EXPORT_MEDIA_URL_NOT_ALLOWED');
  }
  if (!sameOrigin && !isAllowedAssetHost(parsed.toString())) throw new Error('EXPORT_MEDIA_URL_NOT_ALLOWED');
  return parsed.toString();
}

/** Validates canonical identity without issuing or persisting a transport grant. */
export function canonicalTimelineExportMediaUrl(params: {
  url: string; userId?: string; requestOrigin: string;
}): string {
  const url = normalizeApprovedExportMediaUrl(params.url, params.requestOrigin);
  if (extractStorageKeyFromUrl(url)) {
    if (!params.userId || !ownedMediaStorageKeyForUrl({url,userId: params.userId})) throw new Error('EXPORT_MEDIA_NOT_OWNED');
    if ([...new URL(url).searchParams.keys()].some(key => /^x-amz-/i.test(key))) throw new Error('EXPORT_MEDIA_URL_NOT_ALLOWED');
  }
  return url;
}

/** Grants exist only at network boundaries. Callers keep the canonical URL. */
export async function createTimelineExportReadUrl(params: {
  url: string; userId?: string; requestOrigin: string; method: 'GET' | 'HEAD'; expiresInSeconds?: number;
}): Promise<string> {
  const url = canonicalTimelineExportMediaUrl(params);
  try {
    return await createOwnedMediaReadUrl({url,userId: params.userId,method: params.method,expiresInSeconds: params.expiresInSeconds ?? 300});
  } catch { throw new Error('EXPORT_MEDIA_UNAVAILABLE'); }
}

/** Worker-only copy: validate the canonical manifest first; never persist this transport. */
export async function prepareTimelineExportRenderMedia(params: {
  manifest: WorkspaceTimelineRenderManifest; userId: string; requestOrigin: string;
}): Promise<WorkspaceTimelineRenderManifest> {
  const grants = new Map<string, string>();
  for (const clip of params.manifest.tracks.flatMap(track => track.clips)) {
    if (!grants.has(clip.mediaUrl)) grants.set(clip.mediaUrl, await createTimelineExportReadUrl({
      url: clip.mediaUrl,userId: params.userId,requestOrigin: params.requestOrigin,method: 'GET',expiresInSeconds: 3600,
    }));
  }
  return {...params.manifest,tracks: params.manifest.tracks.map(track => ({...track,clips: track.clips.map(clip => ({...clip,mediaUrl: grants.get(clip.mediaUrl)!}))}))};
}

async function probeLegacyTimelineExportMediaUrl(params: {
  url: string;
  userId?: string;
  requestOrigin: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  requirements: ExportMediaRequirement[];
}): Promise<{ url: string; sizeBytes: number }> {
  const normalizedUrl = normalizeApprovedExportMediaUrl(params.url, params.requestOrigin);
  const controller = new AbortController();
  const timeoutMs = Math.max(100, Math.min(params.timeoutMs ?? DEFAULT_MEDIA_PROBE_TIMEOUT_MS, 5000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const transportUrl = await createTimelineExportReadUrl({url: normalizedUrl,userId: params.userId,requestOrigin: params.requestOrigin,method: 'HEAD'});
    const response = await (params.fetchImpl ?? fetch)(transportUrl, {
      method: 'HEAD',
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('EXPORT_MEDIA_UNAVAILABLE');
    const contentLength = Number(response.headers.get('content-length'));
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) throw new Error('EXPORT_MEDIA_SIZE_REQUIRED');
    if (contentLength > MAX_EXPORT_MEDIA_BYTES) throw new Error('EXPORT_MEDIA_TOO_LARGE');
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!params.requirements.every((requirement) => matchesExportMediaRequirement(contentType, requirement))) {
      throw new Error('EXPORT_MEDIA_TYPE_MISMATCH');
    }
    return { url: normalizedUrl, sizeBytes: contentLength };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('EXPORT_MEDIA_PROBE_TIMEOUT');
    if (error instanceof Error && /^EXPORT_MEDIA_[A-Z_]+$/.test(error.message)) throw new Error(error.message);
    throw new Error('EXPORT_MEDIA_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}

export async function validateLegacyTimelineExportMediaUrl(params: {
  url: string;
  mediaKind: ExportMediaKind;
  userId?: string;
  requestOrigin: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  allowVideoContainerForAudio?: boolean;
}): Promise<string> {
  return (await probeLegacyTimelineExportMediaUrl({
    ...params,
    requirements: [{
      mediaKind: params.mediaKind,
      allowVideoContainerForAudio: params.allowVideoContainerForAudio,
    }],
  })).url;
}

export async function validateTimelineExportManifestMediaUrls(params: {
  manifest: WorkspaceTimelineRenderManifest;
  userId?: string;
  requestOrigin: string;
  fetchImpl?: typeof fetch;
}): Promise<WorkspaceTimelineRenderManifest> {
  const clipsByUrl = new Map<string, WorkspaceTimelineRenderManifest['tracks'][number]['clips']>();
  for (const clip of params.manifest.tracks.flatMap((track) => track.clips)) {
    const clips = clipsByUrl.get(clip.mediaUrl) ?? [];
    clips.push(clip);
    clipsByUrl.set(clip.mediaUrl, clips);
  }
  const uniqueSources = Array.from(clipsByUrl, ([url, clips]) => ({ url, clips }));
  const replacements = new Map<string, string>();
  const deadline = Date.now() + MANIFEST_MEDIA_VALIDATION_DEADLINE_MS;
  let nextIndex = 0;
  let aggregateBytes = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && nextIndex < uniqueSources.length) {
      const source = uniqueSources[nextIndex++];
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw new Error('EXPORT_MEDIA_VALIDATION_TIMEOUT');
      try {
        const validated = await probeLegacyTimelineExportMediaUrl({
          url: source.url,
          userId: params.userId,
          requestOrigin: params.requestOrigin,
          fetchImpl: params.fetchImpl,
          timeoutMs: Math.min(DEFAULT_MEDIA_PROBE_TIMEOUT_MS, remainingMs),
          requirements: source.clips.map((clip) => ({
            mediaKind: clip.mediaKind,
            allowVideoContainerForAudio: clip.mediaKind === 'audio' && clip.audioProvenance === 'embedded',
          })),
        });
        aggregateBytes += validated.sizeBytes;
        if (aggregateBytes > MAX_EXPORT_AGGREGATE_MEDIA_BYTES) {
          throw new Error('EXPORT_MEDIA_AGGREGATE_TOO_LARGE');
        }
        replacements.set(source.url, validated.url);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_MEDIA_PROBE_CONCURRENCY, uniqueSources.length) }, worker));
  return {
    ...params.manifest,
    tracks: params.manifest.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => ({
        ...clip,
        mediaUrl: replacements.get(clip.mediaUrl) ?? clip.mediaUrl,
      })),
    })),
  };
}
