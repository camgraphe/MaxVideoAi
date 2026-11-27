import { getAlibabaModelStudioClient } from './alibaba-model-studio/client';
import { createApimartClient } from './apimart/wan-prime';
import type { AlibabaVideoPayload } from './alibaba-model-studio/types';
import type { NormalizedVideoProviderTask, VideoProviderKey } from './types';

type WanSubmissionClient = { createVideo(payload: AlibabaVideoPayload): Promise<NormalizedVideoProviderTask> };
/** Factories are lazy; ranking a request never creates a client or opens a connection. */
const clients = {
  alibaba_model_studio: getAlibabaModelStudioClient,
  apimart: createApimartClient,
} satisfies Partial<Record<VideoProviderKey, () => WanSubmissionClient>>;

export type WanDirectProvider = keyof typeof clients;
export type WanClientOverrides = Partial<Record<WanDirectProvider, () => WanSubmissionClient>>;
export function isWanDirectProvider(provider: VideoProviderKey | null): provider is WanDirectProvider {
  return provider !== null && Object.hasOwn(clients, provider);
}
export function getWanSubmissionClient(provider: WanDirectProvider, overrides: WanClientOverrides) {
  return (overrides[provider] ?? clients[provider])();
}
