'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, Ellipsis, Heart, Info, Music2, Trash2, Wand2, X } from 'lucide-react';
import Lightbox, { type Slide, type ZoomRef } from 'yet-another-react-lightbox';
import Inline from 'yet-another-react-lightbox/plugins/inline';
import Video from 'yet-another-react-lightbox/plugins/video';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import './viewer.css';
import type { MediaItem, ViewerProps } from './types';

type AudioSlide = { type: 'audio'; src: string; name: string; mediaId: string };
declare module 'yet-another-react-lightbox' {
  interface SlideTypes { audio: AudioSlide }
}

type ViewerSlide = Slide & { mediaId: string; name: string; thumbnail?: string };
const PLUGINS = [Inline, Zoom, Video];
const LABELS = {
  'Zoom in': 'Agrandir', 'Zoom out': 'Réduire', Next: 'Suivant', Previous: 'Précédent',
  'Photo gallery': 'Aperçu du média', Slide: 'Média', '{index} of {total}': '{index} sur {total}',
};

function toSlide(item: MediaItem): ViewerSlide {
  const common = { mediaId: item.id, name: item.name, thumbnail: item.thumbUrl ?? undefined };
  if (item.kind === 'audio') return { ...common, type: 'audio', src: item.previewUrl || item.originalUrl };
  if (item.kind === 'video') return {
    ...common, type: 'video', width: item.width, height: item.height, poster: item.thumbUrl ?? undefined,
    sources: [{ src: item.previewUrl || item.originalUrl, type: item.mime }],
  };
  return { ...common, type: 'image', src: item.previewUrl || item.thumbUrl || item.originalUrl, width: item.width, height: item.height, alt: item.name };
}

