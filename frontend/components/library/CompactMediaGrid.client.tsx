'use client';
import { memo, useMemo, useRef } from 'react';
import { Button, Checkbox, GridList, GridListItem, type Selection } from 'react-aria-components';
import { GridLayout, ListLayout, Size, Virtualizer } from 'react-aria-components/Virtualizer';
import { Check, Film, ImageIcon, Music2, ScanSearch } from 'lucide-react';
import { useLibraryMediaAccess } from '@/hooks/useLibraryMediaAccess';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import { compactLibraryCopy } from './compact-library-copy';
import { compactMediaSource } from './media-action-copy';
const defaultAssetKey = (asset: AssetBrowserAsset) => asset.organization?.key ?? asset.id;
const audioOptions = { rowSize: 64, gap: 4 };
function sameResource(a: string, b: string) {
  try {
    const x = new URL(a),
      y = new URL(b);
    return x.origin + x.pathname === y.origin + y.pathname;
  } catch {
    return a === b;
  }
}
/** Legacy thumbUrl can name the original itself. That role is never warmed in a grid. */
function thumbnailRole(asset: AssetBrowserAsset) {
  if (
    !asset.thumbUrl ||
    sameResource(asset.thumbUrl, asset.url) ||
    /\.(mp4|webm|mov|m4v|mp3|wav|m4a|ogg|flac)(?:[?#]|$)/i.test(asset.thumbUrl)
  )
    return null;
  return asset.thumbUrl;
}
function CompactThumbnail({ asset, userId }: { asset: AssetBrowserAsset; userId: string }) {
  const media = useLibraryMediaAccess({ userId, asset, refreshOnMount: false });
  const canonical = thumbnailRole(asset);
  const src = media.retired ? null : canonical ? (media.access.thumbnailAccessUrl ?? canonical) : null;
  const Icon = asset.kind === 'video' ? Film : asset.kind === 'audio' ? Music2 : ImageIcon;
  // Stored private thumbnails must never pass through the public image optimizer.
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={asset.width ?? undefined}
      height={asset.height ?? undefined}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        void media.refresh();
      }}
    />
  ) : (
    <Icon aria-hidden size={28} />
  );
}
function duration(value?: number | null) {
  if (value == null) return '';
  return `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`;
}
export const CompactMediaGrid = memo(function CompactMediaGrid({
  assets,
  selectedKeys,
  onSelectionChange,
  onOpen,
  onPreview,
  openActionLabel,
  density,
  locale,
  userId,
  disabled = false,
  virtualized = true,
  loading = false,
  renderAssetMeta,
  getAssetKey = defaultAssetKey,
  getAssetName,
  selectionMode = 'multiple',
  selectionDisabledKeys,
}: {
  assets: AssetBrowserAsset[];
  selectedKeys: ReadonlySet<string>;
  onSelectionChange: (keys: Set<string> | 'all') => void;
  onOpen: (asset: AssetBrowserAsset) => void;
  onPreview?: (asset: AssetBrowserAsset) => void;
  openActionLabel?: string;
  density: number;
  locale: string;
  userId: string;
  disabled?: boolean;
  virtualized?: boolean;
  loading?: boolean;
  renderAssetMeta?: AssetLibraryBrowserMeta;
  getAssetKey?: (asset: AssetBrowserAsset) => string;
  getAssetName?: (asset: AssetBrowserAsset) => string;
  selectionMode?: 'single' | 'multiple';
  selectionDisabledKeys?: ReadonlySet<string>;
}) {
  const copy = compactLibraryCopy(locale);
  const geometry = useRef({ count: 0, audio: false });
  if (!loading)
    geometry.current = {
      count: assets.length,
      audio: assets.length > 0 && assets.every((a) => a.kind === 'audio'),
    };
  const audio = geometry.current.audio;
  const latest = useRef({ onOpen, onPreview, onSelectionChange, assets, selectedKeys });
  latest.current = { onOpen, onPreview, onSelectionChange, assets, selectedKeys };
  const items = useMemo<{ id: string; asset: AssetBrowserAsset | null; name: string }[]>(
    () =>
      loading
        ? Array.from({ length: geometry.current.count }, (_, index) => ({
            id: 'placeholder-' + index,
            asset: null,
            name: copy.loading,
          }))
        : assets.map((asset) => ({
            id: getAssetKey(asset),
            asset,
            name: getAssetName?.(asset) || asset.name?.trim() || copy.unknown,
          })),
    [assets, copy.unknown, copy.loading, loading, getAssetKey, getAssetName],
  );
  const layoutOptions = useMemo(
    () => ({
      minItemSize: new Size(density, density + 28),
      maxItemSize: new Size(density + 24, density + 52),
      preserveAspectRatio: true,
      minSpace: new Size(8, 8),
      maxHorizontalSpace: 12,
    }),
    [density],
  );
  const anchor = useRef<string | null>(null);
  const changed = (keys: Selection) => {
    if (keys === 'all') {
      latest.current.onSelectionChange('all');
      return;
    }
    const next = new Set([...keys].map(String));
    const changedKey =
      [...next].find((key) => !latest.current.selectedKeys.has(key)) ??
      [...latest.current.selectedKeys].find((key) => !next.has(key));
    if (changedKey) anchor.current = changedKey;
    latest.current.onSelectionChange(next);
  };
  const range = (target: string) => {
    if (disabled || loading || selectionMode === 'single') return;
    const ordered = latest.current.assets.map(getAssetKey);
    const start = ordered.indexOf(anchor.current ?? target),
      end = ordered.indexOf(target);
    if (start < 0 || end < 0) return;
    const next = new Set(latest.current.selectedKeys);
    for (const key of ordered.slice(Math.min(start, end), Math.max(start, end) + 1))
      if (!selectionDisabledKeys?.has(key)) next.add(key);
    latest.current.onSelectionChange(next);
  };
  const rangeTarget = (event: React.SyntheticEvent<HTMLElement>) => {
    const target = event.target as HTMLElement,
      row = target.closest<HTMLElement>('[data-media-key]');
    return row && (target === row || target.closest('.compact-media-check')) ? row.dataset.mediaKey : null;
  };
  const rangeKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = rangeTarget(event);
    if (selectionMode === 'multiple' && event.shiftKey && event.key === ' ' && key) {
      event.preventDefault();
      event.stopPropagation();
      if (event.type === 'keydown') range(key);
    }
    const target = event.target as HTMLElement;
    if (event.key === 'Enter' && target.matches('[data-media-key]')) {
      event.preventDefault();
      event.stopPropagation();
      if (event.type === 'keydown' && !event.repeat && !disabled && !loading) {
        const asset = latest.current.assets.find((a) => getAssetKey(a) === target.dataset.mediaKey);
        if (asset) latest.current.onOpen(asset);
      }
    }
  };

  const collection = (
    <GridList
      aria-label={copy.all}
      items={items}
      selectionMode={selectionMode}
      selectionBehavior="toggle"
      selectedKeys={selectedKeys}
      onSelectionChange={changed}
      disabledBehavior={selectionDisabledKeys && !disabled && !loading ? 'selection' : 'all'}
      disabledKeys={disabled || loading ? items.map((item) => item.id) : selectionDisabledKeys}
      layout={audio ? 'stack' : 'grid'}
      className={`compact-media-grid ${audio ? 'is-audio' : 'is-grid'} ${virtualized ? '' : 'is-plain'}`}
      style={!virtualized && !audio ? { gridTemplateColumns: `repeat(auto-fill,minmax(${density}px,1fr))` } : undefined}
      dependencies={[audio, locale, userId, renderAssetMeta, getAssetKey, selectionDisabledKeys, Boolean(onPreview), openActionLabel]}
      onAction={(key) => {
        const item = latest.current.assets.find((a) => getAssetKey(a) === key);
        if (item) latest.current.onOpen(item);
      }}
    >
      {(item) => (
        <GridListItem
          id={item.id}
          textValue={item.name}
          data-media-key={item.id}
          data-kind={item.asset?.kind}
          className={`compact-media-tile ${audio ? 'compact-audio-row' : ''}`}
        >
          {item.asset ? (
            <>
              <Checkbox slot="selection" aria-label={`${copy.select} ${item.name}`} className="compact-media-check">
                {({ isSelected }) => <span>{isSelected && <Check size={12} aria-hidden />}</span>}
              </Checkbox>
              <Button
                type="button"
                className="compact-media-preview"
                aria-label={`${openActionLabel ?? copy.preview} ${item.name}`}
                isDisabled={disabled || loading || Boolean(onPreview && selectionDisabledKeys?.has(item.id))}
                onPress={() => {
                  const current = latest.current.assets.find((a) => getAssetKey(a) === item.id);
                  if (current) latest.current.onOpen(current);
                }}
              >
                <span className="compact-media-cover">
                  <CompactThumbnail asset={item.asset} userId={userId} />
                </span>
                <span className="compact-media-name" title={item.name}>
                  {item.name}
                </span>
              </Button>
              {onPreview ? (
                <Button
                  type="button"
                  className="compact-media-inspect"
                  aria-label={`${copy.preview} ${item.name}`}
                  isDisabled={disabled || loading}
                  onPress={() => {
                    const current = latest.current.assets.find((asset) => getAssetKey(asset) === item.id);
                    if (current) latest.current.onPreview?.(current);
                  }}
                >
                  <ScanSearch size={16} aria-hidden />
                </Button>
              ) : null}
              {item.asset.durationSec != null ? (
                <span className="compact-media-duration">{duration(item.asset.durationSec)}</span>
              ) : null}
              <span className="compact-media-kind">
                {compactMediaSource(item.asset.source ?? '', locale, item.asset.kind)}
              </span>
              {renderAssetMeta ? <span className="compact-media-meta">{renderAssetMeta(item.asset)}</span> : null}
            </>
          ) : (
            <span data-loading-placeholder className="compact-media-placeholder" aria-hidden />
          )}
        </GridListItem>
      )}
    </GridList>
  );
  return (
    <div
      onKeyDownCapture={rangeKeyboard}
      onKeyUpCapture={rangeKeyboard}
      onClickCapture={(event) => {
        const key = rangeTarget(event);
        if (selectionMode === 'multiple' && event.shiftKey && key) {
          event.preventDefault();
          event.stopPropagation();
          range(key);
        }
      }}
      className="compact-media-canvas"
      data-layout={audio ? 'audio-list' : 'grid'}
      data-virtualized={virtualized}
    >
      {virtualized ? (
        audio ? (
          <Virtualizer key="audio" layout={ListLayout} layoutOptions={audioOptions}>
            {collection}
          </Virtualizer>
        ) : (
          <Virtualizer key="grid" layout={GridLayout} layoutOptions={layoutOptions}>
            {collection}
          </Virtualizer>
        )
      ) : (
        collection
      )}
    </div>
  );
});
type AssetLibraryBrowserMeta = (asset: AssetBrowserAsset) => React.ReactNode;
