import { NextRequest, NextResponse } from 'next/server';
import { extractStoryboardGeneratorDraftFromPrompt } from '@/lib/storyboard-generator-handoff';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { listRecentOutputs, type JobOutputRecord, type MediaKind } from '@/server/media-library';

export const runtime = 'nodejs';

function normalizeKind(value: string | null): MediaKind | null {
  if (value === 'image' || value === 'video' || value === 'audio') return value;
  return null;
}

function buildRecentOutputStoryboardHandoff(output: JobOutputRecord) {
  if (!output.jobPrompt) return null;
  return extractStoryboardGeneratorDraftFromPrompt(output.jobPrompt, {
    durationSec: output.jobDurationSec ?? output.durationSec,
    aspectRatio: output.jobAspectRatio,
    width: output.width,
    height: output.height,
  });
}

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, outputs: [], error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let outputs: Awaited<ReturnType<typeof listRecentOutputs>>;
  const surface = req.nextUrl.searchParams.get('surface');
  try {
    outputs = await listRecentOutputs({
      userId,
      kind: normalizeKind(req.nextUrl.searchParams.get('kind')),
      surface,
      limit: Number(req.nextUrl.searchParams.get('limit') ?? 50),
    });
  } catch (error) {
    console.error('[media-library] failed to list recent outputs', error);
    return NextResponse.json({ ok: false, outputs: [], error: 'LOAD_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    outputs: outputs.map((output) => ({
      id: output.id,
      jobId: output.jobId,
      url: output.url,
      thumbUrl: output.thumbUrl,
      previewUrl: output.previewUrl,
      mime: output.mimeType,
      width: output.width,
      height: output.height,
      durationSec: output.durationSec,
      kind: output.kind,
      position: output.position,
      status: output.status,
      createdAt: output.createdAt,
      isSaved: Boolean(output.isSaved),
      savedAssetId: output.savedAssetId ?? null,
      storyboard: surface === 'storyboard' ? buildRecentOutputStoryboardHandoff(output) : null,
    })),
  });
}
