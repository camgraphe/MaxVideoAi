import type { Clip, Project } from "../shared/types";
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
