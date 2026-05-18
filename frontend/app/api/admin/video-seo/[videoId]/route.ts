import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { isStablePublicMediaUrl } from '@/lib/media';
import { buildExpectedVideoCanonicalUrl } from '@/lib/video-seo-canonical';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { getSeoVideoById } from '@/server/videos';
import {
  listVideoSeoEditorialEntries,
  normalizeVideoSeoEditorialInput,
  upsertVideoSeoEditorialEntry,
  validateVideoSeoEditorialUpdatePayload,
} from '@/server/video-seo-editorial';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    videoId: string;
  }>;
};

export async function PUT(req: NextRequest, props: RouteParams) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let adminUserId: string;
  try {
    adminUserId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const params = await props.params;
  const videoId = params.videoId?.trim();
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const video = await getSeoVideoById(videoId);
    const entries = await listVideoSeoEditorialEntries();
    const fallback = entries.find((entry) => entry.id === videoId) ?? null;
    const stableVideoAsset = isStablePublicMediaUrl(video?.videoUrl);
    const stableThumbnailAsset = isStablePublicMediaUrl(video?.thumbUrl);
    const editablePayload = payload as Parameters<typeof normalizeVideoSeoEditorialInput>[1];
    const hasInternalLinkTargets = validationTargetHasInternalLinks(payload as Record<string, unknown>);
    const provisionalEntry = normalizeVideoSeoEditorialInput(videoId, editablePayload, fallback);
    const canonicalUrl = buildExpectedVideoCanonicalUrl(videoId, provisionalEntry.canonicalSlug);
    const canonicalTargetIndexable = Boolean(
      video?.videoUrl &&
        video?.thumbUrl &&
        video?.visibility === 'public' &&
        video?.indexable &&
        stableVideoAsset &&
        stableThumbnailAsset &&
        hasInternalLinkTargets
    );
    const validation = validateVideoSeoEditorialUpdatePayload({
      videoId,
      payload,
      fallback,
      otherEntries: entries,
      qaContext: {
        promptText: video?.prompt,
        hasVideoAsset: Boolean(video?.videoUrl),
        hasThumbnailAsset: Boolean(video?.thumbUrl),
        hasStableVideoAsset: stableVideoAsset,
        hasStableThumbnailAsset: stableThumbnailAsset,
        hasInternalLinkTargets,
        canonicalUrl,
        expectedCanonicalUrl: canonicalUrl,
        canonicalTargetIndexable,
        technicallyIndexable: Boolean(video?.videoUrl && video?.thumbUrl && video?.visibility === 'public' && video?.indexable),
      },
    });
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error, qa: validation.qa }, { status: 400 });
    }

    const editorial = await upsertVideoSeoEditorialEntry(
      validation.entry,
      adminUserId,
      typeof payload.notes === 'string' ? payload.notes : null
    );

    return NextResponse.json({ ok: true, editorial, qa: validation.qa });
  } catch (error) {
    console.error('[api/admin/video-seo/:videoId] failed to save page', error);
    const message = error instanceof Error ? error.message : 'Failed to save video SEO page';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

function validationTargetHasInternalLinks(payload: Record<string, unknown>): boolean {
  return (
    typeof payload.modelSlug === 'string' &&
    payload.modelSlug.trim().length > 0 &&
    typeof payload.examplesSlug === 'string' &&
    payload.examplesSlug.trim().length > 0
  );
}
