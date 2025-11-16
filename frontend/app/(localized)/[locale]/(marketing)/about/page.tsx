import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';

const ABOUT_SLUG_MAP = buildSlugMap('about');
const ABOUT_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'About — MaxVideoAI',
    description: 'Quiet, premium, precise. Independent AI video hub that routes the right engine for every shot.',
  },
  fr: {
    title: 'À propos — MaxVideoAI',
    description:
      'Hub vidéo IA indépendant : précision, sobriété et transparence pour router le bon moteur à chaque plan.',
  },
  es: {
    title: 'Acerca de — MaxVideoAI',
    description:
      'Hub independiente de video con IA que dirige el motor adecuado para cada plano con precio antes de generar.',
  },
};

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const metadataUrls = buildMetadataUrls(locale, ABOUT_SLUG_MAP);
  const metaCopy = ABOUT_META[locale] ?? ABOUT_META.en;

  return {
    title: metaCopy.title,
    description: metaCopy.description,
    keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      title: metaCopy.title,
      description: metaCopy.description,
      url: metadataUrls.canonical,
      siteName: 'MaxVideoAI',
      images: [
        {
          url: '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: 'About MaxVideo AI.',
        },
      ],
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
    },
    twitter: {
      card: 'summary_large_image',
      title: metaCopy.title,
      description: metaCopy.description,
      images: ['/og/price-before.png'],
    },
  };
}

export default async function AboutPage() {
  const { dictionary } = await resolveDictionary();
  const content = dictionary.about;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>

      <section className="mt-12 space-y-6 text-sm text-text-secondary">
        {content.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </section>

      <aside className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card text-sm text-text-muted">
        {content.note}
      </aside>
    </div>
  );
}
