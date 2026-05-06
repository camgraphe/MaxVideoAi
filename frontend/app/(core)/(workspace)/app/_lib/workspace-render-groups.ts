import type { QuadPreviewTile } from '@/components/QuadPreviewPanel';
import type { GroupMemberSummary, GroupSummary } from '@/types/groups';
import type { LocalRender, LocalRenderGroup } from './render-persistence';
import { resolveRenderThumb } from './render-persistence';

export type RemovedRenderRefs = {
  renders: LocalRender[];
  removedLocalKeys: string[];
  removedGroupIds: Set<string>;
  changed: boolean;
};

export function filterLocalRenders(
  renders: LocalRender[],
  shouldRemove: (render: LocalRender) => boolean
): RemovedRenderRefs {
  let changed = false;
  const removedLocalKeys: string[] = [];
  const removedGroupIds = new Set<string>();
  const next = renders.filter((render) => {
    if (!shouldRemove(render)) {
      return true;
    }
    changed = true;
    if (render.localKey) {
      removedLocalKeys.push(render.localKey);
    }
    if (render.batchId) {
      removedGroupIds.add(render.batchId);
    }
    if (render.groupId) {
      removedGroupIds.add(render.groupId);
    }
    return false;
  });
  return {
    renders: next,
    removedLocalKeys,
    removedGroupIds,
    changed,
  };
}

export function hasRemovedRenderRefs(refs: Pick<RemovedRenderRefs, 'removedLocalKeys' | 'removedGroupIds'>): boolean {
  return refs.removedLocalKeys.length > 0 || refs.removedGroupIds.size > 0;
}

export function pruneBatchHeroes(
  batchHeroes: Record<string, string>,
  removedGroupIds: Set<string>
): Record<string, string> {
  let changed = false;
  const next = { ...batchHeroes };
  removedGroupIds.forEach((groupId) => {
    if (groupId && next[groupId]) {
      delete next[groupId];
      changed = true;
    }
  });
  return changed ? next : batchHeroes;
}

export function clearRemovedGroupId(current: string | null, removedGroupIds: Set<string>): string | null {
  return current && removedGroupIds.has(current) ? null : current;
}

export function clearSelectedPreviewForRemovedRenders<
  T extends { id?: string; localKey?: string | null; batchId?: string | null } | null,
>(
  current: T,
  refs: Pick<RemovedRenderRefs, 'removedLocalKeys' | 'removedGroupIds'>,
  options?: { clearAudioPreview?: boolean }
): T | null {
  if (!current) return current;
  if (options?.clearAudioPreview && typeof current.id === 'string' && current.id.toLowerCase().startsWith('aud_')) {
    return null;
  }
  if (current.localKey && refs.removedLocalKeys.includes(current.localKey)) {
    return null;
  }
  if (current.batchId && refs.removedGroupIds.has(current.batchId)) {
    return null;
  }
  return current;
}

export function haveSameGroupOrder(a: GroupSummary[], b: GroupSummary[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index]?.id !== b[index]?.id) return false;
  }
  return true;
}

export function buildRenderGroups(renders: LocalRender[]): Map<string, LocalRenderGroup> {
  const map = new Map<string, LocalRenderGroup>();
  renders.forEach((item) => {
    const key = item.groupId ?? item.batchId ?? item.localKey;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      existing.readyCount += item.videoUrl ? 1 : 0;
      if (typeof item.priceCents === 'number') {
        existing.totalPriceCents = (existing.totalPriceCents ?? 0) + item.priceCents;
      }
      if (!existing.currency && item.currency) {
        existing.currency = item.currency;
      }
      if (!existing.groupId && item.groupId) {
        existing.groupId = item.groupId;
      }
    } else {
      map.set(key, {
        id: key,
        items: [item],
        iterationCount: item.iterationCount || 1,
        readyCount: item.videoUrl ? 1 : 0,
        totalPriceCents: typeof item.priceCents === 'number' ? item.priceCents : null,
        currency: item.currency,
        groupId: item.groupId ?? item.batchId ?? null,
      });
    }
  });
  map.forEach((group) => {
    group.items.sort((a, b) => a.iterationIndex - b.iterationIndex);
    if (!group.items.length) {
      group.iterationCount = 1;
      group.totalPriceCents = null;
      return;
    }
    const observedCount = Math.max(group.iterationCount, group.items.length);
    group.iterationCount = Math.max(1, Math.min(4, observedCount));
    if (group.totalPriceCents != null && group.iterationCount > group.items.length) {
      const average = group.totalPriceCents / group.items.length;
      group.totalPriceCents = Math.round(average * group.iterationCount);
    }
  });
  return map;
}

