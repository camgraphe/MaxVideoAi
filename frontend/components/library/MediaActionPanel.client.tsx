'use client';
import { useLibraryDisplayAccess } from '@/hooks/useLibraryMediaAccess';
import { libraryOriginalAccessHref } from '@/lib/library-media-access';

import { useState, type ReactNode, type Ref } from 'react';
import { Download, Share2, Link2, Check, ExternalLink } from 'lucide-react';
import { ProgressiveMediaReader } from './ProgressiveMediaReader.client';
import { MediaViewerNavigation } from './MediaViewerNavigation.client';
import { MediaDialog } from './MediaDialog.client';
import { recentMediaCopy, recentMediaFilename } from './recent-media-copy';
import { mediaActionCopy, meaningfulMediaLabel } from './media-action-copy';
import { buildAppDownloadUrl, suggestDownloadFilename } from '@/lib/download';
import { copyTextToClipboard } from '@/lib/clipboard';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import { SeedanceDraftFinalAction } from './SeedanceDraftFinalAction.client';
import { VideoSharePanel } from './VideoSharePanel.client';

/** One original, one reader, and the same selected output for every action. */
export function MediaActionPanel({ asset, locale, onClose, children, title, boundaryRef, navigation, details, neighbors, onNavigateAsset }: {
  asset: AssetBrowserAsset; locale: string; onClose: () => void; children?: ReactNode; title?: string;
  boundaryRef?: Ref<HTMLDivElement>; navigation?: ReactNode; details?: ReactNode;
  neighbors?: AssetBrowserAsset[]; onNavigateAsset?: (asset: AssetBrowserAsset) => void;
}) {
  const copy = mediaActionCopy(locale);
  return <MediaDialog title={title ?? asset.name ?? copy.title} closeLabel={copy.close} onClose={onClose} boundaryRef={boundaryRef} navigation={<>{navigation}{neighbors && onNavigateAsset ? <MediaViewerNavigation asset={asset} assets={neighbors} onSelect={onNavigateAsset} locale={locale} /> : null}</>}>
    <MediaActionContent key={`${asset.id}:${asset.url}:${asset.readAccessOwnerId ?? ''}:${asset.readAccessRevision ?? ''}`} asset={asset} locale={locale} details={details}>{children}</MediaActionContent>
  </MediaDialog>;
}

export function MediaActionContent({ asset, locale, children, details }: { asset: AssetBrowserAsset; locale: string; children?: ReactNode; details?: ReactNode }) {
  const copy = mediaActionCopy(locale);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const fr = locale.startsWith('fr'), es = locale.startsWith('es');
  const labels = fr ? ['Partager', 'Copier le lien du média', 'Lien copié', 'Ouvrir l’original', 'Détails', 'Impossible de copier le lien.', 'Le lien original peut expirer.'] : es ? ['Compartir', 'Copiar enlace del medio', 'Enlace copiado', 'Abrir original', 'Detalles', 'No se pudo copiar el enlace.', 'El enlace original puede caducar.'] : ['Share', 'Copy media link', 'Link copied', 'Open original', 'Details', 'Unable to copy link.', 'The original link may expire.'];
  const name = recentMediaFilename(asset.url, asset.kind);
  const mediaAccess = useLibraryDisplayAccess(asset);
  const originalReadUrl = mediaAccess.access.accessUrl ?? asset.url;
  const label = asset.name ?? meaningfulMediaLabel(asset.url, recentMediaCopy(locale)[asset.kind]);
  const share = async () => {
    if (asset.kind === 'video') { setSharing(value => !value); return; }
    if (typeof navigator.share !== 'function') { setSharing(value => !value); return; }
    try { await navigator.share({ title: label, url: originalReadUrl }); }
    catch (failure) { if (!(failure instanceof Error && failure.name === 'AbortError')) setSharing(true); }
  };
  if (mediaAccess.retired) return null;
  return <div className="app-media-detail-layout">
    <div className="app-media-view">
      <ProgressiveMediaReader asset={asset} locale={locale} label={label} />
      <p className="app-media-panel-filename">{[label, asset.width && asset.height ? `${asset.width} × ${asset.height}` : null, asset.durationSec ? `${asset.durationSec}s` : null].filter(Boolean).join(' · ')}</p>
      <div className="app-media-panel-transport">
        <a href={libraryOriginalAccessHref(asset, 'download', suggestDownloadFilename(asset.url, name)) ?? buildAppDownloadUrl(originalReadUrl, suggestDownloadFilename(asset.url, name))}><Download size={16} aria-hidden />{copy.download}</a>
        <button type="button" aria-expanded={sharing} onClick={() => void share()} data-analytics-event={sharing ? undefined : 'cta_click'} data-analytics-cta-name="video_share_open" data-analytics-cta-location="result_modal"><Share2 size={16} aria-hidden />{labels[0]}</button>
        <a href={libraryOriginalAccessHref(asset, 'original') ?? originalReadUrl} target="_blank" rel="noreferrer" aria-label={labels[3]} title={labels[3]}><ExternalLink size={16} aria-hidden /></a>
      </div>
      {sharing && asset.kind === 'video' ? <VideoSharePanel asset={asset} locale={locale} /> : sharing ? <div className="app-media-share">
        <button type="button" onClick={async () => { const ok = await copyTextToClipboard(originalReadUrl); setCopied(ok); setError(!ok); }}>{copied ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}{copied ? labels[2] : labels[1]}</button>
        <small>{labels[6]}</small>
        {error ? <p role="alert">{labels[5]}</p> : null}
      </div> : null}
    </div>
    {children || details ? <aside className="app-media-panel-actions">
      {children}
      {asset.kind === 'video' && asset.jobId ? <SeedanceDraftFinalAction jobId={asset.jobId} locale={locale} /> : null}
      {details ? <details className="app-media-details"><summary>{labels[4]}</summary><div>{details}</div></details> : null}
    </aside> : asset.kind === 'video' && asset.jobId ? <SeedanceDraftFinalAction jobId={asset.jobId} locale={locale} asAside /> : null}
  </div>;
}
