import { normalizeMediaUrl } from '@/lib/media';
import { getPlaceholderMedia } from '@/lib/placeholderMedia';
import type { Job } from '@/types/jobs';
import type { GroupSummary, GroupMemberSummary } from '@/types/groups';

interface GroupBucket {
  key: string;
  jobs: Job[];
  iterationCountHint: number;
  splitMode: string | null;
  batchId: string | null;
}

function resolveGroupKey(job: Job, iterationCountHint: number): string | null {
  if (job.groupId) return job.groupId;
  if (job.batchId) return job.batchId;
  if (iterationCountHint > 1 && Array.isArray(job.renderIds) && job.renderIds.length > 1) {
    return job.renderIds.filter(Boolean).sort().join(':');
  }
  return null;
}

function shouldGroup(job: Job, iterationCountHint: number): boolean {
  if (job.groupId) return true;
  if (iterationCountHint > 1) return true;
  if (typeof job.splitMode === 'string') {
    return job.splitMode.toLowerCase() !== 'single';
  }
  return false;
}

function buildMember(job: Job): GroupMemberSummary {
  const placeholder = getPlaceholderMedia(job.jobId);
  const thumbUrl = normalizeMediaUrl(job.thumbUrl) ?? placeholder.posterUrl;
  const videoUrl = normalizeMediaUrl(job.videoUrl) ?? placeholder.videoUrl;
  const aspectRatio = job.aspectRatio ?? placeholder.aspectRatio;
  const priceCents = job.finalPriceCents ?? job.pricingSnapshot?.totalCents ?? null;
  const currency = job.currency ?? job.pricingSnapshot?.currency ?? null;
  const iterationCount = job.iterationCount ?? (Array.isArray(job.renderIds) ? job.renderIds.length : null) ?? null;
  const statusRaw = (job.status ?? '').toLowerCase();
  let status: GroupMemberSummary['status'] = 'completed';
  if (statusRaw === 'failed') {
    status = 'failed';
  } else if (
    statusRaw === 'pending' ||
    statusRaw === 'queued' ||
    statusRaw === 'running' ||
    statusRaw === 'processing' ||
    (!videoUrl && statusRaw !== 'completed')
  ) {
    status = 'pending';
  } else if (!videoUrl) {
    status = 'pending';
  }

  return {
    id: job.jobId,
    jobId: job.jobId,
    batchId: job.batchId ?? job.groupId ?? null,
    localKey: job.localKey ?? undefined,
    iterationIndex: typeof job.iterationIndex === 'number' ? job.iterationIndex : null,
    iterationCount,
    engineId: job.engineId,
    engineLabel: job.engineLabel,
    durationSec: job.durationSec,
    priceCents,
    currency,
    thumbUrl,
    videoUrl,
    aspectRatio,
    prompt: job.prompt,
    status,
    progress:
      typeof job.progress === 'number'
        ? job.progress
        : status === 'completed'
          ? 100
          : job.videoUrl
            ? 100
            : 0,
    message: job.message ?? null,
    etaLabel: job.etaLabel ?? null,
    etaSeconds: job.etaSeconds ?? null,
    createdAt: job.createdAt,
    source: 'job',
    job,
  };
}

function pickHero(bucket: GroupBucket, members: GroupMemberSummary[]): GroupMemberSummary {
  const byId = new Map<string, Job>();
  bucket.jobs.forEach((job) => {
    byId.set(job.jobId, job);
  });

  const preferHeroId = bucket.jobs.find((job) => job.heroRenderId)?.heroRenderId ?? null;

  if (preferHeroId) {
    const preferred = members.find((member) => member.id === preferHeroId);
    if (preferred) return preferred;
  }

  const byIteration = members.find((member) => member.iterationIndex === 0);
  if (byIteration) return byIteration;

  const withVideo = members.find((member) => Boolean(member.videoUrl));
  if (withVideo) return withVideo;

  return members[0];
}

function buildSingleGroup(job: Job): GroupSummary {
  const member = buildMember(job);
  const placeholder = getPlaceholderMedia(job.jobId);
  const thumb = member.thumbUrl ?? placeholder.posterUrl;
  const video = member.videoUrl ?? placeholder.videoUrl;
  const aspect = member.aspectRatio ?? placeholder.aspectRatio;
  const priceCents = typeof member.priceCents === 'number' ? member.priceCents : null;
  const currency = member.currency ?? null;
  const createdAt = member.createdAt ?? job.createdAt;
  const groupId = job.batchId ?? job.groupId ?? job.jobId;
  const iterationCount =
    typeof member.iterationCount === 'number'
      ? member.iterationCount
      : typeof job.iterationCount === 'number'
        ? job.iterationCount
        : Array.isArray(job.renderIds)
          ? job.renderIds.filter(Boolean).length
          : 1;
  const count = Math.max(1, Math.min(4, iterationCount || 1));
  const splitMode = count > 1 ? 'quad' : 'single';

  return {
    id: groupId,
    source: 'history',
    splitMode,
    batchId: job.batchId ?? job.groupId ?? null,
    count,
    totalPriceCents: priceCents,
    currency,
    createdAt,
    hero: member,
    previews: [
      {
        id: member.id,
        thumbUrl: thumb,
        videoUrl: video,
        aspectRatio: aspect,
      },
    ],
    members: [member],
  };
}

