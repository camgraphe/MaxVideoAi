'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, AudioLines, ChevronRight, ExternalLink } from 'lucide-react';

import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import { UIIcon } from '@/components/ui/UIIcon';

import { MODEL_PAGE_ICON_MUTED, MODEL_PAGE_ICON_ON_DARK } from '../_lib/model-page-icon-styles';

export type DecisionExampleFilterId =
  | 'all'
  | 'cinematic'
  | 'product'
  | 'action'
  | 'vertical'
  | 'audio'
  | 'campaign'
  | 'typography'
  | 'reference'
  | 'final'
  | 'grounded'
  | 'edit'
  | 'wide'
  | 'character'
  | 'batch'
  | 'ui'
  | 'mask'
  | 'infographic';

export type DecisionExampleFilter = {
  id: DecisionExampleFilterId;
  label: string;
};

export type DecisionExampleGalleryItem = {
  id: string;
  href: string;
  posterUrl: string;
  alt: string;
  audioBadgeLabel: string | null;
  durationLabel: string | null;
  aspectRatio: string | null;
  category: string;
  title: string;
  recreateHref: string | null;
  recreateLabel: string | null;
  tags: DecisionExampleFilterId[];
};

type ModelDecisionExamplesGalleryProps = {
  title: string;
  intro: string;
  filters: DecisionExampleFilter[];
  items: DecisionExampleGalleryItem[];
  examplesLinkHref: LocalizedLinkHref | null;
  viewAllLabel: string;
  renderLinkLabel: string;
  emptyLabel: string;
};

export function ModelDecisionExamplesGallery({
  title,
  intro,
  filters,
  items,
  examplesLinkHref,
  viewAllLabel,
  renderLinkLabel,
  emptyLabel,
}: ModelDecisionExamplesGalleryProps) {
  const [activeFilter, setActiveFilter] = useState<DecisionExampleFilterId>('all');
  const [pageIndex, setPageIndex] = useState(0);
  const visibleItems = useMemo(
    () => (activeFilter === 'all' ? items : items.filter((item) => item.tags.includes(activeFilter))),
    [activeFilter, items]
  );
  const itemsPerPage = 4;
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / itemsPerPage));
  const resolvedPageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedItems = visibleItems.slice(resolvedPageIndex * itemsPerPage, resolvedPageIndex * itemsPerPage + itemsPerPage);
  const canPageExamples = visibleItems.length > itemsPerPage;

  useEffect(() => {
    setPageIndex(0);
  }, [activeFilter]);

  useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [pageCount, pageIndex]);

  return (
    <>
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,0.92fr)_auto] xl:items-start">
        <div className="xl:max-w-[650px]">
          <h2 className="!text-left text-[1.7rem] font-semibold leading-tight tracking-normal text-slate-950 dark:text-white">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{intro}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
          <div className="flex flex-wrap gap-2 xl:flex-nowrap" aria-label="Example filters">
            {filters.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  aria-pressed={isActive}
                  className={[
                    'inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                    isActive
                      ? 'border-blue-200 bg-white text-blue-600 shadow-sm dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-200'
                      : 'border-slate-200 bg-white/75 text-slate-600 hover:border-blue-200 hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:border-blue-300/30 dark:hover:text-blue-200',
                  ].join(' ')}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          {examplesLinkHref ? (
            <Link
              href={examplesLinkHref}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-4 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <span>{viewAllLabel}</span>
              <UIIcon icon={ExternalLink} size={14} />
            </Link>
          ) : null}
        </div>
      </div>

      {items.length ? (
        <div className="relative mt-5">
          {visibleItems.length ? (
            <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
              {pagedItems.map((item) => {
                const isVertical = item.aspectRatio === '9:16' || item.aspectRatio === '3:4';
                return (
                  <article
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/[0.045]"
                  >
                    <Link
                      href={item.href as LocalizedLinkHref}
                      className={[
                        'group relative block aspect-video overflow-hidden',
                        isVertical ? 'bg-slate-950 dark:bg-black' : 'bg-slate-100 dark:bg-white/5',
                      ].join(' ')}
                    >
                      {item.posterUrl ? (
                        <Image
                          src={item.posterUrl}
                          alt={item.alt}
                          fill
                          className={[
                            'h-full w-full transition duration-300',
                            isVertical ? 'object-contain' : 'object-cover group-hover:scale-[1.025]',
                          ].join(' ')}
                          sizes="(min-width: 1280px) 300px, (min-width: 768px) 45vw, 90vw"
                          quality={70}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                          No preview
                        </div>
                      )}
                      {item.audioBadgeLabel ? (
                        <div className="absolute left-2 top-2 inline-flex h-6 items-center gap-1 rounded-lg bg-slate-950/82 px-2 text-[0.64rem] font-semibold text-white shadow-sm backdrop-blur sm:left-3 sm:top-3 sm:h-7 sm:gap-1.5 sm:px-2.5 sm:text-[0.72rem]">
                          <UIIcon icon={AudioLines} size={12} className={MODEL_PAGE_ICON_ON_DARK} />
                          <span className="max-[380px]:sr-only">{item.audioBadgeLabel}</span>
                        </div>
                      ) : null}
                      {item.durationLabel ? (
                        <div className="absolute right-2 top-2 rounded-lg bg-slate-950/82 px-2 py-1 text-[0.64rem] font-semibold text-white shadow-sm backdrop-blur sm:right-3 sm:top-3 sm:px-2.5 sm:text-[0.72rem]">
                          {item.durationLabel}
                        </div>
                      ) : null}
                      {item.aspectRatio ? (
                        <div className="absolute bottom-2 right-2 rounded-lg bg-slate-950/82 px-2 py-1 text-[0.64rem] font-semibold text-white shadow-sm backdrop-blur sm:bottom-3 sm:right-3 sm:px-2.5 sm:text-[0.72rem]">
                          {item.aspectRatio}
                        </div>
                      ) : null}
                    </Link>
                    <div className="px-3 py-3 sm:px-4 sm:py-3.5">
                      <p className="text-[0.72rem] font-medium text-slate-500 dark:text-slate-400">{item.category}</p>
                      <h3 className="mt-1 line-clamp-1 !text-left text-sm font-semibold text-slate-950 dark:text-white">
                        {item.title}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.72rem] font-semibold sm:gap-x-5 sm:text-[0.78rem]">
                        <Link href={item.href as LocalizedLinkHref} className="text-slate-950 transition hover:text-blue-600 dark:text-white dark:hover:text-blue-200">
                          {renderLinkLabel}
                        </Link>
                        {item.recreateHref && item.recreateLabel ? (
                          <Link
                            href={item.recreateHref as LocalizedLinkHref}
                            className="inline-flex items-center gap-1 text-blue-700 transition hover:text-blue-500 dark:text-blue-200 dark:hover:text-blue-100"
                          >
                            <span>{item.recreateLabel.replace(/\s*(?:→|->)\s*$/, '')}</span>
                            <UIIcon icon={ArrowRight} size={13} className={MODEL_PAGE_ICON_MUTED} />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300">
              {emptyLabel}
            </div>
          )}
          {canPageExamples ? (
            <button
              type="button"
              onClick={() => setPageIndex((current) => (current + 1) % pageCount)}
              aria-label="Show more examples"
              className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 shadow-[0_16px_38px_-26px_rgba(15,23,42,0.55)] transition hover:border-blue-200 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:border-blue-300/30 dark:hover:text-blue-200 sm:right-3 sm:h-12 sm:w-12"
            >
              <UIIcon icon={ChevronRight} size={19} />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300">
          {intro}
        </div>
      )}
    </>
  );
}
