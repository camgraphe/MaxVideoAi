import type { Metadata } from 'next';
import { ChevronRight, Eye, Sparkles, Wallet, Workflow } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getLocalizedUrl } from '@/lib/metadataUrls';
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
    viewModels: string;
    startTitle: string;
    startDescription: string;
    startCta: string;
    chooseTitle: string;
    chooseDescription: string;
    chooseCta: string;
    steps: Array<{ title: string; description: string }>;
    benefits: Array<{ title: string; description: string }>;
  }
> = {
  en: {
    eyebrow: 'Best for',
    title: 'Best AI video engines by use case',
    description: 'Pick the right AI video model for each job: cinematic shots, references, multi-shot sequences, ads, UGC, 4K delivery, and fast drafts.',
    empty: 'More guides are on the way.',
    viewGuide: 'View guide',
    featured: 'Featured models',
    tier: 'Tier',
    viewModels: 'View all models',
    startTitle: 'Not sure where to start?',
    startDescription: "Answer a few questions and we'll suggest the best engine for your project.",
    startCta: 'Find my engine',
    chooseTitle: 'How to choose the right engine',
    chooseDescription: 'Every project is different. Compare quality, speed, cost, and features before you generate.',
    chooseCta: 'Compare engines',
    benefits: [
      { title: 'Compare engines', description: 'side by side' },
      { title: 'See real outputs', description: 'before you generate' },
      { title: 'Know the cost', description: 'before you spend' },
      { title: 'Pay-as-you-go', description: 'No subscription' },
    ],
    steps: [
      { title: 'Define your goal', description: 'What are you creating and what matters most?' },
      { title: 'Compare engines', description: 'See side-by-side results, features, and limitations.' },
      { title: 'Preview outputs', description: 'Check real examples before you generate.' },
      { title: 'Generate with confidence', description: 'Know the cost upfront and launch with the right engine.' },
    ],
  },
  fr: {
    eyebrow: 'Meilleur pour',
    title: 'Meilleurs moteurs vidéo IA par cas d’usage',
    description: 'Choisissez le bon modèle vidéo IA selon le besoin : rendu cinéma, références, séquences multi-shot, ads, UGC, livraison 4K et drafts rapides.',
    empty: 'D’autres guides arrivent bientôt.',
    viewGuide: 'Voir le guide',
    featured: 'Modèles mis en avant',
    tier: 'Tier',
    viewModels: 'Voir tous les modèles',
    startTitle: 'Vous ne savez pas par où commencer ?',
    startDescription: 'Répondez à quelques questions et nous suggérerons le bon moteur pour votre projet.',
    startCta: 'Trouver mon moteur',
    chooseTitle: 'Comment choisir le bon moteur',
    chooseDescription: 'Chaque projet est différent. Comparez qualité, vitesse, coût et fonctionnalités avant de générer.',
    chooseCta: 'Comparer les moteurs',
    benefits: [
      { title: 'Comparer les moteurs', description: 'côte à côte' },
      { title: 'Voir des rendus réels', description: 'avant de générer' },
      { title: 'Connaître le coût', description: 'avant de dépenser' },
      { title: 'Paiement à l’usage', description: 'sans abonnement' },
    ],
    steps: [
      { title: 'Définir l’objectif', description: 'Que créez-vous et qu’est-ce qui compte vraiment ?' },
      { title: 'Comparer les moteurs', description: 'Résultats, features et limites côte à côte.' },
      { title: 'Prévisualiser les sorties', description: 'Vérifiez des exemples réels avant génération.' },
      { title: 'Générer avec confiance', description: 'Connaissez le coût et lancez avec le bon moteur.' },
    ],
  },
  es: {
    eyebrow: 'Mejor para',
    title: 'Mejores motores de video con IA por caso de uso',
    description: 'Elige el modelo de video con IA adecuado para cada necesidad: cine, referencias, secuencias multi-shot, anuncios, UGC, 4K y borradores rápidos.',
    empty: 'Pronto habrá más guías.',
    viewGuide: 'Ver guía',
    featured: 'Modelos destacados',
    tier: 'Tier',
    viewModels: 'Ver todos los modelos',
    startTitle: '¿No sabes por dónde empezar?',
    startDescription: 'Responde algunas preguntas y sugeriremos el mejor motor para tu proyecto.',
    startCta: 'Encontrar mi motor',
    chooseTitle: 'Cómo elegir el motor adecuado',
    chooseDescription: 'Cada proyecto es diferente. Compara calidad, velocidad, costo y funciones antes de generar.',
    chooseCta: 'Comparar motores',
    benefits: [
      { title: 'Comparar motores', description: 'lado a lado' },
      { title: 'Ver resultados reales', description: 'antes de generar' },
      { title: 'Conocer el costo', description: 'antes de gastar' },
      { title: 'Pago por uso', description: 'sin suscripción' },
    ],
    steps: [
      { title: 'Define tu objetivo', description: 'Qué estás creando y qué importa más.' },
      { title: 'Compara motores', description: 'Resultados, funciones y límites lado a lado.' },
      { title: 'Previsualiza resultados', description: 'Revisa ejemplos reales antes de generar.' },
      { title: 'Genera con confianza', description: 'Conoce el costo y elige el motor correcto.' },
    ],
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
    keywords: [
      copy.title,
      'best AI video generator',
      'AI video engines by use case',
      'cinematic AI video generator',
      'image-to-video AI generator',
      '4K AI video generator',
      'UGC AI video generator',
    ],
  });
}

