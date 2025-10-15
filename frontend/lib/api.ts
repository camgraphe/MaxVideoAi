import { useEffect } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { computePreflight, enginesResponse } from '@/lib/engines';
import { supabase } from '@/lib/supabaseClient';
import type { EnginesResponse, PreflightRequest, PreflightResponse } from '@/types/engines';
import type { JobsPage } from '@/types/jobs';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { GenerateAttachment } from '@/lib/fal';
import type { VideoAsset } from '@/types/render';

type GeneratePayload = {
  engineId: string;
  prompt: string;
  durationSec: number;
  durationOption?: number | string | null;
  numFrames?: number | null;
  aspectRatio: string;
  resolution: string;
  fps: number;
  mode: string;
  addons?: {
    audio?: boolean;
    upscale4k?: boolean;
    [key: string]: unknown;
  };
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

export function useEngines() {
  return useSWR<EnginesResponse>(
    'static-engines',
    async () => {
      const { engines } = await enginesResponse();
      return { engines };
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

  return {
    ok: payload.ok !== false,
    jobs: payload.jobs,
    nextCursor: payload.nextCursor ?? null,
  };
}

export function useInfiniteJobs(pageSize = 12) {
  const swr = useSWRInfinite<JobsPage>(
    (index, previousPage) => {
      if (previousPage && !previousPage.nextCursor) {
        return null;
      }
      const params = new URLSearchParams({ limit: String(pageSize) });
      if (index > 0) {
        const cursor = previousPage?.nextCursor;
        if (!cursor) return null;
        params.set('cursor', cursor);
      }
      return `/api/jobs?${params.toString()}`;
    },
    async (key) => {
      const url = new URL(key, 'http://localhost');
      const limit = Number(url.searchParams.get('limit') ?? pageSize);
      const cursor = url.searchParams.get('cursor');
      return fetchJobsPage(limit, cursor);
    },
    { revalidateOnFocus: false }
  );

  const { mutate } = swr;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<JobStatusResult>).detail;
      if (!detail || !detail.jobId) return;
      void mutate(
        (pages) => {
          if (!pages) return pages;
          return pages.map((page) => {
            const jobs = page.jobs.map((job) => {
              if (job.jobId !== detail.jobId) {
                return job;
              }
              const next = {
                ...job,
                status: detail.status ?? job.status,
                progress: detail.progress ?? job.progress,
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
            return { ...page, jobs };
          });
        },
        { revalidate: false }
      );
    };
    window.addEventListener('jobs:status', handler as EventListener);
    return () => {
      window.removeEventListener('jobs:status', handler as EventListener);
    };
  }, [mutate]);

  return swr;
}

export async function runPreflight(payload: PreflightRequest): Promise<PreflightResponse> {
  return computePreflight(payload);
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

  const body = (await response.json().catch(() => null)) as (GenerateResult & { error?: string }) | null;

  if (!response.ok) {
    const message = body?.error ?? `Generation failed (${response.status})`;
    const error = new Error(message);
    if (body && typeof body === 'object') {
      Object.assign(error, body);
    }
    throw error;
  }

  if (!body || typeof body !== 'object') {
    throw new Error('Generation response malformed');
  }

  return body;
}

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
    credentials: 'include',
    headers: Object.keys(headers).length ? headers : undefined,
  });

  const payload = (await response.json().catch(() => null)) as
    | (Partial<JobStatusResult> & { error?: string; status?: string; progress?: number })
    | null;

  if (!response.ok) {
    const message = payload?.error ?? `Status fetch failed (${response.status})`;
    throw new Error(message);
  }

  if (!payload) {
    throw new Error('Status payload missing');
  }

  const normalizedStatus: JobStatusResult['status'] =
    payload.status === 'completed'
      ? 'completed'
      : payload.status === 'failed'
        ? 'failed'
        : payload.videoUrl
          ? 'completed'
          : 'pending';

  const progress =
    typeof payload.progress === 'number'
      ? payload.progress
      : payload.videoUrl
        ? 100
        : 0;

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
    message: payload.message ?? null,
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
