import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { isStablePublicMediaUrl } from '@/lib/media';
import { buildExpectedVideoCanonicalUrl } from '@/lib/video-seo-canonical';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { getSeoVideoById, type GalleryVideo } from '@/server/videos';
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
        ...buildVisualQaContext(video, provisionalEntry.intent),
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function buildVisualQaContext(video: GalleryVideo | null, intent: string) {
  const raw = asRecord(video?.settingsSnapshot);
  const core = asRecord(raw?.core);
  const advanced = asRecord(raw?.advanced);
  const refs = asRecord(raw?.refs);
  const inputMode = asString(raw?.inputMode);
  const referenceImageCount = asArray(refs?.referenceImages).map(asString).filter(Boolean).length;
  const hasVisualReferenceAsset = Boolean(
    asString(refs?.imageUrl) ||
      asString(refs?.firstFrameUrl) ||
      asString(refs?.lastFrameUrl) ||
      asString(refs?.endImageUrl) ||
      referenceImageCount > 0
  );
  const isVisualReferenceWorkflow =
    intent === 'image-to-video' ||
    ['i2v', 'r2v', 'fl2v', 'ref2v', 'image-to-video', 'reference-to-video'].includes(inputMode ?? '') ||
    hasVisualReferenceAsset;

  return {
    isVisualReferenceWorkflow,
    hasVisualReferenceAsset,
    hasAudio: Boolean(video?.hasAudio || asBoolean(core?.audio) || asString(refs?.audioUrl)),
    hasMultiShot: asArray(advanced?.multiPrompt).filter((entry) => Boolean(asRecord(entry)?.prompt)).length > 1,
  };
}
