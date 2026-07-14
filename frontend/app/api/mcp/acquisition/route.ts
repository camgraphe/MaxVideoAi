import { NextResponse } from 'next/server';

import {
  createSignedMcpAcquisitionCookie,
  MCP_ACQUISITION_COOKIE_NAME,
  MCP_ACQUISITION_REQUEST_MAX_BYTES,
  mcpAcquisitionCookieOptions,
  parseMcpAcquisitionRequest,
  resolveMcpAcquisitionSigningSecret,
} from '@/lib/mcp-acquisition';
import { isSameOriginConsentRequest } from '@/server/mcp/oauth-consent';

export const runtime = 'nodejs';

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

type DeclaredLengthResult =
  | { status: 'ok'; value: number }
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'too_large' };

type BoundedBodyResult =
  | { status: 'ok'; value: string }
  | { status: 'invalid' }
  | { status: 'mismatch' }
  | { status: 'too_large' };

function parseDeclaredContentLength(request: Request): DeclaredLengthResult {
  const raw = request.headers.get('content-length');
  if (raw === null) return { status: 'missing' };
  if (!/^(0|[1-9]\d*)$/.test(raw)) return { status: 'invalid' };
  const length = Number(raw);
  if (!Number.isSafeInteger(length)) return { status: 'invalid' };
  if (length > MCP_ACQUISITION_REQUEST_MAX_BYTES) return { status: 'too_large' };
  return { status: 'ok', value: length };
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // The response still fails closed if the transport cannot be cancelled.
  }
}

async function readBoundedBody(
  request: Request,
  declaredLength: number,
): Promise<BoundedBodyResult> {
  if (!request.body) {
    return declaredLength === 0 ? { status: 'ok', value: '' } : { status: 'mismatch' };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MCP_ACQUISITION_REQUEST_MAX_BYTES) {
        await cancelReader(reader);
        return { status: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    await cancelReader(reader);
    return { status: 'invalid' };
  }

  if (totalBytes !== declaredLength) return { status: 'mismatch' };
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { status: 'ok', value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return { status: 'invalid' };
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginConsentRequest(request)) return errorResponse('origin_forbidden', 403);
  if (
    request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !==
    'application/json'
  ) {
    return errorResponse('content_type_unsupported', 415);
  }
  if (request.headers.has('transfer-encoding')) {
    return errorResponse('transfer_encoding_unsupported', 400);
  }

  const declaredLength = parseDeclaredContentLength(request);
  if (declaredLength.status === 'missing') return errorResponse('content_length_required', 411);
  if (declaredLength.status === 'invalid') return errorResponse('content_length_invalid', 400);
  if (declaredLength.status === 'too_large') return errorResponse('payload_too_large', 413);

  const rawBody = await readBoundedBody(request, declaredLength.value);
  if (rawBody.status === 'too_large') return errorResponse('payload_too_large', 413);
  if (rawBody.status === 'mismatch') return errorResponse('content_length_mismatch', 400);
  if (rawBody.status === 'invalid') return errorResponse('payload_invalid', 400);

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody.value);
  } catch {
    return errorResponse('payload_invalid', 400);
  }
  const acquisition = parseMcpAcquisitionRequest(parsedBody);
  if (!acquisition) return errorResponse('payload_invalid', 400);

  let secret: string;
  try {
    secret = resolveMcpAcquisitionSigningSecret();
  } catch {
    return errorResponse('acquisition_unavailable', 503);
  }

  const signed = createSignedMcpAcquisitionCookie(
    {
      source: acquisition.source,
      medium: acquisition.medium,
      campaign: acquisition.campaign,
      client: acquisition.client,
    },
    { secret },
  );
  const response = new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'private, no-store' },
  });
  response.cookies.set(
    MCP_ACQUISITION_COOKIE_NAME,
    signed.value,
    mcpAcquisitionCookieOptions(),
  );
  return response;
}
