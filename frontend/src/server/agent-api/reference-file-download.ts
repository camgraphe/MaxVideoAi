import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';

import { AgentApiError } from './errors';
import { getReferenceUploadPolicy } from './create-reference-upload-link';
import type { DownloadedReferenceFile, HostReferenceFile } from './reference-file-import';

export type ResolvedReferenceAddress = {
  address: string;
  family: 4 | 6;
};

export type ReferenceFileDownloaderDependencies = {
  lookupHost(hostname: string): Promise<ResolvedReferenceAddress[]>;
  openPinnedHttps(
    url: URL,
    address: ResolvedReferenceAddress,
  ): Promise<ReferenceHttpsResponse>;
};

export type ReferenceHttpsResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
  cancel?: () => void;
};

export const REFERENCE_DOWNLOAD_TIMEOUT_MS = 30_000;

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) blockedAddresses.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:2::', 48],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['2002::', 16],
  ['fc00::', 7],
  ['fec0::', 10],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
] as const) blockedAddresses.addSubnet(network, prefix, 'ipv6');

function parseHttpsUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AgentApiError('REFERENCE_INVALID', 'The host file URL is invalid.');
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username.length > 0
    || parsed.password.length > 0
    || parsed.hash.length > 0
    || (parsed.port.length > 0 && parsed.port !== '443')
    || parsed.hostname.length < 1
    || parsed.hostname.length > 253
  ) {
    throw new AgentApiError('REFERENCE_INVALID', 'The host file URL is invalid.');
  }
  return parsed;
}

function isBlockedAddress(candidate: ResolvedReferenceAddress): boolean {
  if (isIP(candidate.address) !== candidate.family) return true;
  return blockedAddresses.check(candidate.address, candidate.family === 4 ? 'ipv4' : 'ipv6');
}

function headerValue(
  headers: ReferenceHttpsResponse['headers'],
  name: string,
): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

function supportedMime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
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
): Promise<DownloadedReferenceFile> {
  try {
    if (response.statusCode !== 200) {
      throw new AgentApiError('REFERENCE_INVALID', 'The host file could not be downloaded.');
    }
    const declaredMime = supportedMime(file.mime_type);
    const responseMime = supportedMime(headerValue(response.headers, 'content-type'));
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
    const maximumBytes = mediaPolicy(mimeType).maxBytes;
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
): (file: HostReferenceFile) => Promise<DownloadedReferenceFile> {
  const download = async (
    url: URL,
    file: HostReferenceFile,
    redirectsRemaining: number,
  ): Promise<DownloadedReferenceFile> => {
    const addresses = await dependencies.lookupHost(url.hostname);
    if (addresses.length < 1 || addresses.some(isBlockedAddress)) {
      throw new AgentApiError('REFERENCE_INVALID', 'The host file URL is not permitted.');
    }
    const response = await dependencies.openPinnedHttps(url, addresses[0]);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      try {
        const location = headerValue(response.headers, 'location');
        if (!location || redirectsRemaining < 1) {
          throw new AgentApiError('REFERENCE_INVALID', 'The host file redirect is invalid.');
        }
        let redirected: URL;
        try {
          redirected = parseHttpsUrl(new URL(location, url).toString());
        } catch {
          throw new AgentApiError('REFERENCE_INVALID', 'The host file redirect is invalid.');
        }
        return download(redirected, file, redirectsRemaining - 1);
      } finally {
        response.cancel?.();
      }
    }
    return readBoundedResponse(response, file);
  };
  return (file) => download(parseHttpsUrl(file.download_url), file, 3);
}

async function lookupPublicHost(hostname: string): Promise<ResolvedReferenceAddress[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((entry) => ({
    address: entry.address,
    family: entry.family === 6 ? 6 : 4,
  }));
}

async function openPinnedHttps(
  url: URL,
  address: ResolvedReferenceAddress,
): Promise<ReferenceHttpsResponse> {
  return new Promise((resolve, reject) => {
    let responseBody: import('node:http').IncomingMessage | null = null;
    let settled = false;
    const timeoutError = () => new AgentApiError('REFERENCE_INVALID', 'The host file download timed out.');
    const request = httpsRequest(url, {
      method: 'GET',
      headers: {
        Accept: 'image/*,video/*,audio/*,application/octet-stream;q=0.5',
        'User-Agent': 'MaxVideoAI-MCP/1.0',
      },
      maxHeaderSize: 16 * 1024,
      lookup: (_hostname, _options, callback) => {
        callback(null, address.address, address.family);
      },
    }, (response) => {
      responseBody = response;
      settled = true;
      resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: response,
        cancel() {
          clearTimeout(absoluteTimer);
          response.destroy();
        },
      });
    });
    const absoluteTimer = setTimeout(() => {
      const error = timeoutError();
      responseBody?.destroy(error);
      request.destroy(error);
      if (!settled) reject(error);
    }, REFERENCE_DOWNLOAD_TIMEOUT_MS);
    request.setTimeout(REFERENCE_DOWNLOAD_TIMEOUT_MS, () => {
      const error = timeoutError();
      clearTimeout(absoluteTimer);
      responseBody?.destroy(error);
      request.destroy(error);
      if (!settled) reject(error);
    });
    request.once('error', (error) => {
      clearTimeout(absoluteTimer);
      if (!settled) reject(error);
    });
    request.end();
  });
}

export const downloadReferenceFile = createReferenceFileDownloader({
  lookupHost: lookupPublicHost,
  openPinnedHttps,
});