interface GroupSummaryOptions {
  includeSinglesAsGroups?: boolean;
}

export function groupJobsIntoSummaries(
  jobs: Job[],
  options: GroupSummaryOptions = {}
): { groups: GroupSummary[]; ungrouped: Job[] } {
  const includeSinglesAsGroups = Boolean(options.includeSinglesAsGroups);
  const buckets = new Map<string, GroupBucket>();
  let singles: Job[] = [];

  for (const job of jobs) {
    const iterationCountHint = Math.max(
      job.iterationCount ?? 0,
      Array.isArray(job.renderIds) ? job.renderIds.length : 0,
      0
    );
    const effectiveIterationCount = iterationCountHint > 0 ? iterationCountHint : 1;
    if (!shouldGroup(job, effectiveIterationCount)) {
      singles.push(job);
      continue;
    }

    const key = resolveGroupKey(job, effectiveIterationCount);
    if (!key) {
      singles.push(job);
      continue;
    }

    const bucket = buckets.get(key) ?? {
      key,
      jobs: [],
      iterationCountHint: effectiveIterationCount,
      splitMode: job.splitMode ?? null,
      batchId: job.batchId ?? null,
    };

    bucket.jobs.push(job);
    bucket.iterationCountHint = Math.max(bucket.iterationCountHint, effectiveIterationCount, bucket.jobs.length);
    if (!bucket.splitMode && job.splitMode) {
      bucket.splitMode = job.splitMode;
    }
    if (!bucket.batchId && job.batchId) {
      bucket.batchId = job.batchId;
    }
    buckets.set(key, bucket);
  }

  const groups: GroupSummary[] = [];

  buckets.forEach((bucket) => {
    if (bucket.jobs.length <= 1 && bucket.iterationCountHint <= 1) {
      if (includeSinglesAsGroups) {
        bucket.jobs.forEach((job) => {
          groups.push(buildSingleGroup(job));
        });
      } else {
        singles.push(...bucket.jobs);
      }
      return;
    }

    const sorted = bucket.jobs
      .slice()
      .sort((a, b) => {
        const ai = typeof a.iterationIndex === 'number' ? a.iterationIndex : Number.MAX_SAFE_INTEGER;
        const bi = typeof b.iterationIndex === 'number' ? b.iterationIndex : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) {
          return ai - bi;
        }
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });

    const members = sorted.map(buildMember);
    if (members.length === 0) {
      singles.push(...bucket.jobs);
      return;
    }

    const hero = pickHero(bucket, members);
    const currency = hero.currency ?? members.find((member) => member.currency)?.currency ?? null;
    const totalPrice = members.reduce<number>((sum, member) => {
      return sum + (typeof member.priceCents === 'number' ? member.priceCents : 0);
    }, 0);
    const observedCount = Math.max(bucket.iterationCountHint, members.length);
    const count = Math.max(1, Math.min(4, observedCount));
    const splitMode = count > 1 ? 'quad' : 'single';

    const previews = members.slice(0, count).map((member, index) => {
      let thumb = member.thumbUrl;
      let video = member.videoUrl;
      let aspect = member.aspectRatio;
      if (!thumb || !video || !aspect) {
        const placeholder = getPlaceholderMedia(`${member.id}-${index}`);
        if (!thumb) thumb = placeholder.posterUrl;
        if (!video) video = placeholder.videoUrl;
        if (!aspect) aspect = placeholder.aspectRatio;
      }
      return {
        id: member.id,
        thumbUrl: thumb,
        videoUrl: video,
        aspectRatio: aspect,
      };
    });

    groups.push({
      id: bucket.key,
      source: 'history',
      splitMode,
      batchId: bucket.batchId,
      count,
      totalPriceCents: totalPrice > 0 ? totalPrice : null,
      currency,
      createdAt: hero.createdAt,
      hero,
      previews,
      members,
    });
  });

  groups.sort((a, b) => {
    const timeA = Date.parse(a.createdAt);
    const timeB = Date.parse(b.createdAt);
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
  });

  if (includeSinglesAsGroups && singles.length) {
    singles.forEach((job) => {
      groups.push(buildSingleGroup(job));
    });
    singles = [];
    groups.sort((a, b) => {
      const timeA = Date.parse(a.createdAt);
      const timeB = Date.parse(b.createdAt);
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
  }

  return { groups, ungrouped: singles };
}

export const GROUP_SUMMARY_STORAGE_KEY = 'maxvideoai.generate.groupSummaries.v1';
export const GROUP_SUMMARIES_UPDATED_EVENT = 'mvai:groups-updated';

type StoredGroupMember = Omit<GroupMemberSummary, 'job'>;
interface StoredGroupSummary {
  id: string;
  splitMode?: string | null;
  batchId?: string | null;
  count: number;
  totalPriceCents: number | null;
  currency?: string | null;
  createdAt: string;
  heroId: string;
  previews: GroupSummary['previews'];
  members: StoredGroupMember[];
}

function sanitizeMember(member: GroupMemberSummary): StoredGroupMember {
  return {
    id: member.id,
    jobId: member.jobId,
    localKey: member.localKey,
    batchId: member.batchId ?? null,
    iterationIndex: typeof member.iterationIndex === 'number' ? member.iterationIndex : null,
    iterationCount: typeof member.iterationCount === 'number' ? member.iterationCount : null,
    engineId: member.engineId,
    engineLabel: member.engineLabel,
    durationSec: member.durationSec,
    priceCents: typeof member.priceCents === 'number' ? member.priceCents : null,
    currency: member.currency ?? null,
    thumbUrl: normalizeMediaUrl(member.thumbUrl) ?? undefined,
    videoUrl: normalizeMediaUrl(member.videoUrl) ?? undefined,
    aspectRatio: member.aspectRatio ?? null,
    prompt: member.prompt ?? null,
    status: member.status ?? 'completed',
    progress: typeof member.progress === 'number' ? member.progress : null,
    message: member.message ?? null,
    etaLabel: member.etaLabel ?? null,
    etaSeconds: typeof member.etaSeconds === 'number' ? member.etaSeconds : null,
    createdAt: member.createdAt,
    source: member.source ?? 'job',
  };
}

function restoreMember(member: StoredGroupMember): GroupMemberSummary {
  return {
    ...member,
    priceCents: typeof member.priceCents === 'number' ? member.priceCents : null,
    currency: member.currency ?? null,
    thumbUrl: normalizeMediaUrl(member.thumbUrl) ?? undefined,
    videoUrl: normalizeMediaUrl(member.videoUrl) ?? undefined,
    aspectRatio: member.aspectRatio ?? undefined,
    prompt: member.prompt ?? undefined,
    status: member.status === 'pending' || member.status === 'failed' ? member.status : 'completed',
    progress: typeof member.progress === 'number' ? member.progress : member.status === 'completed' ? 100 : null,
    message: member.message ?? null,
    etaLabel: member.etaLabel ?? null,
    etaSeconds: typeof member.etaSeconds === 'number' ? member.etaSeconds : null,
    job: undefined,
  };
}

function serializeGroupSummary(group: GroupSummary): StoredGroupSummary {
  const members = group.members.map(sanitizeMember);
  return {
    id: group.id,
    splitMode: group.splitMode ?? null,
    batchId: group.batchId ?? null,
    count: group.count,
    totalPriceCents: typeof group.totalPriceCents === 'number' ? group.totalPriceCents : null,
    currency: group.currency ?? null,
    createdAt: group.createdAt,
    heroId: group.hero.id,
    previews: group.previews.slice(0, 4),
    members,
  };
}

function restoreGroupSummary(stored: StoredGroupSummary): GroupSummary | null {
  if (!stored || typeof stored !== 'object') return null;
  if (typeof stored.id !== 'string') return null;
  if (!Array.isArray(stored.members) || stored.members.length === 0) return null;
  const members = stored.members.map(restoreMember).filter(Boolean);
  if (!members.length) return null;
  const hero = members.find((member) => member.id === stored.heroId) ?? members[0];
  const previews = Array.isArray(stored.previews) && stored.previews.length
    ? stored.previews.slice(0, 4)
    : members.slice(0, 4).map((member) => ({
        id: member.id,
        thumbUrl: member.thumbUrl,
        videoUrl: member.videoUrl,
        aspectRatio: member.aspectRatio ?? undefined,
      }));

  return {
    id: stored.id,
    source: 'history',
    splitMode: typeof stored.splitMode === 'string' ? stored.splitMode : undefined,
    batchId: typeof stored.batchId === 'string' ? stored.batchId : stored.batchId ?? null,
    count: typeof stored.count === 'number' ? stored.count : members.length,
    totalPriceCents: typeof stored.totalPriceCents === 'number' ? stored.totalPriceCents : null,
    currency: typeof stored.currency === 'string' ? stored.currency : null,
    createdAt: typeof stored.createdAt === 'string' ? stored.createdAt : new Date().toISOString(),
    hero,
    previews,
    members,
  };
}

export function savePersistedGroupSummaries(
  groups: GroupSummary[],
  storageKey: string = GROUP_SUMMARY_STORAGE_KEY
): void {
  if (typeof window === 'undefined') return;
  const filtered = groups.filter((group) => group.members.length > 0);
  if (!filtered.length) {
    window.localStorage.removeItem(storageKey);
    window.dispatchEvent(new CustomEvent(GROUP_SUMMARIES_UPDATED_EVENT));
    return;
  }
  const payload = filtered.slice(0, 12).map(serializeGroupSummary);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(new CustomEvent(GROUP_SUMMARIES_UPDATED_EVENT));
}

export function loadPersistedGroupSummaries(storageKey: string = GROUP_SUMMARY_STORAGE_KEY): GroupSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) return [];
    const raw = JSON.parse(value);
    if (!Array.isArray(raw)) return [];
    return raw.map(restoreGroupSummary).filter((group): group is GroupSummary => Boolean(group));
  } catch {
    return [];
  }
}
