import { NextRequest, NextResponse } from 'next/server';

import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { resolveMcpRuntimeCapabilities } from '@/server/mcp/operational-access';
import { isSameOriginConsentRequest } from '@/server/mcp/oauth-consent';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!resolveMcpRuntimeCapabilities(
    process.env,
    getMcpRequestHost(request.headers),
  ).referenceUploads) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
  if (!isSameOriginConsentRequest(request)) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  const { userId } = await getRouteAuthContext(request);
  if (!userId) return NextResponse.json({ ok: false, error: 'AUTH_REQUIRED' }, { status: 401 });
  return NextResponse.json({ ok: false, error: 'DIRECT_UPLOAD_REQUIRED' }, { status: 410 });
}
