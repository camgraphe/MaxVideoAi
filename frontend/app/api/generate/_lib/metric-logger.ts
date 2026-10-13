import type { Mode } from '@/types/engines';
import { recordGenerateMetric, type GenerateMetricInput } from '@/server/generate-metrics';
import { getBaseEngineIncludingHidden } from '@/lib/engines';
import { resolveBytePlusTransport } from '@/server/video-providers/byteplus-modelark';
import type { GenerateRouteContextResult } from './route-context';

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

/** Accepted is recorded at reservation; a pending provider response adds no duplicate event. */
export function terminalGenerateMetricStatus(status: string): 'completed' | 'failed' | null {
  return status === 'completed' || status === 'failed' ? status : null;
}

type RecordGenerateMetric = (input: GenerateMetricInput) => void | Promise<void>;

const PREFLIGHT_ERROR_CODES = new Set([
  'BYTEPLUS_LAS_EXECUTION_DISABLED', 'BYTEPLUS_LAS_API_KEY_MISSING',
  'BYTEPLUS_API_KEY_MISSING', 'BYTEPLUS_MODEL_ID_MISSING',
  'BYTEPLUS_ENGINE_DISABLED', 'BYTEPLUS_ENGINE_PROFILE_MISSING',
  'BYTEPLUS_PROFILE_PREFLIGHT_FAILED',
  'BYTEPLUS_LAS_WALLET_REQUIRED',
]);

export function createGenerateMetricLogger(params: {
  requestStartedAt: number;
  now?: () => number;
  recordMetric?: RecordGenerateMetric;
}): {
  state: GenerateRouteMetricState;
  log: (status: GenerateRouteMetricStatus, options?: GenerateRouteMetricOptions) => void;
  logPreflightRejection: (body: Record<string, unknown>, result: GenerateRouteContextResult) => Promise<void>;
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
      durationSource: 'request_elapsed',
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

  const logPreflightRejection = async (body: Record<string, unknown>, result: GenerateRouteContextResult) => {
    if (result.ok || typeof body.engineId !== 'string') return;
    const engine = getBaseEngineIncludingHidden(body.engineId);
    if (engine?.id !== 'seedance-2-5') return;
    const error = result.body.error;
    const errorCode = error === 'Engine unavailable' ? 'ENGINE_UNAVAILABLE'
      : typeof error === 'string' && PREFLIGHT_ERROR_CODES.has(error) ? error : null;
    if (!errorCode) return;
    const rawMode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
    const mode = engine.modes.find((candidate) => candidate === rawMode)
      ?? (body.mode === undefined ? engine.modes[0] : undefined);
    if (!mode) return;
    const transport = resolveBytePlusTransport(engine.id, mode);
    // This event precedes authentication/billing. Never copy caller IDs, settings,
    // messages, media or prompts into either sink.
    console.warn('[api/generate] preflight rejected', {
      engineId: engine.id, mode, status: result.status, code: errorCode,
      provider: 'byteplus_modelark', transport,
    });
    try {
      await recordMetric({
        engineId: engine.id, engineLabel: engine.label, mode,
        jobId: null, userId: null, status: 'rejected',
        durationMs: now() - params.requestStartedAt, errorCode,
        meta: { stage: 'route_preflight', httpStatus: result.status,
          provider: 'byteplus_modelark', transport, durationSource: 'request_elapsed' },
      });
    } catch {
      // The immediate runtime trace remains available if the metric sink fails.
    }
  };

  return { state, log, logPreflightRejection };
}
