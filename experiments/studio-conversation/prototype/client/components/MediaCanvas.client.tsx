import type { ReactNode } from "react";
import {
  Pin,
  Image as ImageIcon,
  Clapperboard,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Asset, Project } from "../../shared/types";
import { mediaUrl } from "../hooks/useStudio";
export function MediaCanvas({
  project,
  selected,
  pinned,
  onSelect,
  onPin,
  onReference,
  monitor,
}: {
  project: Project;
  selected?: string;
  pinned: string[];
  onSelect: (a: Asset) => void;
  onPin: (id: string) => void;
  onReference: (a: Asset) => void;
  monitor?: ReactNode;
}) {
  const assets = project.assets.filter(
    (a) =>
      a.kind !== "audio" &&
      !project.jobs.some(
        (j) => j.kind === "export" && j.outputIds.includes(a.id),
      ),
  );
  const pool = [
    ...assets.filter((a) => a.id === selected),
    ...assets.filter((a) => pinned.includes(a.id)),
    ...assets.toReversed(),
  ];
  const visible = pool
    .filter((a, i) => pool.findIndex((b) => b.id === a.id) === i)
    .slice(0, monitor ? 3 : 4);
  const card = (a: Asset, i: number) => (
    <div
      className={
        "media-card media-card-" + i + (selected === a.id ? " selected" : "")
      }
      key={a.id}
    >
      <button
        className="media-open"
        onClick={() => onSelect(a)}
        aria-label={"Aperçu de " + a.name}
      >
        <img
          src={mediaUrl(
            project.id,
            a.id,
            a.kind === "video" ? "poster" : undefined,
          )}
          alt={a.name}
        />
        <span className="media-kind">
          {a.kind === "image" ? (
            <ImageIcon size={15} />
          ) : (
            <Clapperboard size={15} />
          )}{" "}
          {a.kind === "video" ? a.duration.toFixed(1) + " s" : ""}
        </span>
      </button>
      <div className="media-actions">
        <button
          className={pinned.includes(a.id) ? "pinned" : ""}
          onClick={() => onPin(a.id)}
          aria-label={
            pinned.includes(a.id)
              ? "Désépingler " + a.name
              : "Épingler " + a.name
          }
        >
          <Pin size={14} />
        </button>
        <span>{a.name}</span>
        <button
          onClick={() => onReference(a)}
          aria-label={"Utiliser " + a.name + " comme référence"}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
  if (!assets.length)
    return (
      <>
        <aside className="media-left ambient">
          <img
            src="/demo/linen.jpg"
            alt="Exemple de direction : flacon bleu, mer et lin"
          />
          <img src="/demo/caustic.jpg" alt="Exemple de reflets de lumière" />
          <span>UNE PREMIÈRE INSPIRATION</span>
        </aside>
        <aside className="media-right ambient">
          <img src="/demo/hand.jpg" alt="Exemple de film parfum" />
          <div className="ambient-note">
            <Sparkles size={15} />
            <span>
              Des références. Des images. Du mouvement.
              <br />
              Tout commence avec vos mots.
            </span>
          </div>
          {monitor}
        </aside>
      </>
    );
  return (
    <>
      <aside className={"media-left count-" + visible.length}>
        {visible.slice(1, 3).map((a, i) => card(a, i))}
        <button className="canvas-hint" onClick={() => onReference(visible[0])}>
          <Plus size={13} /> Un visuel comme référence
        </button>
      </aside>
      <aside className={"media-right count-" + visible.length}>
        {visible[3] && card(visible[3], 3)}
        {monitor ?? (visible[0] && card(visible[0], 2))}
      </aside>
    </>
  );
}