export function buildPendingGroupSummaries(
  renderGroups: Map<string, LocalRenderGroup>,
  batchHeroes: Record<string, string>
): GroupSummary[] {
  const summaries: GroupSummary[] = [];
  renderGroups.forEach((group, id) => {
    const now = Date.now();
    const members: GroupMemberSummary[] = group.items.map((item) => {
      const thumb = item.thumbUrl ?? resolveRenderThumb(item);
      const gatingActive = now < item.minReadyAt && item.status !== 'failed';
      const memberVideoUrl = gatingActive ? null : item.videoUrl ?? item.readyVideoUrl ?? null;
      const memberStatus: GroupMemberSummary['status'] = (() => {
        if (item.status === 'failed') return 'failed';
        if (gatingActive) return 'pending';
        if (item.status === 'completed' || memberVideoUrl) return 'completed';
        return 'pending';
      })();
      const memberProgress = typeof item.progress === 'number'
        ? gatingActive
          ? Math.min(Math.max(item.progress, 5), 95)
          : item.progress
        : memberStatus === 'completed'
          ? 100
          : item.progress;
      const member: GroupMemberSummary = {
        id: item.id,
        jobId: item.id,
        localKey: item.localKey,
        batchId: item.batchId,
        iterationIndex: item.iterationIndex,
        iterationCount: group.iterationCount,
        engineId: item.engineId,
        engineLabel: item.engineLabel,
        durationSec: item.durationSec,
        priceCents: item.priceCents ?? null,
        currency: item.currency ?? group.currency ?? null,
        thumbUrl: thumb,
        videoUrl: memberVideoUrl,
        previewVideoUrl: gatingActive ? null : item.previewVideoUrl ?? null,
        aspectRatio: item.aspectRatio ?? null,
        prompt: item.prompt,
        status: memberStatus,
        progress: memberProgress,
        message: item.message,
        etaLabel: item.etaLabel ?? null,
        etaSeconds: item.etaSeconds ?? null,
        createdAt: item.createdAt,
        source: 'render',
      };
      return member;
    });

    if (members.length === 0) return;

    const preferredHeroKey = batchHeroes[id] ?? group.items.find((item) => item.videoUrl)?.localKey ?? group.items[0]?.localKey;
    const hero = preferredHeroKey
      ? members.find((member) => member.localKey === preferredHeroKey) ?? members[0]
      : members[0];
    const observedCount = Math.max(group.iterationCount, members.length);
    const displayCount = Math.max(1, Math.min(4, observedCount));

    const previews = members
      .slice(0, displayCount)
      .map((member) => ({
        id: member.id,
        thumbUrl: member.thumbUrl,
        videoUrl: member.videoUrl,
        previewVideoUrl: member.previewVideoUrl,
        aspectRatio: member.aspectRatio,
      }));
    const batchKey = group.groupId ?? group.items[0]?.batchId ?? id;

    summaries.push({
      id,
      source: 'active',
      splitMode: displayCount > 1 ? 'quad' : 'single',
      batchId: batchKey,
      count: displayCount,
      totalPriceCents: group.totalPriceCents,
      currency: group.currency ?? hero.currency ?? null,
      createdAt: hero.createdAt,
      hero,
      previews,
      members,
    });
  });

  return summaries.sort((a, b) => {
    const timeA = Date.parse(a.createdAt);
    const timeB = Date.parse(b.createdAt);
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });
}

