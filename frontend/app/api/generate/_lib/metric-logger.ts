import type { Mode } from '@/types/engines';
import { recordGenerateMetric, type GenerateMetricInput } from '@/server/generate-metrics';

export type GenerateRouteMetricState = {
  engineId: string | null;
  engineLabel: string | null;
  mode: Mode | null;
  userId: string | null;
  jobId: string | null;
  durationSec: number | null;
  resolution: string | null;
};

export type GenerateRouteMetricStatus = 'accepted' | 'rejected' | 'completed' | 'failed';

export type GenerateRouteMetricOptions = {
  errorCode?: string;
  meta?: Record<string, unknown>;
  durationMs?: number;
  jobId?: string | null;
};

type RecordGenerateMetric = (input: GenerateMetricInput) => void | Promise<void>;

export function createGenerateMetricLogger(params: {
  requestStartedAt: number;
  now?: () => number;
  recordMetric?: RecordGenerateMetric;
}): {
  state: GenerateRouteMetricState;
  log: (status: GenerateRouteMetricStatus, options?: GenerateRouteMetricOptions) => void;
} {
  const now = params.now ?? Date.now;
  const recordMetric = params.recordMetric ?? recordGenerateMetric;
  const state: GenerateRouteMetricState = {
    engineId: null,
    engineLabel: null,
    mode: null,
    userId: null,
    jobId: null,
    durationSec: null,
    resolution: null,
  };

  const log = (status: GenerateRouteMetricStatus, options?: GenerateRouteMetricOptions) => {
    if (!state.engineId) return;
    const durationMs = options?.durationMs ?? now() - params.requestStartedAt;
    const meta = {
      durationSec: state.durationSec,
      resolution: state.resolution,
      ...(options?.meta ?? {}),
    };
    void recordMetric({
      jobId: options?.jobId ?? state.jobId,
      userId: state.userId,
      engineId: state.engineId,
      engineLabel: state.engineLabel ?? undefined,
      mode: state.mode ?? undefined,
      status,
      durationMs,
      errorCode: options?.errorCode,
      meta,
    });
  };

  return { state, log };
}
