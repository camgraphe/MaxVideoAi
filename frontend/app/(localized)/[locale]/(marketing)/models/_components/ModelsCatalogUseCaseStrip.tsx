import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';
import type { ModelsCatalogUseCase } from '../_lib/models-catalog-decision-data';

type ModelsCatalogUseCaseStripProps = {
  bestLabel: string;
  title: string;
  viewAllLabel: string;
  items: ModelsCatalogUseCase[];
};

export function ModelsCatalogUseCaseStrip({ bestLabel, title, viewAllLabel, items }: ModelsCatalogUseCaseStripProps) {
  return (
    <section className="catalog-use-cases border-b border-hairline bg-bg py-5">
      <div className="container-page max-w-[1248px]">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <Link
            href="/ai-video-engines/best-for"
            className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary transition hover:text-text-primary"
          >
            {viewAllLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              prefetch={false}
              className="flex min-h-[98px] flex-col items-center rounded-[8px] border border-hairline bg-surface px-2.5 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted sm:min-h-[118px] sm:px-3"
            >
              <span
                className="catalog-use-icon"
              >
                <UIIcon icon={item.icon} size={15} />
              </span>
              <span className="mt-2 block text-[11px] font-semibold leading-tight text-text-primary">{item.title}</span>
              <span className="mt-1 block text-[10px] leading-snug text-text-secondary">{item.subtitle}</span>
              <span className="mt-auto block pt-1.5 text-[9px] font-semibold leading-tight text-text-muted">
                {bestLabel}: {item.best}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
