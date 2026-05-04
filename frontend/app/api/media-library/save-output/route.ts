import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { saveJobOutputToLibrary } from '@/server/media-library';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as { jobId?: unknown; outputId?: unknown } | null;
  const jobId = typeof payload?.jobId === 'string' ? payload.jobId.trim() : '';
  const outputId = typeof payload?.outputId === 'string' ? payload.outputId.trim() : '';
  if (!jobId || !outputId) {
    return NextResponse.json({ ok: false, error: 'JOB_OUTPUT_REQUIRED' }, { status: 400 });
  }

  try {
    const asset = await saveJobOutputToLibrary({ userId, jobId, outputId });
    return NextResponse.json({
      ok: true,
      asset: {
        id: asset.id,
        url: asset.url,
        thumbUrl: asset.thumbUrl,
        previewUrl: asset.previewUrl,
        width: asset.width,
        height: asset.height,
        mime: asset.mimeType,
        size: asset.sizeBytes,
        source: asset.source,
        jobId: asset.sourceJobId,
        sourceOutputId: asset.sourceOutputId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SAVE_FAILED';
    const status = message === 'OUTPUT_NOT_FOUND' ? 404 : 422;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
