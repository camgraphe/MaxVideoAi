import { NextResponse } from 'next/server';

import review from '@/config/openai-review-environment.json';
import { getMcpRequestHost, isMcpApiHost } from '@/lib/mcp-host-routing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_PROJECT_ID = 'prj_CA8KpDAwYzihVJZyDNnEUrDszaMu';

// Domain proof is public; it grants no MCP/account access. It is intentionally
// independent of tool enablement so a closed candidate can verify its domain.
export function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  const host = getMcpRequestHost(request.headers);
  const token = process.env.MCP_OPENAI_DOMAIN_VERIFICATION_TOKEN ?? '';
  const dedicated = process.env.VERCEL_PROJECT_ID === review.projectId
    && process.env.MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE === review.profile;
  const sharedProduction = process.env.VERCEL_PROJECT_ID === PUBLIC_PROJECT_ID
    && process.env.MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE === 'shared-production';
  if ((!dedicated && !sharedProduction)
    || !host || !isMcpApiHost(host, new URL(review.directoryOrigin).host)
    || !/^[A-Za-z0-9_-]{16,512}$/.test(token)) {
    return new NextResponse(null, { status: 404, headers });
  }
  return new NextResponse(token, {
    headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
