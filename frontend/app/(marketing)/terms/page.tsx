import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Terms — MaxVideo AI',
  description: 'MaxVideo AI terms of service.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Terms — MaxVideo AI',
    description: 'MaxVideo AI terms of service and legal guidelines.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Legal overview.',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.maxvideo.ai/terms',
    languages: {
      en: 'https://www.maxvideo.ai/terms',
      fr: 'https://www.maxvideo.ai/terms?lang=fr',
    },
  },
};

export default function TermsPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.legal.terms;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.title}</h1>
        <p className="text-base text-text-secondary">{content.intro}</p>
      </header>
      <section className="mt-12 space-y-6">
        {content.sections.map((section) => (
          <article key={section.heading} className="rounded-card border border-hairline bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">{section.heading}</h2>
            <p className="mt-2 text-sm text-text-secondary">{section.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
