import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Models — MaxVideo AI',
  description: 'See the always-current lineup of AI video engines that MaxVideo AI routes across every project.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Models — MaxVideo AI',
    description: 'Always-current AI video engines with transparent pricing and independence from providers.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Model lineup overview with Price-Before chip.',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.maxvideo.ai/models',
    languages: {
      en: 'https://www.maxvideo.ai/models',
      fr: 'https://www.maxvideo.ai/models?lang=fr',
    },
  },
};

export default function ModelsPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.models;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-12 space-y-6">
        {content.cards.map((card) => (
          <article key={card.name} className="rounded-card border border-hairline bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-text-primary">{card.name}</h2>
              <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                Version {card.version}
              </span>
            </div>
            <p className="mt-3 text-sm text-text-secondary">{card.description}</p>
            <p className="mt-2 text-xs text-text-muted">{card.priceBefore}</p>
          </article>
        ))}
      </section>
      <aside className="mt-12 rounded-card border border-dashed border-hairline bg-white p-6 text-sm text-text-muted">
        {content.note}
      </aside>
    </div>
  );
}
