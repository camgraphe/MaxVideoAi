type FixtureRequest = { method: string; range?: string | null };
type FixtureResponse = { status: number; headers: Record<string, string>; body: Buffer };

/**
 * Test-only bytes, after the caller has checked the exact fixture host/key/access.
 * No URL lookup, network, signature validation or production authorization lives here.
 * Single byte ranges follow RFC9110 §14; unsupported/multiple ranges are ignored.
 */
export function studioMediaByteResponse(bytes: Buffer, request: FixtureRequest): FixtureResponse {
  const headers: Record<string, string> = {
    'content-type': 'video/mp4', 'content-length': String(bytes.length),
    'accept-ranges': 'bytes', 'cache-control': 'private, no-store',
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'Content-Range, Content-Length, Accept-Ranges',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return { status: 405, headers: { ...headers, allow: 'GET, HEAD', 'content-length': '0' }, body: Buffer.alloc(0) };
  }
  if (request.method === 'HEAD') return { status: 200, headers, body: Buffer.alloc(0) };
  const match = request.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2]) || !bytes.length) return { status: 200, headers, body: bytes };
  const first = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]));
  const last = match[1] && match[2] ? Number(match[2]) : bytes.length - 1;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first >= bytes.length || last < first || (!match[1] && Number(match[2]) === 0)) {
    return { status: 416, headers: { ...headers, 'content-range': `bytes */${bytes.length}`, 'content-length': '0' }, body: Buffer.alloc(0) };
  }
  const end = Math.min(last, bytes.length - 1);
  const body = bytes.subarray(first, end + 1);
  return { status: 206, headers: { ...headers, 'content-range': `bytes ${first}-${end}/${bytes.length}`, 'content-length': String(body.length) }, body };
}
