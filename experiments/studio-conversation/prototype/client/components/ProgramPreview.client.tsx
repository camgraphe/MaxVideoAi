import { useEffect, useRef } from "react";
import { X, Play, Pause, Clapperboard, AudioLines } from "lucide-react";
import type { Asset, Clip, Project } from "../../shared/types";
import { synchronizeTimelineAudio } from "../mediaPlayback";
import type { Playback } from "../hooks/usePlayback";
import { mediaUrl } from "../hooks/useStudio";
import { videoStart, sequenceDuration } from "../../shared/timeline";
function ProgramVideo({
  project,
  clip,
  time,
  playing,
  buffering,
}: {
  project: Project;
  clip: Clip;
  time: number;
  playing: boolean;
  buffering: (v: boolean) => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    a = project.assets.find((a) => a.id === clip.assetId)!;
  const end = clip.outFrame / project.settings.fps - 1 / project.settings.fps,
    local = Math.min(
      end,
      clip.inFrame / project.settings.fps +
        time -
        videoStart(project.clips, clip.id) / project.settings.fps,
    );
  const advancing =
    time <
    (videoStart(project.clips, clip.id) + clip.outFrame - clip.inFrame) /
      project.settings.fps;
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (v.readyState >= 1 && Math.abs(v.currentTime - local) > 0.18)
      v.currentTime = Math.min(a.duration - 0.001, Math.max(0, local));
    v.volume = project.settings.sourceAudio ? clip.volume : 0;
    if (playing && advancing) void v.play().catch(() => {});
    else v.pause();
  }, [
    local,
    playing,
    advancing,
    clip.volume,
    project.settings.sourceAudio,
    a.duration,
  ]);
  return (
    <video
      ref={video}
      src={mediaUrl(project.id, a.id)}
      poster={mediaUrl(project.id, a.id, "poster")}
      preload="auto"
      playsInline
      onWaiting={() => buffering(true)}
      onCanPlay={() => buffering(false)}
      onLoadedMetadata={() => {
        if (video.current) video.current.currentTime = Math.max(0, local);
        buffering(false);
      }}
      style={{
        objectFit: project.settings.fit === "cover" ? "cover" : "contain",
      }}
      aria-label={"Montage · " + a.name}
    />
  );
}
function AudioTrack({
  project,
  clip,
  playback,
}: {
  project: Project;
  clip: Clip;
  playback: Playback;
}) {
  const ref = useRef<HTMLAudioElement>(null),
    a = project.assets.find((a) => a.id === clip.assetId)!;
  const local = playback.time - clip.startFrame / project.settings.fps,
    active =
      local >= 0 &&
      local < (clip.outFrame - clip.inFrame) / project.settings.fps;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    synchronizeTimelineAudio(el, project, clip, playback);
  }, [
    active,
    local,
    clip.inFrame,
    clip.volume,
    playback.playing,
    playback.buffering,
    project.settings.fps,
  ]);
  return (
    <audio
      ref={ref}
      preload="auto"
      src={mediaUrl(project.id, a.id)}
      onLoadedMetadata={() => {
        if (ref.current)
          ref.current.currentTime =
            clip.inFrame / project.settings.fps + Math.max(0, local);
      }}
    />
  );
}
export function ProgramPreview({
  project,
  asset,
  mode,
  playback,
  onClose,
}: {
  project: Project;
  asset?: Asset;
  mode: "program" | "asset";
  playback: Playback;
  onClose: () => void;
}) {
  const videoClips = project.clips.filter((c) => c.track === "video");
  const active =
      project.clips.find(
        (c) =>
          c.track === "video" &&
          playback.time >=
            videoStart(project.clips, c.id) / project.settings.fps &&
          playback.time <
            (videoStart(project.clips, c.id) + c.outFrame - c.inFrame) /
              project.settings.fps,
      ) ?? videoClips.at(-1),
    duration = sequenceDuration(project);
  return (
    <section className="monitor" aria-label="Petit moniteur">
      <div className="monitor-heading">
        <Clapperboard size={14} />
        <span>{mode === "program" ? "Votre montage" : asset?.name}</span>
        <button
          className="icon-button"
          aria-label="Fermer le moniteur"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>
      <div
        className={
          "monitor-screen " +
          (mode === "asset" && asset?.kind === "audio" ? "audio-screen" : "")
        }
        style={
          mode === "program"
            ? {
                aspectRatio: project.settings.ratio.replace(":", " / "),
                width:
                  project.settings.ratio === "9:16"
                    ? "min(100%, 20vh)"
                    : project.settings.ratio === "1:1"
                      ? "min(100%, 32vh)"
                      : undefined,
                marginInline: "auto",
              }
            : undefined
        }
      >
        {mode === "program" ? (
          active ? (
            <ProgramVideo
              key={active.id + active.assetId}
              project={project}
              clip={active}
              time={playback.time}
              playing={playback.playing}
              buffering={playback.setBuffering}
            />
          ) : (
            <div className="audio-program">
              <AudioLines size={42} />
              <span>
                {project.clips.length
                  ? "Votre création sonore"
                  : "Votre montage apparaîtra ici"}
              </span>
            </div>
          )
        ) : asset?.kind === "image" ? (
          <img src={mediaUrl(project.id, asset.id)} alt={asset.name} />
        ) : asset?.kind === "video" ? (
          <video
            controls
            playsInline
            preload="metadata"
            src={mediaUrl(project.id, asset.id)}
            poster={mediaUrl(project.id, asset.id, "poster")}
          />
        ) : (
          asset && (
            <>
              <AudioLines size={36} />
              <audio
                controls
                src={mediaUrl(project.id, asset.id)}
                preload="metadata"
              />
            </>
          )
        )}
      </div>
      {mode === "program" && (
        <>
          <div className="monitor-controls">
            <button
              className="icon-button"
              disabled={!duration}
              onClick={playback.toggle}
              aria-label={
                playback.playing ? "Mettre en pause" : "Lire le montage"
              }
            >
              {playback.playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <input
              type="range"
              min="0"
              max={duration || 1}
              step={1 / project.settings.fps}
              value={playback.time}
              onChange={(e) => playback.seek(Number(e.target.value))}
              aria-label="Position de lecture"
            />
            <span>
              {playback.time.toFixed(1)} / {duration.toFixed(1)} s
            </span>
          </div>
          {project.clips
            .filter((c) => c.track !== "video")
            .map((c) => (
              <AudioTrack
                key={c.id}
                project={project}
                clip={c}
                playback={playback}
              />
            ))}
        </>
      )}
    </section>
  );
}
