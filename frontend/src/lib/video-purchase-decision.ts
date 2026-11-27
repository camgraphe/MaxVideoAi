import type { VideoProviderKey } from '../server/video-providers/types';

export const PROVIDER_LABELS = {
  apimart: 'APIMart Gold',
  alibaba_model_studio: 'Alibaba Model Studio',
  fal: 'Fal',
  byteplus_modelark: 'BytePlus ModelArk',
  kling_direct: 'Kling Direct',
  luma_agents_direct: 'Luma Agents',
  google_vertex_veo_direct: 'Google Vertex · Veo',
  google_vertex_omni_direct: 'Google Vertex · Omni',
} satisfies Record<VideoProviderKey, string>;

export type PurchaseLimits = {
  ceilingMicros: number;
  unavailable?: Partial<Record<VideoProviderKey, string>>;
};
export type PurchaseCandidate = {
  provider: VideoProviderKey;
  tariff: string;
  costMicros: number | null;
  excluded: string | null;
};
export function rankQuotedOffers(quotes: readonly PurchaseCandidate[], limits: PurchaseLimits) {
  const candidates = quotes.map((row) => {
    let excluded = row.excluded ?? limits.unavailable?.[row.provider] ?? null;
    const cost = row.costMicros;
    if (!excluded && (cost === null || !Number.isSafeInteger(cost) || cost < 0)) excluded = 'Cost unavailable';
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
  eligible.sort((a, b) => Number(a.costMicros) - Number(b.costMicros));
  // Fal's queue owns final failure and payment reconciliation. It must be the last send.
  const terminal = eligible.findIndex(row => row.provider === 'fal');
  const reachable = terminal < 0 ? eligible : eligible.slice(0, terminal + 1);
  for (const row of eligible.slice(reachable.length)) row.excluded = 'After terminal Fal submission';
  return { ceilingMicros: limits.ceilingMicros, candidates, order: reachable.map((row) => row.provider) };
}
export type PurchaseDecision = ReturnType<typeof rankQuotedOffers>;
export type SubmitOutcome = 'accepted' | 'refused' | 'uncertain' | 'invalid';
/** Only a definitive operational refusal may advance the original job to the next provider. */
export function nextPurchaseProvider(
  order: VideoProviderKey[],
  current: VideoProviderKey,
  outcome: SubmitOutcome
) {
  const index = order.indexOf(current);
  return outcome === 'refused' && index >= 0 ? (order[index + 1] ?? null) : null;
}
