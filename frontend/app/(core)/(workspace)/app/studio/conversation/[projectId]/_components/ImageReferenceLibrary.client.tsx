'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {AudioWaveform, Check, Film, ImageIcon, Search, Upload, X} from 'lucide-react';
import {LibraryImageThumbnail} from '@/components/library/LibraryImageThumbnail.client';
import {saveRecentMediaReference, type RecentImage, type ImageLibraryAsset} from '@/lib/studio/image-library';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import styles from './image-reference-library.module.css';
export type {ImageLibraryAsset} from '@/lib/studio/image-library';

type MediaKind = 'image' | 'video' | 'audio';
type Selection = {scope: object; name: string} & ({source: 'assets'; asset: ImageLibraryAsset} | {source: 'recent'; output: RecentImage});

function mediaName(url: string, fallback: string) {
  try {return decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || fallback;} catch {return fallback;}
}

function MediaPreview({item, kind, name}: {item: ImageLibraryAsset | RecentImage; kind: MediaKind; name: string}) {
  if (kind === 'image') return <LibraryImageThumbnail asset={item} alt={name} />;
  if (item.thumbUrl) {
    // Private posters stay direct; never fall back to video/audio bytes in an image.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.thumbUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
  }
  return kind === 'video' ? <Film className={styles.mediaIcon} size={34} aria-hidden="true" /> : <AudioWaveform className={styles.mediaIcon} size={42} aria-hidden="true" />;
}

