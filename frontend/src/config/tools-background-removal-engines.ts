import type { BackgroundRemovalToolEngineDefinition } from '@/types/tools-background-removal';

export const BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND = 0.00425;
export const BACKGROUND_REMOVAL_DYNAMIC_MARGIN_MULTIPLIER = 4;
export const BACKGROUND_REMOVAL_MAX_STUDIO_DURATION_SECONDS = 60;
export const BACKGROUND_REMOVAL_REALTIME_SESSION_SECONDS = [30, 60, 120] as const;

export const BACKGROUND_REMOVAL_TOOL_ENGINES: readonly BackgroundRemovalToolEngineDefinition[] = [
  {
    id: 'bria-video-background-removal-v3',
    label: 'Bria VRMBG 3.0',
    description: 'Queued video background removal with transparent or solid-color output.',
    falModelId: 'bria/video/background-removal/v3',
    billingProductKey: 'background-removal-video-v3',
    mode: 'studio',
    providerPriceUsdPerSecond: BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND,
  },
  {
    id: 'bria-video-background-removal-realtime',
    label: 'Bria VRMBG 3.0 Realtime',
    description: 'Low-latency webcam background removal using fal realtime WebSockets.',
    falModelId: 'bria/video/background-removal/realtime',
    billingProductKey: 'background-removal-realtime',
    mode: 'realtime',
    providerPriceUsdPerSecond: BACKGROUND_REMOVAL_PROVIDER_PRICE_USD_PER_SECOND,
  },
] as const;

const BACKGROUND_REMOVAL_ENGINE_MAP = new Map(
  BACKGROUND_REMOVAL_TOOL_ENGINES.map((engine) => [engine.id, engine])
);

export function listBackgroundRemovalToolEngines(
  mode?: 'studio' | 'realtime'
): readonly BackgroundRemovalToolEngineDefinition[] {
  return mode ? BACKGROUND_REMOVAL_TOOL_ENGINES.filter((engine) => engine.mode === mode) : BACKGROUND_REMOVAL_TOOL_ENGINES;
}

export function getBackgroundRemovalToolEngine(
  id?: string | null,
  mode: 'studio' | 'realtime' = 'studio'
): BackgroundRemovalToolEngineDefinition {
  const fallback = BACKGROUND_REMOVAL_TOOL_ENGINES.find((engine) => engine.mode === mode)!;
  if (!id) return fallback;
  const engine = BACKGROUND_REMOVAL_ENGINE_MAP.get(id as never);
  return engine?.mode === mode ? engine : fallback;
}
