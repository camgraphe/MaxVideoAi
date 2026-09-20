import React from 'react';
import type { AppLocale } from '@/i18n/locales';
import type { ModelPublicOffer } from '../_lib/model-page-schema';
import { formatModelPublicOffer } from '../_lib/model-page-offer-display';

export function ModelPublicOfferLine({ offer, locale }: { offer: ModelPublicOffer | null; locale: AppLocale }) {
  if (!offer) return null;
  const display = formatModelPublicOffer(offer, locale);
  return (
    <p className="text-sm leading-6 text-[#52627a] dark:text-white/60">
      <span>{display.name}</span>{' — '}<strong className="font-semibold text-[#071126] dark:text-white">{display.price}</strong>
    </p>
  );
}
