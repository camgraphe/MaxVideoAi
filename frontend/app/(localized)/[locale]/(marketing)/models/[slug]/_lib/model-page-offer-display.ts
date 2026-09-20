import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { ModelPublicOffer } from './model-page-schema';

const COPY = {
  en: { example: 'Generation example', textVideo: 'Text to video', textImage: 'Text to image', image: '1 image', high: 'High quality', audio: 'Audio included', silent: 'Silent', squareHd: 'Square HD' },
  fr: { example: 'Exemple de génération', textVideo: 'Texte vers vidéo', textImage: 'Texte vers image', image: '1 image', high: 'Qualité élevée', audio: 'Audio inclus', silent: 'Sans audio', squareHd: 'Carré HD' },
  es: { example: 'Ejemplo de generación', textVideo: 'Texto a vídeo', textImage: 'Texto a imagen', image: '1 imagen', high: 'Calidad alta', audio: 'Audio incluido', silent: 'Sin audio', squareHd: 'Cuadrado HD' },
} as const;

export function formatModelPublicOffer(offer: ModelPublicOffer, locale: AppLocale) {
  const copy = COPY[locale];
  const scenario = offer.scenario;
  const resolution = scenario.resolution === 'square_hd' ? copy.squareHd : scenario.resolution;
  const details = scenario.mode === 't2i'
    ? [copy.image, resolution, scenario.quality === 'high' ? copy.high : null, copy.textImage]
    : [`${scenario.durationSeconds} s`, resolution, scenario.aspectRatio, copy.textVideo, scenario.audio ? copy.audio : copy.silent];
  return {
    name: `${copy.example}: ${details.filter(Boolean).join(' · ')}`,
    price: new Intl.NumberFormat(localeRegions[locale], {
      style: 'currency', currency: offer.currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(offer.amountCents / 100),
  };
}
