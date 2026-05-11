import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';

export type ModelPricingCallout = {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
};

const PRICING_ANCHORS: Record<string, string> = {
  'seedance-2-0': 'seedance-2-0-pricing',
  'seedance-2-0-fast': 'seedance-2-0-fast-pricing',
  'ltx-2-3-fast': 'ltx-2-3-fast-pricing',
  'ltx-2-3-pro': 'ltx-2-3-pro-pricing',
  'kling-3-pro': 'kling-3-pro-pricing',
  'kling-3-4k': 'kling-3-4k-pricing',
  'kling-3-standard': 'kling-3-standard-pricing',
  'veo-3-1': 'veo-3-1-pricing',
  'veo-3-1-lite': 'veo-3-1-lite-pricing',
  'veo-3-1-fast': 'veo-3-1-fast-pricing',
  'wan-2-6': 'wan-2-6-pricing',
  'pika-text-to-video': 'pika-text-to-video-pricing',
};

const MODEL_LABELS: Record<string, string> = {
  'seedance-2-0': 'Seedance 2.0',
  'seedance-2-0-fast': 'Seedance 2.0 Fast',
  'ltx-2-3-fast': 'LTX 2.3 Fast',
  'ltx-2-3-pro': 'LTX 2.3 Pro',
  'kling-3-pro': 'Kling 3 Pro',
  'kling-3-4k': 'Kling 3 4K',
  'kling-3-standard': 'Kling 3 Standard',
  'veo-3-1': 'Veo 3.1',
  'veo-3-1-lite': 'Veo 3.1 Lite',
  'veo-3-1-fast': 'Veo 3.1 Fast',
  'wan-2-6': 'Wan 2.6',
  'pika-text-to-video': 'Pika 2.2',
};

const PRICING_SLUG_MAP = buildSlugMap('pricing');

function linkLabel(locale: AppLocale) {
  return locale === 'fr' ? 'Voir la ligne tarifaire' : locale === 'es' ? 'Ver fila de precios' : 'View pricing row';
}

function titleForModel(label: string, locale: AppLocale) {
  return locale === 'fr' ? `Tarifs ${label}` : locale === 'es' ? `Precios de ${label}` : `${label} pricing`;
}

function bodyForModel(slug: string, label: string, locale: AppLocale) {
  if (slug === 'seedance-2-0') {
    return locale === 'fr'
      ? 'Voyez les prix MaxVideoAI actuels pour 5 s 720p, 10 s 1080p et les routes avec audio.'
      : locale === 'es'
        ? 'Consulta precios actuales de MaxVideoAI para 5 s 720p, 10 s 1080p y rutas con audio.'
        : 'See current MaxVideoAI prices for 5s 720p, 10s 1080p and audio-enabled routes.';
  }
  if (slug === 'ltx-2-3-fast') {
    return locale === 'fr'
      ? 'Comparez les prix LTX 2.3 Fast pour 8 s, 10 s, 1080p et la sortie 4K.'
      : locale === 'es'
        ? 'Compara precios de LTX 2.3 Fast para 8 s, 10 s, 1080p y salida 4K.'
        : 'Compare LTX 2.3 Fast pricing for 8s, 10s, 1080p and 4K output.';
  }
  if (slug.startsWith('kling-3')) {
    return locale === 'fr'
      ? `Comparez ${label} avec les autres routes Kling par durée, audio et résolution.`
      : locale === 'es'
        ? `Compara ${label} con otras rutas Kling por duración, audio y resolución.`
        : `Compare ${label} against other Kling routes by duration, audio and resolution.`;
  }
  return locale === 'fr'
    ? `Comparez les prix ${label} par scénario vidéo avant de générer.`
    : locale === 'es'
      ? `Compara precios de ${label} por escenario de video antes de generar.`
      : `Compare ${label} prices by video scenario before you generate.`;
}

export function buildModelPricingCallout(slug: string, locale: AppLocale): ModelPricingCallout | null {
  const anchor = PRICING_ANCHORS[slug];
  const label = MODEL_LABELS[slug];
  if (!anchor || !label) return null;
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const pricingSegment = PRICING_SLUG_MAP[locale] ?? PRICING_SLUG_MAP.en ?? 'pricing';
  return {
    title: titleForModel(label, locale),
    body: bodyForModel(slug, label, locale),
    href: `${prefix}/${pricingSegment}#${anchor}`.replace(/\/{2,}/g, '/'),
    linkLabel: linkLabel(locale),
  };
}
