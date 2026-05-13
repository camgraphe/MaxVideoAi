import type { ComponentProps } from 'react';
import { Sparkles } from 'lucide-react';
import { ModelsGallery, type ModelsGalleryEngineType } from '@/components/marketing/ModelsGallery';
import { UIIcon } from '@/components/ui/UIIcon';

type ModelsCatalogGallerySectionProps = {
  allowCompare: boolean;
  bridgeText: string;
  cards: ComponentProps<typeof ModelsGallery>['cards'];
  copy: ComponentProps<typeof ModelsGallery>['copy'];
  ctaLabel: string;
  initialEngineType: ModelsGalleryEngineType;
  srTitle: string;
  showEngineTypeTabs: boolean;
  subtitle: string;
  title: string;
  visibleFilters: ComponentProps<typeof ModelsGallery>['visibleFilters'];
};

export function ModelsCatalogGallerySection({
  allowCompare,
  bridgeText,
  cards,
  copy,
  ctaLabel,
  initialEngineType,
  srTitle,
  showEngineTypeTabs,
  subtitle,
  title,
  visibleFilters,
}: ModelsCatalogGallerySectionProps) {
  return (
    <section id="models-grid" className="scroll-mt-24">
      <div className="container-page max-w-[1248px]">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">{subtitle}</p>
          </div>
        </div>
        <h2 className="sr-only">{srTitle}</h2>
        <div className="rounded-[8px] border border-hairline bg-surface p-3 shadow-card sm:p-4">
          <ModelsGallery
            cards={cards}
            ctaLabel={ctaLabel}
            copy={copy}
            visibleFilters={visibleFilters}
            allowCompare={allowCompare}
            showEngineTypeTabs={showEngineTypeTabs}
            initialEngineType={initialEngineType}
          />
        </div>
        <p className="mx-auto mt-4 flex max-w-4xl items-start gap-3 px-4 text-sm font-medium leading-relaxed text-text-secondary sm:items-center">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-soft)] text-brand sm:mt-0">
            <UIIcon icon={Sparkles} size={15} />
          </span>
          <span>{bridgeText}</span>
        </p>
      </div>
    </section>
  );
}
