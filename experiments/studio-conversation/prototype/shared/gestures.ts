import type { Clip } from "./types";
export function trimGesture(
  clip: Clip,
  edge: "inFrame" | "outFrame",
  delta: number,
  sourceFrames: number,
  fps: number,
): Clip {
  const next = { ...clip },
    value = clip[edge] + Math.round(delta);
  next[edge] =
    edge === "inFrame"
      ? Math.max(0, Math.min(clip.outFrame - fps, value))
      : Math.max(clip.inFrame + fps, Math.min(sourceFrames, value));
  return next;
}
