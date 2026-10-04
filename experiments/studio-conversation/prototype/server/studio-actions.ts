import type { Command, Project } from "../shared/types";
import { StudioError, videoStart } from "../shared/timeline";
import { CommandService } from "./commands";
import { MediaLibraryService } from "./library";
import { waitForJob } from "./job-wait";

const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const string = { type: "string" },
  integer = { type: "integer", minimum: 0 };
const optional = (s: object) => ({ anyOf: [s, { type: "null" }] });
const choice = (values: (string | number)[]) => ({
  type: typeof values[0] === "string" ? "string" : "integer",
  enum: values,
});
const command = (type: string, fields: Record<string, unknown> = {}) =>
  object({ type: { type: "string", enum: [type] }, ...fields });
const settings = object({
  ratio: optional(choice(["16:9", "9:16", "1:1"])),
  resolution: optional(choice([720, 1080])),
  fps: optional(choice([24, 30])),
  fit: optional(choice(["cover", "contain"])),
  sourceAudio: optional({ type: "boolean" }),
  targetDuration: optional({ type: "number", minimum: 10, maximum: 120 }),
});
const edits = [
  command("settings", { settings, title: optional(string) }),
  command("insert", {
    assetId: string,
    track: optional(choice(["video", "voice", "music"])),
    index: optional(integer),
    startFrame: optional(integer),
  }),
  command("replace", { clipId: string, assetId: string }),
  command("trim", { clipId: string, inFrame: integer, outFrame: integer }),
  command("move", {
    clipId: string,
    index: optional(integer),
    startFrame: optional(integer),
  }),
  command("volume", {
    clipId: string,
    volume: { type: "number", minimum: 0, maximum: 2 },
  }),
  command("remove", { clipId: string }),
  command("assemble", {
    assetIds: { type: "array", items: string, maxItems: 12 },
  }),
  command("undo"),
  command("redo"),
];
const generations = [
  command("images", {
    count: { type: "integer", minimum: 1, maximum: 4 },
    prompt: { type: "string", maxLength: 2000 },
    buildFilm: { type: "boolean" },
  }),
  command("animate", {
    assetId: string,
    duration: { type: "number", minimum: 1, maximum: 30 },
    motion: choice(["gentle", "pan", "still"]),
  }),
  command("voice", { text: { type: "string", minLength: 1, maxLength: 2000 } }),
  command("music", { duration: { type: "number", minimum: 1, maximum: 120 } }),
];
const tool = (
  name: string,
  description: string,
  parameters: ReturnType<typeof object>,
  label: string,
) => ({ name, description, parameters, label });
export const actionTools = [
  tool(
    "studio_project",
    "Read the current canonical project, revision, assets, clips and asynchronous jobs. No filesystem paths.",
    object({}),
    "Lecture du montage…",
  ),
  tool(
    "studio_library",
    "Search media across this local library. Read-only. Returned IDs belong to their source project; adopt them before editing. Pages contain 30 media.",
    object({
      search: optional(string),
      kind: optional(choice(["image", "video", "audio"])),
      page: integer,
    }),
    "Recherche dans la bibliothèque…",
  ),
  tool(
    "studio_use_media",
    "Adopt a media into the current project without modifying its source. Returns its new owned asset ID; does not insert it in the timeline.",
    object({ sourceProjectId: string, assetId: string }),
    "Ajout d’une référence…",
  ),
  tool(
    "studio_edit",
    "Edit the current montage using its expectedRevision. Integer sequence frames at project fps, source outFrame exclusive, trim minimum 1 second. Video order uses zero-based index; audio position uses startFrame. Read current project after a conflict; never overwrite a manual edit. Set unused optional fields to null.",
    object({ expectedRevision: integer, command: { anyOf: edits } }),
    "Modification du montage…",
  ),
  tool(
    "studio_generate",
    "Queue LOCAL tasks only. Images use the fixed perfume demo set regardless of prompt (say this explicitly). buildFilm creates demo animations and auto-assembly. Animate uses FFmpeg on an owned image; voice uses French macOS speech; music is synthetic ambience. These are NOT paid AI media models. When the user's request includes dependent editing/rendering, use studio_wait on the returned job ID before continuing. Never claim completion until ready.",
    object({ command: { anyOf: generations } }),
    "Préparation des médias…",
  ),
  tool(
    "studio_render",
    "Queue a real MP4 or audio-only MP3 render from an immutable snapshot. Use studio_wait for its result when the user requests a completed film. No publishing.",
    object({}),
    "Lancement du rendu…",
  ),
  tool(
    "studio_wait",
    "Wait for an owned local job before dependent editing or rendering. Returns canonical outputs and ready/failed/cancelled, or timedOut after at most 60 seconds. This waits on worker state without model polling or resubmission. If timedOut, explain pending work and finish this exchange; do not wait repeatedly. If revisionChanged, preserve manual edits and ask for a new instruction before editing/rendering.",
    object({ jobId: string }),
    "Création en cours…",
  ),
  tool(
    "studio_job",
    "Cancel a local job or retry a failed/cancelled job.",
    object({ action: choice(["cancel", "retry"]), jobId: string }),
    "Mise à jour de la tâche…",
  ),
];
export function projectView(p: Project) {
  return {
    id: p.id,
    title: p.title,
    revision: p.revision,
    settings: p.settings,
    assets: p.assets.map(
      ({ id, name, kind, duration, width, height, hasAudio, origin }) => ({
        id,
        name,
        kind,
        duration,
        width,
        height,
        hasAudio,
        origin,
      }),
    ),
    clips: p.clips.map((c) => ({
      ...c,
      timelineStartFrame:
        c.track === "video" ? videoStart(p.clips, c.id) : c.startFrame,
    })),
    jobs: p.jobs.map(({ id, kind, state, progress, outputIds, error }) => ({
      id,
      kind,
      state,
      progress,
      outputIds,
      error,
    })),
  };
}
// Strict tool discovery helps the model; these runtime checks also protect MCP callers.
function validate(schema: any, value: any): boolean {
  if (schema.anyOf) return schema.anyOf.some((s: any) => validate(s, value));
  if (schema.enum && !schema.enum.includes(value)) return false;
  switch (schema.type) {
    case "null":
      return value === null;
    case "object":
      return (
        !!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        schema.required.every((k: string) => Object.hasOwn(value, k)) &&
        Object.keys(value).every(
          (k) =>
            schema.properties[k] && validate(schema.properties[k], value[k]),
        )
      );
    case "array":
      return (
        Array.isArray(value) &&
        value.length <= (schema.maxItems ?? Infinity) &&
        value.every((v) => validate(schema.items, v))
      );
    case "string":
      return (
        typeof value === "string" &&
        value.length >= (schema.minLength ?? 0) &&
        value.length <= (schema.maxLength ?? 4000)
      );
    case "integer":
      if (!Number.isSafeInteger(value)) return false;
    // fall through
    case "number":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= (schema.minimum ?? -Infinity) &&
        value <= (schema.maximum ?? Infinity)
      );
    case "boolean":
      return typeof value === "boolean";
    default:
      return false;
  }
}
function withoutNulls(value: any): any {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, withoutNulls(v)]),
    );
  return value;
}
export class StudioActions {
  constructor(
    public service: CommandService,
    public library: MediaLibraryService,
  ) {}
  async execute(
    projectId: string,
    requestId: string,
    name: string,
    args: unknown,
  ) {
    const definition = actionTools.find((t) => t.name === name);
    if (!definition || !validate(definition.parameters, args))
      throw new StudioError("Outil ou arguments invalides.");
    const a = withoutNulls(args);
    if (name === "studio_wait") {
      const result = await waitForJob(this.service.store, projectId, a.jobId);
      return {
        project: projectView(result.project),
        job: projectView(result.project).jobs.find((j) => j.id === a.jobId),
        timedOut: result.timedOut,
        revisionChanged: result.revisionChanged,
      };
    }
    if (name === "studio_project")
      return { project: projectView(await this.service.store.get(projectId)) };
    if (name === "studio_library") {
      const search = (a.search ?? "").toLocaleLowerCase("fr");
      const all = (await this.library.list()).filter(
        (r) =>
          (!a.kind || r.asset.kind === a.kind) &&
          (r.asset.name + " " + r.projectTitle)
            .toLocaleLowerCase("fr")
            .includes(search),
      );
      const offset = a.page * 30;
      return {
        media: all.slice(offset, offset + 30).map((r) => ({
          sourceProjectId: r.projectId,
          projectTitle: r.projectTitle,
          ...projectView({
            assets: [r.asset],
            clips: [],
            jobs: [],
          } as unknown as Project).assets[0],
        })),
        nextPage: offset + 30 < all.length ? a.page + 1 : null,
      };
    }
    if (name === "studio_use_media") {
      const result = await this.library.use(
        projectId,
        a.sourceProjectId,
        a.assetId,
      );
      return { assetId: result.asset.id, project: projectView(result.project) };
    }
    const c: Command =
      name === "studio_render"
        ? { type: "export" }
        : name === "studio_job"
          ? { type: a.action, jobId: a.jobId }
          : a.command;
    const result = await this.service.execute(projectId, {
      requestId,
      expectedRevision: a.expectedRevision,
      command: c,
    });
    return {
      project: projectView(result.project),
      jobId: result.jobId,
      replayed: result.replayed,
    };
  }
}
