'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Images, X, Film, AudioLines, Loader2 } from 'lucide-react';
import { creatorExperienceCopy } from './creator-experience-copy';
import { AssetLibraryBrowser, type AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { authFetch } from '@/lib/authFetch';
import { uploadVideoFile } from '@/lib/client-video-upload';
import { buildMediaLibraryAssetsUrl, type MediaLibraryAssetsResponse } from '@/lib/media-library-client';
import type { ToolMediaKind } from '@/lib/toolbox/catalogue';
import { creatorCopy } from './creator-copy';
import { selectCreatorSource, type CreatorSource } from './creator-source-selection';
import styles from './creator-workspace.module.css';

export function CreatorSourcePicker({ userId, locale, label, hint, kind, source, onChange, onBusyChange, disabled = false }: {
  userId?: string; locale: string; label: string; hint?: string; kind: ToolMediaKind; source: CreatorSource | null;
  onChange(source: CreatorSource | null): void; onBusyChange?(busy: boolean): void; disabled?: boolean;
}) {
  const copy = creatorCopy(locale), experience = creatorExperienceCopy(locale);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const mounted = useRef(true), uploading = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function upload(file: File) {
    if (!userId || disabled || uploading.current) return;
    uploading.current = true; setBusy(true); onBusyChange?.(true); setError(null);
    try {
      if (!file.type.startsWith(`${kind}/`)) throw new Error('Wrong kind');
      let asset: unknown;
      if (kind === 'video') asset = await uploadVideoFile(file);
      else {
        const body = new FormData(); body.append('file', file, file.name);
        const response = await authFetch(`/api/uploads/${kind}`, { method: 'POST', body });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error('Upload failed');
        asset = data.asset;
      }
      const selected = selectCreatorSource(asset, kind, file.name);
      if (mounted.current) onChange(selected);
    } catch { if (mounted.current) setError(copy.uploadError); }
    finally { uploading.current = false; if (mounted.current) { setBusy(false); onBusyChange?.(false); } }
  }
  const importLabel = kind === 'image' ? experience.importImage : kind === 'video' ? experience.importVideo : experience.importAudio;
  const thumbnail = source?.thumbnailUrl ?? (kind === 'image' ? source?.url : undefined);
  return <section className={styles.sourceCard}>
    <h2>{label}</h2>
    {hint ? <p className={styles.sourceHint}>{hint}</p> : null}
    {source ? <div className={styles.selectedSource}>
      <div className={styles.sourceThumbnail}>{thumbnail ? /* eslint-disable-next-line @next/next/no-img-element -- Account-owned media stays outside public optimization. */
        <img src={thumbnail} alt="" /> : kind === 'audio' ? <AudioLines size={22} aria-hidden="true" /> : <Film size={22} aria-hidden="true" />}</div>
      <div><strong title={source.name}>{source.name || copy.source}</strong><span>{experience.selected}{source.durationSec ? ` · ${Number(source.durationSec.toFixed(2))} ${copy.seconds}` : ''}</span></div>
      <button type="button" disabled={disabled || busy} onClick={() => onChange(null)} aria-label={`${copy.remove} — ${label}`}><X size={17} aria-hidden="true" /></button>
    </div> : null}
    <div className={styles.sourceActions} data-selected={Boolean(source)}>
      <label className={styles.upload} aria-disabled={!userId || disabled || busy}>
        <input type="file" accept={`${kind}/*`} aria-label={`${importLabel} — ${label}`} disabled={!userId || disabled || busy} onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file);
        }} />
        {busy ? <Loader2 className={styles.spinner} size={22} aria-hidden="true" /> : <Upload size={22} aria-hidden="true" />}
        <strong>{busy ? copy.loading : source ? copy.change : importLabel}</strong>
      </label>
      <button type="button" className={styles.libraryButton} disabled={!userId || disabled || busy} onClick={() => setOpen(true)}><Images size={16} aria-hidden="true" />{copy.library}</button>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    {open && userId ? <CreatorLibraryPicker key={`${userId}:${kind}`} locale={locale} kind={kind} disabled={disabled || busy}
      onClose={() => setOpen(false)} onSelect={asset => { onChange(selectCreatorSource(asset, kind, copy.library)); setOpen(false); setError(null); }} /> : null}
  </section>;
}

function CreatorLibraryPicker({ locale, kind, disabled, onClose, onSelect }: {
  locale: string; kind: ToolMediaKind; disabled: boolean; onClose(): void; onSelect(asset: AssetBrowserAsset): void;
}) {
  const copy = creatorCopy(locale);
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  const [assets, setAssets] = useState<AssetBrowserAsset[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null), [retry, setRetry] = useState(0), [hasMore, setHasMore] = useState(false);
  const nextCursor = useRef<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError(null);
    void authFetch(buildMediaLibraryAssetsUrl({ kind, limit: 30, cursor }), { signal: controller.signal }).then(async response => {
      const data = await response.json() as MediaLibraryAssetsResponse;
      if (!response.ok || !data.ok) throw new Error('Library unavailable');
      if (controller.signal.aborted) return;
      const page = data.assets.filter(asset => asset.kind === kind).map(asset => ({ ...asset, kind }));
      setAssets(previous => cursor ? Array.from(new Map([...previous, ...page].map(asset => [asset.id, asset])).values()) : page);
      nextCursor.current = data.nextCursor ?? null;
      setHasMore(Boolean(data.hasMore && data.nextCursor));
    }).catch(() => { if (!controller.signal.aborted) setError(copy.sourceError); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [kind, cursor, retry, copy.sourceError]);
  return <div className={styles.modalBackdrop}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={copy.library} tabIndex={-1} onKeyDown={onDialogKeyDown} className={styles.libraryDialog}>
      <AssetLibraryBrowser locale={locale} assetType={kind} assets={assets} title={copy.library} source="all" availableSources={['all']}
        sourceLabels={{ all: copy.all }} onSourceChange={() => {}} isLoading={busy && !assets.length} error={error}
        searchPlaceholder={copy.search} sourcesTitle={copy.source} emptyLabel={copy.empty} emptySearchLabel={copy.empty}
        onClose={onClose} closeLabel={copy.close} renderAssetActions={() => null} hasMore={hasMore} isLoadingMore={busy && !!assets.length}
        loadMoreLabel={copy.loadMore} onLoadMore={() => { if (!busy) setCursor(nextCursor.current); }}
        headerActions={error ? <button type="button" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button> : undefined}
        selection={{ scope: `creator:${kind}`, busy: disabled, onConfirm: onSelect, isDisabled: asset => !/^ma_[a-f0-9]{32}$/.test(asset.id) }} />
    </div>
  </div>;
}
