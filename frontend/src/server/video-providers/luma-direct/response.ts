import type { NormalizedVideoProviderTask } from '../types';

type LumaOutput = {
  type?: string;
  url?: string;
};

export type LumaGeneration = {
  id?: string;
  state?: string;
  output?: LumaOutput[];
  failure_reason?: string | null;
  failure_code?: string | null;
  [key: string]: unknown;
};

function normalizeState(state: string | undefined): NormalizedVideoProviderTask['status'] {
  const normalized = (state ?? '').trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'succeeded' || normalized === 'success') return 'completed';
  if (normalized === 'failed' || normalized === 'error' || normalized === 'cancelled' || normalized === 'canceled') {
    return 'failed';
  }
  if (normalized === 'running' || normalized === 'processing') return 'running';
  return 'queued';
}

function extractVideoUrl(output: unknown): string | null {
  if (!Array.isArray(output)) return null;
  const video = output.find((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as LumaOutput;
    return typeof candidate.url === 'string' && (!candidate.type || candidate.type === 'video');
  }) as LumaOutput | undefined;
  return typeof video?.url === 'string' && video.url.trim().length ? video.url.trim() : null;
}

export function normalizeLumaDirectGeneration(raw: LumaGeneration, providerJobId?: string): NormalizedVideoProviderTask {
  const status = normalizeState(raw.state);
  const failureMessage =
    typeof raw.failure_reason === 'string' && raw.failure_reason.trim().length ? raw.failure_reason.trim() : null;
  return {
    providerJobId: providerJobId ?? (typeof raw.id === 'string' ? raw.id : ''),
    status,
    rawStatus: typeof raw.state === 'string' ? raw.state : null,
    videoUrl: status === 'completed' ? extractVideoUrl(raw.output) : null,
    message: status === 'failed' ? failureMessage ?? 'Luma generation failed.' : failureMessage,
    usage: null,
    raw,
  };
}
