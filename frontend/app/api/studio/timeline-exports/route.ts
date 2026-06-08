export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { createTimelineExportJobWithReservation } from '@/server/timeline-exports/billing';
import {
  parseTimelineExportRequest,
  resolveTimelineExportFps,
  resolveTimelineExportResolution,
} from '@/server/timeline-exports/render-request';

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
    const projectName = request.manifest.projectName || 'MaxVideoAI Export';
    const resolution = resolveTimelineExportResolution(request);
    const fps = resolveTimelineExportFps(request);
    const pricingSnapshot = {
      source: 'timeline_export',
      durationSec: request.manifest.durationSec,
      resolution,
      fps,
      qualityPreset: request.exportSettings.qualityPreset,
    };
    const result = await createTimelineExportJobWithReservation({
      userId,
      idempotencyKey: request.idempotencyKey,
      projectName,
      durationSec: request.manifest.durationSec,
      resolution,
      fps,
      qualityPreset: request.exportSettings.qualityPreset,
      pricingSnapshot,
      renderManifest: request.manifest,
      exportSettings: request.exportSettings,
    });
    return json({ ok: true, export: result.job, billing: result.billing, reused: result.reused });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EXPORT_CREATE_FAILED';
    const status = message === 'INSUFFICIENT_WALLET_BALANCE' ? 402 : 400;
    return json({ ok: false, error: message }, { status });
  }
}
