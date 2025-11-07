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
    canonical: 'https://maxvideoai.com/changelog',
    languages: {
      en: 'https://maxvideoai.com/changelog',
      fr: 'https://maxvideoai.com/changelog?lang=fr',
    },
  },
};

export default async function ChangelogPage() {
  const { dictionary } = await resolveDictionary();
  const content = dictionary.changelog;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-8 rounded-card border border-hairline bg-white/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
        <p>
          We ship updates to MaxVideoAI in tight release trains. Engine upgrades land as soon as providers open access,
          and workflow improvements follow the same week so production teams can adopt them without re-learning the
          platform. The changelog highlights what changed, why it matters, and any credentials or migration steps you
          should prepare.
        </p>
        <p className="mt-4">
          Looking for something specific? Use this log to trace when a capability became available, confirm latency
          fixes, or share proof of delivery with your stakeholders. If an entry affects billing or routing policy it
          will link directly to the documentation page so finance and compliance crews stay aligned.
        </p>
        <div className="mt-6 rounded-card border border-dashed border-hairline bg-bg/70 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">How we tag releases</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><span className="font-semibold text-text-primary">Engine</span> — new models, quality shifts, or pricing moves.</li>
            <li><span className="font-semibold text-text-primary">Workflow</span> — UI, automation, or queue enhancements.</li>
            <li><span className="font-semibold text-text-primary">Trust</span> — policy, audit, or compliance adjustments.</li>
          </ul>
        </div>
      </section>
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