function formatBytes(value: number) {
  const unit = value >= 1_000_000 ? 'Mo' : 'Ko';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value / (unit === 'Mo' ? 1_000_000 : 1_000))} ${unit}`;
}

function formatDuration(seconds = 0) {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function ProgressiveImage({ src, thumbnail, name, width, height, rect }: {
  src: string; thumbnail?: string; name: string; width: number; height: number; rect: { width: number; height: number };
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scale = Math.min(rect.width / Math.max(1, width), rect.height / Math.max(1, height));
  return <div className="mv-image-pair" style={{ width: width * scale, height: height * scale }}>
    {thumbnail && thumbnail !== src ? <img className="mv-image-underlay" src={thumbnail} alt="" aria-hidden="true" draggable={false} /> : null}
    <img key={attempt} className={`mv-image-display${loaded ? ' is-ready' : ''}`} src={src} alt={name} draggable={false} decoding="async"
      onLoad={() => { setLoaded(true); setFailed(false); }} onError={() => setFailed(true)} />
    {!loaded && !failed ? <span className="mv-media-status" role="status">Chargement de l’aperçu…</span> : null}
    {failed ? <div className="mv-media-status mv-media-error" role="alert">Aperçu indisponible.
      <button type="button" onClick={() => { setFailed(false); setLoaded(false); setAttempt(value => value + 1); }}>Réessayer</button>
    </div> : null}
  </div>;
}

function AudioPreview({ slide }: { slide: AudioSlide }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setFailed(false); }, [slide.mediaId, slide.src]);
  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio?.pause(); };
  }, [slide.mediaId, slide.src, attempt]);
  return <div className="mv-audio-preview">
    <div className="mv-audio-art"><Music2 size={52} strokeWidth={1.1} aria-hidden="true" /></div>
    <p>{slide.name}</p>
    <audio ref={audioRef} key={attempt} src={slide.src} controls preload="none" aria-label={`Écouter ${slide.name}`} onError={() => setFailed(true)} />
    {failed ? <div className="mv-media-error" role="alert">Lecture indisponible. <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>Réessayer</button></div> : null}
  </div>;
}

/** Throwaway viewer: native dialog owns focus; YARL owns the active media stage only. */
export function MediaViewer({ items, activeId, onActiveChange, onClose, onFavorite, onUse, onTrash, useLabel = 'Utiliser dans…' }: ViewerProps & { useLabel?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const zoomRef = useRef<ZoomRef>(null);
  const titleId = useId();
  const [details, setDetails] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoAttempt, setVideoAttempt] = useState(0);
  const activeIndex = items.findIndex(item => item.id === activeId);
  const active = items[activeIndex];
  const activeTransport = active?.previewUrl || active?.originalUrl;
  const windowStart = Math.max(0, Math.min(activeIndex - 1, items.length - 3));
  const windowItems = items.slice(windowStart, windowStart + 3);
  // Changes to favorite/collection metadata must not recreate the lightbox catalogue.
  const signature = windowItems.map(item => [item.id, item.kind, item.name, item.previewUrl, item.originalUrl, item.thumbUrl, item.width, item.height, item.mime].join('\u001f')).join('\u001e');
  const slideCache = useRef<{ signature: string; slides: ViewerSlide[] }>({ signature: '', slides: [] });
  if (slideCache.current.signature !== signature) slideCache.current = { signature, slides: windowItems.map(toSlide) };
  const slides = slideCache.current.slides;
  const filmstrip = useMemo(() => {
    const start = Math.max(0, Math.min(activeIndex - 5, items.length - 11));
    return items.slice(start, start + 11);
  }, [items, activeIndex]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media => media.pause());
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => { setVideoError(false); setVideoAttempt(0); }, [activeId, activeTransport]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector('.mv-filmstrip [aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeId]);

  const close = () => {
    dialogRef.current?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media => media.pause());
    onClose();
  };
  const move = (direction: number) => {
    const next = items[activeIndex + direction];
    if (next) onActiveChange(next.id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('audio,video,input,textarea,select,[contenteditable="true"]')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if ((zoomRef.current?.zoom ?? 1) <= 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key.toLowerCase() === 'f' && active) {
      event.preventDefault(); onFavorite(active.id);
    }
  };

  if (!active) return null;
  return <dialog ref={dialogRef} className="mv-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }} onKeyDownCapture={onKeyDown}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="mv-viewer">
      <header className="mv-header">
        <div className="mv-title"><h2 id={titleId} title={active.name}>{active.name}</h2>
          <span>{active.kind === 'image' ? 'Image' : active.kind === 'video' ? 'Vidéo' : 'Audio'}{active.kind !== 'audio' ? ` · ${active.width} × ${active.height}` : ` · ${formatDuration(active.durationSec)}`}</span>
        </div>
        <div className="mv-header-actions">
          <button type="button" className="mv-icon-button" aria-label={active.favorite ? 'Retirer des favoris (F)' : 'Ajouter aux favoris (F)'} aria-pressed={active.favorite} onClick={() => onFavorite(active.id)} title="Favori · F"><Heart size={19} fill={active.favorite ? 'currentColor' : 'none'} /></button>
          <button type="button" className="mv-icon-button" aria-label="Afficher les détails" aria-expanded={details} aria-controls="mv-inspector" onClick={() => setDetails(value => !value)} title="Détails"><Info size={19} /></button>
          <button type="button" className="mv-icon-button mv-close" aria-label="Fermer l’aperçu" autoFocus onClick={close}><X size={21} /></button>
        </div>
      </header>

      <div className={`mv-stage-layout${details ? ' has-inspector' : ''}`}>
        <div className="mv-stage" onErrorCapture={event => { if ((event.target as HTMLElement).tagName === 'VIDEO') setVideoError(true); }}>
          <Lightbox key={`${activeId}:${videoAttempt}`} plugins={PLUGINS} slides={slides} index={activeIndex - windowStart}
            carousel={{ finite: true, preload: 0, imageFit: 'contain', padding: 16 }}
            video={{ controls: true, playsInline: true, preload: 'none', autoPlay: false }}
            zoom={{ ref: zoomRef, maxZoomPixelRatio: 2, scrollToZoom: false }}
            controller={{ closeOnEscape: false, touchAction: 'pan-y' }}
            animation={{ swipe: 180, zoom: 180 }} labels={LABELS}
            on={{ view: ({ index }) => { const next = slides[index]; if (next && next.mediaId !== activeId) onActiveChange(next.mediaId); } }}
            render={{
              buttonPrev: () => null, buttonNext: () => null,
              slide: ({ slide, offset, rect }) => {
                if (slide.type === 'audio') return offset === 0 ? <AudioPreview key={slide.mediaId} slide={slide} /> : <span />;
                if (slide.type === 'image' || slide.type === undefined) {
                  const image = slide as ViewerSlide & { src: string; width?: number; height?: number };
                  return <ProgressiveImage key={`${image.mediaId}:${image.src}`} src={image.src} thumbnail={image.thumbnail} name={image.name} width={image.width ?? 1} height={image.height ?? 1} rect={rect} />;
                }
                return undefined;
              },
            }} />
          <button type="button" className="mv-nav mv-prev" aria-label="Média précédent" disabled={activeIndex <= 0} onClick={() => move(-1)}><ChevronLeft size={24} /></button>
          <button type="button" className="mv-nav mv-next" aria-label="Média suivant" disabled={activeIndex >= items.length - 1} onClick={() => move(1)}><ChevronRight size={24} /></button>
          {videoError ? <div className="mv-video-error" role="alert">Lecture indisponible. <button type="button" onClick={() => { setVideoError(false); setVideoAttempt(value => value + 1); }}>Réessayer</button></div> : null}
        </div>
        {details ? <aside id="mv-inspector" className="mv-inspector" aria-label="Détails du média">
          <h3>Détails</h3><dl>
            <div><dt>Nom</dt><dd>{active.name}</dd></div>
            <div><dt>Format</dt><dd>{active.mime}</dd></div>
            <div><dt>Taille</dt><dd>{formatBytes(active.size)}</dd></div>
            {active.durationSec !== undefined ? <div><dt>Durée</dt><dd>{formatDuration(active.durationSec)}</dd></div> : null}
            <div><dt>Origine</dt><dd>{active.source === 'upload' ? 'Importé' : 'Créé'}</dd></div>
            <div><dt>Ajouté le</dt><dd>{new Date(active.createdAt).toLocaleDateString('fr-FR')}</dd></div>
          </dl>
        </aside> : null}
      </div>

      <footer className="mv-footer">
        <div className="mv-action-bar">
          <span className="mv-position" aria-live="polite">{activeIndex + 1} <span>/ {items.length.toLocaleString('fr-FR')}</span></span>
          <div className="mv-primary-actions">
            <a className="mv-download" href={active.originalUrl} download={active.name}><Download size={16} /><span>Original</span></a>
            <button type="button" className="mv-use" onClick={() => onUse(active)}><Wand2 size={16} />{useLabel}</button>
            <details className="mv-more"><summary aria-label="Autres actions"><Ellipsis size={19} /></summary>
              <div><button type="button" onClick={() => onTrash(active.id)}><Trash2 size={16} />Mettre à la corbeille</button></div>
            </details>
          </div>
        </div>
        <nav className="mv-filmstrip" aria-label="Médias voisins">
          {filmstrip.map(item => <button type="button" key={item.id} className={`mv-film-cell${item.id === activeId ? ' is-active' : ''}`} aria-current={item.id === activeId ? 'true' : undefined} aria-label={`Ouvrir ${item.name}`} title={item.name} onClick={() => onActiveChange(item.id)}>
            {item.thumbUrl && item.kind !== 'audio' ? <img src={item.thumbUrl} alt="" loading="lazy" decoding="async" draggable={false} /> : <Music2 size={21} aria-hidden="true" />}
            {item.kind === 'video' ? <span className="mv-film-duration">{formatDuration(item.durationSec)}</span> : null}
          </button>)}
        </nav>
      </footer>
    </div>
  </dialog>;
}

export default MediaViewer;
