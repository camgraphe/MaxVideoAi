'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { FileText, ImageIcon, Music2, Search, Video } from 'lucide-react';
import editorStyles from '../maxvideoai-editor.module.css';
import styles from '../_styles/asset-library.module.css';
import type {
  WorkspaceLibraryAsset,
  WorkspaceLibraryKind,
  WorkspaceLibrarySource,
} from '../_lib/workspace-library-assets';
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceAssetLibraryBrowserLayout = 'sidebar' | 'modal';
type WorkspaceLibraryKindFilter = 'all' | WorkspaceLibraryKind;

type WorkspaceAssetLibraryBrowserProps = {
  copy: StudioCopy['assetLibrary'];
  title: string;
  subtitle?: string;
  layout: WorkspaceAssetLibraryBrowserLayout;
  assets: WorkspaceLibraryAsset[];
  isLoading: boolean;
  error: string | null;
  usingFallback: boolean;
  source: WorkspaceLibrarySource;
  sourceOptions: readonly WorkspaceLibrarySource[];
  sourceLabels: Record<WorkspaceLibrarySource, string>;
  onSourceChange: (source: WorkspaceLibrarySource) => void;
  mediaKindFilter?: WorkspaceLibraryKindFilter;
  onMediaKindFilterChange?: (kind: WorkspaceLibraryKindFilter) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onSelectAsset?: (asset: WorkspaceLibraryAsset) => void;
  headerActions?: ReactNode;
  searchPlaceholder?: string;
  emptyLabel?: string;
  emptySearchLabel?: string;
};

function formatCopyValue(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function pluralizeAssets(count: number, copy: StudioCopy['assetLibrary']): string {
  return `${count} ${count === 1 ? copy.assetSingular : copy.assetPlural}`;
}

function assetIcon(kind: WorkspaceLibraryAsset['kind']) {
  if (kind === 'video') return <Video size={20} />;
  if (kind === 'audio') return <Music2 size={20} />;
  if (kind === 'image') return <ImageIcon size={20} />;
  return <FileText size={20} />;
}

export function WorkspaceAssetLibraryBrowser({
  copy,
  title,
  subtitle,
  layout,
  assets,
  isLoading,
  error,
  usingFallback,
  source,
  sourceOptions,
  sourceLabels,
  onSourceChange,
  mediaKindFilter,
  onMediaKindFilterChange,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onSelectAsset,
  headerActions,
  searchPlaceholder,
  emptyLabel,
  emptySearchLabel,
}: WorkspaceAssetLibraryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSearchQuery('');
  }, [mediaKindFilter, source]);

  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) => {
      const haystack = [asset.id, asset.name, asset.meta, asset.kind, asset.dimensions, asset.url]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [assets, searchQuery]);

  const countLabel = isLoading ? copy.loading : pluralizeAssets(filteredAssets.length, copy);
  const browserClassName = `${styles.assetBrowser} ${
    layout === 'sidebar' ? styles.assetBrowserSidebar : styles.assetBrowserModal
  }`;
  const mediaKindOptions: Array<{ value: WorkspaceLibraryKindFilter; label: string }> = [
    { value: 'all', label: copy.mediaKindAll },
    { value: 'image', label: copy.mediaKindImage },
    { value: 'video', label: copy.mediaKindVideo },
    { value: 'audio', label: copy.mediaKindAudio },
  ];

  return (
    <section className={browserClassName} aria-label={title}>
      <header className={styles.assetBrowserHeader}>
        <div>
          <div className={styles.assetBrowserTitleRow}>
            <p className={editorStyles.panelTitle}>{title}</p>
            <span className={styles.assetBrowserCount}>{countLabel}</span>
          </div>
          {subtitle ? <span className={editorStyles.panelSubtitle}>{subtitle}</span> : null}
        </div>
        {headerActions ? <div className={styles.assetBrowserHeaderActions}>{headerActions}</div> : null}
      </header>

      <label className={styles.assetBrowserSearch}>
        <Search size={14} />
        <span>{copy.searchAssets}</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          placeholder={searchPlaceholder ?? copy.searchPlaceholder}
        />
      </label>

      {onMediaKindFilterChange ? (
        <div className={styles.assetBrowserSources} role="tablist" aria-label={copy.mediaKindFilters}>
          {mediaKindOptions.map((option) => {
            const active = mediaKindFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.assetBrowserSourceButton} ${active ? styles.assetBrowserSourceButtonActive : ''}`}
                onClick={() => onMediaKindFilterChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={styles.assetBrowserSources} role="tablist" aria-label={copy.sourceFilters}>
        {sourceOptions.map((option) => {
          const active = source === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.assetBrowserSourceButton} ${active ? styles.assetBrowserSourceButtonActive : ''}`}
              onClick={() => onSourceChange(option)}
            >
              {sourceLabels[option]}
            </button>
          );
        })}
      </div>

      <div className={styles.assetBrowserContent}>
        {error ? <p className={styles.assetBrowserNotice} role="alert">{error}</p> : null}
        {usingFallback ? <p className={styles.assetBrowserNotice}>{copy.showingDevAssets}</p> : null}
        {isLoading ? <p className={styles.assetBrowserNotice}>{copy.loadingLibrary}</p> : null}
        {!isLoading && filteredAssets.length === 0 ? (
          <p className={styles.assetBrowserNotice}>{searchQuery.trim().length ? emptySearchLabel ?? copy.emptySearch : emptyLabel ?? copy.emptyLibrary}</p>
        ) : null}
        <div className={styles.assetBrowserGrid}>
          {filteredAssets.map((asset) => {
            const canSelect = typeof onSelectAsset === 'function';
            const content = (
              <>
                <span className={styles.assetBrowserThumb}>
                  {asset.thumbUrl ? <img src={asset.thumbUrl} alt="" /> : assetIcon(asset.kind)}
                </span>
                <span className={styles.assetBrowserMeta}>
                  <strong>{asset.name}</strong>
                  <small>{asset.meta}</small>
                </span>
              </>
            );
            if (canSelect) {
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={styles.assetBrowserCard}
                  onClick={() => onSelectAsset(asset)}
                  aria-label={formatCopyValue(copy.useAsset, { name: asset.name })}
                >
                  {content}
                </button>
              );
            }
            return (
              <article key={asset.id} className={styles.assetBrowserCard}>
                {content}
              </article>
            );
          })}
        </div>
        {hasMore && onLoadMore ? (
          <div className={styles.assetBrowserLoadMore}>
            <button
              type="button"
              className={styles.assetBrowserLoadMoreButton}
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? copy.loadingMore : copy.loadMore}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
