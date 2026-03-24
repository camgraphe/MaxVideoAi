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
const HUB_COPY: Record<
  AppLocale,
  {
    eyebrow: string;
    title: string;
    description: string;
    empty: string;
    viewGuide: string;
  }
> = {
  en: {
    eyebrow: 'Best for X',
    title: 'Best AI video engines by use case',
    description: 'These guides will highlight top picks, criteria, and comparisons per use case. Content is being built now.',
    empty: 'More guides are on the way.',
    viewGuide: 'View guide →',
  },
  fr: {
    eyebrow: 'Meilleur pour',
    title: 'Meilleurs moteurs vidéo IA par cas d’usage',
    description: 'Ces guides mettront en avant les meilleurs choix, les critères clés et les comparatifs par cas d’usage. Le contenu est en cours de préparation.',
    empty: 'D’autres guides arrivent bientôt.',
    viewGuide: 'Voir le guide →',
  },
  es: {
    eyebrow: 'Mejor para',
    title: 'Mejores motores de video con IA por caso de uso',
    description: 'Estas guías destacarán las mejores opciones, los criterios clave y las comparativas por caso de uso. El contenido está en preparación.',
    empty: 'Pronto habrá más guías.',
    viewGuide: 'Ver guía →',
  },
};

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale ?? 'en';
  const copy = HUB_COPY[locale] ?? HUB_COPY.en;
  return buildSeoMetadata({
    locale,
    title: copy.title,
    description: copy.description,
    englishPath: '/ai-video-engines/best-for',
    robots: BEST_FOR_PAGES.length ? undefined : { index: false, follow: true },
  });
}

export default function BestForHubPage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale ?? 'en';
  const copy = HUB_COPY[locale] ?? HUB_COPY.en;

  return (
    <div className="container-page max-w-4xl section">
      <div className="stack-gap-lg">
        <header className="stack-gap-sm">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.eyebrow}</p>
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{copy.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{copy.description}</p>
        </header>

        {BEST_FOR_PAGES.length ? (
          <div className="grid grid-gap sm:grid-cols-2">
            {BEST_FOR_PAGES.map((entry) => (
              <article key={entry.slug} className="rounded-card border border-hairline bg-surface p-5 shadow-card">
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Tier {entry.tier}</p>
                <h2 className="mt-2 text-lg font-semibold text-text-primary">{entry.title}</h2>
                <Link
                  href={{ pathname: '/ai-video-engines/best-for/[usecase]', params: { usecase: entry.slug } }}
                  className="mt-3 inline-flex text-sm font-semibold text-brand hover:text-brandHover"
                >
                  {copy.viewGuide}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-hairline bg-surface p-6 text-sm text-text-secondary shadow-card">
            {copy.empty}
          </div>
        )}
      </div>
    </div>
  );
}
