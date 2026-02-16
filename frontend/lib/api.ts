import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { supabase } from '@/lib/supabaseClient';
import { authFetch } from '@/lib/authFetch';
import { readLastKnownUserId, writeLastKnownUserId } from '@/lib/last-known';
import type { EnginesResponse, PreflightRequest, PreflightResponse } from '@/types/engines';
import type { Job, JobsPage } from '@/types/jobs';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { SoraRequest } from '@/lib/sora';
import type { GenerateAttachment } from '@/lib/fal';
import type { VideoAsset } from '@/types/render';
import { translateError } from '@/lib/error-messages';
import { normalizeJobMessage, normalizeJobProgress, normalizeJobStatus } from '@/lib/job-status';
import type { ImageGenerationRequest, ImageGenerationResponse } from '@/types/image-generation';

type PrimitiveValue = string | number | boolean | null | undefined;

function toPrimitive(value: unknown): PrimitiveValue {
  if (value == null) return value as null | undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function toPrimitiveArray(value: unknown): PrimitiveValue[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.reduce<PrimitiveValue[]>((acc, entry) => {
    if (entry === null || entry === undefined) {
      acc.push(entry);
      return acc;
    }
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      acc.push(entry);
    }
    return acc;
  }, []);
}

type GeneratePayload = {
  engineId: string;
  prompt: string;
  durationSec: number;
  durationOption?: number | string | null;
  numFrames?: number | null;
  aspectRatio?: string;
  resolution: string;
  fps: number;
  mode: string;
  audio?: boolean;
  cfgScale?: number | null;
  membershipTier?: string;
  payment?: { mode?: string | null; paymentIntentId?: string | null } | null;
  negativePrompt?: string;
  inputs?: GenerateAttachment[] | undefined;
  idempotencyKey?: string;
  apiKey?: string;
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  renderIds?: string[] | null;
  renderThumbUrls?: string[] | null;
  heroRenderId?: string | null;
  localKey?: string | null;
  message?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
  soraRequest?: SoraRequest;
  visibility?: 'public' | 'private';
  allowIndex?: boolean;
  indexable?: boolean;
  loop?: boolean;
  multiPrompt?: Array<{ prompt: string; duration: number }>;
  shotType?: 'customize' | 'intelligent';
  voiceIds?: string[];
  voiceControl?: boolean;
  elements?: Array<{ frontalImageUrl?: string; referenceImageUrls?: string[]; videoUrl?: string }>;
  endImageUrl?: string;
};

type GenerateOptions = {
  token?: string;
};

type GenerateResult = {
  ok: true;
  jobId: string;
  videoUrl: string | null;
  video?: VideoAsset | null;
  thumbUrl: string | null;
  status: 'pending' | 'completed' | 'failed';
  progress: number;
  pricing?: PricingSnapshot;
  paymentStatus: string;
  provider: string;
  providerJobId: string | null;
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  renderIds?: string[] | null;
  renderThumbUrls?: string[] | null;
  heroRenderId?: string | null;
  localKey?: string | null;
  message?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
};

type JobStatusResult = {
  ok: true;
  jobId: string;
  status: 'pending' | 'completed' | 'failed';
  progress: number;
  videoUrl: string | null;
  thumbUrl: string | null;
  aspectRatio?: string | null;
  pricing?: PricingSnapshot;
  finalPriceCents?: number;
  currency?: string;
  paymentStatus: string;
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  renderIds?: string[] | null;
  heroRenderId?: string | null;
  localKey?: string | null;
  message?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
};

type StatusRetryMeta = {
  attempt: number;
  timer: number | null;
};

