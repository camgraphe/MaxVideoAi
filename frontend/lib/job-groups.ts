import { normalizeMediaUrl } from '@/lib/media';
import { normalizeJobMessage, normalizeJobProgress, normalizeJobStatus } from '@/lib/job-status';
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
  const thumbUrl = normalizeMediaUrl(job.thumbUrl) ?? null;
  const videoUrl = normalizeMediaUrl(job.videoUrl) ?? null;
  const aspectRatio = job.aspectRatio ?? '16:9';
  const priceCents = job.finalPriceCents ?? job.pricingSnapshot?.totalCents ?? null;
  const currency = job.currency ?? job.pricingSnapshot?.currency ?? null;
  const iterationCount = job.iterationCount ?? (Array.isArray(job.renderIds) ? job.renderIds.length : null) ?? null;
  const hasVideo = Boolean(videoUrl);
  const normalizedStatus = normalizeJobStatus(job.status ?? null, hasVideo);
  const status: GroupMemberSummary['status'] =
    normalizedStatus ?? (hasVideo ? 'completed' : 'pending');
  const messageFromJob = normalizeJobMessage(job.message);
  let message = messageFromJob ?? null;
  if (!message) {
    if (status === 'failed') {
      message =
        'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.';
    } else if (status === 'pending') {
      message = 'Processing…';
    }
  }
  const progressValue = normalizeJobProgress(job.progress, status, hasVideo);
  const progress = typeof progressValue === 'number' ? progressValue : null;

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
    progress,
    message,
    etaLabel: job.etaLabel ?? null,
    etaSeconds: job.etaSeconds ?? null,
    createdAt: job.createdAt,
    source: 'job',
    job,
  };
}

function isImageVariantJob(job: Job): job is Job & { renderIds: string[] } {
  if (!Array.isArray(job.renderIds) || job.renderIds.length <= 1) return false;
  if (job.videoUrl || job.readyVideoUrl) return false;
  return job.renderIds.every((value) => typeof value === 'string' && /^https?:\/\//i.test(value));
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
  const thumb = member.thumbUrl ?? null;
  const video = member.videoUrl ?? null;
  const aspect = member.aspectRatio ?? job.aspectRatio ?? '16:9';
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

    const members: GroupMemberSummary[] = [];
    sorted.forEach((job) => {
      const baseMember = buildMember(job);
      if (isImageVariantJob(job)) {
        job.renderIds.forEach((url, index) => {
          members.push({
            ...baseMember,
            id: `${job.jobId}-image-${index}`,
            thumbUrl: normalizeMediaUrl(url) ?? url,
            videoUrl: null,
            aspectRatio: baseMember.aspectRatio ?? '1:1',
          });
        });
      } else {
        members.push(baseMember);
      }
    });
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

    const previews = members.slice(0, count).map((member) => {
      const thumb = member.thumbUrl ?? null;
      const video = member.videoUrl ?? null;
      const aspect = member.aspectRatio ?? '16:9';
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
