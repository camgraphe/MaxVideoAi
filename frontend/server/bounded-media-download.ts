import { AgentApiError } from '@/server/agent-api/errors';
import { headerValue, openPublicHttpsResponse, publicMediaTransport, type ReferenceFileDownloaderDependencies, type ReferenceHttpsResponse } from './public-media-transport';
export type HostReferenceFile = {download_url:string;file_id:string;mime_type?:string;file_name?:string};
export type DownloadedReferenceFile = {bytes:Buffer;fileName:string;mimeType:string};
export type DownloadMediaPolicy = {accepted:readonly string[];maxBytes:number|((mimeType:string)=>number)};
function supportedMime(value:unknown,policy:DownloadMediaPolicy):string|null {
  const normalized=typeof value==='string'?value.split(';',1)[0]?.trim().toLowerCase():undefined;
  return normalized && policy.accepted.includes(normalized) ? normalized : null;
}
async function readBoundedResponse(
  response: ReferenceHttpsResponse,
  file: HostReferenceFile,
  policy: DownloadMediaPolicy,
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
    const maximumBytes = typeof policy.maxBytes === 'number' ? policy.maxBytes : policy.maxBytes(mimeType);
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
  policy: DownloadMediaPolicy,
): (file: HostReferenceFile) => Promise<DownloadedReferenceFile> {
  if (!policy.accepted.length || (typeof policy.maxBytes === 'number' && (!Number.isSafeInteger(policy.maxBytes) || policy.maxBytes < 1))) throw new Error('Invalid download policy.');
  return async (file) => readBoundedResponse(await openPublicHttpsResponse(file.download_url, dependencies), file, policy);
}


export function createBoundedMediaDownloader(policy: {accepted:readonly string[];maxBytes:number}) { return createReferenceFileDownloader(publicMediaTransport,policy); }
