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

export interface AssetLibraryBrowserProps {
  assetType: 'image' | 'video';
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

function compactCollectionLabel(label: string): string {
  const compact = label
    .replace(/\b(images?|videos?|assets?)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return compact.length ? compact : label;
}

function compactToolLabel(label: string): string {
  const compact = label
    .replace(/\b(generate|create|change)\b/gi, '')
    .replace(/\bbuilder\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!compact.length) return label;
  return compact.charAt(0).toUpperCase() + compact.slice(1);
}

export function AssetLibraryBrowser({
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
  const mobileSourceLabels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(sourceLabels).map(([key, value]) => [key, typeof value === 'string' ? compactCollectionLabel(value) : value])
      ) as Partial<Record<AssetLibrarySource, string>>,
    [sourceLabels]
  );
  const mobileToolLinks = useMemo(
    () => (toolLinks ?? []).map((tool) => ({ ...tool, compactLabel: compactToolLabel(tool.label) })),
    [toolLinks]
  );

  return (
    <div
      className={clsx(
        isPageLayout
          ? 'flex w-full flex-col gap-4 lg:min-h-0 lg:flex-1'
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
            ? 'border-b border-border/60 pb-4'
            : 'border-b border-border/70 bg-surface-glass-90 px-4 py-4 pr-16 lg:px-6 lg:py-5 lg:pr-20'
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold text-text-primary lg:text-lg">{title}</h2>
            {countLabel ? <span className="text-xs text-text-secondary">{countLabel}</span> : null}
          </div>
          {subtitle ? <p className="mt-1 hidden text-sm text-text-secondary lg:block">{subtitle}</p> : null}
        </div>
        {headerActions ? (
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:justify-end lg:overflow-visible lg:px-0 lg:pb-0">
            {headerActions}
          </div>
        ) : null}
      </div>

      <div
        className={clsx(
          isPageLayout ? 'flex w-full flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-8' : 'flex min-h-0 flex-1 flex-col lg:flex-row'
        )}
      >
        <aside
          className={clsx(
            'flex w-full shrink-0 flex-col gap-3',
            isPageLayout
              ? 'lg:w-[248px] xl:w-[268px]'
              : 'bg-surface-2/80 px-4 py-4 lg:w-[280px] lg:border-r lg:border-border/70 lg:p-5'
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

          <div className="space-y-2">
            <p className="hidden px-2 text-[11px] font-semibold uppercase tracking-micro text-text-muted lg:block">{sourcesTitle}</p>
            <div
              role="tablist"
              aria-label="Library asset filters"
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0"
            >
              {availableSources.map((option) => {
                const label = sourceLabels[option];
                const mobileLabel = mobileSourceLabels[option];
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

          {hasToolLinks ? (
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
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
                {mobileToolLinks.map((tool) => (
                  <ButtonLink
                    key={tool.href}
                    href={tool.href}
                    size="sm"
                    variant="ghost"
                    className="h-9 min-w-max shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-semibold text-text-secondary hover:bg-surface hover:text-text-primary lg:h-11 lg:w-full lg:min-w-0 lg:justify-start lg:rounded-[16px] lg:px-4 lg:text-sm"
                  >
                    <span className="lg:hidden">{tool.compactLabel}</span>
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
                ? 'lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-2'
                : 'bg-surface-2/35 p-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:p-6'
            )}
          >
            {error ? (
              <div className="rounded-input border border-error-border bg-error-bg px-4 py-3 text-sm text-error">
                {error}
              </div>
            ) : isLoading ? (
              <div className="grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-3">
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
              <div className="grid grid-cols-2 gap-2 md:gap-3 xl:grid-cols-3">
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
                            sizes="(min-width: 1280px) 32vw, (min-width: 768px) 48vw, 100vw"
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-2 border-t border-border/70 bg-surface-glass-90 px-2 py-2 text-[10px] text-text-secondary md:px-3 md:text-[12px] lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          {dimensions ? <span>{dimensions}</span> : null}
                          {sizeLabel ? <span>{sizeLabel}</span> : null}
                          {renderAssetMeta ? renderAssetMeta(asset) : null}
                        </div>
                        <div className="flex w-full items-center gap-1.5 md:gap-2 lg:w-auto">{renderAssetActions(asset)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
