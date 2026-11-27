import {
  nextPurchaseProvider,
  PROVIDER_LABELS,
  type PurchaseCandidate,
  type PurchaseDecision,
  type PurchaseProviderKey,
  type SubmitOutcome,
} from '@/lib/video-purchase-decision';

export function offerAccessLabel(offer: PurchaseCandidate<PurchaseProviderKey>, engineId: string, installed: boolean): string {
  if (offer.simulationOnly) return 'Catalogue estimate · simulation only';
  if (offer.provider === 'apimart' && engineId === 'wan-3-prime' && !installed)
    return 'Optional admin pilot · access required';
  return '';
}

export type Response = SubmitOutcome | 'offline';
export type Conditions = Partial<Record<PurchaseProviderKey, Response>>;
export type Preset = 'best' | 'fallback' | 'double' | 'lost';
export const presets: Record<Preset, string> = {
  best: 'Best price',
  fallback: 'First refusal',
  double: 'Two refusals',
  lost: 'Lost response',
};
export const responseLabels: Record<Response, string> = {
  accepted: 'Accept',
  refused: 'Balance refused',
  uncertain: 'Response lost',
  invalid: 'Invalid request',
  offline: 'Unavailable',
};

export function presetConditions(preset: Preset, ordered: PurchaseProviderKey[]): Conditions {
  if (preset === 'best' || !ordered.length) return {};
  if (preset === 'lost') return { [ordered[0]]: 'uncertain' };
  return Object.fromEntries(ordered.slice(0, preset === 'double' ? 2 : 1).map((key) => [key, 'refused']));
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 5,
});
export const dollars = (micros: number) => usd.format(micros / 1e6);

export type Frame = {
  kind: 'intake' | 'sending' | 'empty' | SubmitOutcome;
  provider?: PurchaseProviderKey;
  title: string;
  detail: string;
};

export function routeFrames(decision: PurchaseDecision, conditions: Conditions): Frame[] {
  const frames: Frame[] = [
    {
      kind: 'intake',
      title: 'Request enters the router',
      detail: 'Check mode, availability and purchase ceiling.',
    },
  ];
  if (!decision.order.length)
    return [
      ...frames,
      { kind: 'empty', title: 'No eligible route', detail: 'Every offer is excluded. No request is sent.' },
    ];
  let provider: PurchaseProviderKey | null = decision.order[0];
  while (provider) {
    const label = PROVIDER_LABELS[provider];
    const outcome: Response = conditions[provider] ?? 'accepted';
    if (outcome === 'offline') break; // Already filtered by rankQuotedOffers.
    frames.push({
      kind: 'sending',
      provider,
      title: 'Sending to ' + label,
      detail:
        frames.length === 1
          ? decision.strategy === 'preserve-fallback' && decision.order.length > 1
            ? 'This provider can hand off to a backup within the ceiling.'
            : 'First eligible offer in price order.'
          : 'Next eligible offer under the same ceiling.',
    });
    const next: PurchaseProviderKey | null = nextPurchaseProvider(decision.order, provider, outcome);
    const captions = {
      accepted: ['Accepted by ' + label, 'This provider owns the job. Routing ends here.'],
      refused: [
        label + ' refused the request',
        next
          ? 'Balance refused before acceptance. Trying the next offer.'
          : 'All eligible providers refused. Routing ends here.',
      ],
      uncertain: [
        'Waiting for ' + label,
        'Acknowledgement lost. Reconcile this attempt before sending again.',
      ],
      invalid: ['Request rejected by ' + label, 'Invalid request. Correct the request before retrying.'],
    } as const;
    const [title, detail] = captions[outcome];
    frames.push({ kind: outcome, provider, title, detail });
    provider = next;
  }
  return frames;
}
