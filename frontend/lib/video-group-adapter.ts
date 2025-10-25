import type { GroupSummary, GroupMemberSummary } from '@/types/groups';
import { normalizeMediaUrl } from '@/lib/media';
import type { ResultProvider, VideoGroup, VideoGroupLayout, VideoItem, VideoAspect } from '@/types/video-groups';

const FALLBACK_ASPECT: VideoAspect = '16:9';

function normalizeAspect(aspectRatio?: string | null): { aspect: VideoAspect; original?: string | null } {
  if (!aspectRatio) {
    return { aspect: FALLBACK_ASPECT };
  }
  const normalized = aspectRatio.trim().replace(/\s+/g, '').replace('/', ':');
  if (normalized === '16:9' || normalized === '1:1' || normalized === '9:16') {
    return { aspect: normalized as VideoAspect };
  }
  if (normalized === '9:21' || normalized === '4:5' || normalized === '3:4' || normalized === '5:4' || normalized === '21:9') {
    return { aspect: FALLBACK_ASPECT, original: aspectRatio };
  }
  return { aspect: FALLBACK_ASPECT, original: aspectRatio };
}

function resolveLayout(group: GroupSummary): VideoGroupLayout {
  const count = Math.max(1, Math.min(4, group.count || group.members.length || 1));
  switch (count) {
    case 1:
      return 'x1';
    case 2:
      return 'x2';
    case 3:
      return 'x3';
    default:
      return 'x4';
  }
}

function toVideoItem(member: GroupMemberSummary): VideoItem {
  const videoUrl = normalizeMediaUrl(member.videoUrl) ?? undefined;
  const thumb = normalizeMediaUrl(member.thumbUrl) ?? undefined;
  const { aspect, original } = normalizeAspect(member.aspectRatio);

  const meta: Record<string, unknown> = {};
  if (original && original !== aspect) {
    meta.originalAspectRatio = original;
  }
  if (member.prompt) {
    meta.prompt = member.prompt;
  }
  if (typeof member.progress === 'number') {
    meta.progress = member.progress;
  }
  if (member.message) {
    meta.message = member.message;
  }
  if (member.etaLabel) {
    meta.etaLabel = member.etaLabel;
  }
  if (typeof member.etaSeconds === 'number') {
    meta.etaSeconds = member.etaSeconds;
  }
  if (member.source) {
    meta.source = member.source;
  }
  if (member.currency) {
    meta.currency = member.currency;
  }
  if (videoUrl) {
    meta.mediaType = 'video';
  } else if (thumb) {
    meta.mediaType = 'image';
  }
  if (member.status) {
    meta.status = member.status;
  }
  if (member.jobId) {
    meta.jobId = member.jobId;
  }
  if (typeof member.job?.indexable === 'boolean') {
    meta.indexable = member.job.indexable;
  }
  if (member.job?.visibility) {
    meta.visibility = member.job.visibility;
  }
  if (typeof member.job?.hasAudio === 'boolean') {
    meta.hasAudio = member.job.hasAudio;
  }

  const visibility = member.job?.visibility === 'public' ? 'public' : member.job?.visibility === 'private' ? 'private' : undefined;
  const indexable =
    typeof member.job?.indexable === 'boolean'
      ? member.job.indexable
      : typeof member.job?.visibility === 'string' && member.job.visibility === 'private'
        ? false
        : undefined;

  return {
    id: member.id,
    url: videoUrl ?? thumb ?? '',
    aspect,
    thumb,
    jobId: member.jobId ?? member.id,
    durationSec: member.durationSec,
    engineId: member.engineId,
    costCents: typeof member.priceCents === 'number' ? member.priceCents : undefined,
    meta: Object.keys(meta).length ? meta : undefined,
    indexable,
    visibility,
    hasAudio: typeof member.job?.hasAudio === 'boolean' ? member.job.hasAudio : undefined,
  };
}

export function adaptGroupSummary(
  group: GroupSummary,
  provider: ResultProvider,
  overrides?: Partial<Pick<VideoGroup, 'status' | 'errorMsg' | 'items' | 'layout'>>
): VideoGroup {
  const layout = overrides?.layout ?? resolveLayout(group);
  let items = overrides?.items ?? group.members.slice(0, 4).map(toVideoItem);
  const previewMap = new Map<string, { videoUrl?: string | null; thumbUrl?: string | null }>();
  group.previews.forEach((preview) => {
    if (!preview || typeof preview.id !== 'string') return;
    previewMap.set(preview.id, {
      videoUrl: normalizeMediaUrl(preview.videoUrl ?? undefined) ?? undefined,
      thumbUrl: normalizeMediaUrl(preview.thumbUrl ?? undefined) ?? undefined,
    });
  });
  items = items.map((item) => {
    const preview = previewMap.get(item.id);
    if (!preview) return item;
    const meta = { ...(item.meta ?? {}) };
    if (preview.videoUrl) {
      meta.mediaType = 'video';
    }
    if (!preview.videoUrl && preview.thumbUrl && !meta.mediaType) {
      meta.mediaType = 'image';
    }
    return {
      ...item,
      url: preview.videoUrl ?? item.url,
      thumb: preview.thumbUrl ?? item.thumb,
      meta: Object.keys(meta).length ? meta : item.meta,
    };
  });
  const hero = group.hero;
  const paramsSnapshot: Record<string, unknown> = {
    engineId: hero.engineId,
    engineLabel: hero.engineLabel,
    prompt: hero.prompt,
    durationSec: hero.durationSec,
    aspectRatio: hero.aspectRatio,
    iterationCount: hero.iterationCount,
    priceCents: hero.priceCents,
    currency: hero.currency,
  };
  if (hero.job) {
    paramsSnapshot.jobId = hero.job.jobId;
    paramsSnapshot.createdAt = hero.job.createdAt;
  }

  const totalCost = typeof group.totalPriceCents === 'number' ? group.totalPriceCents : hero.priceCents;
  const currency = group.currency ?? hero.currency ?? undefined;
  const meta: Record<string, unknown> = {};
  if (group.splitMode) meta.splitMode = group.splitMode;
  if (group.batchId) meta.batchId = group.batchId;

  const memberStatuses = group.members.map((member) => {
    if (member.status === 'failed') return 'failed';
    if (member.status === 'pending') return 'pending';
    if (member.status === 'completed') return 'completed';
    if (member.videoUrl) return 'completed';
    return 'pending';
  });

  let computedStatus: VideoGroup['status'];
  if (overrides?.status) {
    computedStatus = overrides.status;
  } else if (memberStatuses.includes('failed')) {
    computedStatus = 'error';
  } else if (memberStatuses.includes('pending')) {
    computedStatus = 'loading';
  } else {
    computedStatus = 'ready';
  }

  const errorMsg =
    overrides?.errorMsg ??
    (computedStatus === 'error' ? hero.message ?? hero.job?.message ?? 'Generation failed' : undefined);

  return {
    id: group.id,
    items,
    layout,
    createdAt: group.createdAt,
    provider,
    paramsSnapshot,
    totalCostCents: typeof totalCost === 'number' ? totalCost : undefined,
    currency,
    heroItemId: hero.id,
    meta: Object.keys(meta).length ? meta : undefined,
    status: computedStatus,
    errorMsg,
  };
}

export function adaptGroupSummaries(groups: GroupSummary[], provider: ResultProvider): VideoGroup[] {
  return groups.map((group) => adaptGroupSummary(group, provider));
}
