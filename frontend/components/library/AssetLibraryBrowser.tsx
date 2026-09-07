'use client';

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AudioWaveform, Film } from 'lucide-react';
import { MediaActionPanel } from './MediaActionPanel.client';
import { LibraryImageThumbnail } from './LibraryImageThumbnail.client';
import { mediaActionCopy, compactMediaSource } from './media-action-copy';
import { Button, ButtonLink } from '@/components/ui/Button';

export type AssetLibrarySource =
  | 'all'
  | 'upload'
  | 'generated'
  | 'recent'
  | 'storyboard'
  | 'character'
  | 'angle'
  | 'upscale';

export type AssetBrowserAsset = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  previewUrl?: string | null;
  kind: 'image' | 'video' | 'audio';
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mime?: string | null;
  source?: string | null;
  createdAt?: string;
  canDelete?: boolean;
  jobId?: string | null;
  sourceOutputId?: string | null;
  isSaved?: boolean;
  savedAssetId?: string | null;
};

export type AssetBrowserToolLink = {
  href: string;
  label: string;
};

export interface AssetLibraryBrowserProps {
  locale?: string;
  renderContinuation?: (asset: AssetBrowserAsset) => ReactNode;
  assetType: 'image' | 'video' | 'audio';
  layout?: 'modal' | 'page';
  title: string;
  subtitle?: string;
  countLabel?: string | null;
  onClose?: () => void;
  closeLabel?: string;
  assets: AssetBrowserAsset[];
  isLoading: boolean;
  error?: string | null;
  source: AssetLibrarySource;
  availableSources: readonly AssetLibrarySource[];
  sourceLabels: Partial<Record<AssetLibrarySource, string>>;
  onSourceChange: (source: AssetLibrarySource) => void;
  headerActions?: ReactNode;
  headerLeadingActions?: ReactNode;
  titleActions?: ReactNode;
  headingActions?: ReactNode;
  searchPlaceholder: string;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onRetry?: () => void;
  retryLabel?: string;
  sourcesTitle: string;
  emptyLabel: string;
  emptySearchLabel: string;
  toolsTitle?: string;
  toolsDescription?: string;
  toolLinks?: AssetBrowserToolLink[];
  getAssetHref?: (asset: AssetBrowserAsset) => string | null;
  getAssetHrefLabel?: (asset: AssetBrowserAsset) => string;
  renderAssetActions: (asset: AssetBrowserAsset) => ReactNode;
  renderAssetMeta?: (asset: AssetBrowserAsset) => ReactNode;
  hasMore?: boolean;
  loadMoreLabel?: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  className?: string;
}

function formatSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function AssetLibraryBrowser({
  locale = 'en',
  renderContinuation,
  assetType,
  layout = 'modal',
  title,
  subtitle,
  countLabel,
  onClose,
  closeLabel = 'Close',
  assets,
  isLoading,
  error,
  source,
  availableSources,
  sourceLabels,
  onSourceChange,
  headerActions,
  headerLeadingActions,
  titleActions,
  headingActions,
  searchPlaceholder,
  searchQuery: controlledSearchQuery,
  onSearchQueryChange,
  onRetry,
  retryLabel = 'Retry',
  sourcesTitle,
  emptyLabel,
  emptySearchLabel,
  toolsTitle,
  toolsDescription,
  toolLinks,
  getAssetHref,
  getAssetHrefLabel,
  renderAssetActions,
  renderAssetMeta,
  hasMore,
  loadMoreLabel = 'Load more',
  onLoadMore,
  isLoadingMore,
  className,
}: AssetLibraryBrowserProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = controlledSearchQuery ?? localSearchQuery;
  const searchId = useId();
  const setSearchQuery = onSearchQueryChange ?? setLocalSearchQuery;
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const isPageLayout = layout === 'page';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = assets.find((asset) => asset.id === selectedId);
  const actionCopy = mediaActionCopy(locale);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (onSearchQueryChange || !normalizedQuery) return assets;
    return assets.filter((asset) => {
      const dimensions = asset.width && asset.height ? `${asset.width}x${asset.height}` : '';
      const haystack = [asset.id, asset.url, asset.source, asset.mime, asset.createdAt, dimensions]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [assets, onSearchQueryChange, searchQuery]);

  useEffect(() => {
    setLocalSearchQuery('');
    setActivePreviewId(null);
  }, [assetType, source, title]);

  const hasToolLinks = assetType === 'image' && Array.isArray(toolLinks) && toolLinks.length > 0;

  return (
    <div
      className={clsx(
        isPageLayout
          ? 'app-media-collection flex w-full flex-col gap-4 lg:min-h-0 lg:flex-1'
          : 'relative flex h-full w-full flex-col overflow-y-auto overscroll-contain rounded-[24px] border border-border/70 bg-surface shadow-float lg:overflow-hidden lg:rounded-[28px]',
        className
      )}
    >
      {!isPageLayout && onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-3 top-3 z-20 h-10 w-10 rounded-full border border-border/70 bg-surface-glass-90 px-0 text-text-secondary shadow-card backdrop-blur hover:bg-surface-2 hover:text-text-primary dark:border-white/10 dark:bg-black/30 dark:text-white/70 dark:hover:bg-white/[0.08] dark:hover:text-white"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-4.5 w-4.5">
            <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </Button>
      ) : null}
      <div
        className={clsx(
          'flex flex-col gap-3',
          isPageLayout
            ? 'app-library-heading rounded-2xl border border-border/70 bg-surface p-4'
            : 'border-b border-border/70 bg-surface-glass-90 px-4 py-4 pr-16 lg:px-6 lg:py-5 lg:pr-20'
        )}
      >
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-base font-semibold text-text-primary lg:text-lg">{title}</h2>
                {countLabel && !isLoading ? <span className="text-xs text-text-secondary">{countLabel}</span> : null}
              </div>
              {subtitle ? <p className="mt-1 hidden text-sm text-text-secondary lg:block">{subtitle}</p> : null}
            </div>
          </div>
          {headingActions ? <div className="app-media-heading-actions">{headingActions}</div> : null}
          {titleActions ? (
            <div className="app-library-view-switch flex flex-wrap items-center gap-2 lg:justify-end">
              {titleActions}
            </div>
          ) : null}
        </div>
        {headerLeadingActions || headerActions ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            {headerLeadingActions ? (
              <div className="app-library-types flex flex-wrap items-center gap-2">{headerLeadingActions}</div>
            ) : (
              <span aria-hidden />
            )}
            {headerActions ? (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">{headerActions}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={clsx(
          isPageLayout ? 'flex w-full flex-col gap-4 lg:min-h-0 lg:flex-1' : 'flex min-h-0 flex-1 flex-col lg:flex-row'
        )}
      >
        <aside
          className={clsx(
            'flex w-full shrink-0 flex-col gap-3',
            isPageLayout
              ? 'app-library-filters app-media-filters'
              : 'bg-surface-2/80 px-4 py-4 lg:w-[280px] lg:border-r lg:border-border/70 lg:p-5'
          )}
        >
          <div className="relative">
            <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted">
              <circle cx="8.5" cy="8.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="m12 12 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <label htmlFor={searchId} className="sr-only">{searchPlaceholder}</label>
            <input
              id={searchId}
              maxLength={onSearchQueryChange ? 200 : undefined}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder={isPageLayout ? locale.startsWith('fr') ? 'Rechercher' : locale.startsWith('es') ? 'Buscar' : 'Search' : searchPlaceholder}
              className="h-11 w-full rounded-[16px] border border-border/70 bg-surface pl-10 pr-3 text-sm text-text-primary shadow-inner placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="app-media-source-filter space-y-2">
            <p className="hidden px-2 text-[11px] font-semibold uppercase tracking-micro text-text-muted lg:block">{sourcesTitle}</p>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-text-secondary lg:hidden">
              <span className="shrink-0">{sourcesTitle}</span>
              <select title={sourceLabels[source]} value={source} onChange={(event) => onSourceChange(event.target.value as AssetLibrarySource)} className="!min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {availableSources.map((option) => sourceLabels[option] ? <option key={option} value={option}>{isPageLayout ? compactMediaSource(option, locale, sourceLabels[option]!) : sourceLabels[option]}</option> : null)}
              </select>
            </label>
            <div
              role="group"
              aria-label={sourcesTitle}
              className="hidden lg:block lg:space-y-1"
            >
              {availableSources.map((option) => {
                const label = sourceLabels[option];
                const mobileLabel = label;
                if (!label) return null;
                const active = source === option;
                return (
                  <Button
                    key={option}
                    type="button"
                    variant={active ? 'primary' : 'ghost'}
                    size="sm"
                    aria-pressed={active}
                    onClick={() => onSourceChange(option)}
                    className={clsx(
                      'h-9 min-w-max shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-semibold lg:h-11 lg:w-full lg:min-w-0 lg:justify-start lg:rounded-[16px] lg:px-4 lg:text-sm',
                      active ? 'shadow-card' : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                    )}
                  >
                    <span className="lg:hidden">{mobileLabel}</span>
                    <span className="hidden lg:inline">{label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {hasToolLinks && !isPageLayout ? (
            <div className="space-y-2">
              {toolsTitle || toolsDescription ? (
                <div className="px-2">
                  {toolsTitle ? (
                    <p className="hidden text-[11px] font-semibold uppercase tracking-micro text-text-muted lg:block">{toolsTitle}</p>
                  ) : null}
                  {toolsDescription ? (
                    <p className="mt-1 hidden text-xs text-text-secondary lg:block">{toolsDescription}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 lg:block lg:space-y-1">
                {(toolLinks ?? []).map((tool) => (
                  <ButtonLink
                    key={tool.href}
                    href={tool.href}
                    size="sm"
                    variant="ghost"
                    className="h-9 min-w-max shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-semibold text-text-secondary hover:bg-surface hover:text-text-primary lg:h-11 lg:w-full lg:min-w-0 lg:justify-start lg:rounded-[16px] lg:px-4 lg:text-sm"
                  >
                    <span className="lg:hidden">{tool.label}</span>
                    <span className="hidden lg:inline">{tool.label}</span>
                  </ButtonLink>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div
          className={clsx(
            'flex min-w-0 flex-1 flex-col',
            isPageLayout ? 'bg-transparent lg:min-h-0 lg:overflow-hidden' : 'bg-surface lg:min-h-0'
          )}
        >
          <div
            className={clsx(
              'flex-1 overflow-visible',
              isPageLayout
                ? 'app-scroll-surface lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-2'
                : 'bg-surface-2/35 p-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:p-6'
            )}
          >
            {error ? (
              <div role="alert" className="rounded-input border border-error-border bg-error-bg px-4 py-3 text-sm text-error">
                <p>{error}</p>
                {onRetry ? <Button type="button" variant="outline" size="sm" className="mt-3 !min-h-11" onClick={onRetry}>{retryLabel}</Button> : null}
              </div>
            ) : isLoading ? (
              <div className={isPageLayout ? "app-media-grid" : "grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-3"}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`asset-skeleton-${index}`} className="h-28 rounded-card border border-border bg-placeholder md:h-40" aria-hidden>
                    <div className="skeleton h-full w-full" />
                  </div>
                ))}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="rounded-input border border-border/70 bg-surface-glass-80 px-4 py-6 text-center text-sm text-text-secondary">
                {searchQuery.trim().length ? emptySearchLabel : emptyLabel}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className={isPageLayout ? "app-media-grid" : "grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-3"}>
                  {filteredAssets.map((asset) => {
                    const dimensions = asset.width && asset.height ? `${asset.width}×${asset.height}` : null;
                    const sizeLabel = formatSize(asset.size);
                    const assetHref = getAssetHref?.(asset) ?? null;
                    const assetHrefLabel = getAssetHrefLabel?.(asset) ?? 'Open asset source';
                    return (
                      <div
                        key={asset.id}
                        className="app-library-asset overflow-hidden rounded-card border border-border/70 bg-surface shadow-card transition hover:border-text-primary/60"
                        onMouseEnter={() => {
                          if (!isPageLayout && asset.kind === 'video' && asset.previewUrl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setActivePreviewId(asset.id);
                        }}
                        onMouseLeave={() => {
                          if (!isPageLayout && asset.kind === 'video' && asset.previewUrl) setActivePreviewId((current) => (current === asset.id ? null : current));
                        }}
                        onFocusCapture={() => {
                          if (!isPageLayout && asset.kind === 'video' && asset.previewUrl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setActivePreviewId(asset.id);
                        }}
                        onBlurCapture={() => {
                          if (!isPageLayout && asset.kind === 'video' && asset.previewUrl) setActivePreviewId((current) => (current === asset.id ? null : current));
                        }}
                      >
                        <div className="relative bg-placeholder" style={{ aspectRatio: '16 / 9' }}>
                          {asset.kind === 'video' ? (
                            <>
                              {asset.thumbUrl ? (
                                isPageLayout ? <LibraryImageThumbnail asset={{ ...asset, url: asset.thumbUrl }} className="absolute inset-0 h-full w-full object-cover" /> : <Image
                                  src={asset.thumbUrl}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 390px"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-surface-2 text-text-secondary">
                                  <Film className="h-8 w-8" aria-hidden />
                                </div>
                              )}
                              {asset.previewUrl && activePreviewId === asset.id ? (
                                <video
                                  src={activePreviewId === asset.id ? asset.previewUrl : undefined}
                                  poster={asset.thumbUrl ?? undefined}
                                  muted
                                  loop
                                  playsInline
                                  autoPlay
                                  preload="none"
                                  className={clsx(
                                    'absolute inset-0 h-full w-full bg-surface-2 object-cover transition-opacity duration-150',
                                    activePreviewId === asset.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                              ) : null}
                            </>
                          ) : asset.kind === 'audio' ? (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface-2 px-4 text-text-secondary">
                              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-brand shadow-card">
                                <AudioWaveform className="h-6 w-6" aria-hidden />
                              </div>
                              {!isPageLayout ? <audio src={asset.url} controls preload="none" className="w-full max-w-[260px]" /> : null}
                            </div>
                          ) : (
                            isPageLayout ? <LibraryImageThumbnail asset={asset} className="absolute inset-0 h-full w-full object-cover" /> : <Image
                              src={asset.thumbUrl ?? asset.url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 390px"
                            />
                          )}
                          {isPageLayout ? <button type="button" className="app-media-card-open absolute inset-0 z-10" onClick={() => setSelectedId(asset.id)} aria-label={actionCopy.title}><span>{actionCopy.actions} ↗</span></button> : assetHref ? (
                            <Link
                              href={assetHref}
                              prefetch={false}
                              aria-label={assetHrefLabel}
                              title={assetHrefLabel}
                              data-library-card-media-link
                              className="absolute inset-0 z-10 rounded-t-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            >
                              <span className="sr-only">{assetHrefLabel}</span>
                            </Link>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2 border-t border-border/70 bg-surface-glass-90 px-2 py-2 text-[10px] text-text-secondary md:px-3 md:text-[12px] lg:gap-2">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate">{[dimensions, sizeLabel].filter(Boolean).join(' · ')}</span>
                            {renderAssetMeta ? renderAssetMeta(asset) : null}
                          </div>
                          {!isPageLayout ? <div className="flex w-full flex-wrap items-center gap-1.5 md:gap-2">{renderAssetActions(asset)}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {hasMore && (onSearchQueryChange || searchQuery.trim().length === 0) && onLoadMore ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoadingMore}
                      onClick={onLoadMore}
                      className="rounded-full border-border bg-surface px-4 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadMoreLabel}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
      {isPageLayout && selected ? <MediaActionPanel key={selected.id} asset={selected} locale={locale} onClose={() => setSelectedId(null)}>
        {error ? <p role="alert" className="text-error">{error}</p> : null}
        {renderContinuation?.(selected)}
        {getAssetHref?.(selected) ? <Link href={getAssetHref(selected)!} prefetch={false}>{getAssetHrefLabel?.(selected) ?? 'Open asset source'}</Link> : null}
        <div className="app-media-management">{renderAssetActions(selected)}</div>
      </MediaActionPanel> : null}
    </div>
  );
}
