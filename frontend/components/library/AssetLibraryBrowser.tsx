'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';

export type AssetLibrarySource = 'all' | 'upload' | 'generated' | 'character' | 'angle';

export type AssetBrowserAsset = {
  id: string;
  url: string;
  kind: 'image' | 'video' | 'audio';
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mime?: string | null;
  source?: string | null;
  createdAt?: string;
  canDelete?: boolean;
};

export type AssetBrowserToolLink = {
  href: string;
  label: string;
};

interface AssetLibraryBrowserProps {
  assetType: 'image' | 'video';
  layout?: 'modal' | 'page';
  title: string;
  subtitle?: string;
  countLabel?: string | null;
  assets: AssetBrowserAsset[];
  isLoading: boolean;
  error?: string | null;
  source: AssetLibrarySource;
  availableSources: AssetLibrarySource[];
  sourceLabels: Partial<Record<AssetLibrarySource, string>>;
  onSourceChange: (source: AssetLibrarySource) => void;
  headerActions?: ReactNode;
  searchPlaceholder: string;
  sourcesTitle: string;
  emptyLabel: string;
  emptySearchLabel: string;
  toolsTitle?: string;
  toolsDescription?: string;
  toolLinks?: AssetBrowserToolLink[];
  renderAssetActions: (asset: AssetBrowserAsset) => ReactNode;
  renderAssetMeta?: (asset: AssetBrowserAsset) => ReactNode;
  className?: string;
}

function formatSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function AssetLibraryBrowser({
  assetType,
  layout = 'modal',
  title,
  subtitle,
  countLabel,
  assets,
  isLoading,
  error,
  source,
  availableSources,
  sourceLabels,
  onSourceChange,
  headerActions,
  searchPlaceholder,
  sourcesTitle,
  emptyLabel,
  emptySearchLabel,
  toolsTitle,
  toolsDescription,
  toolLinks,
  renderAssetActions,
  renderAssetMeta,
  className,
}: AssetLibraryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const isPageLayout = layout === 'page';

  const filteredAssets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return assets;
    return assets.filter((asset) => {
      const dimensions = asset.width && asset.height ? `${asset.width}x${asset.height}` : '';
      const haystack = [asset.id, asset.url, asset.source, asset.mime, asset.createdAt, dimensions]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [assets, searchQuery]);

  useEffect(() => {
    setSearchQuery('');
  }, [assetType, source, title]);

  const hasToolLinks = assetType === 'image' && Array.isArray(toolLinks) && toolLinks.length > 0;

  return (
    <div
      className={clsx(
        isPageLayout
          ? 'flex w-full flex-col gap-5 lg:h-full lg:min-h-0 lg:flex-row lg:gap-8'
          : 'flex h-full w-full flex-col overflow-y-auto overscroll-contain rounded-[24px] border border-border/70 bg-surface shadow-float sm:flex-row sm:overflow-hidden sm:rounded-[28px]',
        className
      )}
    >
      <aside
        className={clsx(
          'flex w-full shrink-0 flex-col',
          isPageLayout
            ? 'gap-5 lg:w-[248px] xl:w-[268px]'
            : 'border-b border-border/70 bg-surface-2/80 p-4 sm:w-[280px] sm:border-b-0 sm:border-r sm:p-5'
        )}
      >
        <div className="relative">
          <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted">
            <circle cx="8.5" cy="8.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="m12 12 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-[16px] border border-border/70 bg-surface pl-10 pr-3 text-sm text-text-primary shadow-inner placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className={clsx(isPageLayout ? 'space-y-2' : 'mt-4 space-y-2 sm:mt-6')}>
          <p className="px-2 text-[11px] font-semibold uppercase tracking-micro text-text-muted">{sourcesTitle}</p>
          <div
            role="tablist"
            aria-label="Library asset filters"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:block sm:space-y-1 sm:overflow-visible sm:px-0 sm:pb-0"
          >
            {availableSources.map((option) => {
              const label = sourceLabels[option];
              if (!label) return null;
              const active = source === option;
              return (
                <Button
                  key={option}
                  type="button"
                  role="tab"
                  variant={active ? 'primary' : 'ghost'}
                  size="sm"
                  aria-selected={active}
                  onClick={() => onSourceChange(option)}
                  className={clsx(
                    'h-10 min-w-max shrink-0 justify-center rounded-full px-4 text-sm font-semibold sm:h-11 sm:w-full sm:min-w-0 sm:justify-start sm:rounded-[16px]',
                    active ? 'shadow-card' : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                  )}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>

        {hasToolLinks ? (
          <div className={clsx(isPageLayout ? 'space-y-3' : 'mt-5 space-y-3 sm:mt-8')}>
            {toolsTitle || toolsDescription ? (
              <div className="px-2">
                {toolsTitle ? (
                  <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{toolsTitle}</p>
                ) : null}
                {toolsDescription ? (
                  <p className="mt-1 hidden text-xs text-text-secondary sm:block">{toolsDescription}</p>
                ) : null}
              </div>
            ) : null}
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:block sm:space-y-1 sm:overflow-visible sm:px-0 sm:pb-0">
              {toolLinks?.map((tool) => (
                <ButtonLink
                  key={tool.href}
                  href={tool.href}
                  size="sm"
                  variant="ghost"
                  className="h-10 min-w-max shrink-0 justify-center rounded-full px-4 text-sm font-semibold text-text-secondary hover:bg-surface hover:text-text-primary sm:h-11 sm:w-full sm:min-w-0 sm:justify-start sm:rounded-[16px]"
                >
                  {tool.label}
                </ButtonLink>
              ))}
            </div>
          </div>
        ) : null}
      </aside>

      <div
        className={clsx(
          'flex min-w-0 flex-1 flex-col',
          isPageLayout ? 'bg-transparent lg:min-h-0 lg:overflow-hidden' : 'bg-surface sm:min-h-0'
        )}
      >
        <div
          className={clsx(
            'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
            isPageLayout
              ? 'border-b border-border/60 pb-4'
              : 'border-b border-border/70 bg-surface-glass-90 px-4 py-4 sm:px-6 sm:py-5'
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
              {countLabel ? <span className="text-xs text-text-secondary">{countLabel}</span> : null}
            </div>
            {subtitle ? <p className="text-sm text-text-secondary">{subtitle}</p> : null}
          </div>
          {headerActions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{headerActions}</div> : null}
        </div>

        <div
          className={clsx(
            'flex-1 overflow-visible',
            isPageLayout ? 'pt-5 lg:min-h-0 lg:overflow-y-auto lg:pr-2' : 'bg-surface-2/35 p-4 sm:min-h-0 sm:overflow-y-auto sm:p-6'
          )}
        >
          {error ? (
            <div className="rounded-input border border-error-border bg-error-bg px-4 py-3 text-sm text-error">
              {error}
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-[var(--grid-gap-sm)] xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`asset-skeleton-${index}`} className="h-28 rounded-card border border-border bg-placeholder sm:h-40" aria-hidden>
                  <div className="skeleton h-full w-full" />
                </div>
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="rounded-input border border-border/70 bg-surface-glass-80 px-4 py-6 text-center text-sm text-text-secondary">
              {searchQuery.trim().length ? emptySearchLabel : emptyLabel}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-[var(--grid-gap-sm)] xl:grid-cols-3">
              {filteredAssets.map((asset) => {
                const dimensions = asset.width && asset.height ? `${asset.width}×${asset.height}` : null;
                const sizeLabel = formatSize(asset.size);
                return (
                  <div key={asset.id} className="overflow-hidden rounded-card border border-border/70 bg-surface shadow-card transition hover:border-text-primary/60">
                    <div className="relative bg-placeholder" style={{ aspectRatio: '16 / 9' }}>
                      {asset.kind === 'video' ? (
                        <video src={asset.url} controls className="h-full w-full bg-black object-cover" />
                      ) : (
                        <Image
                          src={asset.url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(min-width: 1280px) 32vw, (min-width: 640px) 48vw, 100vw"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 border-t border-border/70 bg-surface-glass-90 px-2.5 py-2 text-[11px] text-text-secondary sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-3 sm:text-[12px]">
                      <div className="flex min-w-0 flex-col gap-1">
                        {dimensions ? <span>{dimensions}</span> : null}
                        {sizeLabel ? <span>{sizeLabel}</span> : null}
                        {renderAssetMeta ? renderAssetMeta(asset) : null}
                      </div>
                      <div className="flex w-full items-center gap-2 sm:w-auto">{renderAssetActions(asset)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
