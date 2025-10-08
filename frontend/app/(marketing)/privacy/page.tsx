import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Privacy — MaxVideo AI',
  description: 'MaxVideo AI privacy policy.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Privacy — MaxVideo AI',
    description: 'Learn how MaxVideo AI handles data, security, and user privacy.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Privacy details.',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.maxvideo.ai/privacy',
    languages: {
      en: 'https://www.maxvideo.ai/privacy',
      fr: 'https://www.maxvideo.ai/privacy?lang=fr',
    },
  },
};

export default function PrivacyPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.legal.privacy;

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
