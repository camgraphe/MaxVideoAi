import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { EngineIcon } from '@/components/ui/EngineIcon';
import engineCatalog from '@/config/engine-catalog.json';
import compareConfig from '@/config/compare-config.json';

interface BestForEntry {
  slug: string;
  title: string;
  description?: string;
  tier: number;
  topPicks?: string[];
}

const BEST_FOR_PAGES = compareConfig.bestForPages as BestForEntry[];
const ENGINE_CATALOG = engineCatalog as Array<{
  modelSlug: string;
  marketingName: string;
  provider?: string;
  brandId?: string;
}>;
const ENGINE_BY_SLUG = new Map(ENGINE_CATALOG.map((entry) => [entry.modelSlug, entry]));
const HUB_COPY: Record<
  AppLocale,
  {
    eyebrow: string;
    title: string;
    description: string;
    empty: string;
    viewGuide: string;
    featured: string;
    tier: string;
  }
> = {
  en: {
    eyebrow: 'Best for X',
    title: 'Best AI video engines by use case',
    description: 'Pick the right AI video model for each job: cinematic shots, references, multi-shot sequences, ads, UGC, 4K delivery, and fast drafts.',
    empty: 'More guides are on the way.',
    viewGuide: 'View guide',
    featured: 'Featured models',
    tier: 'Tier',
  },
  fr: {
    eyebrow: 'Meilleur pour',
    title: 'Meilleurs moteurs vidéo IA par cas d’usage',
    description: 'Choisissez le bon modèle vidéo IA selon le besoin : rendu cinéma, références, séquences multi-shot, ads, UGC, livraison 4K et drafts rapides.',
    empty: 'D’autres guides arrivent bientôt.',
    viewGuide: 'Voir le guide',
    featured: 'Modèles mis en avant',
    tier: 'Tier',
  },
  es: {
    eyebrow: 'Mejor para',
    title: 'Mejores motores de video con IA por caso de uso',
    description: 'Elige el modelo de video con IA adecuado para cada necesidad: cine, referencias, secuencias multi-shot, anuncios, UGC, 4K y borradores rápidos.',
    empty: 'Pronto habrá más guías.',
    viewGuide: 'Ver guía',
    featured: 'Modelos destacados',
    tier: 'Tier',
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
    <div className="container-page max-w-7xl section">
      <div className="stack-gap-lg">
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
          <div className="stack-gap-sm">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.eyebrow}</p>
            <h1 className="max-w-4xl text-3xl font-semibold text-text-primary sm:text-5xl">{copy.title}</h1>
            <p className="max-w-3xl text-base leading-relaxed text-text-secondary">{copy.description}</p>
          </div>
          <div className="rounded-[20px] border border-hairline bg-surface bg-[image:radial-gradient(circle_at_18%_18%,rgba(99,102,241,0.16),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.86))] p-5 shadow-card dark:bg-[image:radial-gradient(circle_at_18%_18%,rgba(129,140,248,0.18),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))]">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.featured}</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {getFeaturedHubModels().map((slug, index) => {
                const engine = ENGINE_BY_SLUG.get(slug);
                return (
                  <div key={`${slug}-${index}`} className="grid min-h-[92px] place-items-center rounded-[14px] border border-hairline bg-surface/80 p-3 text-center shadow-sm">
                    <EngineIcon
                      engine={{ id: slug, label: engine?.marketingName ?? slug, brandId: engine?.brandId }}
                      size={42}
                      rounded="xl"
                    />
                    <p className="mt-2 max-w-full truncate text-[11px] font-semibold text-text-primary">{engine?.marketingName ?? slug}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {BEST_FOR_PAGES.length ? (
          <div className="grid grid-gap sm:grid-cols-2 xl:grid-cols-3">
            {BEST_FOR_PAGES.map((entry) => (
              <article
                key={entry.slug}
                className="group relative isolate overflow-hidden rounded-[16px] border border-hairline bg-surface bg-[image:linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-5 shadow-[0_18px_44px_rgba(15,23,42,0.055),0_4px_12px_rgba(15,23,42,0.025)] transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_24px_52px_rgba(15,23,42,0.08)] dark:bg-[image:linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))]"
              >
                <span className="pointer-events-none absolute inset-px rounded-[15px] border border-white/75 opacity-80 dark:border-white/[0.04]" aria-hidden />
                <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <p className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                    {copy.tier} {entry.tier}
                  </p>
                  <div className="flex -space-x-2">
                    {(entry.topPicks ?? []).slice(0, 3).map((slug) => {
                      const engine = ENGINE_BY_SLUG.get(slug);
                      return (
                        <EngineIcon
                          key={slug}
                          engine={{ id: slug, label: engine?.marketingName ?? slug, brandId: engine?.brandId }}
                          size={34}
                          rounded="full"
                          className="ring-2 ring-surface"
                        />
                      );
                    })}
                  </div>
                </div>
                <h2 className="mt-5 text-xl font-semibold leading-tight text-text-primary">{entry.title}</h2>
                {entry.description ? (
                  <p className="mt-3 min-h-[4.25rem] text-sm leading-relaxed text-text-secondary">{entry.description}</p>
                ) : null}
                <Link
                  href={{ pathname: '/ai-video-engines/best-for/[usecase]', params: { usecase: entry.slug } }}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brandHover"
                >
                  {copy.viewGuide}
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
                </div>
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

function getFeaturedHubModels() {
  const slugs = BEST_FOR_PAGES.flatMap((entry) => entry.topPicks ?? []);
  return Array.from(new Set(slugs)).slice(0, 6);
}
