import { useEffect, useState } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { supabase } from '@/lib/supabaseClient';
import type { EnginesResponse, PreflightRequest, PreflightResponse } from '@/types/engines';
import type { Job, JobsPage } from '@/types/jobs';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { SoraRequest } from '@/lib/sora';
import type { GenerateAttachment } from '@/lib/fal';
import type { VideoAsset } from '@/types/render';
import { translateError } from '@/lib/error-messages';
import { normalizeJobMessage, normalizeJobProgress, normalizeJobStatus } from '@/lib/job-status';

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
  const hasMedia = Boolean(job.videoUrl);
  const normalizedStatus = normalizeJobStatus(job.status ?? null, hasMedia);
  const status: Job['status'] =
    normalizedStatus ?? (hasMedia ? 'completed' : 'pending');
  const progress = normalizeJobProgress(job.progress, status as 'pending' | 'completed' | 'failed', hasMedia);
  const messageFromApi = normalizeJobMessage(job.message);
  const message =
    messageFromApi ??
    (status === 'failed' ? 'Fal reported a failure without details.' : undefined);

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

export function useEngines() {
  return useSWR<EnginesResponse>(
    'static-engines',
    async () => {
      const response = await fetch('/api/engines', { credentials: 'include' });
      const data = (await response.json().catch(() => null)) as { engines?: EnginesResponse['engines'] } | null;
      return { engines: data?.engines ?? [] };
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000,
    }
  );
}

async function fetchJobsPage(limit: number, cursor?: string | null): Promise<JobsPage> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;

  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/jobs?${params.toString()}`, {
    credentials: 'include',
    headers: Object.keys(headers).length ? headers : undefined,
  });

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

type JobsKey = readonly ['jobs', string, number, string | null];

export function useInfiniteJobs(pageSize = 12) {
  const [cacheKey, setCacheKey] = useState<string | null>(() => (typeof window === 'undefined' ? 'server' : null));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setCacheKey(data.session?.user?.id ?? 'anonymous');
      }
    });
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setCacheKey(session?.user?.id ?? 'anonymous');
      }
    });
    return () => {
      cancelled = true;
      subscription.data?.subscription?.unsubscribe();
    };
  }, []);

  const getJobsKey = (index: number, previousPage: JobsPage | null | undefined): JobsKey | null => {
    if (!cacheKey) return null;
    if (previousPage && !previousPage.nextCursor) {
      return null;
    }
    const cursor = index === 0 ? null : previousPage?.nextCursor ?? null;
    return ['jobs', cacheKey, pageSize, cursor];
  };

  const fetchJobs = async (key: JobsKey) => {
    const [, , limit, cursor] = key;
    return fetchJobsPage(limit, cursor);
  };

  const swr = useSWRInfinite<JobsPage, Error>(
    getJobsKey,
    fetchJobs,
    { revalidateOnFocus: false }
  );

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
              return next;
            });
            return pageModified ? { ...page, jobs } : page;
          });
          return jobFound ? nextPages : pages;
        },
        { revalidate: false }
      );

      if (!jobFound) {
        void mutate(undefined, { revalidate: true });
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

  return swr;
}

export async function runPreflight(payload: PreflightRequest): Promise<PreflightResponse> {
  const response = await fetch('/api/preflight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
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

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers,
    credentials: 'include',
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

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      credentials: 'include',
      headers: Object.keys(headers).length ? headers : undefined,
    });
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
    }
    const message = payload?.error ?? `Status fetch failed (${response.status})`;
    throw new Error(message);
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
    (normalizedStatus === 'failed' ? 'Fal reported a failure without details.' : undefined);

  const renderIds =
    Array.isArray(payload.renderIds) && payload.renderIds.length
      ? payload.renderIds.filter((value): value is string => typeof value === 'string')
      : payload.renderIds === null
        ? null
        : undefined;

  const result: JobStatusResult = {
    ok: true,
    jobId: payload.jobId ?? jobId,
    status: normalizedStatus,
    progress,
    videoUrl: payload.videoUrl ?? null,
    thumbUrl: payload.thumbUrl ?? null,
    pricing: payload.pricing,
    finalPriceCents: payload.finalPriceCents,
    currency: payload.currency,
    paymentStatus: payload.paymentStatus ?? 'platform',
    batchId: payload.batchId ?? null,
    groupId: payload.groupId ?? null,
    iterationIndex: payload.iterationIndex ?? null,
    iterationCount: payload.iterationCount ?? null,
    renderIds: renderIds ?? null,
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

export async function hideJob(jobId: string): Promise<void> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jobs:hidden', { detail: { jobId } }));
  }
}