function normalizeJobFromApi(job: Job): Job {
  const hasImageMedia =
    Array.isArray(job.renderIds) && job.renderIds.some((value) => typeof value === 'string' && value.length);
  const hasMedia = Boolean(job.videoUrl) || hasImageMedia;
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

const STATUS_RETRY_TIMERS = new Map<string, StatusRetryMeta>();
const STATUS_RETRY_BASE_DELAY_MS = 60_000;
const STATUS_RETRY_MAX_DELAY_MS = 30 * 60 * 1000;

function clearStatusRetry(jobId: string): void {
  if (typeof window === 'undefined') return;
  const existing = STATUS_RETRY_TIMERS.get(jobId);
  if (existing?.timer != null) {
    window.clearTimeout(existing.timer);
  }
  STATUS_RETRY_TIMERS.delete(jobId);
}

function scheduleStatusRetry(jobId: string, attempt: number): void {
  if (typeof window === 'undefined') return;
  const existing = STATUS_RETRY_TIMERS.get(jobId);
  if (existing?.timer != null) {
    window.clearTimeout(existing.timer);
  }
  const delay = Math.min(STATUS_RETRY_BASE_DELAY_MS * Math.pow(2, attempt), STATUS_RETRY_MAX_DELAY_MS);
  const timer = window.setTimeout(() => {
    STATUS_RETRY_TIMERS.set(jobId, { attempt: attempt + 1, timer: null });
    void getJobStatus(jobId).catch(() => {
      scheduleStatusRetry(jobId, attempt + 1);
    });
  }, delay);
  STATUS_RETRY_TIMERS.set(jobId, { attempt, timer });
}

type EngineCategory = 'video' | 'image' | 'all';

export function useEngines(category: EngineCategory = 'video') {
  const query = category === 'video' ? '' : `?category=${encodeURIComponent(category)}`;
  return useSWR<EnginesResponse>(
    `static-engines:${category}`,
    async () => {
      const response = await authFetch(`/api/engines${query}`);
      const data = (await response.json().catch(() => null)) as { engines?: EnginesResponse['engines'] } | null;
      return { engines: data?.engines ?? [] };
    },
    {
      dedupingInterval: 5 * 60 * 1000,
    }
  );
}

type JobFeedType = 'video' | 'image' | 'all';

async function fetchJobsPage(
  limit: number,
  cursor?: string | null,
  options?: { type?: JobFeedType }
): Promise<JobsPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  if (options?.type && options.type !== 'all') {
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

type JobsKey = readonly ['jobs', string, number, string | null, JobFeedType];

export function useInfiniteJobs(pageSize = 12, options?: { type?: JobFeedType }) {
  const [cacheKey, setCacheKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return 'server';
    return readLastKnownUserId();
  });
  const feedType: JobFeedType =
    options?.type === 'image' || options?.type === 'video' ? options.type : 'all';
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
    const subscription = supabase.auth.onAuthStateChange(async (event, session) => {
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
    return () => {
      cancelled = true;
      subscription.data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setStableStore({ byId: {}, order: [] });
  }, [cacheKey, feedType]);

  const getJobsKey = (index: number, previousPage: JobsPage | null | undefined): JobsKey | null => {
    if (!cacheKey) return null;
    if (previousPage && !previousPage.nextCursor) {
      return null;
    }
    const cursor = index === 0 ? null : previousPage?.nextCursor ?? null;
    return ['jobs', cacheKey, pageSize, cursor, feedType];
  };

  const fetchJobs = async (key: JobsKey) => {
    const [, , limit, cursor, type] = key;
    return fetchJobsPage(limit, cursor, { type });
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
        const meta = STATUS_RETRY_TIMERS.get(detail.jobId);
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
      const meta = STATUS_RETRY_TIMERS.get(jobId);
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
    if (!jobs.length) return;

    setStableStore((prev) => {
      const byId: Record<string, Job> = { ...prev.byId };
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
        normalizeJobStatus(job.status ?? null, Boolean(job.videoUrl)) ?? (job.videoUrl ? 'completed' : 'pending');
      if (normalizedStatus === 'completed' || normalizedStatus === 'failed') {
        clearStatusRetry(jobId);
      } else if (normalizedStatus === 'pending') {
        const meta = STATUS_RETRY_TIMERS.get(jobId);
        if (!meta || meta.timer === null) {
          scheduleStatusRetry(jobId, meta?.attempt ?? 0);
        }
      }
    });
    STATUS_RETRY_TIMERS.forEach((_meta, jobId) => {
      if (!seen.has(jobId)) {
        clearStatusRetry(jobId);
      }
    });
  }, [swr.data]);

  const stableJobs = stableStore.order.map((id) => stableStore.byId[id]).filter(Boolean);

  return { ...swr, stableJobs } as typeof swr & { stableJobs: Job[] };
}

export async function runPreflight(payload: PreflightRequest): Promise<PreflightResponse> {
  const response = await authFetch('/api/preflight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as PreflightResponse | null;
  if (!data) {
    return {
      ok: false,
      messages: ['Unable to compute pricing'],
      error: {
        code: 'PRICING_ERROR',
        message: 'Failed to compute pricing',
      },
    };
  }
  return data;
}

export async function runGenerate(
  payload: GeneratePayload,
  options?: GenerateOptions
): Promise<GenerateResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await authFetch('/api/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    const primitiveValue = toPrimitive(payload?.value);
    const allowedValues = toPrimitiveArray(payload?.allowed);
    const translation = translateError({
      code: typeof payload?.error === 'string' ? (payload.error as string) : undefined,
      status: response.status,
      message: typeof payload?.message === 'string' ? (payload.message as string) : undefined,
      providerMessage:
        typeof payload?.providerMessage === 'string' ? (payload.providerMessage as string) : undefined,
      field: typeof payload?.field === 'string' ? (payload.field as string) : undefined,
      value: primitiveValue,
      allowed: allowedValues,
    });
    const error = new Error(translation.message);
    if (payload) {
      Object.assign(error, payload);
    }
    Object.assign(error, {
      code: translation.code,
      message: translation.message,
      originalMessage: translation.originalMessage ?? (typeof payload?.message === 'string' ? payload.message : undefined),
      providerMessage:
        typeof payload?.providerMessage === 'string' ? (payload.providerMessage as string) : undefined,
      field: typeof payload?.field === 'string' ? (payload.field as string) : undefined,
      allowed: allowedValues,
      value: primitiveValue,
      details: payload,
      status: response.status,
    });
    throw error;
  }

  if (!body || typeof body !== 'object') {
    throw new Error('Generation response malformed');
  }

  return body as GenerateResult;
}

export async function runImageGeneration(payload: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const response = await authFetch('/api/images/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as ImageGenerationResponse | null;
  if (!data) {
    throw new Error('Image generation response malformed');
  }
  if (!response.ok || !data.ok) {
    const error = new Error(data.error?.message ?? `Image generation failed (${response.status})`);
    Object.assign(error, {
      code: data.error?.code ?? 'image_generation_failed',
      detail: data.error?.detail,
      status: response.status,
    });
    throw error;
  }
  return data;
}

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  let response: Response;
  try {
    response = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jobs:status-error', { detail: { jobId } }));
    }
    throw error;
  }

  const payload = (await response.json().catch(() => null)) as
    | (Partial<JobStatusResult> & { error?: string; status?: string; progress?: number })
    | null;

  if (!response.ok) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jobs:status-error', { detail: { jobId } }));
    }
    const message = payload?.error ?? `Status fetch failed (${response.status})`;
    const error = new Error(message);
    Object.assign(error, { status: response.status, jobId });
    throw error;
  }

  if (!payload) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jobs:status-error', { detail: { jobId } }));
    }
    throw new Error('Status payload missing');
  }

  const statusFromPayload = normalizeJobStatus(payload.status ?? null, Boolean(payload.videoUrl));
  const normalizedStatus = (statusFromPayload ?? (payload.videoUrl ? 'completed' : 'pending')) as JobStatusResult['status'];
  const progressValue = normalizeJobProgress(payload.progress, normalizedStatus, Boolean(payload.videoUrl));
  const progress = progressValue ?? (normalizedStatus === 'completed' ? 100 : 0);
  const normalizedMessage =
    normalizeJobMessage(payload.message) ??
    (normalizedStatus === 'failed'
      ? 'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'
      : undefined);

  const renderIds =
    Array.isArray(payload.renderIds) && payload.renderIds.length
      ? payload.renderIds.filter((value): value is string => typeof value === 'string')
      : payload.renderIds === null
        ? null
        : undefined;
  const renderThumbUrls =
    Array.isArray(payload.renderThumbUrls) && payload.renderThumbUrls.length
      ? payload.renderThumbUrls.filter((value): value is string => typeof value === 'string')
      : payload.renderThumbUrls === null
        ? null
        : undefined;

  const result: JobStatusResult = {
    ok: true,
    jobId: payload.jobId ?? jobId,
    status: normalizedStatus,
    progress,
    videoUrl: payload.videoUrl ?? null,
    thumbUrl: payload.thumbUrl ?? null,
    aspectRatio: payload.aspectRatio ?? null,
    pricing: payload.pricing,
    finalPriceCents: payload.finalPriceCents,
    currency: payload.currency,
    paymentStatus: payload.paymentStatus ?? 'platform',
    batchId: payload.batchId ?? null,
    groupId: payload.groupId ?? null,
    iterationIndex: payload.iterationIndex ?? null,
    iterationCount: payload.iterationCount ?? null,
    renderIds: renderIds ?? null,
    renderThumbUrls: renderThumbUrls ?? null,
    heroRenderId: payload.heroRenderId ?? null,
    localKey: payload.localKey ?? null,
    message: normalizedMessage ?? null,
    etaSeconds: payload.etaSeconds ?? null,
    etaLabel: payload.etaLabel ?? null,
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<JobStatusResult>('jobs:status', { detail: result }));
  }

  return result;
}

type SavedAsset = {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  size?: number | null;
};

export async function saveImageToLibrary(payload: { url: string; jobId?: string | null; label?: string | null }) {
  const response = await authFetch('/api/user-assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; asset?: SavedAsset } | null;
  if (!response.ok || !data?.ok || !data.asset) {
    throw new Error(data?.error ?? `Failed to save image (${response.status})`);
  }
  return data.asset;
}

export async function hideJob(jobId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jobs:hidden', { detail: { jobId } }));
  }
}
