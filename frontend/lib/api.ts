import { useEffect } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { computePreflight, enginesResponse, getEngineById } from '@/lib/engines';
import type {
  AspectRatio,
  EngineCaps,
  EnginesResponse,
  Mode,
  PreflightRequest,
  PreflightResponse,
  Resolution,
} from '@/types/engines';
import type { Job, JobsPage } from '@/types/jobs';
import type { PricingSnapshot } from '@maxvideoai/pricing';

type SampleMedia = {
  videoUrl: string;
  thumbUrl: string;
  aspectRatio: string;
};

const SAMPLE_MEDIA: SampleMedia[] = [
  { videoUrl: '/hero/sora2.mp4', thumbUrl: '/hero/sora2.jpg', aspectRatio: '16:9' },
  { videoUrl: '/hero/luma-dream.mp4', thumbUrl: '/hero/luma-dream.jpg', aspectRatio: '16:9' },
  { videoUrl: '/hero/runway-gen3.mp4', thumbUrl: '/hero/runway-gen3.jpg', aspectRatio: '16:9' },
  { videoUrl: '/hero/pika-15.mp4', thumbUrl: '/hero/pika-15.jpg', aspectRatio: '16:9' },
];

const MAX_JOBS = 40;

type GeneratePayload = {
  engineId: string;
  prompt: string;
  durationSec: number;
  aspectRatio: string;
  resolution: string;
  fps: number;
  mode: Mode;
  addons?: {
    audio?: boolean;
    upscale4k?: boolean;
    [key: string]: unknown;
  };
  membershipTier?: string;
  payment?: { mode?: string | null } | null;
  negativePrompt?: string;
  inputs?: unknown;
  idempotencyKey?: string;
  apiKey?: string;
};

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
  providerJobId: string;
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
};

type MockJob = {
  jobId: string;
  engine: EngineCaps;
  payload: GeneratePayload & { addons: { audio: boolean; upscale4k: boolean } };
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  updatedAt: number;
  thumbUrl: string | null;
  videoUrl: string | null;
  pricing?: PricingSnapshot;
  paymentStatus: string;
  sample: SampleMedia;
};

const mockJobs = new Map<string, MockJob>();
const jobListeners = new Set<() => void>();
const progressTimers = new Map<string, number>();
let sampleCursor = 0;

function notifyJobListeners() {
  if (!jobListeners.size) return;
  Array.from(jobListeners).forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors to keep demo running
    }
  });
}

function subscribeToJobs(listener: () => void) {
  jobListeners.add(listener);
  return () => {
    jobListeners.delete(listener);
  };
}

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

function ensureJobCapacity() {
  if (mockJobs.size <= MAX_JOBS) return;
  const ordered = Array.from(mockJobs.values()).sort((a, b) => a.createdAt - b.createdAt);
  while (ordered.length > MAX_JOBS) {
    const job = ordered.shift();
    if (job) {
      clearJobTimer(job.jobId);
      mockJobs.delete(job.jobId);
    }
  }
}

function clearJobTimer(jobId: string) {
  const timer = progressTimers.get(jobId);
  if (timer != null) {
    if (typeof window !== 'undefined') {
      window.clearInterval(timer);
    } else {
      clearInterval(timer);
    }
    progressTimers.delete(jobId);
  }
}

function scheduleJobLifecycle(job: MockJob) {
  if (typeof window === 'undefined') return;
  const totalMs = 5000 + Math.random() * 5000;
  const start = Date.now();
  const interval = window.setInterval(() => {
    const current = mockJobs.get(job.jobId);
    if (!current) {
      window.clearInterval(interval);
      progressTimers.delete(job.jobId);
      return;
    }
    const elapsed = Date.now() - start;
    const progress = Math.min(100, Math.round((elapsed / totalMs) * 100));
    current.progress = Math.max(current.progress, progress);
    if (progress >= 100 && current.status !== 'completed') {
      current.status = 'completed';
      current.videoUrl = current.sample.videoUrl;
      current.thumbUrl = current.sample.thumbUrl;
      window.clearInterval(interval);
      progressTimers.delete(job.jobId);
    }
    current.updatedAt = Date.now();
    notifyJobListeners();
  }, 600);
  progressTimers.set(job.jobId, interval);
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
  const jobs = Array.from(mockJobs.values())
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
    thumbUrl: job.thumbUrl ?? undefined,
    videoUrl: job.videoUrl ?? undefined,
    createdAt: new Date(job.createdAt).toISOString(),
    engineId: job.engine.id,
    aspectRatio: job.payload.aspectRatio,
    status: job.status,
    progress: job.progress,
    finalPriceCents: job.pricing?.totalCents,
    currency: job.pricing?.currency,
    pricingSnapshot: job.pricing,
    paymentStatus: job.paymentStatus,
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

export function useInfiniteJobs(pageSize = 12) {
  const swr = useSWRInfinite<JobsPage>(
    (index) => (index === 0 ? `mock-jobs-${pageSize}` : null),
    async () => buildJobsPage(pageSize),
    { revalidateOnFocus: false }
  );

  const { mutate } = swr;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsubscribe = subscribeToJobs(() => {
      void mutate();
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
  _options?: GenerateOptions
): Promise<GenerateResult> {
  void _options;

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

  const jobId = `job_${generateRandomId()}`;
  const sample = selectSample();
  const now = Date.now();
  const paymentMode = payload.payment?.mode ?? 'platform';
  const paymentStatus = paymentMode === 'wallet' ? 'paid_wallet' : 'platform';

  const job: MockJob = {
    jobId,
    engine,
    payload: { ...payload, addons, resolution, aspectRatio },
    status: 'processing',
    progress: 5,
    createdAt: now,
    updatedAt: now,
    thumbUrl: sample.thumbUrl,
    videoUrl: null,
    pricing,
    paymentStatus,
    sample,
  };

  mockJobs.set(jobId, job);
  ensureJobCapacity();
  notifyJobListeners();
  scheduleJobLifecycle(job);

  return {
    ok: true,
    jobId,
    videoUrl: job.videoUrl,
    thumbUrl: job.thumbUrl,
    status: job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'pending',
    progress: job.progress,
    pricing,
    paymentStatus,
    provider: 'mock',
    providerJobId: `mock-${jobId}`,
  };
}

export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  const job = mockJobs.get(jobId);
  if (!job) {
    throw new Error('Job not found');
  }
  return {
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
  };
}

export async function hideJob(jobId: string): Promise<void> {
  if (!mockJobs.has(jobId)) return;
  clearJobTimer(jobId);
  mockJobs.delete(jobId);
  notifyJobListeners();
}
