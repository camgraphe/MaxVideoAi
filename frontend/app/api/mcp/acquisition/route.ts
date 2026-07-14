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

function contentLengthIsTooLarge(request: Request): boolean {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > MCP_ACQUISITION_REQUEST_MAX_BYTES;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginConsentRequest(request)) return errorResponse('origin_forbidden', 403);
  if (
    request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !==
    'application/json'
  ) {
    return errorResponse('content_type_unsupported', 415);
  }
  if (contentLengthIsTooLarge(request)) return errorResponse('payload_too_large', 413);

  const rawBody = await request.text().catch(() => null);
  if (
    rawBody === null ||
    new TextEncoder().encode(rawBody).byteLength > MCP_ACQUISITION_REQUEST_MAX_BYTES
  ) {
    return errorResponse('payload_too_large', 413);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
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
