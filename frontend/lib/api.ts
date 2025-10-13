import { useEffect } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { computePreflight, enginesResponse, getEngineById } from '@/lib/engines';
import { normalizeMediaUrl } from '@/lib/media';
import { ENV as CLIENT_ENV } from '@/lib/env';
import { supabase } from '@/lib/supabaseClient';
import type {
  AspectRatio,
  EngineCaps,
  EnginesResponse,
  PreflightRequest,
  PreflightResponse,
  Resolution,
} from '@/types/engines';
import type { Job, JobsPage } from '@/types/jobs';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import {
  ensureMockJobCapacity,
  getMockJob,
  getMockJobs,
  removeMockJob,
  scheduleMockJobLifecycle,
  setMockJob,
  subscribeMockJobs,
  updateMockJob,
  type MockGeneratePayload,
  type MockJob,
  type SampleMedia,
} from '@/lib/mock-jobs-store';
import { formatEtaLabel, pickSimulatedDurationMs } from '@/config/engine-eta';

const SAMPLE_MEDIA: SampleMedia[] = [
  { videoUrl: '/hero/sora2.mp4', thumbUrl: '/hero/sora2.jpg', aspectRatio: '16:9' },
  { videoUrl: '/hero/luma-dream.mp4', thumbUrl: '/hero/luma-dream.jpg', aspectRatio: '16:9' },
  { videoUrl: '/hero/runway-gen3.mp4', thumbUrl: '/hero/runway-gen3.jpg', aspectRatio: '16:9' },
  { videoUrl: '/hero/pika-15.mp4', thumbUrl: '/hero/pika-15.jpg', aspectRatio: '16:9' },
];

const MAX_JOBS = 40;

type GeneratePayload = MockGeneratePayload;

type GenerateOptions = {
  token?: string;
};

type GenerateResult = {
  ok: true;
  jobId: string;
  videoUrl: string | null;
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

let sampleCursor = 0;

function selectSample(): SampleMedia {
  const sample = SAMPLE_MEDIA[sampleCursor % SAMPLE_MEDIA.length];
  sampleCursor += 1;
  return sample;
}

function normalizeMemberTier(value?: string): 'member' | 'plus' | 'pro' {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'plus' || raw === 'pro') return raw;
  return 'member';
}

function normaliseResolution(engine: EngineCaps, value: string): Resolution {
  const candidate = value as Resolution;
  if (engine.resolutions.includes(candidate)) {
    return candidate;
  }
  const fallback =
    engine.resolutions.find((entry) => entry !== 'auto') ?? engine.resolutions[0] ?? '1080p';
  return fallback;
}

function normaliseAspectRatio(engine: EngineCaps, value: string): AspectRatio {
  const candidate = value as AspectRatio;
  if (engine.aspectRatios.includes(candidate)) {
    return candidate;
  }
  return engine.aspectRatios[0] ?? '16:9';
}

