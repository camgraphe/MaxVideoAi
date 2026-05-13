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

const USE_CASE_ICON_CLASSES = [
  'bg-violet-50 text-violet-700 dark:bg-violet-400/12 dark:text-violet-200',
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200',
  'bg-sky-50 text-sky-700 dark:bg-sky-400/12 dark:text-sky-200',
  'bg-cyan-50 text-cyan-700 dark:bg-cyan-400/12 dark:text-cyan-200',
  'bg-purple-50 text-purple-700 dark:bg-purple-400/12 dark:text-purple-200',
  'bg-amber-50 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200',
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-400/12 dark:text-indigo-200',
  'bg-orange-50 text-orange-700 dark:bg-orange-400/12 dark:text-orange-200',
] as const;

export function ModelsCatalogUseCaseStrip({ bestLabel, title, viewAllLabel, items }: ModelsCatalogUseCaseStripProps) {
  return (
    <section className="border-b border-hairline bg-bg py-5">
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
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
          {items.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              prefetch={false}
              className="flex min-h-[118px] flex-col items-center rounded-[8px] border border-hairline bg-surface px-3 py-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-text-muted"
            >
              <span
                className={`mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  USE_CASE_ICON_CLASSES[index % USE_CASE_ICON_CLASSES.length]
                }`}
              >
                <UIIcon icon={item.icon} size={16} />
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
