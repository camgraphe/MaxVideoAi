"use client";
import { useEffect, useRef, useState } from "react";
import {
  saveRecentMediaReference,
  type RecentImage,
  type ImageLibraryAsset,
} from "@/lib/studio/image-library";
import styles from "../image-conversation.module.css";
import {AudioWaveform, Film} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
export type { ImageLibraryAsset } from "@/lib/studio/image-library";

export function ImageReferenceLibrary({
  onClose,
  onSelect,
  mediaEnabled = false,
  locale = 'en',
}: {
  onClose: () => void;
  onSelect: (asset: ImageLibraryAsset) => void;
  mediaEnabled?: boolean;
  locale?: ConversationLocale;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""),
    [source, setSource] = useState<"assets" | "recent">("assets");
  const [kind, setKind] = useState<'image' | 'video' | 'audio'>('image');
  const t = (en: string, fr: string) => locale === 'fr' ? fr : en;
  const [assets, setAssets] = useState<ImageLibraryAsset[]>([]),
    [recent, setRecent] = useState<RecentImage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const alive = useRef(true),
    scope = useRef("");
  scope.current = `${source}:${kind}:${query}`;
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
    };
  }, []);
  function endpoint(next?: string) {
    const params = new URLSearchParams({
      kind,
      limit: "30",
      q: query,
    });
    if (next) params.set("cursor", next);
    return `/api/media-library/${source === "assets" ? "assets" : "recent-outputs"}?${params}`;
  }
  function apply(
    data: {
      assets?: ImageLibraryAsset[];
      outputs?: RecentImage[];
      nextCursor?: string | null;
    },
    append = false,
  ) {
    if (source === "assets")
      setAssets((current) => [
        ...(append ? current : []),
        ...(data.assets ?? []).filter((asset) => asset.assetId),
      ]);
    else
      setRecent((current) => [
        ...(append ? current : []),
        ...(data.outputs ?? []).filter((output) => output.status === "ready"),
      ]);
    setCursor(data.nextCursor ?? null);
  }
  useEffect(() => {
    const controller = new AbortController();
    setAssets([]);
    setRecent([]);
    setCursor(null);
    setBusy(true);
    setError(null);
    const timer = setTimeout(() => {
      void fetch(endpoint(), { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || !data.ok)
            throw new Error(
              t('The library is unavailable. Check your connection.','La bibliothèque est indisponible. Vérifiez votre connexion.'),
            );
          if (!controller.signal.aborted) apply(data);
        })
        .catch((failure) => {
          if (!controller.signal.aborted) setError(failure.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // Requests are scoped to the selected library tab and search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, source, kind]);
  async function more() {
    if (!cursor || busy) return;
    const currentScope = scope.current;
    setBusy(true);
    try {
      const response = await fetch(endpoint(cursor), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw new Error(t('Unable to load more media.','Impossible de charger la suite.'));
      if (alive.current && scope.current === currentScope) apply(data, true);
    } catch (failure) {
      if (alive.current && scope.current === currentScope)
        setError(
          failure instanceof Error ? failure.message : t('Loading interrupted.','Chargement interrompu.'),
        );
    } finally {
      if (alive.current && scope.current === currentScope) setBusy(false);
    }
  }
  async function selectRecent(output: RecentImage) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const asset = await saveRecentMediaReference(output, kind);
      if (alive.current) onSelect(asset);
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : t('Selection interrupted.','Sélection interrompue.'),
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/uploads/${kind}`, {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.asset?.assetId)
        throw new Error(t('The media could not be imported.','Le média n’a pas pu être importé.'));
      if (alive.current) onSelect({...data.asset, kind});
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : t('Import interrupted.','Import interrompu.'),
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className={styles.library}
      aria-labelledby="image-library-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className={styles.libraryTop}>
        <h2 id="image-library-title">{t('MaxVideoAI library', 'Bibliothèque MaxVideoAI')}</h2>
        <button onClick={onClose} aria-label={t('Close library', 'Fermer la bibliothèque')}>
          ×
        </button>
      </div>
      <p className={styles.muted}>
        {mediaEnabled ? t('Bring a reference into your conversation.', 'Apportez une référence à votre conversation.') : t('Choose an image to guide the creation.', 'Choisissez une image pour guider la création.')}
      </p>
      <div className={styles.libraryTools}>
        <button
          aria-pressed={source === "assets"}
          onClick={() => setSource("assets")}
        >
          {t('Saved', 'Enregistrées')}
        </button>
        <button
          aria-pressed={source === "recent"}
          onClick={() => setSource("recent")}
        >
          {t('Recent creations', 'Créations récentes')}
        </button>
      </div>
      {mediaEnabled && <div className={styles.libraryTools}>
        {(['image','video','audio'] as const).map(value => <button key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'image' ? 'Images' : value === 'video' ? t('Videos', 'Vidéos') : 'Audio'}</button>)}
      </div>}
      <div className={styles.libraryTools}>
        <input
          aria-label={t('Search media', 'Rechercher des médias')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Search…', 'Rechercher…')}
        />
        <button disabled={busy} onClick={() => input.current?.click()}>
          {t('Import', 'Importer')}
        </button>
      </div>
      <input
        hidden
        ref={input}
        type="file"
        accept={kind === 'image' ? 'image/png,image/jpeg,image/webp' : kind === 'video' ? 'video/mp4,video/quicktime' : 'audio/mpeg,audio/wav,audio/x-wav'}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {error && <p role="alert">{error}</p>}
      <div className={styles.libraryGrid}>
        {source === "assets"
          ? assets.map((asset) => (
              <button
                key={asset.assetId}
                disabled={busy}
                onClick={() => onSelect({...asset, kind})}
                aria-label={`${t('Choose', 'Choisir')} ${asset.name ?? kind}`}
              >
                {kind === 'image' || asset.thumbUrl ? <img src={asset.thumbUrl ?? asset.url} alt={asset.name ?? t('Library reference', 'Référence de votre bibliothèque')} loading="lazy" />
                  : kind === 'video' ? <Film aria-label={t('Video', 'Vidéo')} /> : <AudioWaveform aria-label="Audio" />}
                {kind !== 'image' && <span>{asset.name ?? kind}</span>}
              </button>
            ))
          : recent.map((output) => (
              <button
                key={output.id}
                disabled={busy}
                onClick={() => void selectRecent(output)}
                aria-label={t('Attach this creation', 'Joindre cette création')}
              >
                {kind === 'image' || output.thumbUrl ? <img src={output.thumbUrl ?? output.url} alt={t('Recent creation', 'Création récente')} loading="lazy" />
                  : kind === 'video' ? <Film /> : <AudioWaveform />}
              </button>
            ))}
      </div>
      {!busy && !assets.length && !recent.length && !error && (
        <p className={styles.muted}>
          {t('No media here yet. You can import some.', 'Aucun média ici pour le moment. Vous pouvez en importer.')}
        </p>
      )}
      {busy && <p role="status">{t('Loading…', 'Chargement…')}</p>}
      {cursor && (
        <button disabled={busy} onClick={() => void more()}>
          {t('Load more', 'Voir la suite')}
        </button>
      )}
    </dialog>
  );
}
