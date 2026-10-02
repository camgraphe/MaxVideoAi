export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { resolveStudioRouteContext } from '../_lib/studio-route-utils';
import { submitOwnedTimelineExport } from '@/server/timeline-exports/orchestration';

export async function POST(req: NextRequest) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;
  const payload = await req.json().catch(() => null);
  const result = await submitOwnedTimelineExport({
    userId: context.userId,
    requestOrigin: req.nextUrl.origin,
    rawRequest: payload?.request ?? payload,
    estimateToken: payload?.estimateToken,
  });
  const response = NextResponse.json(result.body, { status: result.status });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
