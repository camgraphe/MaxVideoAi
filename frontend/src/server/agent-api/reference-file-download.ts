import { AgentApiError } from './errors';
import { getReferenceUploadPolicy } from './create-reference-upload-link';
import type { DownloadedReferenceFile, HostReferenceFile } from './reference-file-import';
import { headerValue, openPublicHttpsResponse, publicMediaTransport, type ReferenceFileDownloaderDependencies, type ReferenceHttpsResponse } from '@/server/public-media-transport';
export { createPinnedLookup, REFERENCE_DOWNLOAD_TIMEOUT_MS } from '@/server/public-media-transport';
export type { ReferenceFileDownloaderDependencies, ReferenceHttpsResponse, ResolvedReferenceAddress } from '@/server/public-media-transport';

type DownloadMediaPolicy = { accepted: readonly string[]; maxBytes: number };

function supportedMime(value: unknown, policy?: DownloadMediaPolicy): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (policy) return policy.accepted.includes(normalized) ? normalized : null;
  for (const kind of ['image', 'video', 'audio'] as const) {
    if (getReferenceUploadPolicy(kind).accepted.includes(normalized as never)) return normalized;
  }
  return null;
}

function mediaPolicy(mimeType: string): ReturnType<typeof getReferenceUploadPolicy> {
  if (mimeType.startsWith('image/')) return getReferenceUploadPolicy('image');
  if (mimeType.startsWith('video/')) return getReferenceUploadPolicy('video');
  return getReferenceUploadPolicy('audio');
}

async function readBoundedResponse(
  response: ReferenceHttpsResponse,
  file: HostReferenceFile,
  policy?: DownloadMediaPolicy,
): Promise<DownloadedReferenceFile> {
  try {
    if (response.statusCode !== 200) {
      throw new AgentApiError('REFERENCE_INVALID', 'The host file could not be downloaded.');
    }
    const declaredMime = supportedMime(file.mime_type, policy);
    const responseMime = supportedMime(headerValue(response.headers, 'content-type'), policy);
    if (file.mime_type && !declaredMime) {
      throw new AgentApiError('REFERENCE_INVALID', 'The host file type is unsupported.');
    }
    if (declaredMime && responseMime && declaredMime !== responseMime) {
      throw new AgentApiError('REFERENCE_INVALID', 'The host file type is inconsistent.');
    }
    const mimeType = declaredMime ?? responseMime;
    if (!mimeType) {
      throw new AgentApiError('REFERENCE_INVALID', 'The host file type is missing or unsupported.');
    }
    const maximumBytes = policy?.maxBytes ?? mediaPolicy(mimeType).maxBytes;
    const declaredLength = headerValue(response.headers, 'content-length');
    if (declaredLength !== null
      && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > maximumBytes)) {
      throw new AgentApiError('REFERENCE_INVALID', 'The host file exceeds the private upload limit.');
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk);
      totalBytes += bytes.length;
      if (totalBytes > maximumBytes) {
        throw new AgentApiError('REFERENCE_INVALID', 'The host file exceeds the private upload limit.');
      }
      chunks.push(bytes);
    }
    if (totalBytes < 1 || (declaredLength !== null && Number(declaredLength) !== totalBytes)) {
      throw new AgentApiError('REFERENCE_INVALID', 'The host file download is incomplete.');
    }
    const fileName = typeof file.file_name === 'string'
      && file.file_name.length >= 1
      && file.file_name.length <= 255
      && file.file_name === file.file_name.trim()
      && !/[\u0000-\u001f\u007f]/u.test(file.file_name)
      ? file.file_name
      : `reference-${file.file_id.slice(0, 48)}`;
    return { bytes: Buffer.concat(chunks, totalBytes), fileName, mimeType };
  } finally {
    response.cancel?.();
  }
}

export function createReferenceFileDownloader(
  dependencies: ReferenceFileDownloaderDependencies,
  policy?: DownloadMediaPolicy,
): (file: HostReferenceFile) => Promise<DownloadedReferenceFile> {
  if (policy && (!Number.isSafeInteger(policy.maxBytes) || policy.maxBytes < 1 || !policy.accepted.length)) throw new Error('Invalid download policy.');
  return async (file) => readBoundedResponse(await openPublicHttpsResponse(file.download_url, dependencies), file, policy);
}

export const downloadReferenceFile = createReferenceFileDownloader(publicMediaTransport);

/** Server-owned policy extension; all DNS, redirect, byte and timeout guards remain shared. */
export function createBoundedMediaDownloader(policy: DownloadMediaPolicy) {
  return createReferenceFileDownloader(publicMediaTransport, policy);
}
