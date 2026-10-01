import type { Project, Command, Clip, Sequence } from "./types";
import {
  secondsToTimelineFrame,
  timelineFrameToSeconds,
  MIN_CLIP_DURATION_SEC,
} from "./frames";
export { secondsToTimelineFrame, timelineFrameToSeconds };
export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function videoStart(clips: Clip[], id: string): number {
  let frame = 0;
  for (const clip of clips.filter((c) => c.track === "video")) {
    if (clip.id === id) return frame;
    frame += clip.outFrame - clip.inFrame;
  }
  return frame;
}
export function sequenceDuration(
  p: Pick<Project, "clips" | "settings">,
): number {
  const video = p.clips
    .filter((c) => c.track === "video")
    .reduce((n, c) => n + c.outFrame - c.inFrame, 0);
  return timelineFrameToSeconds(
    Math.max(
      video,
      ...p.clips
        .filter((c) => c.track !== "video")
        .map((c) => c.startFrame + c.outFrame - c.inFrame),
      0,
    ),
    p.settings.fps,
  );
}
export const isEdit = (c: Command) =>
  [
    "settings",
    "insert",
    "replace",
    "trim",
    "move",
    "volume",
    "remove",
    "assemble",
    "undo",
    "redo",
  ].includes(c.type);
export const sequence = (p: Project): Sequence =>
  structuredClone({ clips: p.clips, settings: p.settings });
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
function validate(p: Project) {
  const s = p.settings;
  if (
    ![24, 30].includes(s.fps) ||
    !["16:9", "9:16", "1:1"].includes(s.ratio) ||
    ![720, 1080].includes(s.resolution) ||
    !["cover", "contain"].includes(s.fit) ||
    typeof s.sourceAudio !== "boolean" ||
    !Number.isFinite(s.targetDuration) ||
    s.targetDuration < 10 ||
    s.targetDuration > 120
  )
    throw new StudioError("Paramètres de sortie invalides.");
  if (p.clips.filter((c) => c.track === "video").length > 12)
    throw new StudioError("Le montage accepte jusqu’à 12 plans.");
  if (p.clips.length > 36)
    throw new StudioError("Le montage accepte jusqu’à 36 éléments.");
  for (const c of p.clips) {
    const asset = p.assets.find((a) => a.id === c.assetId);
    if (
      !asset ||
      !["video", "voice", "music"].includes(c.track) ||
      !integer(c.inFrame) ||
      !integer(c.outFrame) ||
      !integer(c.startFrame) ||
      c.startFrame > s.fps * 600 ||
      c.outFrame - c.inFrame < s.fps * MIN_CLIP_DURATION_SEC ||
      c.outFrame > Math.floor(asset.duration * s.fps + 0.001) ||
      !Number.isFinite(c.volume) ||
      c.volume < 0 ||
      c.volume > 1
    )
      throw new StudioError(
        "Coupe invalide : au moins 1 seconde, dans les limites de la source.",
      );
    if (
      (c.track === "video" && asset.kind !== "video") ||
      (c.track !== "video" && asset.kind !== "audio")
    )
      throw new StudioError("Ce média ne correspond pas à cette piste.");
  }
  for (const track of ["voice", "music"]) {
    const sorted = p.clips
      .filter((c) => c.track === track)
      .sort((a, b) => a.startFrame - b.startFrame);
    if (
      sorted.some(
        (c, i) =>
          i > 0 &&
          c.startFrame <
            sorted[i - 1].startFrame +
              sorted[i - 1].outFrame -
              sorted[i - 1].inFrame,
      )
    )
      throw new StudioError(
        "Deux sons ne peuvent pas se chevaucher sur la même piste.",
      );
  }
}
export function editSequence(input: Project, command: Command): Project {
  const p = structuredClone(input),
    before = sequence(p);
  const find = (id: string) => {
    const c = p.clips.find((c) => c.id === id);
    if (!c) throw new StudioError("Plan introuvable.");
    return c;
  };
  const insert = (
    assetId: string,
    track: "video" | "voice" | "music" = "video",
    index?: number,
    startFrame = 0,
  ) => {
    const a = p.assets.find((a) => a.id === assetId);
    if (!a) throw new StudioError("Média introuvable.");
    const c: Clip = {
      id: crypto.randomUUID(),
      assetId,
      track,
      inFrame: 0,
      outFrame: Math.floor(a.duration * p.settings.fps),
      startFrame,
      volume: track === "music" ? 0.25 : 1,
    };
    const videos = p.clips.filter((c) => c.track === "video");
    if (index !== undefined && (!integer(index) || index > videos.length))
      throw new StudioError("Position invalide.");
    if (track === "video" && index !== undefined && index < videos.length)
      p.clips.splice(p.clips.indexOf(videos[index]), 0, c);
    else p.clips.push(c);
  };
  switch (command.type) {
    case "settings": {
      const old = p.settings.fps;
      p.settings = { ...p.settings, ...command.settings };
      if (old !== p.settings.fps)
        for (const c of p.clips)
          for (const key of ["inFrame", "outFrame", "startFrame"] as const)
            c[key] = secondsToTimelineFrame(c[key] / old, p.settings.fps);
      if (command.title !== undefined) {
        if (!command.title.trim() || command.title.length > 120)
          throw new StudioError("Le titre doit contenir 1 à 120 caractères.");
        p.title = command.title.trim();
      }
      break;
    }
    case "insert":
      insert(command.assetId, command.track, command.index, command.startFrame);
      break;
    case "replace": {
      const c = find(command.clipId),
        a = p.assets.find((a) => a.id === command.assetId);
      if (!a) throw new StudioError("Média introuvable.");
      const length = c.outFrame - c.inFrame;
      c.assetId = a.id;
      c.inFrame = 0;
      c.outFrame = Math.min(length, Math.floor(a.duration * p.settings.fps));
      break;
    }
    case "trim":
      Object.assign(find(command.clipId), {
        inFrame: command.inFrame,
        outFrame: command.outFrame,
      });
      break;
    case "volume":
      find(command.clipId).volume = command.volume;
      break;
    case "move": {
      const c = find(command.clipId);
      if (c.track !== "video") {
        if (command.startFrame === undefined)
          throw new StudioError("Position audio requise.");
        c.startFrame = command.startFrame;
        break;
      }
      const videos = p.clips.filter((c) => c.track === "video");
      if (
        command.index === undefined ||
        !integer(command.index) ||
        command.index >= videos.length
      )
        throw new StudioError("Position invalide.");
      const order = videos.filter((v) => v.id !== c.id);
      order.splice(command.index, 0, c);
      p.clips = [...order, ...p.clips.filter((v) => v.track !== "video")];
      break;
    }
    case "remove":
      find(command.clipId);
      p.clips = p.clips.filter((c) => c.id !== command.clipId);
      break;
    case "assemble":
      if (!Array.isArray(command.assetIds) || !command.assetIds.length)
        throw new StudioError("Choisissez au moins un plan.");
      p.clips = p.clips.filter((c) => c.track !== "video");
      command.assetIds.forEach((id) => insert(id));
      break;
    case "undo":
    case "redo": {
      const from = command.type === "undo" ? p.undo : p.redo,
        to = command.type === "undo" ? p.redo : p.undo,
        last = from.pop();
      if (!last) throw new StudioError("Aucune modification à annuler.");
      to.push(before);
      Object.assign(p, last);
      validate(p);
      p.revision++;
      return p;
    }
    default:
      throw new StudioError("Commande d’édition inconnue.");
  }
  validate(p);
  p.undo.push(before);
  p.undo = p.undo.slice(-100);
  p.redo = [];
  p.revision++;
  return p;
}
