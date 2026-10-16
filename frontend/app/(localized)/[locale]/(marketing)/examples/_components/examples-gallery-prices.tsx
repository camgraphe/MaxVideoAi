import { Suspense, type ReactNode } from 'react';
import type { AppLocale } from '@/i18n/locales';
import { formatCurrentExamplePrice } from '@/lib/current-example-price-display';
import type { CurrentExamplePrice } from '@/server/current-example-price';

type PriceInput = {
  currentPrices: Promise<ReadonlyMap<string, CurrentExamplePrice>>;
  locale: AppLocale;
};

async function ExamplePriceLabel({ id, currentPrices, locale }: PriceInput & { id: string }) {
  return formatCurrentExamplePrice((await currentPrices).get(id), locale);
}

/** Server-rendered price slots cross the client boundary without duplicating its gallery data. */
export function buildExamplesPriceSlots(videos: readonly { id: string }[], input: PriceInput): Record<string, ReactNode> {
  return Object.fromEntries(videos.map(({ id }) => [id,
    <Suspense key={id} fallback={null}><ExamplePriceLabel id={id} {...input} /></Suspense>,
  ]));
}
