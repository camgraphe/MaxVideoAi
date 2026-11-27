import type { VideoProviderKey } from '../server/video-providers/types';

export const PURCHASE_ROUTING_ENGINE_IDS = [
  'wan-3', 'wan-3-prime', 'minimax-h3', 'minimax-h3-max', 'seedance-2-5', 'kling-3-pro', 'kling-o3-pro',
] as const;
export type PurchaseRoutingEngineId = (typeof PURCHASE_ROUTING_ENGINE_IDS)[number];
const purchaseRoutingEngines = new Set<string>(PURCHASE_ROUTING_ENGINE_IDS);

export function isPurchaseRoutingEngine(engineId: unknown): engineId is PurchaseRoutingEngineId {
  return typeof engineId === 'string' && purchaseRoutingEngines.has(engineId);
}

/** Catalogue-only suppliers cannot be used as live provider keys. */
export type PurchaseProviderKey = VideoProviderKey | 'wavespeed';

export const PROVIDER_LABELS = {
  wavespeed: 'WaveSpeedAI',
  apimart: 'APIMart Gold',
  alibaba_model_studio: 'Alibaba Model Studio',
  fal: 'Fal',
  byteplus_modelark: 'BytePlus ModelArk',
  kling_direct: 'Kling Direct',
  luma_agents_direct: 'Luma Agents',
  google_vertex_veo_direct: 'Google Vertex · Veo',
  google_vertex_omni_direct: 'Google Vertex · Omni',
} satisfies Record<PurchaseProviderKey, string>;

export type PurchaseStrategy = 'lowest-cost' | 'preserve-fallback';

export const PURCHASE_STRATEGY_LABELS: Record<PurchaseStrategy, string> = {
  'lowest-cost': 'Lowest cost',
  'preserve-fallback': 'Keep a fallback',
};

export type PurchaseLimits = {
  strategy?: PurchaseStrategy;
  ceilingMicros: number;
  unavailable?: Partial<Record<PurchaseProviderKey, string>>;
};
export type PurchaseCandidate<P extends PurchaseProviderKey = VideoProviderKey> = {
  provider: P;
  simulationOnly?: true;
  sourceUrl?: string;
  tariff: string;
  costMicros: number | null;
  excluded: string | null;
  terminal?: boolean;
};
export function rankQuotedOffers<P extends PurchaseProviderKey>(quotes: readonly PurchaseCandidate<P>[], limits: PurchaseLimits) {
  // The fallback cursor identifies a supplier by provider key. Duplicate keys could loop back to a previous send.
  const unique = new Map<P, PurchaseCandidate<P>>();
  for (const quote of quotes) {
    if (unique.has(quote.provider)) {
      unique.set(quote.provider, {
        ...quote,
        costMicros: null,
        excluded: 'Conflicting offers for this provider',
      });
    } else unique.set(quote.provider, quote);
  }
  const candidates = Array.from(unique.values(), (row) => {
    let excluded = row.excluded ?? limits.unavailable?.[row.provider] ?? null;
    const cost = row.costMicros;
    if (!excluded && (cost === null || !Number.isSafeInteger(cost) || cost < 0))
      excluded = 'Cost unavailable';
    if (
      !excluded &&
      (cost === null ||
        !Number.isSafeInteger(limits.ceilingMicros) ||
        limits.ceilingMicros < 0 ||
        cost > limits.ceilingMicros)
    )
      excluded = 'Above purchase ceiling';
    return { ...row, excluded };
  });
  const eligible = candidates.filter((row) => !row.excluded);
  const strategy = limits.strategy ?? 'lowest-cost';
  // Older attempt snapshots predate the terminal capability. Their Fal queue already owned final settlement.
  const terminal = (row: PurchaseCandidate<P>) => row.provider === 'fal' || row.terminal === true;
  eligible.sort((a, b) => {
    if (strategy === 'preserve-fallback' && terminal(a) !== terminal(b))
      return Number(terminal(a)) - Number(terminal(b));
    return Number(a.costMicros) - Number(b.costMicros);
  });
  const end = eligible.findIndex(terminal);
  const reachable = end < 0 ? eligible : eligible.slice(0, end + 1);
  for (const row of eligible.slice(reachable.length)) {
    row.excluded = 'After terminal ' + PROVIDER_LABELS[eligible[end].provider] + ' submission';
  }
  return {
    strategy,
    ceilingMicros: limits.ceilingMicros,
    candidates,
    order: reachable.map((row) => row.provider),
  };
}
export type PurchaseDecision<P extends PurchaseProviderKey = PurchaseProviderKey> = ReturnType<typeof rankQuotedOffers<P>>;
export function purchaseRoutingSnapshot<T extends PurchaseDecision>(decision: T, mode: 'shadow' | 'canary') {
  return { ...decision, version: 2, mode };
}

export type SubmitOutcome = 'accepted' | 'refused' | 'uncertain' | 'invalid';
/** Only a definitive operational refusal may advance the original job to the next provider. */
export function nextPurchaseProvider<P extends PurchaseProviderKey>(
  order: P[],
  current: P,
  outcome: SubmitOutcome
): P | null {
  const index = order.indexOf(current);
  return outcome === 'refused' && index >= 0 ? (order[index + 1] ?? null) : null;
}
