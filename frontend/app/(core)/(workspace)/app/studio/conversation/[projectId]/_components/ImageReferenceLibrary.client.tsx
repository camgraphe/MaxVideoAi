'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { invalidateLibraryMedia, useLibraryCacheRevision } from '@/hooks/useLibraryCacheRevision';
import { useLibraryImportQueue } from '@/hooks/useLibraryImportQueue';
import type { LibraryImportQueueController } from '@/lib/library-import-queue';
import { AssetLibraryBrowser, type AssetBrowserAsset } from '@/components/library/AssetLibraryBrowser';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { canonicalMediaAssetFields } from '@/lib/media-identity';
import { saveRecentMediaReference, type RecentImage, type ImageLibraryAsset } from '@/lib/studio/image-library';
import type { ConversationLocale } from '@/lib/studio/conversation-quote-presentation';
import { StudioCharacterLibrary } from './StudioCharacterLibrary.client';
import styles from './image-reference-library.module.css';
export type { ImageLibraryAsset } from '@/lib/studio/image-library';
type MediaKind = 'image' | 'video' | 'audio';
type Props = {
  open?: boolean;
  accountKey: string;
  onClose: () => void;
  onSelect: (asset: ImageLibraryAsset) => void | boolean | string;
  onSelectMany?: (assets: ImageLibraryAsset[]) => void | boolean | string;
  mediaEnabled?: boolean;
  characterProjectId?: string;
  locale?: ConversationLocale | 'es';
  purpose?: 'reference' | 'timeline';
  returnFocusTo?: HTMLElement | null;
};
/** Queue survives presentation close/reopen; only account/project/purpose retires it. */
export function ImageReferenceLibrary(props: Props) {
  const context = JSON.stringify([props.accountKey, props.characterProjectId, props.purpose ?? 'reference']);
  const imports = useLibraryImportQueue(props.accountKey, context);
  return props.open === false ? null : <OwnedImageReferenceLibrary key={context} {...props} queue={imports.queue} />;
}
function OwnedImageReferenceLibrary({
  accountKey,
  onClose,
  onSelect,
  onSelectMany,
  mediaEnabled = false,
  characterProjectId,
  locale = 'en',
  purpose = 'reference',
  returnFocusTo,
  queue,
}: Props & { queue: LibraryImportQueueController }) {
  const revision = useLibraryCacheRevision(accountKey);
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLElement | null>(returnFocusTo ?? null);
  const titleId = useId();
  const [query, setQuery] = useState(''),
    [source, setSource] = useState<'all' | 'recent'>('all'),
    [kind, setKind] = useState<MediaKind>('image');
  const [showCharacters, setShowCharacters] = useState(false),
    [assets, setAssets] = useState<AssetBrowserAsset[]>([]);
  const [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const alive = useRef(true),
    pending = useRef<AbortController | null>(null),
    pagination = useRef<AbortController | null>(null);
  const listing = useRef({ key: '' });
  const listKey = JSON.stringify([source, kind, query, revision]);
  if (listing.current.key !== listKey) listing.current = { key: listKey };
  const prepared = useRef(new Map<string, ImageLibraryAsset>()),
    finishSaved = useRef(new Map<string, () => Promise<ImageLibraryAsset>>());
  const t = (en: string, fr: string, es: string) => (locale === 'fr' ? fr : locale === 'es' ? es : en);
  useEffect(() => {
    alive.current = true;
    if (!opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
      pending.current?.abort();
      pagination.current?.abort();
      opener.current?.focus();
    };
  }, []);
  function endpoint(next?: string) {
    const params = new URLSearchParams({ kind, limit: '30', q: query });
    if (next) params.set('cursor', next);
    return `/api/media-library/${source === 'all' ? 'assets' : 'recent-outputs'}?${params}`;
  }
  function apply(
    data: { assets?: ImageLibraryAsset[]; outputs?: RecentImage[]; nextCursor?: string | null },
    append = false,
  ) {
    const page: AssetBrowserAsset[] =
      source === 'all'
        ? (data.assets ?? [])
            .filter((asset) => asset.assetId && (!asset.kind || asset.kind === kind))
            .map((asset) => ({ ...asset, id: asset.assetId, kind }))
        : (data.outputs ?? [])
            .filter((output) => output.status === 'ready')
            .map((output) => ({
              ...output,
              kind,
              source: 'recent',
              sourceOutputId: output.sourceOutputId ?? output.id,
            }));
    setAssets((previous) => (append ? [...previous, ...page] : page));
    setCursor(data.nextCursor ?? null);
  }
  useEffect(() => {
    const controller = new AbortController(),
      captured = listing.current;
    setAssets([]);
    setCursor(null);
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      void ownedAuthFetch(endpoint(), accountKey, { signal: controller.signal, cache: 'no-store' })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || !data.ok) throw Error('Library unavailable');
          if (alive.current && listing.current === captured && !controller.signal.aborted) apply(data);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError(
              t(
                'The library is unavailable.',
                'La bibliothèque est indisponible.',
                'La biblioteca no está disponible.',
              ),
            );
        })
        .finally(() => {
          if (!controller.signal.aborted && listing.current === captured) setLoading(false);
        });
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
      pagination.current?.abort();
    };
    // Listing retirement does not abort canonical preparation or discard captured selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);
  async function more() {
    if (!cursor || loading || busy) return;
    const captured = listing.current,
      controller = new AbortController();
    pagination.current = controller;
    setLoading(true);
    try {
      const response = await ownedAuthFetch(endpoint(cursor), accountKey, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.ok) throw Error();
      if (alive.current && listing.current === captured && !controller.signal.aborted) apply(data, true);
    } catch {
      if (!controller.signal.aborted)
        setError(t('Loading interrupted.', 'Chargement interrompu.', 'Carga interrumpida.'));
    } finally {
      if (alive.current && listing.current === captured && !controller.signal.aborted) setLoading(false);
    }
  }
  async function accept(items: AssetBrowserAsset[], acceptance?: { isCurrent: () => boolean }) {
    const controller = new AbortController();
    pending.current = controller;
    let saved = false;
    const current = () => alive.current && !controller.signal.aborted && (acceptance?.isCurrent() ?? true);
    const results: ImageLibraryAsset[] = [];
    try {
      for (const item of items) {
        if (!current()) return false;
        const key = JSON.stringify([item.assetId, item.jobId, item.sourceOutputId, item.url]);
        let asset = prepared.current.get(key);
        if (!asset) {
          const id = canonicalMediaAssetFields(item.assetId ?? item.id, item.kind).assetId;
          if (id) asset = { ...item, assetId: id, name: item.name ?? undefined };
          else if (finishSaved.current.has(key)) asset = await finishSaved.current.get(key)!();
          else if (item.jobId && item.sourceOutputId)
            asset = await saveRecentMediaReference(
              { ...item, jobId: item.jobId, id: item.sourceOutputId, status: 'ready' },
              item.kind,
              (url, init) => ownedAuthFetch(url, accountKey, { ...init, signal: controller.signal }),
              (finish) => {
                saved = true;
                finishSaved.current.set(key, finish);
              },
            );
          else throw Error('This media has no canonical reference.');
          prepared.current.set(key, asset);
        }
        results.push(asset);
      }
      if (!current()) return false;
      return purpose === 'reference' && onSelectMany
        ? onSelectMany(results)
        : results.length === 1
          ? onSelect(results[0])
          : false;
    } catch {
      return t(
        'This media could not be added. Completed saves remain in your library; retry the selection.',
        'Ajout impossible. Les médias déjà enregistrés restent dans la bibliothèque ; réessayez.',
        'No se pudo añadir. Los archivos guardados permanecen en tu biblioteca; reintenta.',
      );
    } finally {
      if (saved) invalidateLibraryMedia(accountKey);
    }
  }
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <dialog
      ref={dialog}
      className={styles.library}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      {characterProjectId && purpose === 'reference' ? (
        <div className={styles.sourceGroup}>
          <button type="button" disabled={busy} aria-pressed={!showCharacters} onClick={() => setShowCharacters(false)}>
            {t('Media', 'Médias', 'Archivos')}
          </button>
          <button type="button" disabled={busy} aria-pressed={showCharacters} onClick={() => setShowCharacters(true)}>
            {t('Saved characters', 'Personnages sauvegardés', 'Personajes guardados')}
          </button>
        </div>
      ) : null}
      {showCharacters && characterProjectId ? (
        <>
          <button type="button" onClick={close}>
            {t('Close', 'Fermer', 'Cerrar')}
          </button>
          <StudioCharacterLibrary
            accountKey={accountKey}
            projectId={characterProjectId}
            locale={locale}
            onSelect={onSelect}
          />
        </>
      ) : null}
      <div className={styles.browser} hidden={showCharacters}>
        <AssetLibraryBrowser
          active={!showCharacters}
          headingId={titleId}
          closeLabel={t('Close library', 'Fermer la bibliothèque', 'Cerrar biblioteca')}
          locale={locale}
          title={t('MaxVideoAI library', 'Bibliothèque MaxVideoAI', 'Biblioteca MaxVideoAI')}
          assetType={kind}
          assets={assets}
          isLoading={loading && !assets.length}
          isLoadingMore={loading && !!assets.length}
          error={error}
          source={source}
          availableSources={['all', 'recent']}
          sourceLabels={{
            all: t('Library', 'Bibliothèque', 'Biblioteca'),
            recent: t('Recent creations', 'Créations récentes', 'Creaciones recientes'),
          }}
          onSourceChange={(value) => setSource(value === 'recent' ? 'recent' : 'all')}
          searchQuery={query}
          onSearchQueryChange={setQuery}
          searchPlaceholder={t('Search media', 'Rechercher des médias', 'Buscar archivos')}
          sourcesTitle={t('Media', 'Médias', 'Archivos')}
          emptyLabel={t('No media here yet', 'Aucun média pour le moment', 'Todavía no hay archivos')}
          emptySearchLabel={t('No matching media', 'Aucun média correspondant', 'No hay archivos coincidentes')}
          hasMore={!!cursor}
          onLoadMore={() => void more()}
          onClose={close}
          renderAssetActions={() => null}
          headerActions={
            mediaEnabled ? (
              <select
                aria-label={t('Media type', 'Type de média', 'Tipo de archivo')}
                value={kind}
                onChange={(event) => setKind(event.target.value as MediaKind)}
              >
                {(['image', 'video', 'audio'] as const).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            ) : undefined
          }
          selection={{
            confirmLabel:
              purpose === 'timeline'
                ? t('Add to timeline', 'Ajouter à la timeline', 'Añadir a la línea de tiempo')
                : t('Add to conversation', 'Ajouter à la conversation', 'Añadir a la conversación'),
            ownerId: accountKey,
            scope: JSON.stringify([accountKey, characterProjectId, purpose]),
            importQueue: queue,
            busy,
            onBusyChange: setBusy,
            onConfirm: (item) => accept([item]),
            onConfirmMany: purpose === 'reference' && onSelectMany ? accept : undefined,
          }}
        />
      </div>
    </dialog>
  );
}
