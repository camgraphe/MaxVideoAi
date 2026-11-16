'use client';

import useSWR from 'swr';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { formatPricePerUnit } from '@/lib/pricing-unit-display';
import type { CinematicAsset, CinematicPresentation } from '../_lib/model-page-cinematic-data';

async function quote(input: PublicModelQuoteInput): Promise<PublicModelQuote> {
  const response = await fetch('/api/pricing/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input), cache: 'no-store' });
  if (!response.ok) return { status: 'unavailable' };
  return response.json() as Promise<PublicModelQuote>;
}

export function ModelCinematicPromptPrice({ asset, ui, open }: {
  asset: CinematicAsset; ui: CinematicPresentation['ui']; open: boolean;
}) {
  const creation = asset.creation;
  const { data, error, isLoading } = useSWR(open && creation ? ['cinematic-example-quote', creation.quoteInput] : null,
    ([, input]) => quote(input), { shouldRetryOnError: false, revalidateOnFocus: true, dedupingInterval: 10_000 });
  if (!creation) return null;
  const exact = !error && data?.status === 'exact' && Number.isFinite(data.amountCents) && data.amountCents > 0;
  const priceLabel = creation.isStartFrame ? ui.framePrice : ui.price;
  return <li className="cinema-prompt-price" aria-live="polite" title={`${priceLabel} · ${ui.priceNote}`}>
    {exact ? `${formatPricePerUnit(creation.locale, data.currency, data.amountCents / 100)} ${ui.priceUnit}`
      : isLoading && !error ? ui.priceLoading : ui.priceUnavailable}
  </li>;
}
