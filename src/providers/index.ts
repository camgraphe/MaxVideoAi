import { falProvider } from "@/providers/fal";
import { kiwiProvider } from "@/providers/kiwi";
import type { ProviderAdapter, ProviderId } from "@/providers/types";
import { veoProvider } from "@/providers/veo";

const registry: Record<ProviderId, ProviderAdapter> = {
  veo: veoProvider,
  fal: falProvider,
  kiwi: kiwiProvider,
};

export function getProviderAdapter(provider: ProviderId): ProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) {
    throw new Error(`Unsupported provider ${provider}`);
  }
  return adapter;
}
