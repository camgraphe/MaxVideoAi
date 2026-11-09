import { imageDisplayFields } from '@/lib/image-display';
import { NextRequest, NextResponse } from 'next/server';
import { readMediaFacts } from '@/lib/media-identity';
import {buildRecentOutputStoryboardHandoff,buildRecentOutputImage} from '@/server/media-library/output-handoff';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import {
  listRecentOutputPage,
  listStoryboardKlingFirstFrameOutputs,
  type JobOutputRecord,
  type MediaKind,
} from '@/server/media-library';
import { parseMediaLibraryExactJobId } from '@/server/media-library/pagination';

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

  let page: Awaited<ReturnType<typeof listRecentOutputPage>>;
  const surface = req.nextUrl.searchParams.get('surface');
  const exactJob = parseMediaLibraryExactJobId(req.nextUrl.searchParams.get('jobId'));
  if ('error' in exactJob) {
    return NextResponse.json({ ok: false, outputs: [], error: exactJob.error }, { status: 400 });
  }
  try {
    page = await listRecentOutputPage({
      userId,
      kind: normalizeKind(req.nextUrl.searchParams.get('kind')),
      surface,
      limit: Number(req.nextUrl.searchParams.get('limit') ?? 50),
      cursor: req.nextUrl.searchParams.get('cursor'),
      q: req.nextUrl.searchParams.get('q'),
      jobId: exactJob.value,
    }, { ensureSchema: false });
  } catch (error) {
    console.error('[media-library] failed to list recent outputs', error);
    return NextResponse.json({ ok: false, outputs: [], error: 'LOAD_FAILED' }, { status: 500 });
  }

  let klingFirstFramesByParentJobId = new Map<string, JobOutputRecord>();
  if (surface === 'storyboard' && page.items.length) {
    try {
      klingFirstFramesByParentJobId = await listStoryboardKlingFirstFrameOutputs({
        userId,
        parentJobIds: page.items.map((output) => output.jobId),
      }, { ensureSchema: false });
    } catch (error) {
      console.error('[media-library] failed to list storyboard first frames', error);
    }
  }

  return NextResponse.json({
    ok: true,
    outputs: page.items.map((output) => ({
      id: output.id,
      ref: { type: 'job-output', jobId: output.jobId, outputId: output.id, kind: output.kind },
      mediaFacts: readMediaFacts(output.metadata.mediaFacts),
      jobId: output.jobId,
      url: output.url,
      thumbUrl: output.thumbUrl,
      previewUrl: output.previewUrl,
      ...(output.kind === 'image' ? imageDisplayFields(output.metadata.imageDisplay, output.url, output.previewUrl) : {}),
      playbackVideoUrl: typeof output.metadata.playbackVideoUrl === 'string' ? output.metadata.playbackVideoUrl : undefined,
      role: output.metadata.role === 'last_frame' ? 'last_frame' : undefined,
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
      klingFirstFrame:
        surface === 'storyboard' ? buildRecentOutputImage(klingFirstFramesByParentJobId.get(output.jobId)) : null,
    })),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  });
}
