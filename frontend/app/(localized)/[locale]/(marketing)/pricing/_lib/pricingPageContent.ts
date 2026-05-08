import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { PricingScenario } from '@/lib/pricing-scenarios';

export type ExampleCardConfig = {
  title: string;
  engine: string;
  duration: string;
  resolution: string;
  audio: string;
  price?: string;
  note?: string;
  pricingScenario?: PricingScenario;
};

export type ExampleCostsContent = {
  title: string;
  subtitle: string;
  labels: {
    engine: string;
    duration: string;
    resolution: string;
    audio: string;
  };
  cards: ExampleCardConfig[];
};

export type PriceFactorsContent = {
  title: string;
  points: string[];
};

export type FormattedMembershipTier = {
  name: string;
  requirement: string;
  benefit: string;
};

export function formatCurrencyForLocale(locale: AppLocale, currency: string, amount: number) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const DEFAULT_EXAMPLE_COSTS: Record<AppLocale, ExampleCostsContent> = {
  en: {
    title: 'Example costs',
    subtitle: 'Realistic runs to help you plan. Prices update as engines evolve.',
    labels: { engine: 'Engine', duration: 'Duration', resolution: 'Resolution', audio: 'Audio' },
    cards: [
      {
        title: 'Social clip (vertical)',
        engine: 'Pika 2.2',
        duration: '5s',
        resolution: '1080×1920',
        audio: 'Off',
        note: 'Charged only if it succeeds.',
        pricingScenario: { engineId: 'pika-text-to-video', durationSec: 5, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Cinematic test (landscape)',
        engine: 'Veo 3.1',
        duration: '8s',
        resolution: '1920×1080',
        audio: 'On',
        note: 'Price before you generate.',
        pricingScenario: { engineId: 'veo-3-1', durationSec: 8, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Flagship Seedance 2.0 run',
        engine: 'Seedance 2.0',
        duration: '10s',
        resolution: '1280×720',
        audio: 'On',
        note: 'Seedance 2 uses token-based provider pricing. This example assumes 1280×720 at 24 fps, adds the MaxVideoAI margin, then rounds up to the next cent.',
        pricingScenario: {
          engineId: 'seedance-2-0',
          durationSec: 10,
          resolution: '720p',
          aspectRatio: '16:9',
          memberTier: 'member',
        },
      },
    ],
  },
  fr: {
    title: 'Exemples de coûts',
    subtitle: 'Runs réalistes pour planifier. Les prix évoluent avec les modèles.',
    labels: { engine: 'Modèle', duration: 'Durée', resolution: 'Résolution', audio: 'Audio' },
    cards: [
      {
        title: 'Clip social (vertical)',
        engine: 'Pika 2.2',
        duration: '5 s',
        resolution: '1080×1920',
        audio: 'Silencieux',
        note: 'Débité uniquement si le rendu aboutit.',
        pricingScenario: { engineId: 'pika-text-to-video', durationSec: 5, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Test cinématographique (paysage)',
        engine: 'Veo 3.1',
        duration: '8 s',
        resolution: '1920×1080',
        audio: 'Inclus',
        note: 'Prix affiché avant génération.',
        pricingScenario: { engineId: 'veo-3-1', durationSec: 8, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Séquence premium Seedance 2.0',
        engine: 'Seedance 2.0',
        duration: '10 s',
        resolution: '1280×720',
        audio: 'Inclus',
        note: 'Seedance 2 suit une formule provider basée sur les tokens. Cet exemple part de 1280×720 à 24 fps, ajoute la marge MaxVideoAI, puis arrondit au centime supérieur.',
        pricingScenario: {
          engineId: 'seedance-2-0',
          durationSec: 10,
          resolution: '720p',
          aspectRatio: '16:9',
          memberTier: 'member',
        },
      },
    ],
  },
  es: {
    title: 'Costos de ejemplo',
    subtitle: 'Ejecuciones realistas para planificar. Los precios cambian cuando evolucionan los motores.',
    labels: { engine: 'Motor', duration: 'Duración', resolution: 'Resolución', audio: 'Audio' },
    cards: [
      {
        title: 'Clip social (vertical)',
        engine: 'Pika 2.2',
        duration: '5 s',
        resolution: '1080×1920',
        audio: 'Silencioso',
        note: 'Se cobra solo si termina correctamente.',
        pricingScenario: { engineId: 'pika-text-to-video', durationSec: 5, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Test cinematográfico (horizontal)',
        engine: 'Veo 3.1',
        duration: '8 s',
        resolution: '1920×1080',
        audio: 'Incluido',
        note: 'Precio visible antes de generar.',
        pricingScenario: { engineId: 'veo-3-1', durationSec: 8, resolution: '1080p', memberTier: 'member' },
      },
      {
        title: 'Secuencia premium Seedance 2.0',
        engine: 'Seedance 2.0',
        duration: '10 s',
        resolution: '1280×720',
        audio: 'Incluido',
        note: 'Seedance 2 usa una fórmula de proveedor basada en tokens. Este ejemplo parte de 1280×720 a 24 fps, añade el margen de MaxVideoAI y redondea al céntimo superior.',
        pricingScenario: {
          engineId: 'seedance-2-0',
          durationSec: 10,
          resolution: '720p',
          aspectRatio: '16:9',
          memberTier: 'member',
        },
      },
    ],
  },
};

export const DEFAULT_PRICE_FACTORS: Record<AppLocale, PriceFactorsContent> = {
  en: {
    title: 'What affects price',
    points: [
      'Duration scales linearly (4s / 8s / 12s).',
      'On token-priced routes like Seedance 2, both resolution and aspect ratio change the pixel count and the cost.',
      'Audio can add a premium on some engines; others, like Seedance 2, price audio on/off the same.',
      'Engine tier (Seedance / Veo / Kling / LTX) sets the base rate.',
      'Generate still shows the final quote before submission.',
    ],
  },
  fr: {
    title: 'Ce qui influence le prix',
    points: [
      'La durée évolue linéairement (4 s / 8 s / 12 s).',
      'Sur les routes à tokens comme Seedance 2, la résolution et le ratio changent le nombre de pixels et donc le coût.',
      'L’audio peut ajouter une prime sur certains modèles ; d’autres, comme Seedance 2, gardent le même prix avec ou sans audio.',
      'Le niveau du modèle (Seedance / Veo / Kling / LTX) fixe le tarif de base.',
      'Generate affiche quand même le devis final avant validation.',
    ],
  },
  es: {
    title: 'Qué afecta el precio',
    points: [
      'La duración escala de forma lineal (4 s / 8 s / 12 s).',
      'En rutas con tokens como Seedance 2, la resolución y el ratio cambian el número de píxeles y por tanto el costo.',
      'El audio puede añadir un recargo en algunos motores; otros, como Seedance 2, mantienen el mismo precio con o sin audio.',
      'El nivel del motor (Seedance / Veo / Kling / LTX) define la tarifa base.',
      'Generate sigue mostrando el precio final antes de enviar.',
    ],
  },
};
