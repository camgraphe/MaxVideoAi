import type { PricingSnapshot } from '@maxvideoai/pricing';
import type { AspectRatio, EngineCaps, Mode, Resolution } from '@/types/engines';

export type MockGeneratePayload = {
  engineId: string;
  prompt: string;
  durationSec: number;
  durationOption?: number | string | null;
  numFrames?: number | null;
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
  batchId?: string;
  groupId?: string;
  iterationIndex?: number;
  iterationCount?: number;
  renderIds?: string[];
  heroRenderId?: string | null;
  localKey?: string | null;
  message?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
};

export type SampleMedia = {
  videoUrl: string;
  thumbUrl: string;
  aspectRatio: string;
};

export type MockJob = {
  jobId: string;
  engine: EngineCaps;
  payload: MockGeneratePayload & { addons: { audio: boolean; upscale4k: boolean }; resolution: Resolution; aspectRatio: AspectRatio };
  status: 'pending' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  updatedAt: number;
  thumbUrl: string | null;
  videoUrl: string | null;
  pricing?: PricingSnapshot;
  paymentStatus: string;
  sample: SampleMedia;
  batchId: string | null;
  groupId: string | null;
  iterationIndex: number | null;
  iterationCount: number | null;
  renderIds: string[] | null;
  heroRenderId: string | null;
  localKey: string | null;
  message: string | null;
  etaSeconds: number | null;
  etaLabel: string | null;
};

const mockJobs = new Map<string, MockJob>();
const jobListeners = new Set<() => void>();
const progressTimers = new Map<string, ReturnType<typeof setInterval>>();

function notifyListeners(): void {
  if (!jobListeners.size) return;
  Array.from(jobListeners).forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors to keep demo running
    }
  });
}

function clearTimer(jobId: string): void {
  const timer = progressTimers.get(jobId);
  if (timer != null) {
    clearInterval(timer);
    progressTimers.delete(jobId);
  }
}

export function subscribeMockJobs(listener: () => void): () => void {
  jobListeners.add(listener);
  return () => {
    jobListeners.delete(listener);
  };
}

export function setMockJob(job: MockJob): void {
  mockJobs.set(job.jobId, job);
  notifyListeners();
}

export function updateMockJob(jobId: string, updater: (job: MockJob) => void): void {
  const job = mockJobs.get(jobId);
  if (!job) return;
  updater(job);
  job.updatedAt = Date.now();
  notifyListeners();
}

export function ensureMockJobCapacity(maxJobs: number): void {
  if (mockJobs.size <= maxJobs) return;
  const ordered = Array.from(mockJobs.values()).sort((a, b) => a.createdAt - b.createdAt);
  while (ordered.length > maxJobs) {
    const job = ordered.shift();
    if (!job) break;
    clearTimer(job.jobId);
    mockJobs.delete(job.jobId);
  }
  notifyListeners();
}

export function scheduleMockJobLifecycle(jobId: string, totalMs?: number): void {
  clearTimer(jobId);
  const targetMs = typeof totalMs === 'number' && Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 24000 + Math.random() * 6000;
  const start = Date.now();
  const interval = setInterval(() => {
    const job = mockJobs.get(jobId);
    if (!job) {
      clearInterval(interval);
      progressTimers.delete(jobId);
      return;
    }
    const elapsed = Date.now() - start;
    const progress = Math.min(100, Math.round((elapsed / targetMs) * 100));
    const nextProgress = Math.max(job.progress, progress);
    if (nextProgress !== job.progress) {
      job.progress = nextProgress;
      job.updatedAt = Date.now();
      notifyListeners();
    }
    if (progress >= 100 && job.status !== 'completed') {
      job.status = 'completed';
      job.videoUrl = job.sample.videoUrl;
      job.thumbUrl = job.sample.thumbUrl;
      job.updatedAt = Date.now();
      notifyListeners();
      clearInterval(interval);
      progressTimers.delete(jobId);
    }
  }, 600);
  progressTimers.set(jobId, interval);
}

export function getMockJob(jobId: string): MockJob | undefined {
  return mockJobs.get(jobId);
}

export function getMockJobs(): MockJob[] {
  return Array.from(mockJobs.values());
}

export function removeMockJob(jobId: string): void {
  if (!mockJobs.has(jobId)) return;
  clearTimer(jobId);
  mockJobs.delete(jobId);
  notifyListeners();
}
