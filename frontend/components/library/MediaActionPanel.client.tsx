'use client';

import { createPortal } from 'react-dom';
import { useId, useState, type ReactNode, type Ref } from 'react';
import { AppGlyph } from '@/components/app/AppGlyph';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { LibraryImageThumbnail } from './LibraryImageThumbnail.client';
import { recentMediaCopy, recentMediaFilename } from './recent-media-copy';
import { mediaActionCopy, meaningfulMediaLabel } from './media-action-copy';
import { buildAppDownloadUrl, suggestDownloadFilename } from '@/lib/download';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';

/** Presentation only: destination owners validate and insert the exact original. */
export function MediaActionPanel({ asset, locale, onClose, children, title, boundaryRef }: {
  asset: AssetBrowserAsset; locale: string; onClose: () => void; children?: ReactNode; title?: string; boundaryRef?: Ref<HTMLDivElement>;
}) {
  const copy = mediaActionCopy(locale);
  const id = useId();
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  const [preview, setPreview] = useState(false);
  const name = recentMediaFilename(asset.url, asset.kind);
  const label = meaningfulMediaLabel(asset.url, [recentMediaCopy(locale)[asset.kind], asset.width && asset.height ? `${asset.width}×${asset.height}` : null].filter(Boolean).join(' · '));
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="app-experience"><div ref={boundaryRef} className="app-media-panel-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} onKeyDown={onDialogKeyDown} className={`app-media-panel app-scroll-surface${preview ? ' is-preview' : ''}${asset.kind === 'image' ? ' is-image' : ''}`}>
      <header><h2 id={id}>{title ?? copy.title}</h2><button type="button" data-modal-initial-focus="true" onClick={onClose}>{copy.close}</button></header>
      <div className="app-media-panel-cover">
        {preview && asset.kind === 'video' ? <video src={asset.url} controls playsInline preload="none" />
          : preview && asset.kind === 'audio' ? <audio src={asset.url} controls preload="none" />
          : asset.kind === 'image' ? <LibraryImageThumbnail asset={preview ? { ...asset, thumbUrl: null } : asset} />
          : asset.thumbUrl ? <LibraryImageThumbnail asset={{ ...asset, url: asset.thumbUrl }} /> : <AppGlyph name={asset.kind} />}
      </div>
      <p className="app-media-panel-filename">{label}</p>
      <div className="app-media-panel-transport"><button type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}><AppGlyph name="video" />{preview ? copy.back : copy.preview}</button>
        <a href={buildAppDownloadUrl(asset.url, suggestDownloadFilename(asset.url, name))}>{copy.download}</a></div>
      {!preview ? <div className="app-media-panel-actions">{children}</div> : null}
    </section>
  </div></div>, document.body);
}
