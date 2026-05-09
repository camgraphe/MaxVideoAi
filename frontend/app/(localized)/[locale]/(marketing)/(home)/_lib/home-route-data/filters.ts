import { listFalEngines } from '@/config/falEngines';
import type { ProviderItem, ToolCard } from '@/components/marketing/home/HomeRedesignSections';
import { ALLOWED_TOOL_CARD_IDS, PROVIDER_MODEL_LINKS } from './constants';
import type { EngineStats, RedesignContent } from './types';

export function filterProviderItems(content: RedesignContent): ProviderItem[] {
  const providers = new Set(listFalEngines().map((entry) => entry.provider.toLowerCase()));
  return content.providers.items
    .filter((item) => providers.has(item.providerKey.toLowerCase()))
    .map(({ provider, model, href, providerKey }) => ({
      provider,
      model,
      href: href ?? PROVIDER_MODEL_LINKS[providerKey],
    }));
}

export function filterToolCards(content: RedesignContent, stats: EngineStats): ToolCard[] {
  return content.toolbox.cards.filter((tool) => {
    if (!ALLOWED_TOOL_CARD_IDS.has(tool.id)) return false;
    if (tool.id === 'extend-video') return stats.extend > 0;
    if (tool.id === 'retake') return stats.retake > 0;
    if (tool.id === 'audio-to-video') return stats.audioToVideo > 0 || stats.audio > 0;
    if (tool.id === 'video-to-video') return stats.videoToVideo > 0;
    return true;
  });
}