function generateRandomId(): string {
  const globalCrypto = typeof crypto !== 'undefined' ? crypto : (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto
      .randomUUID()
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

function buildJobsPage(limit: number): JobsPage {
  const jobs = getMockJobs()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(toJob);
  return {
    ok: true,
    jobs,
    nextCursor: null,
  };
}

function toJob(job: MockJob): Job {
  return {
    jobId: job.jobId,
    engineLabel: job.engine.label,
    durationSec: job.payload.durationSec,
    prompt: job.payload.prompt,
    thumbUrl: normalizeMediaUrl(job.thumbUrl) ?? undefined,
    videoUrl: normalizeMediaUrl(job.videoUrl) ?? undefined,
    createdAt: new Date(job.createdAt).toISOString(),
    engineId: job.engine.id,
    aspectRatio: job.payload.aspectRatio,
    status: job.status,
    progress: job.progress,
    finalPriceCents: job.pricing?.totalCents,
    currency: job.pricing?.currency,
    pricingSnapshot: job.pricing,
    paymentStatus: job.paymentStatus,
    batchId: job.batchId ?? undefined,
    groupId: job.groupId ?? undefined,
    iterationIndex: job.iterationIndex ?? undefined,
    iterationCount: job.iterationCount ?? undefined,
    renderIds: job.renderIds ?? undefined,
    heroRenderId: job.heroRenderId ?? undefined,
    localKey: job.localKey ?? undefined,
    message: job.message ?? undefined,
    etaSeconds: job.etaSeconds ?? undefined,
    etaLabel: job.etaLabel ?? undefined,
  };
}

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

const CLIENT_RESULT_PROVIDER = (CLIENT_ENV.RESULT_PROVIDER ?? '').toUpperCase();
const USE_SERVER_JOBS = CLIENT_RESULT_PROVIDER === 'FAL' || CLIENT_RESULT_PROVIDER === 'HYBRID';

async function fetchJobsPage(limit: number, cursor?: string | null): Promise<JobsPage> {
  if (typeof window === 'undefined') {
    return buildJobsPage(limit);
  }

  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      return buildJobsPage(limit);
    }

    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const res = await fetch(`/api/jobs?${params.toString()}`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Jobs request failed: ${res.status}`);
    }
    const json = (await res.json()) as JobsPage;
    if (!Array.isArray(json?.jobs)) {
      throw new Error('Jobs payload malformed');
    }
    return {
      ok: true,
      jobs: json.jobs,
      nextCursor: json.nextCursor ?? null,
    };
  } catch (error) {
    console.warn('[jobs] falling back to mock data:', error);
    return buildJobsPage(limit);
  }
}

export function useInfiniteJobs(pageSize = 12) {
  const swr = useSWRInfinite<JobsPage>(
    (index, previousPage) => {
      if (!USE_SERVER_JOBS) {
        return index === 0 ? `mock-jobs?limit=${pageSize}` : null;
      }
      if (previousPage && !previousPage.nextCursor) return null;
      if (index === 0) {
        return `/api/jobs?limit=${pageSize}`;
      }
      const cursor = previousPage?.nextCursor;
      if (!cursor) return null;
      return `/api/jobs?limit=${pageSize}&cursor=${encodeURIComponent(cursor)}`;
    },
    async (key) => {
      if (!USE_SERVER_JOBS) {
        const limitMatch = /limit=(\d+)/.exec(key);
        const limit = limitMatch ? Number(limitMatch[1]) : pageSize;
        return buildJobsPage(limit);
      }
      const url = new URL(key, 'http://localhost');
      const limit = Number(url.searchParams.get('limit') ?? pageSize);
      const cursor = url.searchParams.get('cursor');
      return fetchJobsPage(limit, cursor);
    },
    { revalidateOnFocus: false }
  );

  const { mutate } = swr;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsubscribe = subscribeMockJobs(() => {
      if (!USE_SERVER_JOBS) {
        void mutate();
      }
    });
    return unsubscribe;
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = options?.token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message =
        (errorBody && typeof errorBody.error === 'string' && errorBody.error) ||
        `Generation failed (${response.status})`;
      const error = new Error(message);
      if (errorBody && typeof errorBody === 'object') {
        Object.assign(error, errorBody);
        if (typeof (errorBody as { error?: unknown }).error === 'string') {
          (error as Error & { code?: string }).code = (errorBody as { error: string }).error;
        }
      }
      throw error;
    }

    const result = (await response.json()) as GenerateResult;
    return result;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch')) {
      console.warn('[runGenerate] network error, falling back to mock generation:', error);
      return runGenerateMock(payload);
    }
    throw error instanceof Error ? error : new Error('Generation failed');
  }
}

async function runGenerateMock(payload: GeneratePayload): Promise<GenerateResult> {
  const job = await createMockJob(payload);
  const jobId = job.jobId;
  const simulatedMs = pickSimulatedDurationMs(payload.engineId);
  const etaSeconds = Math.max(20, Math.round(simulatedMs / 1000));
  if (job.etaSeconds == null) {
    job.etaSeconds = etaSeconds;
  }
  if (!job.etaLabel) {
    job.etaLabel = formatEtaLabel(job.etaSeconds);
  }

  setMockJob(job);
  ensureMockJobCapacity(MAX_JOBS);
  scheduleMockJobLifecycle(jobId, simulatedMs);

  return {
    ok: true,
    jobId,
    videoUrl: job.videoUrl,
    thumbUrl: job.thumbUrl,
    status: job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'pending',
    progress: job.progress,
    pricing: job.pricing,
    paymentStatus: job.paymentStatus,
    provider: 'mock',
    providerJobId: `mock-${jobId}`,
    batchId: payload.batchId ?? null,
    groupId: payload.groupId ?? null,
    iterationIndex: payload.iterationIndex ?? null,
    iterationCount: payload.iterationCount ?? null,
    renderIds: payload.renderIds ?? null,
    heroRenderId: payload.heroRenderId ?? null,
    localKey: payload.localKey ?? null,
    message: payload.message ?? null,
    etaSeconds: job.etaSeconds,
    etaLabel: job.etaLabel,
  };
}

async function createMockJob(payload: GeneratePayload): Promise<MockJob> {
  const engine = await getEngineById(payload.engineId);
  if (!engine) {
    throw new Error('Unknown engine');
  }

  const memberTier = normalizeMemberTier(payload.membershipTier);
  const addons = {
    audio: Boolean(payload.addons?.audio),
    upscale4k: Boolean(payload.addons?.upscale4k),
  };
  const resolution = normaliseResolution(engine, payload.resolution);
  const aspectRatio = normaliseAspectRatio(engine, payload.aspectRatio);

  const preflightPayload: PreflightRequest = {
    engine: engine.id,
    mode: payload.mode,
    durationSec: payload.durationSec,
    resolution,
    aspectRatio,
    fps: payload.fps,
    addons,
    seedLocked: false,
    user: { memberTier },
  };

  const preflight = await computePreflight(preflightPayload);
  const pricing = preflight.ok ? preflight.pricing : undefined;

  const jobId =
    (payload.idempotencyKey && typeof payload.idempotencyKey === 'string'
      ? payload.idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)
      : null) || `job_${generateRandomId()}`;
  const sample = selectSample();
  const now = Date.now();
  const paymentMode = payload.payment?.mode ?? 'platform';
  const paymentStatus = paymentMode === 'wallet' ? 'paid_wallet' : 'platform';

  const job: MockJob = {
    jobId,
    engine,
    payload: { ...payload, addons, resolution, aspectRatio },
    status: 'pending',
    progress: 5,
    createdAt: now,
    updatedAt: now,
    thumbUrl: sample.thumbUrl,
    videoUrl: null,
    pricing,
    paymentStatus,
    sample,
    batchId: payload.batchId ?? null,
    groupId: payload.groupId ?? null,
    iterationIndex: payload.iterationIndex ?? null,
    iterationCount: payload.iterationCount ?? null,
    renderIds: payload.renderIds ?? null,
    heroRenderId: payload.heroRenderId ?? null,
    localKey: payload.localKey ?? null,
    message: payload.message ?? null,
    etaSeconds: payload.etaSeconds ?? null,
    etaLabel: payload.etaLabel ?? null,
  };

  return job;
}

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  const mockJob = getMockJob(jobId);

  const buildFromMock = (job: MockJob): JobStatusResult => ({
    ok: true,
    jobId,
    status: job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'pending',
    progress: job.progress,
    videoUrl: job.videoUrl,
    thumbUrl: job.thumbUrl,
    pricing: job.pricing,
    finalPriceCents: job.pricing?.totalCents,
    currency: job.pricing?.currency,
    paymentStatus: job.paymentStatus,
    batchId: job.batchId ?? undefined,
    groupId: job.groupId ?? undefined,
    iterationIndex: job.iterationIndex ?? undefined,
    iterationCount: job.iterationCount ?? undefined,
    renderIds: job.renderIds ?? undefined,
    heroRenderId: job.heroRenderId ?? undefined,
    localKey: job.localKey ?? undefined,
    message: job.message ?? undefined,
    etaSeconds: job.etaSeconds ?? undefined,
    etaLabel: job.etaLabel ?? undefined,
  });

  if (mockJob && mockJob.status === 'completed' && mockJob.videoUrl) {
    return buildFromMock(mockJob);
  }

  try {
    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message =
        (errorBody && typeof errorBody.error === 'string' && errorBody.error) ||
        `Status fetch failed (${response.status})`;
      throw new Error(message);
    }

    const data = (await response.json()) as {
      jobId?: string;
      status?: JobStatusResult['status'];
      progress?: number;
      videoUrl?: string | null;
      thumbUrl?: string | null;
      pricing?: PricingSnapshot;
      finalPriceCents?: number | null;
      currency?: string | null;
      paymentStatus?: string | null;
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

    const normalizedStatus: JobStatusResult['status'] =
      data.status === 'completed'
        ? 'completed'
        : data.status === 'failed'
          ? 'failed'
          : data.videoUrl
            ? 'completed'
            : 'pending';

    if (mockJob) {
      updateMockJob(jobId, (job) => {
        const nextStatus = normalizedStatus === 'pending' ? job.status : normalizedStatus;
        job.status = nextStatus;
        if (typeof data.progress === 'number') {
          job.progress = Math.max(job.progress, data.progress);
        }
        if (data.videoUrl !== undefined) {
          job.videoUrl = data.videoUrl ?? job.videoUrl;
        }
        if (data.thumbUrl !== undefined) {
          job.thumbUrl = data.thumbUrl ?? job.thumbUrl;
        }
        if (data.pricing) {
          job.pricing = data.pricing;
        }
        if (data.paymentStatus) {
          job.paymentStatus = data.paymentStatus;
        }
        if (data.batchId) job.batchId = data.batchId;
        if (data.groupId) job.groupId = data.groupId;
        if (data.iterationIndex != null) job.iterationIndex = data.iterationIndex;
        if (data.iterationCount != null) job.iterationCount = data.iterationCount;
        if (Array.isArray(data.renderIds)) job.renderIds = data.renderIds;
        if (data.heroRenderId) job.heroRenderId = data.heroRenderId;
        if (data.localKey) job.localKey = data.localKey;
        if (data.message) job.message = data.message;
        if (typeof data.etaSeconds === 'number') job.etaSeconds = data.etaSeconds;
        if (typeof data.etaLabel === 'string') job.etaLabel = data.etaLabel;
      });
    }

    return {
      ok: true,
      jobId: data.jobId ?? jobId,
      status: normalizedStatus,
      progress: typeof data.progress === 'number' ? data.progress : mockJob?.progress ?? 0,
      videoUrl: data.videoUrl ?? mockJob?.videoUrl ?? null,
      thumbUrl: data.thumbUrl ?? mockJob?.thumbUrl ?? null,
      pricing: data.pricing ?? mockJob?.pricing,
      finalPriceCents: data.finalPriceCents ?? mockJob?.pricing?.totalCents ?? undefined,
      currency: data.currency ?? mockJob?.pricing?.currency ?? undefined,
      paymentStatus: data.paymentStatus ?? mockJob?.paymentStatus ?? 'platform',
      batchId: data.batchId ?? mockJob?.batchId ?? undefined,
      groupId: data.groupId ?? mockJob?.groupId ?? undefined,
      iterationIndex: data.iterationIndex ?? mockJob?.iterationIndex ?? undefined,
      iterationCount: data.iterationCount ?? mockJob?.iterationCount ?? undefined,
      renderIds: data.renderIds ?? mockJob?.renderIds ?? undefined,
      heroRenderId: data.heroRenderId ?? mockJob?.heroRenderId ?? undefined,
      localKey: data.localKey ?? mockJob?.localKey ?? undefined,
      message: data.message ?? mockJob?.message ?? undefined,
      etaSeconds: data.etaSeconds ?? mockJob?.etaSeconds ?? undefined,
      etaLabel: data.etaLabel ?? mockJob?.etaLabel ?? undefined,
    };
  } catch (error) {
    if (mockJob != null) {
      return buildFromMock(mockJob!);
    }
    throw error instanceof Error ? error : new Error('Status fetch failed');
  }

  if (mockJob != null) {
    return buildFromMock(mockJob!);
  }

  throw new Error('Job not found');
}

export async function hideJob(jobId: string): Promise<void> {
  removeMockJob(jobId);
}
