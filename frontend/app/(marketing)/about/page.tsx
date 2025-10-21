import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'About — MaxVideo AI',
  description: 'Quiet, premium, precise. Independent AI video hub that routes the right engine for every shot.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'About — MaxVideo AI',
    description: 'Learn about MaxVideo AI’s independence, team, and approach to routing and pricing.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'About MaxVideo AI.',
      },
    ],
  },
  alternates: {
    canonical: 'https://maxvideoai.com/about',
    languages: {
      en: 'https://maxvideoai.com/about',
      fr: 'https://maxvideoai.com/about?lang=fr',
    },
  },
};

export default function AboutPage() {
  const { dictionary } = resolveDictionary();
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
