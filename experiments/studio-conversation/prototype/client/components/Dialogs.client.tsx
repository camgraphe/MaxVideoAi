import { useEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Sparkles,
  AudioLines,
  Clapperboard,
  Download,
  RotateCcw,
  Copy,
  Check,
} from "lucide-react";
import type { Panel } from "./Shell.client";
import type { Asset, Command, Project } from "../../shared/types";
import type { Studio } from "../hooks/useStudio";
import { MediaLibrary } from "./MediaLibrary.client";
import { AssetResult } from "./AssetResult.client";
export function Dialogs({
  panel,
  onClose,
  studio,
  onSelect,
  onAdd,
  onReference,
  onUpload,
  selectedClip,
}: {
  panel: Panel;
  onClose: () => void;
  studio: Studio;
  onSelect: (a: Asset) => void;
  onAdd: (a: Asset, track?: "voice" | "music") => void;
  onReference: (a: Asset) => void;
  onUpload: () => void;
  selectedClip?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [name, setName] = useState(""),
    [voice, setVoice] = useState(
      "La lumière a un parfum. Un instant, pour soi.",
    ),
    [copied, setCopied] = useState(false);
  const p = studio.project;
  useEffect(() => {
    const d = ref.current;
    if (panel && !d?.open) d?.showModal();
    if (!panel && d?.open) d?.close();
  }, [panel]);
  const titles = {
    projects: "Vos projets",
    library: "Médias",
    settings: "Le cadre de votre création",
    tools: "Les gestes de Studio",
    activity: "En cours & rendus",
    about: "Studio, en local",
  };
  if (!panel || !p) return null;
  return (
    <dialog
      className={"studio-dialog " + panel}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{titles[panel]}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">
        {panel === "projects" && (
          <>
            <form
              className="new-project-form"
              onSubmit={(e) => {
                e.preventDefault();
                void studio.create(name || "Sans titre").then(() => {
                  setName("");
                  onClose();
                });
              }}
            >
              <input
                placeholder="Le nom de votre prochain film…"
                aria-label="Nom du nouveau projet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
              <button className="gold-button" type="submit">
                <Plus size={15} /> Créer
              </button>
            </form>
            <div className="project-list">
              {studio.projects.map((pr) => (
                <button
                  key={pr.id}
                  className={pr.id === p.id ? "current" : ""}
                  onClick={() => void studio.open(pr.id).then(onClose)}
                >
                  <Clapperboard size={20} />
                  <span>{pr.title}</span>
                  {pr.id === p.id && <Check size={15} />}
                </button>
              ))}
            </div>
          </>
        )}
        {panel === "library" && (
          <MediaLibrary
            project={p}
            onSelect={(a) => {
              onSelect(a);
              onClose();
            }}
            onAdd={onAdd}
            onReference={(a) => {
              onReference(a);
              onClose();
            }}
            onCommand={(c) => void studio.command(c)}
            selectedClip={selectedClip}
            onUpload={onUpload}
          />
        )}
        {panel === "settings" && (
          <Settings
            key={p.id + ":" + p.revision}
            project={p}
            onSave={(c) =>
              void studio.command(c).then((result) => {
                if (result) {
                  void studio.list();
                  onClose();
                }
              })
            }
            busy={studio.busy}
          />
        )}
        {panel === "tools" && (
          <>
            <p className="panel-intro">
              Des actions simples. Le chat peut aussi les déclencher.
            </p>
            <div className="tool-list">
              <button
                onClick={() => {
                  void studio.chat("Crée les visuels du parfum", {});
                  onClose();
                }}
              >
                <Sparkles size={21} />
                <span>
                  Créer des visuels
                  <small>3 images parfum de démonstration</small>
                </span>
              </button>
              <button
                disabled={!p.assets.some((a) => a.kind === "image")}
                onClick={() => {
                  void studio.chat("Anime les images", {});
                  onClose();
                }}
              >
                <Clapperboard size={21} />
                <span>
                  Mettre en mouvement
                  <small>Mouvement doux, jusqu’à 30 s par plan</small>
                </span>
              </button>
              <button
                onClick={() => {
                  void studio.command({
                    type: "music",
                    duration: p.settings.targetDuration,
                  });
                  onClose();
                }}
              >
                <AudioLines size={21} />
                <span>
                  Créer une ambiance
                  <small>Texture sonore synthétique, locale</small>
                </span>
              </button>
            </div>
            <form
              className="voice-form"
              onSubmit={(e) => {
                e.preventDefault();
                void studio.command({ type: "voice", text: voice });
                onClose();
              }}
            >
              <label htmlFor="voice-text">Le texte de votre voix</label>
              <textarea
                id="voice-text"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                maxLength={2000}
              />
              <button className="gold-button" disabled={!voice.trim()}>
                <AudioLines size={15} /> Générer la voix
              </button>
            </form>
          </>
        )}
        {panel === "activity" && (
          <>
            {!p.jobs.length ? (
              <div className="panel-empty">
                <p>La création commence dans le chat.</p>
              </div>
            ) : (
              p.jobs.toReversed().map((j) => (
                <article className="activity-card" key={j.id}>
                  <div>
                    <strong>{j.label}</strong>
                    <span>
                      {j.state === "ready"
                        ? "Prêt"
                        : j.state === "running"
                          ? Math.round(j.progress * 100) + " %"
                          : j.state === "queued"
                            ? "En attente"
                            : j.state === "cancelled"
                              ? "Arrêté"
                              : "Échec"}
                    </span>
                  </div>
                  {["queued", "running"].includes(j.state) ? (
                    <>
                      <progress value={j.progress} max="1" />
                      <button
                        className="secondary-button"
                        onClick={() =>
                          void studio.command({ type: "cancel", jobId: j.id })
                        }
                      >
                        Arrêter
                      </button>
                    </>
                  ) : ["failed", "cancelled"].includes(j.state) ? (
                    <>
                      <p>{j.error}</p>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          void studio.command({ type: "retry", jobId: j.id })
                        }
                      >
                        <RotateCcw size={14} /> Réessayer
                      </button>
                    </>
                  ) : (
                    j.kind === "export" &&
                    j.outputIds.map((id) => {
                      const a = p.assets.find((a) => a.id === id);
                      return (
                        a && (
                          <AssetResult
                            key={id}
                            project={p}
                            asset={a}
                            exported
                            onSelect={onSelect}
                            onAdd={(a) => onAdd(a)}
                          />
                        )
                      );
                    })
                  )}
                </article>
              ))
            )}
          </>
        )}
        {panel === "about" && (
          <>
            <p className="panel-intro">
              Un Studio conversationnel à essayer, dans une branche isolée de
              MaxVideoAI.
            </p>
            <p>
              Le dialogue est simulé. Les imports, voix, animations, coupes,
              sauvegardes et rendus sont réels, sur cet ordinateur. Les visuels
              créés utilisent le jeu parfum de démonstration.
            </p>
            <div className="about-mcp">
              <h3>Le même montage depuis un assistant externe</h3>
              <code>{location.origin}/mcp</code>
              <button
                className="secondary-button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(location.origin + "/mcp")
                    .then(() => setCopied(true))
                }
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                {copied ? "Copié" : "Copier l’adresse MCP"}
              </button>
              <p>
                Le chat, la timeline et ce MCP partagent les mêmes commandes et
                la même révision.
              </p>
            </div>
            <a
              className="secondary-button"
              href={`/api/projects/${p.id}/backup`}
              download
            >
              <Download size={15} /> Sauvegarder le projet JSON
            </a>
          </>
        )}
      </div>
    </dialog>
  );
}
function Settings({
  project,
  onSave,
  busy,
}: {
  project: Project;
  onSave: (c: Command) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(project.title),
    [s, set] = useState(project.settings);
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ type: "settings", settings: s, title });
      }}
    >
      <label>
        Nom du projet
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
        />
      </label>
      <fieldset>
        <legend>Format</legend>
        <div className="format-options">
          {(["16:9", "9:16", "1:1"] as const).map((r) => (
            <button
              type="button"
              key={r}
              className={s.ratio === r ? "chosen" : ""}
              onClick={() => set({ ...s, ratio: r })}
            >
              <span style={{ aspectRatio: r.replace(":", " / ") }} />
              {r}
              <small>
                {r === "16:9" ? "Film" : r === "9:16" ? "Vertical" : "Carré"}
              </small>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="settings-row">
        <label>
          Définition
          <select
            value={s.resolution}
            onChange={(e) =>
              set({ ...s, resolution: Number(e.target.value) as 720 })
            }
          >
            <option value="720">720p</option>
            <option value="1080">1080p</option>
          </select>
        </label>
        <label>
          Cadence
          <select
            value={s.fps}
            onChange={(e) => set({ ...s, fps: Number(e.target.value) as 24 })}
          >
            <option value="24">24 images / s</option>
            <option value="30">30 images / s</option>
          </select>
        </label>
      </div>
      <label>
        Cadrage
        <select
          value={s.fit}
          onChange={(e) => set({ ...s, fit: e.target.value as "cover" })}
        >
          <option value="cover">Remplir le cadre</option>
          <option value="contain">Conserver l’image entière</option>
        </select>
      </label>
      <label>
        Durée cible{" "}
        <div className="duration-setting">
          <input
            type="range"
            min="10"
            max="120"
            step="5"
            value={s.targetDuration}
            onChange={(e) =>
              set({ ...s, targetDuration: Number(e.target.value) })
            }
          />
          <output>{s.targetDuration} s</output>
        </div>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={s.sourceAudio}
          onChange={(e) => set({ ...s, sourceAudio: e.target.checked })}
        />{" "}
        Garder le son des vidéos importées
      </label>
      <p className="form-note">
        La durée finale dépend de vos plans et de vos sons. Changer la cadence
        conserve les points de coupe au plus près.
      </p>
      <button className="gold-button" disabled={busy || !title.trim()}>
        Enregistrer
      </button>
    </form>
  );
}
