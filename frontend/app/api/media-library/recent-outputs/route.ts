import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { listRecentOutputs, type MediaKind } from '@/server/media-library';

export const runtime = 'nodejs';

function normalizeKind(value: string | null): MediaKind | null {
  if (value === 'image' || value === 'video' || value === 'audio') return value;
  return null;
}

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, outputs: [], error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const outputs = await listRecentOutputs({
    userId,
    kind: normalizeKind(req.nextUrl.searchParams.get('kind')),
    surface: req.nextUrl.searchParams.get('surface'),
    limit: Number(req.nextUrl.searchParams.get('limit') ?? 50),
  });

  return NextResponse.json({
    ok: true,
    outputs: outputs.map((output) => ({
      id: output.id,
      jobId: output.jobId,
      url: output.url,
      thumbUrl: output.thumbUrl,
      mime: output.mimeType,
      width: output.width,
      height: output.height,
      durationSec: output.durationSec,
      kind: output.kind,
      position: output.position,
      status: output.status,
      createdAt: output.createdAt,
    })),
  });
}
