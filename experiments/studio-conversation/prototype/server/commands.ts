import type { CommandRequest, CommandResult, Job } from "../shared/types";
import { createHash } from "node:crypto";
import {
  editSequence,
  isEdit,
  sequence,
  sequenceDuration,
  StudioError,
} from "../shared/timeline";
import { ProjectStore } from "./store";
export class CommandService {
  constructor(public store: ProjectStore) {}
  async execute(id: string, request: CommandRequest): Promise<CommandResult> {
    if (
      !request ||
      typeof request.requestId !== "string" ||
      !request.requestId ||
      request.requestId.length > 120 ||
      !request.command ||
      typeof request.command.type !== "string"
    )
      throw new StudioError("Commande invalide.");
    const hash = createHash("sha256")
      .update(
        JSON.stringify({
          command: request.command,
          expectedRevision: request.expectedRevision,
        }),
      )
      .digest("hex");
    let jobId: string | undefined,
      replayed = false;
    const project = await this.store.update(id, (p) => {
      const receipt = p.receipts[request.requestId];
      if (receipt) {
        if (receipt.hash !== hash)
          throw new StudioError(
            "Cet identifiant a déjà été utilisé avec une autre commande.",
            409,
          );
        jobId = receipt.jobId;
        replayed = true;
        return p;
      }
      const c = request.command;
      if (isEdit(c)) {
        if (request.expectedRevision !== p.revision)
          throw new StudioError(
            "La révision a changé. Le projet a été rechargé ; réessayez votre geste.",
            409,
          );
        p = editSequence(p, c);
      } else if (c.type === "cancel" || c.type === "retry") {
        const job = p.jobs.find((j) => j.id === c.jobId);
        if (!job) throw new StudioError("Tâche introuvable.");
        if (c.type === "cancel") {
          if (job.state === "ready")
            throw new StudioError("Cette tâche est déjà terminée.");
          job.state = "cancelled";
        } else {
          if (!["failed", "cancelled"].includes(job.state))
            throw new StudioError("Cette tâche ne peut pas être réessayée.");
          job.state = "queued";
          job.progress = 0;
          delete job.error;
        }
        jobId = job.id;
      } else {
        let count = 1,
          label = "";
        switch (c.type) {
          case "images":
            count = c.count ?? 3;
            if (
              !Number.isInteger(count) ||
              count < 1 ||
              count > 4 ||
              (c.prompt?.length ?? 0) > 2000
            )
              throw new StudioError("Demandez 1 à 4 images.");
            if (c.buildFilm) count *= 2;
            label = c.buildFilm
              ? "Préparation du film · démonstration"
              : "Visuels de démonstration";
            break;
          case "animate":
            if (
              !p.assets.some((a) => a.id === c.assetId && a.kind === "image") ||
              !Number.isFinite(c.duration) ||
              c.duration < 1 ||
              c.duration > 30 ||
              !["gentle", "pan", "still"].includes(c.motion)
            )
              throw new StudioError("Animation invalide (1 à 30 secondes).");
            label = "Animation locale";
            break;
          case "voice":
            if (
              typeof c.text !== "string" ||
              !c.text.trim() ||
              c.text.length > 2000
            )
              throw new StudioError(
                "La voix nécessite un texte de 1 à 2 000 caractères.",
              );
            label = "Voix française locale";
            break;
          case "music":
            if (
              !Number.isFinite(c.duration) ||
              c.duration < 1 ||
              c.duration > 120
            )
              throw new StudioError("Durée audio invalide.");
            label = "Ambiance sonore locale";
            break;
          case "export":
            if (!p.clips.length)
              throw new StudioError(
                "Ajoutez un plan ou un son avant d’exporter.",
              );
            if (sequenceDuration(p) > 600)
              throw new StudioError("Le prototype exporte jusqu’à 10 minutes.");
            label = p.clips.some((c) => c.track === "video")
              ? "Rendu du film"
              : "Rendu audio";
            break;
          default:
            throw new StudioError("Commande inconnue.");
        }
        jobId = crypto.randomUUID();
        const job: Job = {
          id: jobId,
          kind: c.type,
          state: "queued",
          progress: 0,
          label,
          outputIds: Array.from({ length: count }, () => crypto.randomUUID()),
          params: {
            ...c,
            baseRevision: p.revision,
            fps: p.settings.fps,
            targetDuration: p.settings.targetDuration,
          },
          createdAt: new Date().toISOString(),
        };
        if (c.type === "export")
          job.snapshot = {
            ...sequence(p),
            assets: structuredClone(p.assets),
            title: p.title,
            revision: p.revision,
          };
        p.jobs.push(job);
        p.messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          text: label + " · traitement local",
          jobId,
          createdAt: new Date().toISOString(),
        });
      }
      p.receipts[request.requestId] = { hash, revision: p.revision, jobId };
      return p;
    });
    return { project, jobId, replayed };
  }
}
