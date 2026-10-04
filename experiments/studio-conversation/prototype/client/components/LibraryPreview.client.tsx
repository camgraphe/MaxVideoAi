import { X, Plus } from "lucide-react";
import type { LibraryAsset } from "../../shared/types";
import { mediaUrl } from "../hooks/useStudio";

export function LibraryPreview({
  entry,
  onClose,
  onReference,
  disabled,
}: {
  entry: LibraryAsset;
  onClose: () => void;
  onReference: () => void;
  disabled: boolean;
}) {
  const { asset, projectId } = entry;
  return (
    <section className="library-preview" aria-label={"Aperçu de " + asset.name}>
      <div className="library-preview-heading">
        <strong>{asset.name}</strong>
        <button
          className="icon-button"
          aria-label="Fermer l’aperçu"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </div>
      {asset.kind === "image" ? (
        <img src={mediaUrl(projectId, asset.id)} alt={asset.name} />
      ) : asset.kind === "video" ? (
        <video
          key={asset.id}
          controls
          preload="none"
          poster={mediaUrl(projectId, asset.id, "poster")}
          src={mediaUrl(projectId, asset.id)}
          aria-label={asset.name}
        />
      ) : (
        <audio
          key={asset.id}
          controls
          preload="none"
          src={mediaUrl(projectId, asset.id)}
          aria-label={asset.name}
        />
      )}
      <button
        className="secondary-button"
        disabled={disabled}
        onClick={onReference}
      >
        <Plus size={14} /> Joindre au message
      </button>
    </section>
  );
}
