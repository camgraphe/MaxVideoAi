import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { EngineIcon } from '@/components/ui/EngineIcon';
import type { EngineCatalogEntry } from '../_lib/compare-page-types';
import { formatEngineName } from '../_lib/compare-page-helpers';

export function CompareGenerateCard({
  canGenerate,
  entry,
  fullProfileLabel,
  generateButtonLabel,
  generateWithLabel,
  side,
}: {
  canGenerate: boolean;
  entry: EngineCatalogEntry;
  fullProfileLabel: string;
  generateButtonLabel: string;
  generateWithLabel: string;
  side: 'left' | 'right';
}) {
  const tone = side === 'left'
    ? {
        icon: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/25 dark:bg-orange-400/10',
        button:
          'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100 dark:border-orange-400/25 dark:bg-orange-400/10 dark:text-orange-200 dark:hover:bg-orange-400/15',
        link: 'text-orange-600 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200',
      }
    : {
        icon: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10',
        button:
          'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/15',
        link: 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200',
      };

  return (
    <article className="rounded-[16px] border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between gap-4 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full border shadow-sm', tone.icon)}>
            <EngineIcon
              engine={{ id: entry.modelSlug, label: formatEngineName(entry), brandId: entry.brandId }}
              size={20}
              rounded="full"
            />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-text-secondary">
              {generateWithLabel}
            </p>
            <p className="truncate text-base font-semibold leading-5 text-text-primary">
              {formatEngineName(entry)}
            </p>
          </div>
        </div>
        {canGenerate ? (
          <ButtonLink
            href={`/app?engine=${entry.modelSlug}`}
            variant="outline"
            size="sm"
            aria-label={generateButtonLabel}
            className={clsx('h-10 w-10 shrink-0 rounded-[10px] p-0 shadow-none', tone.button)}
          >
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        ) : null}
      </div>
      <div className="border-t border-hairline px-4 py-3">
        <Link
          href={{ pathname: '/models/[slug]', params: { slug: entry.modelSlug } }}
          className={clsx('inline-flex items-center gap-1 text-xs font-semibold', tone.link)}
        >
          {fullProfileLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
