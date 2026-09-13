import { NextRequest, NextResponse } from 'next/server';
import { readMediaFacts } from '@/lib/media-identity';
import { extractStoryboardGeneratorDraftFromPrompt } from '@/lib/storyboard-generator-handoff';
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

function buildRecentOutputStoryboardHandoff(output: JobOutputRecord) {
  if (!output.jobPrompt) return null;
  return extractStoryboardGeneratorDraftFromPrompt(output.jobPrompt, {
    durationSec: output.jobDurationSec ?? output.durationSec,
    aspectRatio: output.jobAspectRatio,
    width: output.width,
    height: output.height,
  });
}

function buildRecentOutputImage(output: JobOutputRecord | null | undefined) {
  if (!output?.url) return null;
  return {
    id: output.id,
    jobId: output.jobId,
    url: output.url,
    thumbUrl: output.thumbUrl,
    previewUrl: output.previewUrl,
    mime: output.mimeType,
    width: output.width,
    height: output.height,
    createdAt: output.createdAt,
  };
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
    });
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
      });
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
