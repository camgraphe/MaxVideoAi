import { randomUUID } from "node:crypto";
import type { ProviderAdapter, JobStatus, PollJobResult } from "@/providers/types";

interface KiwiJobState {
  status: JobStatus;
  progress: number;
  outputUrl?: string;
  thumbnailUrl?: string;
  costActualCents?: number;
  durationSeconds?: number;
  error?: string;
}

const PLACEHOLDER_VIDEO = "https://storage.googleapis.com/supademo-assets/videos/teaser.mp4";
const PLACEHOLDER_THUMBNAIL = "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=900";

const jobStore = new Map<string, KiwiJobState>();

function scheduleKiwiLifecycle(jobId: string, durationSeconds: number) {
  jobStore.set(jobId, { status: "pending", progress: 10 });

  setTimeout(() => {
    jobStore.set(jobId, { status: "running", progress: 55 });
  }, 600);

  setTimeout(() => {
    jobStore.set(jobId, {
      status: "completed",
      progress: 100,
      outputUrl: PLACEHOLDER_VIDEO,
      thumbnailUrl: PLACEHOLDER_THUMBNAIL,
      costActualCents: 0,
      durationSeconds,
    });
  }, 2200);
}

function buildPollResult(jobId: string, state?: KiwiJobState): PollJobResult {
  if (!state) {
    return {
      jobId,
      provider: "kiwi",
      status: "completed",
      progress: 100,
      outputUrl: PLACEHOLDER_VIDEO,
      thumbnailUrl: PLACEHOLDER_THUMBNAIL,
      costActualCents: 0,
    };
  }

  return {
    jobId,
    provider: "kiwi",
    status: state.status,
    progress: state.progress,
    outputUrl: state.outputUrl,
    thumbnailUrl: state.thumbnailUrl,
    costActualCents: state.costActualCents,
    durationSeconds: state.durationSeconds,
    error: state.error,
  };
}

export const kiwiProvider: ProviderAdapter = {
  async startJob(input) {
    const jobId = randomUUID();
    scheduleKiwiLifecycle(jobId, input.durationSeconds);

    return {
      jobId,
      provider: "kiwi",
      status: "pending",
      estimatedSeconds: input.durationSeconds,
      externalId: jobId,
    };
  },

  async pollJob(providerJobId) {
    const state = jobStore.get(providerJobId);
    return buildPollResult(providerJobId, state);
  },
};