export default function BestForHubPage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale ?? 'en';
  const copy = HUB_COPY[locale] ?? HUB_COPY.en;
  const featuredModels = getFeaturedHubModels();
  const itemListJsonLd = buildHubItemListJsonLd(locale);
  const webPageJsonLd = buildHubWebPageJsonLd(locale, copy);

  return (
    <div className="container-page max-w-7xl section pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPageJsonLd) }} />

      <div className="space-y-10">
        <header className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-brand shadow-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {copy.eyebrow}
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-normal text-text-primary sm:text-6xl">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">{copy.description}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {copy.benefits.map((benefit, index) => (
                <div key={benefit.title} className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline bg-surface shadow-sm">
                    {index === 0 ? <Workflow className="h-4 w-4 text-brand" aria-hidden /> : null}
                    {index === 1 ? <Eye className="h-4 w-4 text-brand" aria-hidden /> : null}
                    {index === 2 ? <Wallet className="h-4 w-4 text-brand" aria-hidden /> : null}
                    {index === 3 ? <Sparkles className="h-4 w-4 text-brand" aria-hidden /> : null}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">{benefit.title}</span>
                    <span className="block text-xs text-text-secondary">{benefit.description}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-[14px] border border-brand/20 bg-surface/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                  <Sparkles className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{copy.startTitle}</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{copy.startDescription}</p>
                </div>
              </div>
              <Link
                href={{ pathname: '/ai-video-engines' }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-card border border-hairline bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary shadow-sm transition hover:border-brand/35 hover:text-brandHover"
              >
                {copy.startCta}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <aside className="rounded-[20px] border border-hairline bg-surface p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.featured}</p>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {featuredModels.map((slug, index) => {
                const engine = ENGINE_BY_SLUG.get(slug);
                return (
                  <Link
                    key={`${slug}-${index}`}
                    href={{ pathname: '/models/[slug]', params: { slug } }}
                    className="group relative grid min-h-[122px] place-items-center rounded-[14px] border border-hairline bg-surface-2 p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:bg-surface"
                  >
                    <EngineIcon
                      engine={{ id: slug, label: engine?.marketingName ?? slug, brandId: engine?.brandId }}
                      size={48}
                      rounded="xl"
                    />
                    {index < 3 ? (
                      <span className="absolute bottom-9 right-5 grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-semibold text-white">
                        {index + 1}
                      </span>
                    ) : null}
                    <p className="mt-3 text-xs font-semibold leading-tight text-text-primary">{engine?.marketingName ?? slug}</p>
                  </Link>
                );
              })}
            </div>
            <Link
              href={{ pathname: '/models' }}
              className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brandHover"
            >
              {copy.viewModels}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </aside>
        </header>

        {BEST_FOR_PAGES.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {BEST_FOR_PAGES.map((entry) => (
              <Link
                key={entry.slug}
                href={{ pathname: '/ai-video-engines/best-for/[usecase]', params: { usecase: entry.slug } }}
                className="group relative isolate min-h-[190px] overflow-hidden rounded-[16px] border border-hairline bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-micro text-brand">
                    {copy.tier} {entry.tier}
                  </p>
                  <div className="flex -space-x-2">
                    {(entry.topPicks ?? []).slice(0, 3).map((slug) => {
                      const engine = ENGINE_BY_SLUG.get(slug);
                      return (
                        <EngineIcon
                          key={slug}
                          engine={{ id: slug, label: engine?.marketingName ?? slug, brandId: engine?.brandId }}
                          size={30}
                          rounded="full"
                          className="ring-2 ring-surface"
                        />
                      );
                    })}
                  </div>
                </div>
                <h2 className="mt-5 text-xl font-semibold leading-tight text-text-primary">{entry.title}</h2>
                {entry.description ? (
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-text-secondary">{entry.description}</p>
                ) : null}
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand transition group-hover:text-brandHover">
                  {copy.viewGuide}
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-hairline bg-surface p-6 text-sm text-text-secondary shadow-card">
            {copy.empty}
          </div>
        )}

        <section className="rounded-[18px] border border-brand/15 bg-surface p-5 shadow-card sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-center">
            <div className="flex items-start gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-brand/20 bg-brand/10 text-brand">
                <Workflow className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{copy.chooseTitle}</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {copy.chooseDescription}
                </p>
                <Link
                  href={{ pathname: '/ai-video-engines' }}
                  className="mt-4 inline-flex items-center gap-2 rounded-card border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:border-brand/35 hover:text-brandHover"
                >
                  {copy.chooseCta}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {copy.steps.map((step, index) => (
                <div key={step.title} className="relative">
                  <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-brand/20 bg-brand/10 text-sm font-semibold text-brand">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-text-primary">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function getFeaturedHubModels() {
  const slugs = BEST_FOR_PAGES.flatMap((entry) => entry.topPicks ?? []);
  return Array.from(new Set(slugs)).slice(0, 6);
}

function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function buildHubItemListJsonLd(locale: AppLocale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Best AI video engines by use case',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: BEST_FOR_PAGES.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.title,
      url: getLocalizedUrl(locale, `/ai-video-engines/best-for/${entry.slug}`),
    })),
  };
}

function buildHubWebPageJsonLd(locale: AppLocale, copy: (typeof HUB_COPY)[AppLocale]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: copy.title,
    description: copy.description,
    url: getLocalizedUrl(locale, '/ai-video-engines/best-for'),
  };
}
