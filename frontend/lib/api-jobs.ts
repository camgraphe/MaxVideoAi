import { useEffect, useRef, useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import { authFetch } from '@/lib/authFetch';
import { normalizeJobMessage, normalizeJobProgress, normalizeJobStatus } from '@/lib/job-status';
import { readLastKnownUserId, writeLastKnownUserId } from '@/lib/last-known';
import { hasSupabaseAuthCookie } from '@/lib/supabase-session-hint';
import {
  clearMissingStatusRetries,
  clearStatusRetry,
  getStatusRetryMeta,
  jobHasRenderableMedia,
  scheduleStatusRetry,
  type JobStatusResult,
} from '@/lib/api-job-status';
import type { JobSurface } from '@/types/billing';
import type { Job, JobsPage } from '@/types/jobs';

async function getSupabaseClient() {
  const { supabase } = await import('@/lib/supabaseClient');
  return supabase;
}

function normalizeJobFromApi(job: Job): Job {
  const hasImageMedia =
    Array.isArray(job.renderIds) && job.renderIds.some((value) => typeof value === 'string' && value.length);
  const hasMedia = Boolean(job.videoUrl || job.audioUrl) || hasImageMedia;
  const normalizedStatus = normalizeJobStatus(job.status ?? null, hasMedia);
  const status: Job['status'] =
    normalizedStatus ?? (hasMedia ? 'completed' : 'pending');
  const progress = normalizeJobProgress(job.progress, status as 'pending' | 'completed' | 'failed', hasMedia);
  const messageFromApi = normalizeJobMessage(job.message);
  const message =
    hasImageMedia && status === 'completed'
      ? undefined
      : messageFromApi ??
        (status === 'failed'
          ? 'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'
          : undefined);

  return {
    ...job,
    status,
    progress,
    message,
  };
}

type JobFeedType = 'video' | 'image' | 'all';
type JobFeedSurface = JobSurface | 'all';

async function fetchJobsPage(
  limit: number,
  cursor?: string | null,
  options?: { type?: JobFeedType; surface?: JobFeedSurface }
): Promise<JobsPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  if (options?.surface && options.surface !== 'all') {
    params.set('surface', options.surface);
  } else if (options?.type && options.type !== 'all') {
    params.set('type', options.type);
  }
  const response = await authFetch(`/api/jobs?${params.toString()}`);

  const payload = (await response.json().catch(() => null)) as (Partial<JobsPage> & { error?: string }) | null;

  if (!response.ok) {
    const message = payload?.error ?? `Jobs request failed: ${response.status}`;
    throw new Error(message);
  }

  if (!payload || !Array.isArray(payload.jobs)) {
    throw new Error('Jobs payload malformed');
  }

  const jobs = payload.jobs.map((job) => normalizeJobFromApi(job));

  return {
    ok: payload.ok !== false,
    jobs,
    nextCursor: payload.nextCursor ?? null,
  };
}

type JobsKey = readonly ['jobs', string, number, string | null, JobFeedType, JobFeedSurface];

