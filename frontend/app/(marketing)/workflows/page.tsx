import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Workflows — MaxVideo AI',
  description: 'Express templates and full workflows for team production, approvals, and delivery.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Workflows — MaxVideo AI',
    description: 'Choose Express for rapid runs or Workflows for brand governance and hand-offs.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Workflows overview.',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.maxvideo.ai/workflows',
    languages: {
      en: 'https://www.maxvideo.ai/workflows',
      fr: 'https://www.maxvideo.ai/workflows?lang=fr',
    },
  },
};

export default function WorkflowsPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.workflows;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">{content.express.badge}</span>
          <h2 className="mt-4 text-xl font-semibold text-text-primary">{content.express.title}</h2>
          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
            {content.express.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">{content.workflows.badge}</span>
          <h2 className="mt-4 text-xl font-semibold text-text-primary">{content.workflows.title}</h2>
          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
            {content.workflows.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
