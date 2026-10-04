import type { Clip, Project } from "../shared/types";
import { videoStart } from "../shared/timeline";
import type { Playback } from "./hooks/usePlayback";
export function synchronizeTimelineAudio(
  el: Pick<
    HTMLAudioElement,
    "readyState" | "currentTime" | "volume" | "play" | "pause"
  >,
  project: Pick<Project, "settings">,
  clip: Clip,
  playback: Pick<Playback, "time" | "playing" | "buffering">,
) {
  const local = playback.time - clip.startFrame / project.settings.fps;
  const active =
    local >= 0 && local < (clip.outFrame - clip.inFrame) / project.settings.fps;
  const source = clip.inFrame / project.settings.fps + Math.max(0, local);
  if (el.readyState >= 1 && Math.abs(el.currentTime - source) > 0.18)
    el.currentTime = source;
  el.volume = clip.volume;
  if (playback.playing && !playback.buffering && active)
    void el.play().catch(() => {});
  else el.pause();
}

export function timelineVideoPosition(
  project: Pick<Project, "settings" | "clips">,
  clip: Clip,
  time: number,
) {
  const fps = project.settings.fps;
  const start = videoStart(project.clips, clip.id) / fps;
  return {
    source: Math.max(
      0,
      Math.min((clip.outFrame - 1) / fps, clip.inFrame / fps + time - start),
    ),
    advancing: time < start + (clip.outFrame - clip.inFrame) / fps,
  };
}
export function synchronizeTimelineVideo(
  el: Pick<
    HTMLVideoElement,
    "readyState" | "currentTime" | "volume" | "play" | "pause"
  >,
  project: Pick<Project, "settings" | "clips" | "assets">,
  clip: Clip,
  time: number,
  playing: boolean,
) {
  const a = project.assets.find((a) => a.id === clip.assetId)!;
  const { source, advancing } = timelineVideoPosition(project, clip, time);
  if (
    el.readyState >= 1 &&
    Math.abs(el.currentTime - source) > (playing && advancing ? 0.18 : 0.001)
  )
    el.currentTime = Math.min(a.duration - 0.001, source);
  el.volume = project.settings.sourceAudio ? clip.volume : 0;
  if (playing && advancing) void el.play().catch(() => {});
  else el.pause();
}
