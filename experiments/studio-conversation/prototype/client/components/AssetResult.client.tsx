import {
  Download,
  Plus,
  AudioLines,
  Play,
  Image as ImageIcon,
  Clapperboard,
} from "lucide-react";
import type { Asset, Project } from "../../shared/types";
import { mediaUrl } from "../hooks/useStudio";
export function AssetResult({
  asset,
  project,
  exported,
  onSelect,
  onAdd,
  disabled,
}: {
  asset: Asset;
  project: Pick<Project, "id">;
  exported?: boolean;
  onSelect: (a: Asset) => void;
  onAdd: (a: Asset) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={"asset-result " + asset.kind + (exported ? " exported" : "")}
    >
      {asset.kind === "audio" ? (
        <>
          <div className="audio-caption">
            <AudioLines size={16} />
            <span>{asset.name}</span>
          </div>
          <audio
            controls
            preload="none"
            src={mediaUrl(project.id, asset.id)}
            aria-label={asset.name}
          />
        </>
      ) : exported ? (
        <video
          controls
          preload="metadata"
          poster={mediaUrl(project.id, asset.id, "poster")}
          src={mediaUrl(project.id, asset.id)}
          aria-label={asset.name}
        />
      ) : (
        <button
          className="result-thumb"
          onClick={() => onSelect(asset)}
          aria-label={"Voir " + asset.name}
        >
          <img
            src={mediaUrl(
              project.id,
              asset.id,
              asset.kind === "video" ? "poster" : undefined,
            )}
            alt={asset.name}
          />
          {asset.kind === "video" && <Play size={18} />}
        </button>
      )}
      <div className="result-footer">
        <span>
          {asset.kind === "audio"
            ? `${asset.duration.toFixed(1)} s`
            : asset.name}
        </span>
        {!exported && asset.kind !== "image" && (
          <button
            className="icon-button"
            onClick={() => onAdd(asset)}
            disabled={disabled}
            aria-label={"Ajouter " + asset.name + " au montage"}
          >
            <Plus size={16} />
          </button>
        )}
        <a
          className="icon-button"
          href={mediaUrl(project.id, asset.id, "download")}
          aria-label={"Télécharger " + asset.name}
          download
        >
          <Download size={15} />
        </a>
      </div>
    </div>
  );
}
