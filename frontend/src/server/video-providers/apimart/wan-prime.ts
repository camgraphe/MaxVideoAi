import { wanImageMode } from './wan-image-mode';
import type { AlibabaVideoPayload } from '../alibaba-model-studio/types';
import type { NormalizedVideoProviderTask } from '../types';
import type { SubmitOutcome } from '@/lib/video-purchase-decision';

export class ApimartSubmitError extends Error {
  constructor(
    readonly outcome: Exclude<SubmitOutcome, 'accepted'>,
    readonly code: string
  ) {
    super(code);
  }
}

export function buildApimartWanRequest(payload: AlibabaVideoPayload) {
  const media = payload.input.media ?? [];
  const first = media.filter((item) => item.type === 'first_frame');
  const last = media.filter((item) => item.type === 'last_frame');
  const references = media.filter((item) => item.type === 'reference_image');
  const ordered = [...first, ...last, ...references];
  const mode = first.length || last.length ? 'i2v' : references.length ? 'ref2v' : 't2v';
  const type = wanImageMode(mode, first.length + references.length, first.length > 0, last.length > 0);
  if (payload.model !== 'wan3.0-video-prime' || !type || last.length > 1 || ordered.length !== media.length) {
    throw new ApimartSubmitError('invalid', 'UNSUPPORTED_PILOT_INPUT');
  }
  const p = payload.parameters;
  return {
    model: payload.model,
    prompt: payload.input.prompt,
    duration: p.duration,
    resolution: p.resolution,
    size: p.ratio,
    audio: p.audio,
    prompt_extend: p.prompt_extend,
    seed: p.seed,
    watermark: p.watermark,
    ...(type === 'text' ? {} : { generation_type: type, image_urls: ordered.map((item) => item.url) }),
  };
}
function record(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function taskId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value) ? value : null;
}

export function createApimartClient(apiKey = process.env.APIMART_API_KEY, fetcher: typeof fetch = fetch) {
  if (!apiKey?.trim()) throw new Error('APIMart credential is missing');
  async function request(path: string, body?: object) {
    const response = await fetcher('https://api.apimart.ai/v1/' + path, {
      method: body ? 'POST' : 'GET',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = record(await response.json().catch(() => null));
    return { response, json };
  }
  return {
    async createVideo(payload: AlibabaVideoPayload): Promise<NormalizedVideoProviderTask> {
      const { response, json } = await request('videos/generations', buildApimartWanRequest(payload));
      const data = Array.isArray(json.data) ? record(json.data[0]) : record(json.data);
      const id = taskId(data.task_id);
      // A task ID always takes precedence over an HTTP or envelope error.
      if (id)
        return {
          providerJobId: id,
          status: 'queued',
          rawStatus: 'submitted',
          videoUrl: null,
          message: null,
          usage: null,
          raw: { task_id: id, httpStatus: response.status },
        };
      if (data.task_id != null || (Array.isArray(json.data) && json.data.length > 0)) {
        throw new ApimartSubmitError('uncertain', 'UNRECOGNIZED_ACK');
      }
      if (
        !response.ok &&
        [402, 429].includes(response.status) &&
        (json.error || json.code === response.status)
      ) {
        throw new ApimartSubmitError(
          'refused',
          response.status === 402 ? 'INSUFFICIENT_BALANCE' : 'RATE_LIMITED'
        );
      }
      if ([400, 401, 403, 422].includes(response.status) && (json.error || json.code === response.status)) {
        throw new ApimartSubmitError('invalid', 'REQUEST_REJECTED');
      }
      throw new ApimartSubmitError('uncertain', 'SUBMISSION_UNCONFIRMED');
    },
    async getTask(id: string): Promise<NormalizedVideoProviderTask> {
      if (!taskId(id)) throw new Error('Invalid APIMart task identity');
      const { response, json } = await request('tasks/' + encodeURIComponent(id));
      const data = record(json.data);
      if (!response.ok || (data.id && data.id !== id) || (data.task_id && data.task_id !== id))
        throw new Error('APIMart task read failed');
      const rawStatus = String(data.status ?? '');
      const states = {
        submitted: 'queued',
        pending: 'queued',
        queued: 'queued',
        processing: 'running',
        running: 'running',
        completed: 'completed',
        failed: 'failed',
        cancelled: 'failed',
        canceled: 'failed',
      } as const;
      if (!Object.hasOwn(states, rawStatus)) throw new Error('Unrecognized APIMart task status');
      const status = states[rawStatus as keyof typeof states];
      const videos = record(data.result).videos;
      const urls = Array.isArray(videos) ? record(videos[0]).url : null;
      const videoUrl =
        Array.isArray(urls) && typeof urls[0] === 'string' && urls[0].startsWith('https://') ? urls[0] : null;
      if (status === 'completed' && !videoUrl) throw new Error('Completed APIMart task has no output yet');
      return {
        providerJobId: id,
        status,
        rawStatus,
        videoUrl,
        message: status === 'failed' ? 'Video generation failed.' : null,
        usage: null,
        raw: { task_id: id, status: rawStatus },
      };
    },
  };
}
