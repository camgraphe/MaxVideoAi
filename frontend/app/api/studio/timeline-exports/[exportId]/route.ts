export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { readTimelineExportJob } from '@/server/timeline-exports/repository';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(req: NextRequest, props: { params: Promise<{ exportId: string }> }) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const { exportId } = await props.params;
  const job = await readTimelineExportJob({ userId, exportId });
  if (!job) return json({ ok: false, error: 'EXPORT_NOT_FOUND' }, { status: 404 });
  return json({ ok: true, export: job });
}
