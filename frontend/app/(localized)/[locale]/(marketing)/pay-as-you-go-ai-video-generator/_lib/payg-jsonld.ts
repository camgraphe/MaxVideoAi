import { localePathnames, type AppLocale } from '@/i18n/locales';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';

export function buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale }: { canonical: string; locale: AppLocale }) {
  const labels = getBreadcrumbLabels(locale);
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: labels.home,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: {
          en: 'Pay-as-you-go AI Video Generator',
          es: 'Generador de video con IA de pago por uso',
          fr: 'Générateur de vidéos IA sans abonnement',
        }[locale],
        item: canonical,
      },
    ],
  };
}

export function buildPayAsYouGoServiceJsonLd({ canonical, locale = 'en' }: { canonical: string; locale?: AppLocale }) {
  const copy = {
    en: { name: 'Pay-as-you-go AI Video Generator', description: 'Generate AI videos from text, images, or video with no subscription required, price-before-generation quotes, and failed-render refunds.', serviceType: 'Pay-as-you-go AI video generation', category: 'AI video generator', offer: 'Starter credits are available without a recurring subscription.' },
    es: { name: 'Generador de video con IA de pago por uso', description: 'Genera videos con IA desde texto, imágenes o video sin suscripción, con una cotización antes de generar y reembolso de renders fallidos.', serviceType: 'Generación de video con IA de pago por uso', category: 'Generador de video con IA', offer: 'Los créditos iniciales están disponibles sin suscripción recurrente.' },
    fr: { name: 'Générateur de vidéos IA sans abonnement', description: 'Générez des vidéos IA à partir de texte, d’images ou de vidéo sans abonnement, avec un devis avant la génération et le remboursement des rendus échoués.', serviceType: 'Génération de vidéos IA avec paiement à l’usage', category: 'Générateur de vidéos IA', offer: 'Les crédits de départ sont disponibles sans abonnement récurrent.' },
  }[locale];
  return buildMarketingServiceJsonLd({
    name: copy.name,
    description: copy.description,
    serviceType: copy.serviceType,
    category: copy.category,
    url: canonical,
    offers: {
      priceCurrency: 'USD',
      price: '10.00',
      availability: 'https://schema.org/InStock',
      description: copy.offer,
      url: canonical,
    },
  });
}

export function buildPayAsYouGoWebApplicationJsonLd({ canonical, locale = 'en' }: { canonical: string; locale?: AppLocale }) {
  const copy = {
    en: { description: 'Pay-as-you-go AI video generator for comparing multiple AI video models with upfront pricing and no required subscription.', offer: 'Starter credits are available without a recurring subscription.', features: ['Generate AI videos from text, images, or video', 'Compare Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan and other models', 'See the estimated price before generation', 'Use credits for completed renders'] },
    es: { description: 'Generador de video con IA de pago por uso para comparar varios modelos, con precio por adelantado y sin suscripción obligatoria.', offer: 'Los créditos iniciales están disponibles sin suscripción recurrente.', features: ['Genera videos con IA desde texto, imágenes o video', 'Compara Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan y otros modelos', 'Consulta el precio estimado antes de generar', 'Usa créditos solo para renders completados'] },
    fr: { description: 'Générateur de vidéos IA sans abonnement pour comparer plusieurs modèles avec un prix affiché à l’avance et un paiement à l’usage.', offer: 'Les crédits de départ sont disponibles sans abonnement récurrent.', features: ['Générez des vidéos IA à partir de texte, d’images ou de vidéo', 'Comparez Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan et d’autres modèles', 'Consultez le prix estimé avant la génération', 'Utilisez les crédits uniquement pour les rendus terminés'] },
  }[locale];
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MaxVideoAI',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: canonical,
    description: copy.description,
    offers: {
      '@type': 'Offer',
      price: '10.00',
      priceCurrency: 'USD',
      description: copy.offer,
      url: canonical,
    },
    featureList: copy.features,
  };
}
