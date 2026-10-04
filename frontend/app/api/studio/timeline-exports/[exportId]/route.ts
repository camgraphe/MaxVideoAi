export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { resolveStudioRouteContext } from '../../_lib/studio-route-utils';
import { readOwnedTimelineExportStatus } from '@/server/timeline-exports/orchestration';

export async function GET(req: NextRequest, props: { params: Promise<{ exportId: string }> }) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;
  const { exportId } = await props.params;
  const result = await readOwnedTimelineExportStatus({ userId: context.userId, exportId });
  const response = NextResponse.json(result.body, { status: result.status });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
