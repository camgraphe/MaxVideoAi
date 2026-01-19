import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';

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
  const metaCopy = ABOUT_META[locale] ?? ABOUT_META.en;

  return buildSeoMetadata({
    locale,
    title: metaCopy.title,
    description: metaCopy.description,
    hreflangGroup: 'about',
    slugMap: ABOUT_SLUG_MAP,
    keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
    imageAlt: 'About MaxVideo AI.',
  });
}

export default async function AboutPage() {
  const { dictionary } = await resolveDictionary();
  const content = dictionary.about;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 lg:py-20 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
        <p className="text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
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