export function useInfiniteJobs(pageSize = 12, options?: { type?: JobFeedType; surface?: JobFeedSurface }) {
  const [cacheKey, setCacheKey] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : readLastKnownUserId()
  );
  const feedType: JobFeedType =
    options?.type === 'image' || options?.type === 'video' ? options.type : 'all';
  const feedSurface: JobFeedSurface =
    options?.surface === 'video' ||
    options?.surface === 'image' ||
    options?.surface === 'audio' ||
    options?.surface === 'character' ||
    options?.surface === 'angle' ||
    options?.surface === 'upscale'
      ? options.surface
      : 'all';
  const lastRevalidateRef = useRef<number>(0);
  const lastKnownUserIdRef = useRef<string | null>(typeof window === 'undefined' ? null : readLastKnownUserId());
  const [stableStore, setStableStore] = useState<{
    byId: Record<string, Job>;
    order: string[];
  }>({ byId: {}, order: [] });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;
    const updateCacheKey = async (forceAnonymous = false) => {
      if (forceAnonymous) {
        if (cancelled) return;
        lastKnownUserIdRef.current = null;
        writeLastKnownUserId(null);
        setCacheKey('anonymous');
        return;
      }
      const knownUserId = lastKnownUserIdRef.current ?? readLastKnownUserId();
      if (!knownUserId && !hasSupabaseAuthCookie()) {
        setCacheKey('anonymous');
        return;
      }
      const supabase = await getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const userId = data.session?.user?.id ?? null;
      if (userId) {
        lastKnownUserIdRef.current = userId;
        writeLastKnownUserId(userId);
        setCacheKey(userId);
        return;
      }
      if (lastKnownUserIdRef.current) {
        setCacheKey(lastKnownUserIdRef.current);
        return;
      }
      const storedUserId = readLastKnownUserId();
      if (storedUserId) {
        lastKnownUserIdRef.current = storedUserId;
        setCacheKey(storedUserId);
        return;
      }
      setCacheKey('anonymous');
    };
    void updateCacheKey();
    let subscription: { data?: { subscription?: { unsubscribe: () => void } } } | null = null;
    if (lastKnownUserIdRef.current || readLastKnownUserId() || hasSupabaseAuthCookie()) {
      void getSupabaseClient().then((supabase) => {
        if (cancelled) return;
        subscription = supabase.auth.onAuthStateChange(async (event, session) => {
          if (cancelled) return;
          const eventType = event as string;
          if (eventType === 'SIGNED_OUT' || eventType === 'USER_DELETED') {
            await updateCacheKey(true);
            return;
          }
          const nextUserId = session?.user?.id ?? null;
          if (nextUserId) {
            lastKnownUserIdRef.current = nextUserId;
            writeLastKnownUserId(nextUserId);
            setCacheKey(nextUserId);
            return;
          }
          await updateCacheKey();
        });
      });
    }
    return () => {
      cancelled = true;
      subscription?.data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setStableStore({ byId: {}, order: [] });
  }, [cacheKey, feedSurface, feedType]);

  const getJobsKey = (index: number, previousPage: JobsPage | null | undefined): JobsKey | null => {
    if (!cacheKey) return null;
    if (previousPage && !previousPage.nextCursor) {
      return null;
    }
    const cursor = index === 0 ? null : previousPage?.nextCursor ?? null;
    return ['jobs', cacheKey, pageSize, cursor, feedType, feedSurface];
  };

  const fetchJobs = async (key: JobsKey) => {
    const [, , limit, cursor, type, surface] = key;
    return fetchJobsPage(limit, cursor, { type, surface });
  };

  const swr = useSWRInfinite<JobsPage, Error>(getJobsKey, fetchJobs);

  const { mutate } = swr;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<JobStatusResult>).detail;
      if (!detail || !detail.jobId) return;

      const normalizedStatus = typeof detail.status === 'string' ? detail.status.toLowerCase() : '';
      if (normalizedStatus === 'completed' || normalizedStatus === 'failed') {
        clearStatusRetry(detail.jobId);
      } else {
        const meta = getStatusRetryMeta(detail.jobId);
        if (!meta || meta.timer === null) {
          scheduleStatusRetry(detail.jobId, meta?.attempt ?? 0);
        }
      }

      let jobFound = false;
      void mutate(
        (pages) => {
          if (!pages) return pages;
          const nextPages = pages.map((page) => {
            let pageModified = false;
            const jobs = page.jobs.map((job) => {
              if (job.jobId !== detail.jobId) {
                return job;
              }
              jobFound = true;
              pageModified = true;
              const progressFromDetail =
                typeof detail.progress === 'number' && Number.isFinite(detail.progress)
                  ? Math.max(0, Math.min(100, detail.progress))
                  : undefined;
              const next = {
                ...job,
                status: detail.status ?? job.status,
                progress:
                  typeof progressFromDetail === 'number' && progressFromDetail > 0
                    ? progressFromDetail
                    : job.progress,
                videoUrl: detail.videoUrl ?? job.videoUrl,
                previewVideoUrl: detail.previewVideoUrl ?? job.previewVideoUrl,
                audioUrl: detail.audioUrl ?? job.audioUrl,
                thumbUrl: detail.thumbUrl ?? job.thumbUrl,
                finalPriceCents: detail.finalPriceCents ?? job.finalPriceCents,
                currency: detail.currency ?? job.currency,
                pricingSnapshot: detail.pricing ?? job.pricingSnapshot,
                paymentStatus: detail.paymentStatus ?? job.paymentStatus,
                batchId: detail.batchId ?? job.batchId,
                groupId: detail.groupId ?? job.groupId,
                iterationIndex: detail.iterationIndex ?? job.iterationIndex,
                iterationCount: detail.iterationCount ?? job.iterationCount,
                heroRenderId: detail.heroRenderId ?? job.heroRenderId,
                localKey: detail.localKey ?? job.localKey,
                message: detail.message ?? job.message,
                etaSeconds: detail.etaSeconds ?? job.etaSeconds,
                etaLabel: detail.etaLabel ?? job.etaLabel,
              };
              if (detail.renderIds !== undefined) {
                next.renderIds = detail.renderIds;
              }
              if (detail.renderThumbUrls !== undefined) {
                next.renderThumbUrls = detail.renderThumbUrls;
              }
              return next;
            });
            return pageModified ? { ...page, jobs } : page;
          });
          return jobFound ? nextPages : pages;
        },
        { revalidate: false }
      );

      if (!jobFound) {
        const now = Date.now();
        if (now - lastRevalidateRef.current > 1500) {
          lastRevalidateRef.current = now;
          void mutate(undefined, { revalidate: true });
        }
      }
    };

    const errorHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ jobId?: string }>).detail;
      const jobId = detail?.jobId;
      if (!jobId) return;
      const meta = getStatusRetryMeta(jobId);
      if (meta?.timer) return;
      scheduleStatusRetry(jobId, meta?.attempt ?? 0);
      void mutate(undefined, { revalidate: true });
    };

    window.addEventListener('jobs:status', handler as EventListener);
    window.addEventListener('jobs:status-error', errorHandler as EventListener);
    return () => {
      window.removeEventListener('jobs:status', handler as EventListener);
      window.removeEventListener('jobs:status-error', errorHandler as EventListener);
    };
  }, [mutate]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ jobId?: string }>).detail;
      const jobId = typeof detail?.jobId === 'string' ? detail.jobId : '';
      if (!jobId) return;
      setStableStore((prev) => {
        if (!prev.byId[jobId]) return prev;
        const rest = { ...prev.byId };
        delete rest[jobId];
        const order = prev.order.filter((id) => id !== jobId);
        return { byId: rest, order };
      });
      void mutate(
        (pages) => {
          if (!pages) return pages;
          return pages.map((page) => ({ ...page, jobs: page.jobs.filter((job) => job.jobId !== jobId) }));
        },
        { revalidate: false }
      );
    };
    window.addEventListener('jobs:hidden', handler as EventListener);
    return () => window.removeEventListener('jobs:hidden', handler as EventListener);
  }, [mutate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const jobs = swr.data?.flatMap((page) => page.jobs) ?? [];
    if (!jobs.length) {
      if (swr.data) {
        setStableStore({ byId: {}, order: [] });
      }
      return;
    }

    setStableStore((prev) => {
      const currentJobIds = new Set(
        jobs
          .map((job) => (typeof job?.jobId === 'string' ? job.jobId : ''))
          .filter((jobId): jobId is string => jobId.length > 0)
      );
      const byId: Record<string, Job> = {};
      Object.entries(prev.byId).forEach(([jobId, job]) => {
        if (currentJobIds.has(jobId)) {
          byId[jobId] = job;
        }
      });
      let sawRealJob = false;
      jobs.forEach((job) => {
        if (!job?.jobId) return;
        if (!job.curated) {
          sawRealJob = true;
        }
        const existing = byId[job.jobId];
        if (!existing) {
          byId[job.jobId] = job;
          return;
        }

        const merged: Job = { ...existing, ...job };
        if (job.thumbUrl == null && existing.thumbUrl != null) merged.thumbUrl = existing.thumbUrl;
        if (job.videoUrl == null && existing.videoUrl != null) merged.videoUrl = existing.videoUrl;
        if (job.audioUrl == null && existing.audioUrl != null) merged.audioUrl = existing.audioUrl;
        if (job.readyVideoUrl == null && existing.readyVideoUrl != null) merged.readyVideoUrl = existing.readyVideoUrl;
        if (job.previewFrame == null && existing.previewFrame != null) merged.previewFrame = existing.previewFrame;
        if (job.renderIds == null && existing.renderIds != null) merged.renderIds = existing.renderIds;
        if (job.renderThumbUrls == null && existing.renderThumbUrls != null) {
          merged.renderThumbUrls = existing.renderThumbUrls;
        }
        if (job.heroRenderId == null && existing.heroRenderId != null) merged.heroRenderId = existing.heroRenderId;
        byId[job.jobId] = merged;
      });

      const ids = Object.keys(byId);
      if (sawRealJob) {
        ids.forEach((id) => {
          if (byId[id]?.curated) {
            delete byId[id];
          }
        });
      }

      const MAX_STABLE_JOBS = 400;
      const nextOrder = Object.keys(byId)
        .sort((a, b) => {
          const timeA = Date.parse(byId[a]?.createdAt ?? '');
          const timeB = Date.parse(byId[b]?.createdAt ?? '');
          return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
        })
        .slice(0, MAX_STABLE_JOBS);
      if (nextOrder.length < Object.keys(byId).length) {
        const keep = new Set(nextOrder);
        Object.keys(byId).forEach((id) => {
          if (!keep.has(id)) delete byId[id];
        });
      }

      return { byId, order: nextOrder };
    });
  }, [swr.data]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const jobs = swr.data?.flatMap((page) => page.jobs) ?? [];
    const seen = new Set<string>();
    jobs.forEach((job) => {
      const jobId = job?.jobId;
      if (!jobId) return;
      seen.add(jobId);
      const normalizedStatus =
        normalizeJobStatus(job.status ?? null, jobHasRenderableMedia(job)) ??
        (jobHasRenderableMedia(job) ? 'completed' : 'pending');
      if (normalizedStatus === 'completed' || normalizedStatus === 'failed') {
        clearStatusRetry(jobId);
      } else if (normalizedStatus === 'pending') {
        const meta = getStatusRetryMeta(jobId);
        if (!meta || meta.timer === null) {
          scheduleStatusRetry(jobId, meta?.attempt ?? 0);
        }
      }
    });
    clearMissingStatusRetries(seen);
  }, [swr.data]);

  const stableJobs = stableStore.order.map((id) => stableStore.byId[id]).filter(Boolean);

  return { ...swr, stableJobs } as typeof swr & { stableJobs: Job[] };
}

export async function hideJob(jobId: string): Promise<void> {
  const response = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hidden: true }),
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error ?? `Failed to hide job (${response.status})`);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jobs:hidden', { detail: { jobId } }));
  }
}
