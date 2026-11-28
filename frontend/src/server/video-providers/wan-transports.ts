import type { SubmitOutcome } from '@/lib/video-purchase-decision';
import { estimateAlibabaJobCost } from '@/server/alibaba-job-accounting';
import { getAlibabaModelStudioClient } from './alibaba-model-studio/client';
import { classifyAlibabaPurchaseFailure } from './alibaba-model-studio/errors';
import { normalizeAlibabaPolledTask } from './alibaba-model-studio/response';
import type { AlibabaModelRoute } from './alibaba-model-studio/model-map';
import type { AlibabaVideoPayload } from './alibaba-model-studio/types';
import { ApimartSubmitError, createApimartClient } from './apimart/wan-prime';
import { APIMART_PRIME_MICROS_PER_SECOND } from './purchase/wan';
import type { NormalizedVideoProviderTask, VideoProviderKey } from './types';
import { createVideoRouterClient, VideoRouterSubmitError, VIDEOROUTER_PRIME_MODEL } from './videorouter/wan-prime';

type WanSubmissionClient = { createVideo(payload: AlibabaVideoPayload): Promise<NormalizedVideoProviderTask> };
type AccountingJob = Parameters<typeof estimateAlibabaJobCost>[0];
export type WanPollOverrides = {
  getAlibabaModelStudioClientFn?: () => { getTask(id: string): Promise<unknown> };
  getVideoRouterClientFn?: typeof createVideoRouterClient;
  getApimartClientFn?: typeof createApimartClient;
};
type Transport = {
  modelId(route: AlibabaModelRoute): string | null;
  createClient(): WanSubmissionClient;
  readTask(id: string, isWan: boolean, overrides: WanPollOverrides): Promise<NormalizedVideoProviderTask>;
  pollEnabled(): boolean;
  estimateCost(job: AccountingJob, task: NormalizedVideoProviderTask | undefined, resolution: string): Omit<ReturnType<typeof estimateAlibabaJobCost>, 'status'> & {
    status: ReturnType<typeof estimateAlibabaJobCost>['status'] | 'provider_reported' | 'provider_cost_pending';
  };
  classifyFailure(error: unknown): { outcome: Exclude<SubmitOutcome, 'accepted'>; code: string };
};

/** One registration owns an accepted job from submit to cost attribution. All I/O is lazy. */
export const wanTransports = {
  alibaba_model_studio: {
    modelId: route => route.model,
    createClient: getAlibabaModelStudioClient,
    readTask: async (id, isWan, overrides) => {
      const client = (overrides.getAlibabaModelStudioClientFn ?? getAlibabaModelStudioClient)();
      return normalizeAlibabaPolledTask(await client.getTask(id), id, isWan);
    },
    pollEnabled: () => ['1', 'true', 'yes', 'on'].includes((process.env.ALIBABA_MODEL_STUDIO_ENABLED ?? '').trim().toLowerCase()),
    estimateCost: estimateAlibabaJobCost,
    classifyFailure: classifyAlibabaPurchaseFailure,
  },
  videorouter: {
    modelId: route => route.model === 'wan3.0-video-prime' ? VIDEOROUTER_PRIME_MODEL : null,
    createClient: createVideoRouterClient,
    readTask: (id, _isWan, overrides) => (overrides.getVideoRouterClientFn ?? createVideoRouterClient)().getTask(id),
    pollEnabled: () => Boolean(process.env.VIDEOROUTER_API_KEY?.trim()),
    estimateCost: (job, task) => {
      const cost = task?.providerCostUsd ?? null;
      return { providerCostUsd: cost, providerCostUnits: null, source: 'videorouter_job_cost_usd',
        status: cost === null ? 'provider_cost_pending' : 'provider_reported',
        inputVideoDurationSec: 0, outputVideoDurationSec: job.duration_sec };
    },
    classifyFailure: error => error instanceof VideoRouterSubmitError
      ? error : { outcome: 'uncertain', code: 'SUBMISSION_UNCONFIRMED' },
  },
  apimart: {
    modelId: route => route.model === 'wan3.0-video-prime' ? route.model : null,
    createClient: createApimartClient,
    readTask: (id, _isWan, overrides) => (overrides.getApimartClientFn ?? createApimartClient)().getTask(id),
    // Accepted jobs keep their owner after new submissions have been disabled.
    pollEnabled: () => Boolean(process.env.APIMART_API_KEY?.trim()),
    estimateCost: (job, _task, resolution) => {
      const rate = APIMART_PRIME_MICROS_PER_SECOND[resolution.toLowerCase()];
      const supported = job.engine_id === 'wan-3-prime' && Number.isSafeInteger(rate) &&
        Number.isInteger(job.duration_sec) && job.duration_sec >= 2 && job.duration_sec <= 30;
      return {
        providerCostUsd: supported ? rate * job.duration_sec / 1e6 : null,
        providerCostUnits: supported ? job.duration_sec : null,
        source: 'apimart_gold_2026_11_27',
        status: supported ? 'list_estimate_from_verified_durations' : 'list_estimate_unavailable',
        inputVideoDurationSec: 0,
        outputVideoDurationSec: job.duration_sec,
      };
    },
    classifyFailure: error => error instanceof ApimartSubmitError
      ? error : { outcome: 'uncertain', code: 'SUBMISSION_UNCONFIRMED' },
  },
} satisfies Partial<Record<VideoProviderKey, Transport>>;

export type WanDirectProvider = keyof typeof wanTransports;
export type WanClientOverrides = Partial<Record<WanDirectProvider, () => WanSubmissionClient>>;
export function isWanDirectProvider(provider: string | null): provider is WanDirectProvider {
  return provider !== null && Object.hasOwn(wanTransports, provider);
}
export function enabledWanPollProviders() {
  return Object.keys(wanTransports).filter(isWanDirectProvider).filter(provider => wanTransports[provider].pollEnabled());
}
export function getWanSubmissionClient(provider: WanDirectProvider, overrides: WanClientOverrides) {
  return (overrides[provider] ?? wanTransports[provider].createClient)();
}