export function buildPendingSummaryMap(pendingGroups: GroupSummary[]): Map<string, GroupSummary> {
  const map = new Map<string, GroupSummary>();
  pendingGroups.forEach((group) => {
    map.set(group.id, group);
  });
  return map;
}

export function isGenerationGroupLoading(pendingGroups: GroupSummary[]): boolean {
  return pendingGroups.some((group) => group.members.some((member) => member.status !== 'completed'));
}

export function getGenerationSkeletonCount(renders: LocalRender[], iterations?: number | null): number {
  const count = renders.length > 0 ? renders.length : iterations ?? 1;
  return Math.max(1, Math.min(4, count || 1));
}

export function buildQuadTileFromRender(
  render: LocalRender,
  group: LocalRenderGroup,
  fallbackCurrency: string
): QuadPreviewTile {
  const gatingActive = render.status !== 'failed' && Date.now() < render.minReadyAt;
  const videoUrl = gatingActive ? undefined : render.videoUrl ?? render.readyVideoUrl;
  const previewVideoUrl = gatingActive ? undefined : render.previewVideoUrl;
  const progress = gatingActive
    ? Math.min(Math.max(render.progress ?? 5, 95), 95)
    : videoUrl
      ? 100
      : render.progress;
  const status: QuadPreviewTile['status'] =
    render.status === 'failed'
      ? 'failed'
      : gatingActive
        ? 'pending'
        : videoUrl
          ? 'completed'
          : render.status ?? 'pending';

  return {
    localKey: render.localKey,
    batchId: render.batchId,
    id: render.id,
    jobId: render.jobId,
    iterationIndex: render.iterationIndex,
    iterationCount: group.iterationCount,
    videoUrl,
    previewVideoUrl,
    thumbUrl: render.thumbUrl,
    aspectRatio: render.aspectRatio,
    progress,
    message: render.message,
    priceCents: render.priceCents,
    currency: render.currency ?? group.currency ?? fallbackCurrency,
    durationSec: render.durationSec,
    engineLabel: render.engineLabel,
    engineId: render.engineId,
    etaLabel: render.etaLabel,
    prompt: render.prompt,
    status,
    hasAudio: typeof render.hasAudio === 'boolean' ? render.hasAudio : undefined,
  };
}

export function buildQuadTileFromGroupMember(
  group: GroupSummary,
  member: GroupMemberSummary,
  fallbackEngineId: string
): QuadPreviewTile {
  return {
    localKey: member.localKey ?? member.id,
    batchId: member.batchId ?? group.id,
    id: member.jobId ?? member.id,
    jobId: member.jobId ?? undefined,
    iterationIndex: member.iterationIndex ?? 0,
    iterationCount: member.iterationCount ?? group.count,
    videoUrl: member.videoUrl ?? undefined,
    previewVideoUrl: member.previewVideoUrl ?? undefined,
    thumbUrl: member.thumbUrl ?? undefined,
    aspectRatio: member.aspectRatio ?? '16:9',
    progress: typeof member.progress === 'number' ? member.progress : member.status === 'completed' ? 100 : 0,
    message: member.message ?? '',
    priceCents: member.priceCents ?? undefined,
    currency: member.currency ?? undefined,
    durationSec: member.durationSec,
    engineLabel: member.engineLabel,
    engineId: member.engineId ?? fallbackEngineId,
    etaLabel: member.etaLabel ?? undefined,
    prompt: member.prompt ?? '',
    status: member.status ?? 'completed',
    hasAudio: typeof member.job?.hasAudio === 'boolean' ? member.job.hasAudio : undefined,
  };
}
