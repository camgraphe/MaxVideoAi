import { useRef } from "react";
import type { Clip } from "../../shared/types";
import { trimGesture } from "../../shared/gestures";
export function ClipTrimHandles({
  clip,
  sourceFrames,
  fps,
  zoom,
  revision,
  onDraft,
  onCommit,
  onCancel,
}: {
  clip: Clip;
  sourceFrames: number;
  fps: number;
  zoom: number;
  revision: number;
  onDraft: (c: Clip, r: number, edge: "inFrame" | "outFrame") => void;
  onCommit: (c: Clip, r: number, edge: "inFrame" | "outFrame") => void;
  onCancel: () => void;
}) {
  const gesture = useRef<
    | {
        clip: Clip;
        next: Clip;
        edge: "inFrame" | "outFrame";
        x: number;
        revision: number;
      }
    | undefined
  >(undefined);
  return (
    <>
      {(["inFrame", "outFrame"] as const).map((edge) => (
        <span
          key={edge}
          className={"clip-trim " + (edge === "inFrame" ? "start" : "end")}
          role="slider"
          tabIndex={0}
          aria-label={
            edge === "inFrame"
              ? "Glisser le début du plan"
              : "Glisser la fin du plan"
          }
          aria-valuemin={edge === "inFrame" ? 0 : clip.inFrame + fps}
          aria-valuemax={
            edge === "inFrame" ? clip.outFrame - fps : sourceFrames
          }
          aria-valuenow={clip[edge]}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            gesture.current = {
              clip: { ...clip },
              next: { ...clip },
              edge,
              x: e.clientX,
              revision,
            };
          }}
          onPointerMove={(e) => {
            const g = gesture.current;
            if (!g) return;
            g.next = trimGesture(
              g.clip,
              g.edge,
              ((e.clientX - g.x) / zoom) * fps,
              sourceFrames,
              fps,
            );
            onDraft(g.next, g.revision, g.edge);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            const g = gesture.current;
            if (g) {
              onCommit(g.next, g.revision, g.edge);
              gesture.current = undefined;
            }
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            gesture.current = undefined;
            onCancel();
          }}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
              e.preventDefault();
              e.stopPropagation();
              const next = trimGesture(
                clip,
                edge,
                e.key === "ArrowLeft" ? -1 : 1,
                sourceFrames,
                fps,
              );
              onCommit(next, revision, edge);
            }
          }}
        />
      ))}
    </>
  );
}
