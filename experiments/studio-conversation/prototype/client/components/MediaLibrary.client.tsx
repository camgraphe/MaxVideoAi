import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Clapperboard,
  Replace,
  Image as ImageIcon,
  Download,
  LoaderCircle,
} from "lucide-react";
import type { Asset, LibraryAsset, Project, Command } from "../../shared/types";
import { AssetResult } from "./AssetResult.client";
import { LibraryPreview } from "./LibraryPreview.client";
import { mediaUrl, request } from "../hooks/useStudio";

export function MediaLibrary({
  project,
  onAdd,
  onReference,
  onCommand,
  selectedClip,
  onUpload,
  onUse,
  busy,
  notice,
  onDismissNotice,
}: {
  project: Project;
  onAdd: (a: Asset, track?: "voice" | "music") => void;
  onReference: (a: Asset) => void;
  onCommand: (c: Command) => Promise<unknown>;
  selectedClip?: string;
  onUpload: () => void;
  onUse: (
    sourceProjectId: string,
    assetId: string,
  ) => Promise<Asset | undefined>;
  busy: boolean;
  notice: string;
  onDismissNotice: () => void;
}) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [scope, setScope] = useState("all"),
    [entries, setEntries] = useState<LibraryAsset[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [pending, setPending] = useState<string>(),
    [preview, setPreview] = useState<LibraryAsset>(),
    [duration, setDuration] = useState(8),
    [motion, setMotion] = useState<"gentle" | "pan" | "still">("gentle");
  useEffect(() => {
    let stopped = false;
    setLoading(true);
    setError("");
    void request<LibraryAsset[]>("/api/library")
      .then((items) => {
        if (!stopped) setEntries(items);
      })
      .catch((e) => {
        if (!stopped) setError((e as Error).message);
      })
      .finally(() => {
        if (!stopped) setLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [project.id, project.assets.length, retry]);
  const inProject = (entry: LibraryAsset) =>
    project.assets.some(
      (a) =>
        (project.id === entry.projectId && a.id === entry.asset.id) ||
        (a.librarySource?.projectId === entry.projectId &&
          a.librarySource.assetId === entry.asset.id),
    );
  const assets = entries.filter(
    (entry) =>
      (scope === "all" || inProject(entry)) &&
      (kind === "all" || entry.asset.kind === kind) &&
      `${entry.asset.name} ${entry.projectTitle}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const importFiles = () => {
    setQuery("");
    setKind("all");
    onUpload();
  };
  const use = async (
    entry: LibraryAsset,
    action: (asset: Asset) => unknown,
  ) => {
    if (pending || busy) return;
    setPending(entry.asset.id);
    setError("");
    try {
      const asset = await onUse(entry.projectId, entry.asset.id);
      if (!asset) {
        setError("Ce média n’a pas pu être ajouté. Réessayez.");
        return;
      }
      await action(asset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(undefined);
    }
  };
  return (
    <>
      <div className="library-context">
        <span>Vos images, vidéos et sons · tous les projets locaux</span>
        <select
          aria-label="Périmètre de la bibliothèque"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="all">Tous mes médias</option>
          <option value="project">Ce projet</option>
        </select>
      </div>
      <div className="library-search">
        <Search size={17} />
        <input
          placeholder="Rechercher un média…"
          aria-label="Rechercher dans les médias"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="secondary-button"
          onClick={importFiles}
          disabled={busy || !!pending}
        >
          <Plus size={15} /> Importer
        </button>
      </div>
      <div className="library-tabs" role="group" aria-label="Type de média">
        {[
          ["all", "Tout"],
          ["image", "Images"],
          ["video", "Vidéos"],
          ["audio", "Audios"],
        ].map(([id, name]) => (
          <button
            key={id}
            className={kind === id ? "chosen" : ""}
            aria-pressed={kind === id}
            onClick={() => setKind(id)}
          >
            {name}
          </button>
        ))}
        <span className="library-count">
          {assets.length} média{assets.length !== 1 ? "s" : ""}
        </span>
      </div>
      <details className="library-animation">
        <summary>Options d’animation</summary>
        <div className="animation-options">
          <select
            aria-label="Mouvement d’animation"
            value={motion}
            onChange={(e) => setMotion(e.target.value as typeof motion)}
          >
            <option value="gentle">Mouvement doux</option>
            <option value="pan">Panoramique</option>
            <option value="still">Plan fixe</option>
          </select>
          <label>
            <input
              aria-label="Durée d’animation"
              type="number"
              min="1"
              max="30"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />{" "}
            s
          </label>
        </div>
      </details>
      {(error || notice) && (
        <div className="library-error" role="alert">
          <span>{notice || error}</span>
          <button
            className="secondary-button"
            onClick={() => {
              setError("");
              onDismissNotice();
              setRetry((r) => r + 1);
            }}
          >
            {notice ? "Fermer le message" : "Réessayer"}
          </button>
        </div>
      )}
      {preview && (
        <LibraryPreview
          entry={preview}
          onClose={() => setPreview(undefined)}
          disabled={busy || !!pending}
          onReference={() => void use(preview, onReference)}
        />
      )}
      {loading && !entries.length ? (
        <div className="panel-empty" role="status">
          <LoaderCircle size={24} className="spin" />
          Chargement de la bibliothèque…
        </div>
      ) : !assets.length ? (
        <div className="panel-empty">
          <ImageIcon size={32} />
          <p>
            {query || kind !== "all" || scope !== "all"
              ? "Aucun média ne correspond à cette sélection."
              : "Vos références et vos créations se retrouveront ici."}
          </p>
          <button
            className="secondary-button"
            onClick={importFiles}
            disabled={busy}
          >
            Importer un média
          </button>
        </div>
      ) : (
        <div className="library-grid">
          {assets.map((entry) => {
            const a = entry.asset;
            return (
              <article
                key={entry.projectId + a.id}
                className="library-item"
                aria-label={a.name + " · " + entry.projectTitle}
                aria-busy={pending === a.id}
              >
                <AssetResult
                  asset={a}
                  project={{ id: entry.projectId }}
                  onSelect={() => setPreview(entry)}
                  onAdd={() => void use(entry, onAdd)}
                  disabled={busy || !!pending}
                />
                <div className="asset-metadata">
                  <span>
                    {a.kind === "image"
                      ? `${a.width} × ${a.height}`
                      : a.duration.toFixed(2) + " s"}
                  </span>
                  <span title={entry.projectTitle}>
                    {inProject(entry) ? "Dans ce projet" : entry.projectTitle}
                  </span>
                </div>
                <div className="library-actions">
                  <button
                    disabled={busy || !!pending}
                    onClick={() => void use(entry, onReference)}
                  >
                    {pending === a.id ? (
                      <LoaderCircle size={13} className="spin" />
                    ) : (
                      <Plus size={13} />
                    )}{" "}
                    Référence
                  </button>
                  {a.kind === "image" ? (
                    <button
                      disabled={busy || !!pending}
                      onClick={() =>
                        void use(entry, (asset) =>
                          onCommand({
                            type: "animate",
                            assetId: asset.id,
                            duration,
                            motion,
                          }),
                        )
                      }
                    >
                      <Clapperboard size={13} /> Animer
                    </button>
                  ) : (
                    <button
                      disabled={busy || !!pending}
                      onClick={() => void use(entry, onAdd)}
                    >
                      <Plus size={13} />{" "}
                      {a.kind === "audio" ? "Voix" : "Montage"}
                    </button>
                  )}
                  {a.kind === "audio" && (
                    <button
                      disabled={busy || !!pending}
                      onClick={() =>
                        void use(entry, (asset) => onAdd(asset, "music"))
                      }
                    >
                      Ambiance
                    </button>
                  )}
                  {a.kind === "video" && selectedClip && (
                    <button
                      disabled={busy || !!pending}
                      onClick={() =>
                        void use(entry, (asset) =>
                          onCommand({
                            type: "replace",
                            clipId: selectedClip,
                            assetId: asset.id,
                          }),
                        )
                      }
                    >
                      <Replace size={13} /> Remplacer
                    </button>
                  )}
                  <a
                    href={
                      mediaUrl(entry.projectId, a.id, "original") +
                      "&download=1"
                    }
                    download
                  >
                    <Download size={13} /> Original
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
