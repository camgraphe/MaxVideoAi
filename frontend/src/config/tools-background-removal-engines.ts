import type { BackgroundRemovalToolEngineDefinition } from '@/types/tools-background-removal';

export const BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND = 0.00425;
export const BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER = 2;
export const BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS = 60;

export const BACKGROUND_REMOVAL_TOOL_ENGINES: readonly BackgroundRemovalToolEngineDefinition[] = [
  {
    id: 'bria-video-background-removal-v3',
    label: 'Bria VRMBG 3.0',
    description: 'Queued video background removal with transparent or solid-color output.',
    falModelId: 'bria/video/background-removal/v3',
    billingProductKey: 'background-removal-video-v3',
    providerPriceUsdPerSecond: BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND,
  },
] as const;

const BACKGROUND_REMOVAL_ENGINE_MAP = new Map(
  BACKGROUND_REMOVAL_TOOL_ENGINES.map((engine) => [engine.id, engine])
);

export function listBackgroundRemovalToolEngines(): readonly BackgroundRemovalToolEngineDefinition[] {
  return BACKGROUND_REMOVAL_TOOL_ENGINES;
}

export function getBackgroundRemovalToolEngine(
  id?: string | null
): BackgroundRemovalToolEngineDefinition {
  const fallback = BACKGROUND_REMOVAL_TOOL_ENGINES[0]!;
  if (!id) return fallback;
  const engine = BACKGROUND_REMOVAL_ENGINE_MAP.get(id as never);
  return engine ?? fallback;
}
