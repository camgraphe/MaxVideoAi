/** Server-produced queue identity. Never accept this object from a generation request. */
export type FalQueueReceipt = {
  requestId: string;
  endpoint: string;
  metadataState: 'verified' | 'missing' | 'invalid';
  statusUrl?: string;
  responseUrl?: string;
  cancelUrl?: string;
};

const V4_ENDPOINTS = new Set([
  'kling/v4/text-to-video',
  'kling/v4/image-to-video',
  'kling/v4/reference-to-video',
  'kling/v4/video-to-video/edit',
]);

function validReceiptUrl(value: unknown, endpoint: string, requestId: string, suffix: string): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const roots = [endpoint, 'kling/v4'];
    return url.origin === 'https://queue.fal.run'
      && !url.username && !url.password && !url.search && !url.hash
      && url.toString() === value
      && roots.some(root => url.pathname === `/${root}/requests/${requestId}${suffix}`);
  } catch { return false; }
}

/** Invalid/missing tracking must not discard an accepted ID or trigger a second POST. */
export function parseFalQueueReceipt(endpoint: string, requestId: string, body: unknown): FalQueueReceipt {
  const identity: FalQueueReceipt = { requestId, endpoint, metadataState: 'invalid' };
  if (!V4_ENDPOINTS.has(endpoint) || !/^[a-zA-Z0-9_-]+$/u.test(requestId)) return identity;
  if (!body || typeof body !== 'object') return { ...identity, metadataState: 'missing' };
  const receipt = body as Record<string, unknown>;
  if (receipt.request_id !== requestId) return identity;
  if (receipt.status_url === undefined && receipt.response_url === undefined && receipt.cancel_url === undefined) {
    return { ...identity, metadataState: 'missing' };
  }
  if (!validReceiptUrl(receipt.status_url, endpoint, requestId, '/status')
    || !validReceiptUrl(receipt.response_url, endpoint, requestId, '')
    || !validReceiptUrl(receipt.cancel_url, endpoint, requestId, '/cancel')) return identity;
  return { ...identity, metadataState: 'verified', statusUrl: receipt.status_url,
    responseUrl: receipt.response_url, cancelUrl: receipt.cancel_url };
}

/** Revalidate persisted JSON against the job identity before attaching credentials. */
export function readFalQueueReceipt(value: unknown, requestId: string): FalQueueReceipt {
  if (!value || typeof value !== 'object') throw new Error('Fal queue receipt metadata is unavailable.');
  const stored = value as Record<string, unknown>;
  const receipt = parseFalQueueReceipt(String(stored.endpoint ?? ''), requestId, {
    request_id: stored.requestId, status_url: stored.statusUrl,
    response_url: stored.responseUrl, cancel_url: stored.cancelUrl,
  });
  if (stored.metadataState !== 'verified' || receipt.metadataState !== 'verified') {
    throw new Error('Fal queue receipt metadata is unavailable or invalid.');
  }
  return receipt;
}
