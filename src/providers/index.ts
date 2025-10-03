import { falProvider } from "@/providers/fal";
import type { ProviderAdapter, ProviderId } from "@/providers/types";
import { veoProvider } from "@/providers/veo";

const registry: Record<ProviderId, ProviderAdapter> = {
  veo: veoProvider,
  fal: falProvider,
};

export function getProviderAdapter(provider: ProviderId): ProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) {
    throw new Error(`Unsupported provider ${provider}`);
  }
  return adapter;
}
