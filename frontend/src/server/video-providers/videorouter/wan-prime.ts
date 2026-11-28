import type { SubmitOutcome } from '@/lib/video-purchase-decision';
import type { AlibabaVideoPayload } from '../alibaba-model-studio/types';
import type { NormalizedVideoProviderTask } from '../types';

export const VIDEOROUTER_PRIME_MODEL = 'alibaba/wan-3.0-prime/botsmart';
const hostModel = 'botsmart/wan-3.0-prime';
export function reviewedBotSmartDuration(seconds: number) {
  return Number.isInteger(seconds) && ((seconds >= 2 && seconds <= 5) || seconds === 15);
}
export const botSmartCostMicros = (seconds: number) => Math.ceil(seconds * 39700 * 1025 / 1000);
const taskId = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(id);
const amount = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
function record(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

export class VideoRouterSubmitError extends Error {
  constructor(readonly outcome: Exclude<SubmitOutcome, 'accepted'>, readonly code: string) { super(code); }
}

function checkRejection(status: number, body: Record<string, unknown>): never {
  const code = record(body.error).code;
  if ((status === 402 && ['spend_cap_exceeded', 'insufficient_credits'].includes(String(code))) ||
      (status === 429 && ['concurrency_limit', 'rpm_limit', 'tpm_limit', 'org_rpm_limit'].includes(String(code))) ||
      (status === 401 && code === 'invalid_api_key') || (status === 403 && code === 'missing_scope')) {
    throw new VideoRouterSubmitError('refused', String(code));
  }
  if ((status === 400 || status === 422 || status === 403) && typeof code === 'string') {
    throw new VideoRouterSubmitError('invalid', 'REQUEST_REJECTED');
  }
  throw new VideoRouterSubmitError('uncertain', 'SUBMISSION_UNCONFIRMED');
}

const statuses = { queued: 'queued', in_progress: 'running', completed: 'completed', failed: 'failed',
  canceled: 'failed', cancelled: 'failed' } as const;

export function createVideoRouterClient(key = process.env.VIDEOROUTER_API_KEY, fetcher = fetch) {
  async function request(path: string, body?: object) {
    if (!key?.trim()) throw new VideoRouterSubmitError('refused', 'VIDEOROUTER_UNCONFIGURED');
    const response = await fetcher('https://videorouter.sh/v1/' + path, {
      method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: record(await response.json().catch(() => null)) };
  }
  return {
    async createVideo(payload: AlibabaVideoPayload): Promise<NormalizedVideoProviderTask> {
      const p = payload.parameters;
      if (payload.model !== 'wan3.0-video-prime' || payload.input.media?.length || !payload.input.prompt?.trim() ||
          p.resolution !== '480P' || p.ratio !== '16:9' || !p.audio || !p.prompt_extend || p.seed !== undefined ||
          !reviewedBotSmartDuration(p.duration)) {
        throw new VideoRouterSubmitError('invalid', 'UNSUPPORTED_PILOT_INPUT');
      }
      const body = { model: VIDEOROUTER_PRIME_MODEL, provider: { only: ['botsmart'], allow_fallbacks: false },
        duration_secs: p.duration, strict_duration: true, resolution: '480p', aspect_ratio: p.ratio,
        generate_audio: p.audio, prompt_extend: p.prompt_extend, prompt: payload.input.prompt };
      // The quote endpoint never submits a job. A failed price check can safely hand off.
      const quote = await request('pricing/estimate', { ...body, type: 'video' }).catch(() => null);
      if (quote && [400, 403, 422].includes(quote.status) && record(quote.data.error).code !== 'missing_scope') {
        throw new VideoRouterSubmitError('invalid', 'REQUEST_REJECTED');
      }
      const price = quote?.data;
      const shape = record(price?.assumptions);
      if (quote?.status !== 200 || price?.object !== 'pricing.estimate' || price.type !== 'video' ||
          price.currency !== 'USD' || ![hostModel, VIDEOROUTER_PRIME_MODEL].includes(String(price.model)) ||
          shape.duration_secs !== p.duration || String(shape.resolution).toLowerCase() !== '480p' ||
          shape.aspect_ratio !== p.ratio || !amount(price.estimated_cost_usd) || !amount(price.max_cost_usd) ||
          price.max_cost_usd < price.estimated_cost_usd || price.max_cost_usd > botSmartCostMicros(p.duration) / 1e6) {
        throw new VideoRouterSubmitError('refused', 'VIDEOROUTER_QUOTE_UNAVAILABLE');
      }
      const { status, data } = await request('videos', body);
      if (taskId(data.id)) return { providerJobId: data.id, status: 'queued', rawStatus: 'submitted', videoUrl: null,
        usage: null, message: null, raw: { id: data.id, httpStatus: status, quotedUsd: price.estimated_cost_usd } };
      if (data.id != null || data.data != null) throw new VideoRouterSubmitError('uncertain', 'UNRECOGNIZED_ACK');
      return checkRejection(status, data);
    },
    async getTask(id: string): Promise<NormalizedVideoProviderTask> {
      if (!taskId(id)) throw new Error('Invalid VideoRouter job ID');
      const { status: http, data } = await request('videos/' + encodeURIComponent(id));
      const rawStatus = String(data.status);
      if (http !== 200 || data.id !== id || !Object.hasOwn(statuses, rawStatus)) throw new Error('VideoRouter poll unavailable');
      const status = statuses[rawStatus as keyof typeof statuses];
      const url = Array.isArray(data.data) ? record(data.data[0]).url : null;
      const videoUrl = typeof url === 'string' && url.startsWith('https://') ? url : null;
      if (status === 'completed' && !videoUrl) throw new Error('VideoRouter output pending');
      const cost = amount(data.cost_usd) ? data.cost_usd : null;
      return { providerJobId: id, status, rawStatus, videoUrl, usage: null, providerCostUsd: cost,
        message: status === 'failed' ? 'Video generation failed.' : null, raw: { id, status: rawStatus, cost_usd: cost } };
    },
  };
}
