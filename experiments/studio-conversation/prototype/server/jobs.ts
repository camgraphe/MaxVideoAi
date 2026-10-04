import { editSequence } from "../shared/timeline";
import { ProjectStore } from "./store";
import type { Asset, Job, Project } from "../shared/types";
export type Work = (
  project: Project,
  job: Job,
  signal: AbortSignal,
  progress: (n: number) => void,
) => Promise<Asset[]>;
export class JobRunner {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active: Promise<boolean> | undefined;
  private controller: AbortController | undefined;
  private stopping = false;
  constructor(
    public store: ProjectStore,
    public work: Work,
  ) {}
  async recover() {
    for (const p of await this.store.list())
      if (p.jobs.some((j) => j.state === "running"))
        await this.store.update(p.id, (p) => {
          p.jobs.forEach((j) => {
            if (j.state === "running") {
              j.state = "queued";
              j.progress = 0;
            }
          });
          return p;
        });
  }
  async runOnce(): Promise<boolean> {
    if (this.active) return this.active;
    this.active = this.process();
    try {
      return await this.active;
    } finally {
      this.active = undefined;
    }
  }
  private async process(): Promise<boolean> {
    const projects = await this.store.list();
    const project = projects.find((p) =>
      p.jobs.some((j) => j.state === "queued"),
    );
    if (!project) return false;
    const job = project.jobs.find((j) => j.state === "queued")!;
    const controller = new AbortController();
    this.controller = controller;
    const p = await this.store.update(project.id, (p) => {
      const j = p.jobs.find((j) => j.id === job.id)!;
      if (j.state === "queued") j.state = "running";
      return p;
    });
    if (p.jobs.find((j) => j.id === job.id)?.state !== "running") return true;
    let last = 0;
    const cancelWatch = setInterval(() => {
      void this.store
        .get(p.id)
        .then((p) => {
          if (p.jobs.find((j) => j.id === job.id)?.state === "cancelled")
            controller.abort();
        })
        .catch(() => controller.abort());
    }, 150);
    try {
      const assets = await this.work(p, job, controller.signal, (n) => {
        if (Date.now() - last < 250) return;
        last = Date.now();
        void this.store
          .update(p.id, (p) => {
            const j = p.jobs.find((j) => j.id === job.id)!;
            if (j.state === "running")
              j.progress = Math.max(j.progress, Math.min(0.99, n));
            return p;
          })
          .catch(() => {});
      });
      await this.store.update(p.id, (p) => {
        const j = p.jobs.find((j) => j.id === job.id)!;
        if (j.state !== "running" || controller.signal.aborted) return p;
        j.state = "ready";
        j.progress = 1;
        for (const asset of assets)
          if (!p.assets.some((a) => a.id === asset.id)) p.assets.push(asset);
        if (j.params.buildFilm) {
          const videos = assets.filter((a) => a.kind === "video");
          if (p.revision === j.params.baseRevision && videos.length)
            p = editSequence(p, {
              type: "assemble",
              assetIds: videos.map((a) => a.id),
            });
          else
            p.messages.push({
              id: crypto.randomUUID(),
              role: "assistant",
              text: "Les plans sont prêts. Votre montage a changé pendant la création : je vous laisse décider où les ajouter.",
              createdAt: new Date().toISOString(),
            });
        }
        const message = p.messages.find((m) => m.jobId === j.id);
        if (message) {
          message.text =
            j.kind === "export"
              ? "Votre rendu est prêt."
              : j.kind === "images"
                ? "Une première direction autour de l’eau, du verre et de la lumière."
                : j.kind === "voice"
                  ? "La voix est prête. Vous pouvez l’écouter ici."
                  : j.kind === "music"
                    ? "L’ambiance sonore est prête."
                    : "Le plan animé est prêt.";
          message.assets = assets.map((a) => a.id);
        }
        return p;
      });
    } catch (e) {
      await this.store.update(p.id, (p) => {
        const j = p.jobs.find((j) => j.id === job.id)!;
        if (j.state === "running") {
          j.state = this.stopping
            ? "queued"
            : controller.signal.aborted
              ? "cancelled"
              : "failed";
          j.error = e instanceof Error ? e.message : "Le traitement a échoué.";
        }
        return p;
      });
    } finally {
      clearInterval(cancelWatch);
      this.controller = undefined;
    }
    return true;
  }
  start() {
    this.stopping = false;
    const tick = async () => {
      if (this.stopping) return;
      try {
        await this.runOnce();
      } catch (e) {
        console.error("Local worker:", e);
      }
      if (!this.stopping) this.timer = setTimeout(tick, 250);
    };
    void tick();
  }
  async stop() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    this.controller?.abort();
    await this.active;
  }
}
