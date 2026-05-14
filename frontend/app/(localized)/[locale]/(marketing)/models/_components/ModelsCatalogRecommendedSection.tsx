import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { ModelGalleryCard } from '@/components/marketing/ModelsGallery';

type ModelsCatalogRecommendedSectionProps = {
  title: string;
  subtitle: string;
  cards: ModelGalleryCard[];
  allModelsLabel: string;
  statsLabels: {
    from: string;
    duration: string;
    resolution: string;
  };
};

export function ModelsCatalogRecommendedSection({
  title,
  subtitle,
  cards,
  allModelsLabel,
  statsLabels,
}: ModelsCatalogRecommendedSectionProps) {
  return (
    <section id="recommended" className="scroll-mt-24 border-b border-hairline bg-bg py-6">
      <div className="container-page max-w-[1248px]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">{subtitle}</p>
          </div>
          <a href="#models-grid" className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary">
            {allModelsLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              prefetch={false}
              className="flex min-h-[176px] flex-col rounded-[8px] border border-hairline bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-text-muted"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-hairline bg-bg px-2 py-1 text-[10px] font-semibold text-text-secondary">
                  <EngineIcon
                    engine={{ id: card.engineId ?? card.id, label: card.label, brandId: card.brandId ?? undefined }}
                    size={14}
                    framed={false}
                    rounded="full"
                    className="shrink-0"
                  />
                  <span className="truncate">{card.provider}</span>
                </span>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-hairline bg-bg text-sm font-semibold text-text-primary">
                  <span>
                    {card.overallScore != null ? card.overallScore.toFixed(1) : '-'}
                    <span className="text-[8px] font-medium text-text-muted">/10</span>
                  </span>
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold leading-tight text-text-primary">{card.label}</h3>
              <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-text-secondary">{card.description}</p>
              <dl className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-3 text-[11px] text-text-secondary">
                <div className="inline-flex items-center gap-1.5">
                  <dt>{statsLabels.from}</dt>
                  <dd className="font-semibold text-text-primary">{card.stats?.priceFrom ?? '-'}</dd>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <dt>{statsLabels.duration}</dt>
                  <dd className="font-semibold text-text-primary">{card.stats?.maxDuration ?? '-'}</dd>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <dt>{statsLabels.resolution}</dt>
                  <dd className="font-semibold text-text-primary">{card.stats?.maxResolution ?? '-'}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
