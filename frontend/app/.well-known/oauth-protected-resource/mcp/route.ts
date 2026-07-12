import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { getMcpRequestHost } from '@/lib/mcp-host-routing';
import { resolveMcpConfig } from '@/server/mcp/config';
import { isMcpFoundationFeatureEnabled } from '@/server/mcp/feature-access';
import { buildProtectedResourceMetadata } from '@/server/mcp/oauth-resource-metadata';

export const runtime = 'nodejs';

export function GET(request: Request) {
  const requestHost = getMcpRequestHost(request.headers);
  if (!isMcpFoundationFeatureEnabled('discovery', process.env, requestHost)) {
    return new NextResponse(null, {
      status: 404,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  try {
    const config = resolveMcpConfig();
    if (!ENV.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('Supabase URL is not configured.');
    }
    const metadata = buildProtectedResourceMetadata({
      resourceUrl: config.resourceUrl,
      supabaseUrl: ENV.NEXT_PUBLIC_SUPABASE_URL,
    });
    return NextResponse.json(metadata, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return NextResponse.json(
      { error: 'oauth_discovery_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
