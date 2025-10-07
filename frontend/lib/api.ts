import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import type { EnginesResponse, PreflightRequest, PreflightResponse, PricingSnapshot } from '@/types/engines';
import type { Job, JobsPage } from '@/types/jobs';
import { getPlaceholderMedia } from '@/lib/placeholderMedia';
import type { VideoAsset } from '@/types/render';
import type { ResultProviderMode } from '@/types/providers';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '/api').trim();

interface GenerateError extends Error {
  status?: number;
  code?: string;
  details?: {
    requiredCents?: number;
    balanceCents?: number;
  };
}

async function fetcher<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export function useEngines() {
  return useSWR<EnginesResponse>(`${API_BASE}/engines`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
  });
}

export async function runPreflight(payload: PreflightRequest): Promise<PreflightResponse> {
  const res = await fetch(`${API_BASE}/preflight`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json()) as PreflightResponse;
  if (!res.ok) {
    throw new Error(json.error?.message ?? 'Preflight failed');
  }

  return json;
}

export async function runGenerate(
  payload: {
    engineId: string;
    prompt: string;
    durationSec: number;
    aspectRatio: string;
    resolution?: string;
    fps?: number;
    mode?: string;
    addons?: { audio?: boolean; upscale4k?: boolean };
    membershipTier?: string;
    payment?: { mode?: 'wallet' | 'direct' | 'platform'; paymentIntentId?: string; jobId?: string };
    jobId?: string;
    inputs?: Array<{ name: string; type: string; size: number; kind?: 'image' | 'video'; dataUrl: string; slotId?: string; label?: string }>;
  },
  opts?: { token?: string }
): Promise<{
  ok: boolean;
  jobId?: string;
  videoUrl?: string;
  video?: VideoAsset | null;
  thumbUrl?: string;
  error?: string;
  status?: string;
  progress?: number;
  pricing?: PricingSnapshot;
  paymentStatus?: string;
  provider?: ResultProviderMode;
  providerJobId?: string | null;
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts?.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    const message = typeof json?.error === 'string' ? json.error : 'Generate failed';
    const error = Object.assign(new Error(message), {
      status: res.status,
    }) as GenerateError;
    if (typeof json?.error === 'string') {
      error.code = json.error;
    }
    const requiredCents = typeof json?.requiredCents === 'number' ? json.requiredCents : undefined;
    const balanceCents = typeof json?.balanceCents === 'number' ? json.balanceCents : undefined;
    if (requiredCents !== undefined || balanceCents !== undefined) {
      error.details = { requiredCents, balanceCents };
    }
    throw error;
  }
  return json;
}

export async function getJobStatus(jobId: string): Promise<{
  ok: boolean;
  jobId: string;
  status: string;
  progress: number;
  videoUrl?: string;
  thumbUrl?: string;
  pricing?: PricingSnapshot;
  finalPriceCents?: number;
  currency?: string;
  paymentStatus?: string;
  vendorAccountId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
}> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? 'Job status failed');
  }
  return json;
}

function isValidJob(job: Partial<Job>): job is Job {
  return Boolean(
    job &&
    typeof job.jobId === 'string' &&
    typeof job.engineLabel === 'string' &&
    typeof job.durationSec === 'number' &&
    typeof job.prompt === 'string' &&
    typeof job.createdAt === 'string'
  );
}

function validateJobsPayload(payload: unknown): JobsPage {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid jobs payload (not an object)');
  }

  const page = payload as Partial<JobsPage>;
  if (page.ok !== true) {
    throw new Error('Jobs request unsuccessful');
  }

  if (!Array.isArray(page.jobs)) {
    throw new Error('Jobs payload missing jobs array');
  }

  const jobs = page.jobs.filter((job): job is Job => isValidJob(job));
  if (jobs.length !== page.jobs.length) {
    throw new Error('Jobs payload contains invalid entries');
  }

  const nextCursor = page.nextCursor ?? null;
  if (nextCursor !== null && typeof nextCursor !== 'string') {
    throw new Error('Jobs payload has invalid nextCursor');
  }

  return {
    ok: true,
    jobs,
    nextCursor,
  };
}

async function fetchJobsWithRetry(url: string, attempts = 3, initialDelay = 250): Promise<JobsPage> {
  let attempt = 0;
  let delay = initialDelay;

  while (attempt < attempts) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jobs request failed (${res.status}): ${text}`);
      }

      const json = await res.json();
      const page = validateJobsPayload(json);
      const filteredJobs = page.jobs.map((job, index) => {
        const hasVideo = typeof job.videoUrl === 'string' && job.videoUrl.startsWith('http');
        const hasThumb = typeof job.thumbUrl === 'string' && job.thumbUrl.startsWith('http');
        if (hasVideo || hasThumb) {
          return job;
        }
        const fallback = getPlaceholderMedia(`${job.jobId}-${index}`);
        return {
          ...job,
          videoUrl: fallback.videoUrl,
          thumbUrl: fallback.posterUrl,
          aspectRatio: job.aspectRatio ?? fallback.aspectRatio,
        };
      });
      return {
        ...page,
        jobs: filteredJobs,
      };
    } catch (error) {
      attempt += 1;
      if (attempt >= attempts) {
        throw error instanceof Error ? error : new Error('Jobs request failed');
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }

  throw new Error('Jobs request failed');
}

export function useInfiniteJobs(limit = 24) {
  return useSWRInfinite<JobsPage>(
    (index, previousPage) => {
      if (previousPage && !previousPage.nextCursor && index !== 0) {
        return null;
      }

      const params = new URLSearchParams();
      params.set('limit', String(limit));
      const cursor = index === 0 ? '' : previousPage?.nextCursor ?? '';
      if (cursor) {
        params.set('cursor', cursor);
      }

      return `${API_BASE}/jobs?${params.toString()}`;
    },
    (url) => fetchJobsWithRetry(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );
}
