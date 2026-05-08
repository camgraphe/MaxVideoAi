import type { ComponentProps } from 'react';
import { Sparkles } from 'lucide-react';
import { ModelsGallery } from '@/components/marketing/ModelsGallery';
import { UIIcon } from '@/components/ui/UIIcon';

type ModelsCatalogGallerySectionProps = {
  allowCompare: boolean;
  bridgeText: string;
  cards: ComponentProps<typeof ModelsGallery>['cards'];
  copy: ComponentProps<typeof ModelsGallery>['copy'];
  ctaLabel: string;
  srTitle: string;
  visibleFilters: ComponentProps<typeof ModelsGallery>['visibleFilters'];
};

export function ModelsCatalogGallerySection({
  allowCompare,
  bridgeText,
  cards,
  copy,
  ctaLabel,
  srTitle,
  visibleFilters,
}: ModelsCatalogGallerySectionProps) {
  return (
    <>
      <section id="models-grid" className="stack-gap-md scroll-mt-24">
        <h2 className="sr-only">{srTitle}</h2>
        <ModelsGallery
          cards={cards}
          ctaLabel={ctaLabel}
          copy={copy}
          visibleFilters={visibleFilters}
          allowCompare={allowCompare}
        />
      </section>
      <p className="mx-auto flex max-w-4xl items-start gap-3 px-4 text-sm font-medium leading-relaxed text-text-secondary sm:items-center">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-soft)] text-brand sm:mt-0">
          <UIIcon icon={Sparkles} size={15} />
        </span>
        <span>{bridgeText}</span>
      </p>
    </>
  );
}
