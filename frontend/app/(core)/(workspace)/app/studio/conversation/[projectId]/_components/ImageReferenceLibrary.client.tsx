"use client";
import { useEffect, useRef, useState } from "react";
import {
  saveRecentImageReference,
  type RecentImage,
  type ImageLibraryAsset,
} from "@/lib/studio/image-library";
import styles from "../image-conversation.module.css";
export type { ImageLibraryAsset } from "@/lib/studio/image-library";

export function ImageReferenceLibrary({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (asset: ImageLibraryAsset) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""),
    [source, setSource] = useState<"assets" | "recent">("assets");
  const [assets, setAssets] = useState<ImageLibraryAsset[]>([]),
    [recent, setRecent] = useState<RecentImage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const alive = useRef(true),
    scope = useRef("");
  scope.current = `${source}:${query}`;
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
    };
  }, []);
  function endpoint(next?: string) {
    const params = new URLSearchParams({
      kind: "image",
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
              "La bibliothèque est indisponible. Vérifiez votre connexion.",
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
  }, [query, source]);
  async function more() {
    if (!cursor || busy) return;
    const currentScope = scope.current;
    setBusy(true);
    try {
      const response = await fetch(endpoint(cursor), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw new Error("Impossible de charger la suite.");
      if (alive.current && scope.current === currentScope) apply(data, true);
    } catch (failure) {
      if (alive.current && scope.current === currentScope)
        setError(
          failure instanceof Error ? failure.message : "Chargement interrompu.",
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
      const asset = await saveRecentImageReference(output);
      if (alive.current) onSelect(asset);
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : "Sélection interrompue.",
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
      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok || !data.ok || !data.asset?.assetId)
        throw new Error("L’image n’a pas pu être importée.");
      if (alive.current) onSelect(data.asset);
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error ? failure.message : "Import interrompu.",
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
        <h2 id="image-library-title">Bibliothèque MaxVideoAI</h2>
        <button onClick={onClose} aria-label="Fermer la bibliothèque">
          ×
        </button>
      </div>
      <p className={styles.muted}>
        Choisissez une image pour guider la création.
      </p>
      <div className={styles.libraryTools}>
        <button
          aria-pressed={source === "assets"}
          onClick={() => setSource("assets")}
        >
          Enregistrées
        </button>
        <button
          aria-pressed={source === "recent"}
          onClick={() => setSource("recent")}
        >
          Créations récentes
        </button>
      </div>
      <div className={styles.libraryTools}>
        <input
          aria-label="Rechercher des images"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher…"
        />
        <button disabled={busy} onClick={() => input.current?.click()}>
          Importer une image
        </button>
      </div>
      <input
        hidden
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
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
                onClick={() => onSelect(asset)}
                aria-label={`Choisir ${asset.name ?? "cette image"}`}
              >
                <img
                  src={asset.thumbUrl ?? asset.url}
                  alt={asset.name ?? "Référence de votre bibliothèque"}
                  loading="lazy"
                />
              </button>
            ))
          : recent.map((output) => (
              <button
                key={output.id}
                disabled={busy}
                onClick={() => void selectRecent(output)}
                aria-label="Utiliser cette création comme référence"
              >
                <img
                  src={output.thumbUrl ?? output.url}
                  alt="Création récente"
                  loading="lazy"
                />
              </button>
            ))}
      </div>
      {!busy && !assets.length && !recent.length && !error && (
        <p className={styles.muted}>
          Aucune image ici pour le moment. Vous pouvez en importer une.
        </p>
      )}
      {busy && <p role="status">Chargement…</p>}
      {cursor && (
        <button disabled={busy} onClick={() => void more()}>
          Voir la suite
        </button>
      )}
    </dialog>
  );
}
