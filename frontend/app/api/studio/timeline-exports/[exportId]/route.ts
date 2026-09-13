export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { resolveStudioRouteContext } from '../../_lib/studio-route-utils';
import { readTimelineExportJob, timelineExportJobResponse } from '@/server/timeline-exports/repository';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(req: NextRequest, props: { params: Promise<{ exportId: string }> }) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;
  const { userId } = context;
  const { exportId } = await props.params;
  const job = await readTimelineExportJob({ userId, exportId });
  if (!job) return json({ ok: false, error: 'EXPORT_NOT_FOUND' }, { status: 404 });
  return json({ ok: true, export: timelineExportJobResponse(job) });
}
