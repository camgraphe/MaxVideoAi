export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { countUsedFreeTimelineExports } from '@/server/timeline-exports/repository';
import {
  parseTimelineExportRequest,
  resolveTimelineExportFps,
  resolveTimelineExportResolution,
} from '@/server/timeline-exports/render-request';
import { estimateTimelineExportPrice, resolveTimelineExportQuota } from '@/server/timeline-exports/pricing';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const payload = await req.json().catch(() => null);

  try {
    const request = parseTimelineExportRequest(payload?.request ?? payload);
    const quota = resolveTimelineExportQuota({
      usedFreeExports: await countUsedFreeTimelineExports(userId),
    });
    const estimate = estimateTimelineExportPrice({
      durationSec: request.manifest.durationSec,
      resolution: resolveTimelineExportResolution(request),
      fps: resolveTimelineExportFps(request),
      qualityPreset: request.exportSettings.qualityPreset,
      freeExportsRemaining: quota.freeExportsRemaining,
    });
    return json({ ok: true, quota, estimate });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : 'ESTIMATE_FAILED' },
      { status: 400 }
    );
  }
}
