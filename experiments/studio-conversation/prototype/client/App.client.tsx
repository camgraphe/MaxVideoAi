import { useEffect, useRef, useState } from "react";
import {
  Images,
  X,
  LoaderCircle,
  Plus,
  Clapperboard,
  Replace,
} from "lucide-react";
import { Shell, type Panel } from "./components/Shell.client";
import { Chat } from "./components/Chat.client";
import { MediaCanvas } from "./components/MediaCanvas.client";
import { Timeline } from "./components/Timeline.client";
import { ProgramPreview } from "./components/ProgramPreview.client";
import { Dialogs } from "./components/Dialogs.client";
import { useStudio } from "./hooks/useStudio";
import { usePlayback } from "./hooks/usePlayback";
import { sequenceDuration, videoStart } from "../shared/timeline";
import type { Asset, Clip } from "../shared/types";
export function App() {
  const studio = useStudio(),
    p = studio.project;
  const [panel, setPanel] = useState<Panel>(null),
    [selectedAsset, setSelectedAsset] = useState<string>(),
    [selectedClip, setSelectedClip] = useState<string>(),
    [monitor, setMonitor] = useState(false),
    [mode, setMode] = useState<"program" | "asset">("asset"),
    [references, setReferences] = useState<string[]>([]),
    [pinned, setPinned] = useState<string[]>(() => {
      try {
        return JSON.parse(localStorage.getItem("studio-pins") ?? "[]");
      } catch {
        return [];
      }
    });
  const [trimPreview, setTrimPreview] = useState<Clip>();
  const file = useRef<HTMLInputElement>(null),
    playback = usePlayback(p ? sequenceDuration(p) : 0);
  useEffect(() => {
    setSelectedAsset(undefined);
    setSelectedClip(undefined);
    setReferences([]);
    setMonitor(false);
    playback.setPlaying(false);
    playback.seek(0);
  }, [p?.id]);
  useEffect(() => {
    localStorage.setItem("studio-pins", JSON.stringify(pinned));
  }, [pinned]);
  const select = (a: Asset) => {
    setSelectedAsset(a.id);
    setMode("asset");
    setMonitor(true);
    playback.setPlaying(false);
  };
  const selectClip = (c: Clip) => {
    setSelectedClip(c.id);
    setSelectedAsset(c.assetId);
    setMode("program");
    setMonitor(true);
    playback.setPlaying(false);
    if (p)
      playback.seek(
        (c.track === "video" ? videoStart(p.clips, c.id) : c.startFrame) /
          p.settings.fps,
      );
  };
  const reference = (a: Asset) => {
    setReferences((ids) => (ids.includes(a.id) ? ids : [...ids, a.id]));
  };
  const add = (a: Asset, track?: "voice" | "music") =>
    void studio.command({
      type: "insert",
      assetId: a.id,
      track:
        a.kind === "audio"
          ? (track ??
            (p?.jobs.some(
              (j) => j.kind === "music" && j.outputIds.includes(a.id),
            )
              ? "music"
              : "voice"))
          : "video",
    });
  const upload = () => file.current?.click();
  const asset = p?.assets.find((a) => a.id === selectedAsset);
  const closeMonitor = () => {
    setMonitor(false);
    playback.setPlaying(false);
  };
  const preview =
    p && monitor ? (
      <div className="monitor-dock">
        <ProgramPreview
          project={
            trimPreview
              ? {
                  ...p,
                  clips: p.clips.map((c) =>
                    c.id === trimPreview.id ? trimPreview : c,
                  ),
                }
              : p
          }
          asset={asset}
          mode={mode}
          playback={playback}
          onClose={closeMonitor}
        />
        {mode === "asset" && asset && (
          <div className="monitor-actions">
            <button onClick={() => reference(asset)}>
              <Plus size={14} /> Référence
            </button>
            {asset.kind === "image" ? (
              <button
                onClick={() =>
                  void studio.command({
                    type: "animate",
                    assetId: asset.id,
                    duration: 8,
                    motion: "gentle",
                  })
                }
              >
                <Clapperboard size={14} /> Animer
              </button>
            ) : (
              <button onClick={() => add(asset)}>
                <Plus size={14} /> Montage
              </button>
            )}
            {asset.kind === "video" && selectedClip && (
              <button
                onClick={() =>
                  void studio.command({
                    type: "replace",
                    clipId: selectedClip,
                    assetId: asset.id,
                  })
                }
              >
                <Replace size={14} /> Remplacer
              </button>
            )}
          </div>
        )}
      </div>
    ) : undefined;
  return (
    <Shell
      project={p}
      panel={panel}
      onPanel={setPanel}
      onNew={() => {
        void studio.list();
        setPanel("projects");
      }}
    >
      <input
        type="file"
        multiple
        hidden
        accept="image/*,video/*,audio/*"
        ref={file}
        onChange={(e) => {
          if (e.target.files) void studio.upload(e.target.files);
          e.target.value = "";
        }}
      />
      {p ? (
        <>
          <div className="studio-stage">
            <MediaCanvas
              project={p}
              selected={selectedAsset}
              pinned={pinned}
              onSelect={select}
              onPin={(id) =>
                setPinned((ids) =>
                  ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
                )
              }
              onReference={reference}
              monitor={preview}
            />
            <Chat
              project={p}
              busy={studio.busy}
              references={p.assets.filter((a) => references.includes(a.id))}
              onSend={(text) => {
                void studio.chat(text, {
                  clipId: selectedClip,
                  assetIds: references,
                });
                setReferences([]);
              }}
              onUpload={upload}
              onSelect={select}
              onAdd={add}
              onCommand={(c) => void studio.command(c)}
              onRemoveReference={(id) =>
                setReferences((ids) => ids.filter((i) => i !== id))
              }
            />
            <button
              className="library-peek"
              onClick={() => setPanel("library")}
            >
              <Images size={14} />
              {p.assets.length
                ? "Tous les médias · " + p.assets.length
                : "Vos références"}
            </button>
          </div>
          <Timeline
            project={p}
            playback={playback}
            selected={selectedClip}
            onSelect={selectClip}
            onCommand={(c, r) => void studio.command(c, r)}
            onPlay={() => {
              setMode("program");
              setMonitor(true);
              playback.toggle();
            }}
            onLibrary={() => setPanel("library")}
            onDeselect={() => {
              setSelectedClip(undefined);
              setTrimPreview(undefined);
            }}
            onPreview={(c, edge) => {
              setTrimPreview(c);
              if (c && c.track === "video") {
                setMode("program");
                setMonitor(true);
                playback.setPlaying(false);
                playback.seek(
                  (videoStart(p.clips, c.id) +
                    (edge === "outFrame" ? c.outFrame - c.inFrame - 1 : 0)) /
                    p.settings.fps,
                );
              }
            }}
            busy={studio.busy}
          />
        </>
      ) : (
        <div className="boot-state">
          <LoaderCircle size={22} className="spin" />
          <p>Ouverture du Studio local…</p>
        </div>
      )}
      {studio.notice && (
        <div className="notice" role="alert">
          <span>{studio.notice}</span>
          <button
            className="icon-button"
            onClick={() => studio.setNotice("")}
            aria-label="Fermer le message"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {studio.busy && (
        <div className="working-indicator" role="status">
          <LoaderCircle size={13} className="spin" />{" "}
          {studio.busy ? "Enregistrement / traitement local…" : ""}
        </div>
      )}
      <Dialogs
        panel={panel}
        onClose={() => setPanel(null)}
        studio={studio}
        onSelect={select}
        onAdd={add}
        onReference={reference}
        onUpload={upload}
        selectedClip={selectedClip}
      />
    </Shell>
  );
}