export function ImageReferenceLibrary({onClose, onSelect, mediaEnabled = false, locale = 'en', purpose = 'reference'}: {
  onClose: () => void;
  onSelect: (asset: ImageLibraryAsset) => void;
  mediaEnabled?: boolean;
  locale?: ConversationLocale | 'es';
  purpose?: 'reference' | 'timeline';
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'assets' | 'recent'>('assets');
  const [kind, setKind] = useState<MediaKind>('image');
  const [assets, setAssets] = useState<ImageLibraryAsset[]>([]);
  const [recent, setRecent] = useState<RecentImage[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<'upload' | 'select' | null>(null);
  const alive = useRef(true);
  const operation = useRef<AbortController | null>(null);
  const pagination = useRef<AbortController | null>(null);
  const scopeKey = JSON.stringify([source, kind, query]);
  const scope = useRef({key: scopeKey});
  // A new identity also rejects a request if the user returns to an earlier filter.
  if (scope.current.key !== scopeKey) scope.current = {key: scopeKey};
  const selected = selection?.scope === scope.current ? selection : null;
  const t = (en: string, fr: string, es: string) => locale === 'fr' ? fr : locale === 'es' ? es : en;
  const kindLabel = kind === 'image' ? t('Image', 'Image', 'Imagen') : kind === 'video' ? t('Video', 'Vidéo', 'Vídeo') : 'Audio';
  const provenance = source === 'assets' ? t('Library', 'Bibliothèque', 'Biblioteca') : t('Recent creation', 'Création récente', 'Creación reciente');
  const addLabel = purpose === 'timeline' ? t('Add to timeline', 'Ajouter à la timeline', 'Añadir a la línea de tiempo') : t('Add to conversation', 'Ajouter à la conversation', 'Añadir a la conversación');

  useEffect(() => {
    alive.current = true;
    // Retain the original trigger across Strict Mode effect probing: a modal
    // prevents the simulated cleanup from focusing outside its inert boundary.
    if (!opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
      operation.current?.abort();
      pagination.current?.abort();
      opener.current?.focus();
    };
  }, []);

  function endpoint(next?: string) {
    const params = new URLSearchParams({kind, limit: '30', q: query});
    if (next) params.set('cursor', next);
    return `/api/media-library/${source === 'assets' ? 'assets' : 'recent-outputs'}?${params}`;
  }
  function apply(data: {assets?: ImageLibraryAsset[]; outputs?: RecentImage[]; nextCursor?: string | null}, append = false) {
    if (source === 'assets') setAssets(current => [...(append ? current : []), ...(data.assets ?? []).filter(asset => asset.assetId && (!asset.kind || asset.kind === kind))]);
    else setRecent(current => [...(append ? current : []), ...(data.outputs ?? []).filter(output => output.status === 'ready')]);
    setCursor(data.nextCursor ?? null);
  }
  useEffect(() => {
    const controller = new AbortController();
    const intent = scope.current;
    operation.current?.abort();
    pagination.current?.abort();
    setAssets([]);
    setRecent([]);
    setSelection(null);
    setCursor(null);
    setLoading(true);
    setWorking(null);
    setError(null);
    const timer = setTimeout(() => {
      void fetch(endpoint(), {signal: controller.signal, cache: 'no-store'})
        .then(async response => {
          const data = await response.json();
          if (!response.ok || !data.ok) throw new Error(t('The library is unavailable. Check your connection.', 'La bibliothèque est indisponible. Vérifiez votre connexion.', 'La biblioteca no está disponible. Comprueba tu conexión.'));
          if (scope.current === intent && !controller.signal.aborted) apply(data);
        })
        .catch(failure => {if (scope.current === intent && !controller.signal.aborted) setError(failure.message);})
        .finally(() => {if (scope.current === intent && !controller.signal.aborted) setLoading(false);});
    }, 200);
    return () => {controller.abort(); clearTimeout(timer); operation.current?.abort(); pagination.current?.abort();};
    // Listing scope changes, rather than translated copy or state, own request lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, source, kind]);

  async function more() {
    if (!cursor || loading || working) return;
    const intent = scope.current;
    const controller = new AbortController();
    pagination.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint(cursor), {signal: controller.signal, cache: 'no-store'});
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(t('Unable to load more media.', 'Impossible de charger la suite.', 'No se pudieron cargar más archivos.'));
      if (alive.current && scope.current === intent && !controller.signal.aborted) apply(data, true);
    } catch (failure) {
      if (alive.current && scope.current === intent && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : t('Loading interrupted.', 'Chargement interrompu.', 'Carga interrumpida.'));
    } finally {
      if (alive.current && scope.current === intent && !controller.signal.aborted) setLoading(false);
    }
  }
  async function add() {
    if (!selected || working) return;
    const intent = scope.current;
    const controller = new AbortController();
    operation.current = controller;
    setWorking('select');
    setError(null);
    try {
      const asset = selected.source === 'assets' ? {...selected.asset, kind} : await saveRecentMediaReference(selected.output, kind, (url, init) => fetch(url, {...init, signal: controller.signal}));
      if (alive.current && scope.current === intent && !controller.signal.aborted) onSelect(asset);
    } catch {
      if (alive.current && scope.current === intent && !controller.signal.aborted) setError(t('This media could not be added. Please try again.', 'Ce média n’a pas pu être ajouté. Réessayez.', 'No se pudo añadir este archivo. Inténtalo de nuevo.'));
    } finally {
      if (alive.current && scope.current === intent && !controller.signal.aborted) setWorking(null);
    }
  }
  async function upload(file: File) {
    const intent = scope.current;
    const uploadKind = kind;
    const controller = new AbortController();
    operation.current?.abort();
    operation.current = controller;
    setWorking('upload');
    setError(null);
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch(`/api/uploads/${uploadKind}`, {method: 'POST', body, signal: controller.signal});
      const data = await response.json();
      if (!response.ok || !data.ok || !data.asset?.assetId) throw new Error();
      if (alive.current && scope.current === intent && !controller.signal.aborted) onSelect({...data.asset, kind: uploadKind});
    } catch {
      if (alive.current && scope.current === intent && !controller.signal.aborted) setError(t('The media could not be imported. Try uploading it again.', 'Le média n’a pas pu être importé. Réessayez.', 'No se pudo subir el archivo. Inténtalo de nuevo.'));
    } finally {
      if (alive.current && scope.current === intent && !controller.signal.aborted) setWorking(null);
    }
  }
  const count = source === 'assets' ? assets.length : recent.length;
  return (
    <dialog ref={dialog} className={styles.library} aria-labelledby={titleId} onCancel={onClose} onClose={onClose} onClick={event => {if (event.target === event.currentTarget) onClose();}}>
      <header className={styles.header}>
        <div><h2 id={titleId}>{t('MaxVideoAI library', 'Bibliothèque MaxVideoAI', 'Biblioteca MaxVideoAI')}</h2><p>{purpose === 'timeline' ? t('Choose media for your film.', 'Choisissez un média pour votre film.', 'Elige un archivo para tu película.') : t('Choose a reference for your next idea.', 'Choisissez une référence pour votre prochaine idée.', 'Elige una referencia para tu próxima idea.')}</p></div>
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('Close library', 'Fermer la bibliothèque', 'Cerrar biblioteca')}><X size={20} aria-hidden="true" /></button>
      </header>
      <div className={styles.controls}>
        <div className={styles.toolbar}>
          <div className={styles.sourceGroup} role="group" aria-label={t('Media source', 'Source des médias', 'Origen de los archivos')}>
            <button type="button" aria-pressed={source === 'assets'} onClick={() => setSource('assets')}>{t('Library', 'Bibliothèque', 'Biblioteca')}</button>
            <button type="button" aria-pressed={source === 'recent'} onClick={() => setSource('recent')}>{t('Recent creations', 'Créations récentes', 'Creaciones recientes')}</button>
          </div>
          <button type="button" className={styles.upload} disabled={!!working} onClick={() => input.current?.click()}><Upload size={16} aria-hidden="true" />{working === 'upload' ? t('Uploading…', 'Importation…', 'Subiendo…') : t('Upload from device', 'Importer depuis cet appareil', 'Subir desde este dispositivo')}</button>
        </div>
        <div className={styles.filterRow}>
          {mediaEnabled && <div className={styles.typeGroup} role="group" aria-label={t('Media type', 'Type de média', 'Tipo de archivo')}>
            {(['image', 'video', 'audio'] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'image' ? <ImageIcon size={15} aria-hidden="true" /> : value === 'video' ? <Film size={15} aria-hidden="true" /> : <AudioWaveform size={15} aria-hidden="true" />}{value === 'image' ? t('Images', 'Images', 'Imágenes') : value === 'video' ? t('Videos', 'Vidéos', 'Vídeos') : 'Audio'}</button>)}
          </div>}
          <label className={styles.search}><Search size={16} aria-hidden="true" /><input aria-label={t('Search media', 'Rechercher des médias', 'Buscar archivos')} value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search media…', 'Rechercher des médias…', 'Buscar archivos…')} /></label>
        </div>
      </div>
      <input hidden ref={input} type="file" accept={kind === 'image' ? 'image/png,image/jpeg,image/webp' : kind === 'video' ? 'video/mp4,video/quicktime' : 'audio/mpeg,audio/wav,audio/x-wav'} onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file);}} />
      <div className={styles.gallery} aria-busy={loading}>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {count > 0 && <div className={styles.grid}>
          {(source === 'assets' ? assets : recent).map((item, index) => {
            const asset = source === 'assets' ? item as ImageLibraryAsset : null;
            const output = source === 'recent' ? item as RecentImage : null;
            const id = asset?.assetId ?? output!.id;
            const name = asset?.name || mediaName(item.url, `${kindLabel} ${index + 1}`);
            const active = selected?.source === 'assets' ? selected.asset.assetId === id : selected?.source === 'recent' && selected.output.id === id;
            return <button type="button" key={id} data-media-choice={id} className={styles.card} aria-pressed={!!active} disabled={!!working} aria-label={`${t('Choose', 'Choisir', 'Elegir')} ${name}`} onClick={() => setSelection(asset ? {scope: scope.current, source: 'assets', asset, name} : {scope: scope.current, source: 'recent', output: output!, name})}>
              <span className={styles.preview}>
                <MediaPreview item={item} kind={kind} name={name} />
                <span className={styles.kind}>{kindLabel}</span>
                {active && <span className={styles.check}><Check size={16} aria-hidden="true" /><span className={styles.srOnly}>{t('Selected', 'Sélectionné', 'Seleccionado')}</span></span>}
              </span>
              <span className={styles.cardInfo}><strong title={name}>{name}</strong><small>{provenance}</small></span>
            </button>;
          })}
        </div>}
        {loading && <p className={styles.status} role="status">{t('Loading media…', 'Chargement des médias…', 'Cargando archivos…')}</p>}
        {!loading && count === 0 && !error && <div className={styles.empty}><span>{kind === 'image' ? <ImageIcon size={30} aria-hidden="true" /> : kind === 'video' ? <Film size={30} aria-hidden="true" /> : <AudioWaveform size={30} aria-hidden="true" />}</span><strong>{query ? t('No matching media', 'Aucun média correspondant', 'No hay archivos coincidentes') : t('No media here yet', 'Aucun média pour le moment', 'Todavía no hay archivos')}</strong><p>{query ? t('Try another search or upload a file.', 'Essayez une autre recherche ou importez un fichier.', 'Prueba otra búsqueda o sube un archivo.') : t('Upload a file from your device to get started.', 'Importez un fichier depuis votre appareil pour commencer.', 'Sube un archivo desde tu dispositivo para empezar.')}</p></div>}
        {cursor && <button type="button" className={styles.more} disabled={loading || !!working} onClick={() => void more()}>{t('Load more', 'Voir la suite', 'Cargar más')}</button>}
      </div>
      <footer className={styles.footer}>
        <div className={styles.selection} aria-live="polite">{selected ? <><strong title={selected.name}>{selected.name}</strong><span>{kindLabel} · {provenance}</span></> : <span>{t('Select media to add', 'Sélectionnez un média à ajouter', 'Selecciona un archivo para añadir')}</span>}</div>
        <button type="button" className={styles.add} disabled={!selected || !!working} onClick={() => void add()}>{working === 'select' ? t('Adding…', 'Ajout…', 'Añadiendo…') : addLabel}</button>
      </footer>
    </dialog>
  );
}
