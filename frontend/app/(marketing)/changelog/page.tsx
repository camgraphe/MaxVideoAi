import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Changelog — MaxVideo AI',
  description: 'Transparent updates on engines, workflows, and queue performance.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Changelog — MaxVideo AI',
    description: 'Follow every improvement to engines, queue speeds, and pricing.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Changelog timeline.',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.maxvideo.ai/changelog',
    languages: {
      en: 'https://www.maxvideo.ai/changelog',
      fr: 'https://www.maxvideo.ai/changelog?lang=fr',
    },
  },
};

export default function ChangelogPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.changelog;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-12 space-y-6">
        {content.entries.map((entry) => (
          <article key={entry.date} className="rounded-card border border-hairline bg-white p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{entry.date}</p>
            <h2 className="mt-2 text-lg font-semibold text-text-primary">{entry.title}</h2>
            <p className="mt-2 text-sm text-text-secondary">{entry.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
