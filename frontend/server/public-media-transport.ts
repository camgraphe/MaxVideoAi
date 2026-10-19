import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

import { AgentApiError } from '@/server/agent-api/errors';

export type ResolvedReferenceAddress = {
  address: string;
  family: 4 | 6;
};

export type ReferenceFileDownloaderDependencies = {
  lookupHost(hostname: string): Promise<ResolvedReferenceAddress[]>;
  openPinnedHttps(
    url: URL,
    address: ResolvedReferenceAddress,
    options?: { signal?: AbortSignal; timeoutMs?: number },
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
    || parsed.hostname.replace(/\.$/, '').toLowerCase() === 'localhost'
    || parsed.hostname.replace(/\.$/, '').toLowerCase().endsWith('.localhost')
  ) {
    throw new AgentApiError('REFERENCE_INVALID', 'The host file URL is invalid.');
  }
  return parsed;
}

function isBlockedAddress(candidate: ResolvedReferenceAddress): boolean {
  if (isIP(candidate.address) !== candidate.family) return true;
  return blockedAddresses.check(candidate.address, candidate.family === 4 ? 'ipv4' : 'ipv6');
}

export function headerValue(
  headers: ReferenceHttpsResponse['headers'],
  name: string,
): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

/** Shared connection boundary for buffered imports and streaming downloads.
 * Validate every hop and pin the approved DNS answer at socket creation. */
export async function openPublicHttpsResponse(
  source: string,
  dependencies: ReferenceFileDownloaderDependencies = { lookupHost: lookupPublicHost, openPinnedHttps },
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<ReferenceHttpsResponse> {
  let url = parseHttpsUrl(source);
  for (let redirectsRemaining = 3; ; redirectsRemaining -= 1) {
    options?.signal?.throwIfAborted();
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const family = isIP(hostname);
    const addresses: ResolvedReferenceAddress[] = family
      ? [{ address: hostname, family: family as 4 | 6 }]
      : await lookupWithSignal(dependencies, hostname, options?.signal);
    options?.signal?.throwIfAborted();
    if (addresses.length < 1 || addresses.some(isBlockedAddress)) {
      throw new AgentApiError('REFERENCE_INVALID', 'The host file URL is not permitted.');
    }
    const response = await dependencies.openPinnedHttps(url, addresses[0], options);
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
        url = redirected;
      } finally {
        response.cancel?.();
      }
      continue;
    }
    return response;
  }
}

function lookupWithSignal(dependencies: ReferenceFileDownloaderDependencies, hostname: string, signal?: AbortSignal) {
  if (!signal) return dependencies.lookupHost(hostname);
  return new Promise<ResolvedReferenceAddress[]>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { signal.removeEventListener('abort', abort); reject(signal.reason); return; }
    // Node's resolver cannot be canceled; late answers never open a connection.
    dependencies.lookupHost(hostname).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function lookupPublicHost(hostname: string): Promise<ResolvedReferenceAddress[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((entry) => ({
    address: entry.address,
    family: entry.family === 6 ? 6 : 4,
  }));
}

/** Keep the validated DNS address pinned while honoring Node's single-address and
 * `all: true` lookup callback contracts (used by newer auto-family selection). */
export function createPinnedLookup(address: ResolvedReferenceAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address: address.address, family: address.family }]);
      return;
    }
    callback(null, address.address, address.family);
  };
}

async function openPinnedHttps(
  url: URL,
  address: ResolvedReferenceAddress,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<ReferenceHttpsResponse> {
  return new Promise((resolve, reject) => {
    let responseBody: import('node:http').IncomingMessage | null = null;
    let settled = false;
    const timeoutError = () => new AgentApiError('REFERENCE_INVALID', 'The host file download timed out.');
    const request = httpsRequest(url, {
      method: 'GET',
      headers: {
        Accept: 'image/*,video/*,audio/*,application/octet-stream;q=0.5',
        'Accept-Encoding': 'identity',
        'User-Agent': 'MaxVideoAI-MCP/1.0',
      },
      maxHeaderSize: 16 * 1024,
      lookup: createPinnedLookup(address),
      signal: options?.signal,
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
    }, options?.timeoutMs ?? REFERENCE_DOWNLOAD_TIMEOUT_MS);
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

export const publicMediaTransport = { lookupHost: lookupPublicHost, openPinnedHttps };
