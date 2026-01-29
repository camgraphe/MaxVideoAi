import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import compareConfig from '@/config/compare-config.json';

interface BestForEntry {
  slug: string;
  title: string;
  tier: number;
}

const BEST_FOR_PAGES = compareConfig.bestForPages as BestForEntry[];

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale ?? 'en';
  return buildSeoMetadata({
    locale,
    title: 'Best AI video engines by use case — MaxVideoAI',
    description: 'Editorial guides that help you pick the best AI video engine for each use case.',
    englishPath: '/ai-video-engines/best-for',
  });
}

export default function BestForHubPage() {
  return (
    <div className="container-page max-w-4xl section">
      <div className="stack-gap-lg">
        <header className="stack-gap-sm">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Best for X</p>
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">Best AI video engines by use case</h1>
          <p className="text-base leading-relaxed text-text-secondary">
            These guides will highlight top picks, criteria, and comparisons per use case. Content is being built now.
          </p>
        </header>

        <div className="grid grid-gap sm:grid-cols-2">
          {BEST_FOR_PAGES.map((entry) => (
            <article key={entry.slug} className="rounded-card border border-hairline bg-surface p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Tier {entry.tier}</p>
              <h2 className="mt-2 text-lg font-semibold text-text-primary">{entry.title}</h2>
              <Link
                href={{ pathname: '/ai-video-engines/best-for/[usecase]', params: { usecase: entry.slug } }}
                className="mt-3 inline-flex text-sm font-semibold text-brand hover:text-brandHover"
              >
                View guide →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
