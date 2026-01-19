import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const CHANGELOG_SLUG_MAP = buildSlugMap('changelog');

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const title = 'Changelog — MaxVideo AI';
  const description = 'Transparent updates on engines, workflows, and queue performance.';

  return buildSeoMetadata({
    locale,
    title,
    description,
    hreflangGroup: 'changelog',
    slugMap: CHANGELOG_SLUG_MAP,
    keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
    imageAlt: 'Changelog timeline.',
  });
}

export default async function ChangelogPage() {
  const { dictionary } = await resolveDictionary();
  const content = dictionary.changelog;

  return (
    <div className="container-page max-w-4xl px-4 py-16 lg:py-20 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
        <p className="text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
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
