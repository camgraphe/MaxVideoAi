'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { FileText, ImageIcon, Music2, Search, Video } from 'lucide-react';
import editorStyles from '../maxvideoai-editor.module.css';
import styles from '../_styles/asset-library.module.css';
import type {
  WorkspaceLibraryAsset,
  WorkspaceLibrarySource,
} from '../_lib/workspace-library-assets';

type WorkspaceAssetLibraryBrowserLayout = 'sidebar' | 'modal';

type WorkspaceAssetLibraryBrowserProps = {
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
  onSelectAsset?: (asset: WorkspaceLibraryAsset) => void;
  headerActions?: ReactNode;
  searchPlaceholder?: string;
  emptyLabel?: string;
  emptySearchLabel?: string;
};

function pluralizeAssets(count: number): string {
  return `${count} asset${count === 1 ? '' : 's'}`;
}

function assetIcon(kind: WorkspaceLibraryAsset['kind']) {
  if (kind === 'video') return <Video size={20} />;
  if (kind === 'audio') return <Music2 size={20} />;
  if (kind === 'image') return <ImageIcon size={20} />;
  return <FileText size={20} />;
}

export function WorkspaceAssetLibraryBrowser({
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
  onSelectAsset,
  headerActions,
  searchPlaceholder = 'Search assets...',
  emptyLabel = 'No matching media in your app library yet.',
  emptySearchLabel = 'No assets match this search.',
}: WorkspaceAssetLibraryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSearchQuery('');
  }, [source]);

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

  const countLabel = isLoading ? 'Loading' : pluralizeAssets(filteredAssets.length);
  const browserClassName = `${styles.assetBrowser} ${
    layout === 'sidebar' ? styles.assetBrowserSidebar : styles.assetBrowserModal
  }`;

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
        <span>Search assets</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          placeholder={searchPlaceholder}
        />
      </label>

      <div className={styles.assetBrowserSources} role="tablist" aria-label="Library asset filters">
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
        {error ? <p className={styles.assetBrowserNotice}>{error}</p> : null}
        {usingFallback ? <p className={styles.assetBrowserNotice}>Showing dev assets while your app library is empty.</p> : null}
        {isLoading ? <p className={styles.assetBrowserNotice}>Loading your app library...</p> : null}
        {!isLoading && filteredAssets.length === 0 ? (
          <p className={styles.assetBrowserNotice}>{searchQuery.trim().length ? emptySearchLabel : emptyLabel}</p>
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
                  aria-label={`Use ${asset.name}`}
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
      </div>
    </section>
  );
}
