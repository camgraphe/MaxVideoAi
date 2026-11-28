import type { SubmitOutcome } from '@/lib/video-purchase-decision';
import type { NormalizedVideoProviderTask } from '../types';

type VideoBody = {
  model: string;
  provider: { only: string[]; allow_fallbacks: boolean };
  duration_secs: number;
  strict_duration: boolean;
  resolution: string;
  aspect_ratio?: string;
  prompt: string;
  input_references?: { type: string; image_url: { url: string } }[];
  generate_audio?: boolean;
  prompt_extend?: boolean;
};

export type PinnedVideoRequest = { body: VideoBody; hostModel: string; maximumUsd: number };

export class VideoRouterSubmitError extends Error {
  constructor(readonly outcome: Exclude<SubmitOutcome, 'accepted'>, readonly code: string) { super(code); }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function amount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
// Host-issued IDs can include a namespace before a UUID.
function taskId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= 200 && /^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)*$/.test(id);
}
function rejectSubmission(status: number, body: Record<string, unknown>): never {
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

export function createPinnedVideoRouterClient(key = process.env.VIDEOROUTER_API_KEY, fetcher = fetch) {
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
    async createVideo({ body, hostModel, maximumUsd }: PinnedVideoRequest): Promise<NormalizedVideoProviderTask> {
      if (!amount(maximumUsd) || body.provider.only.length !== 1 || body.provider.allow_fallbacks !== false ||
          body.strict_duration !== true || !body.model.endsWith('/' + body.provider.only[0]) || !body.aspect_ratio) {
        throw new VideoRouterSubmitError('refused', 'UNSUPPORTED_PILOT_INPUT');
      }
      // The quote does not render. Only this phase may hand off after a lost response.
      const quote = await request('pricing/estimate', { ...body, type: 'video' }).catch(() => null);
      if (quote && [400, 403, 422].includes(quote.status) && record(quote.data.error).code !== 'missing_scope') {
        throw new VideoRouterSubmitError('invalid', 'REQUEST_REJECTED');
      }
      const price = quote?.data;
      const shape = record(price?.assumptions);
      if (quote?.status !== 200 || price?.object !== 'pricing.estimate' || price.type !== 'video' ||
          price.currency !== 'USD' || ![hostModel, body.model].includes(String(price.model)) ||
          shape.duration_secs !== body.duration_secs || String(shape.resolution).toLowerCase() !== body.resolution ||
          (shape.reference_images ?? 0) !== (body.input_references?.length ?? 0) || shape.aspect_ratio !== body.aspect_ratio ||
          !amount(price.estimated_cost_usd) || !amount(price.max_cost_usd) ||
          price.max_cost_usd < price.estimated_cost_usd || price.max_cost_usd > maximumUsd) {
        throw new VideoRouterSubmitError('refused', 'VIDEOROUTER_QUOTE_UNAVAILABLE');
      }
      const { status, data } = await request('videos', body).catch(() => {
        throw new VideoRouterSubmitError('uncertain', 'SUBMISSION_UNCONFIRMED');
      });
      if (taskId(data.id)) return { providerJobId: data.id, status: 'queued', rawStatus: 'submitted', videoUrl: null,
        usage: null, message: null, raw: { id: data.id, httpStatus: status, quotedUsd: price.estimated_cost_usd } };
      if (data.id != null || data.data != null || data.request_id != null || data.task_id != null) {
        throw new VideoRouterSubmitError('uncertain', 'UNRECOGNIZED_ACK');
      }
      return rejectSubmission(status, data);
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
