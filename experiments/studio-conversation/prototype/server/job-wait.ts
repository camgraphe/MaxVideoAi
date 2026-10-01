import { setTimeout as delay } from "node:timers/promises";
import { ProjectStore } from "./store";
import { StudioError } from "../shared/timeline";

// Wait on local worker state, never on the model API. A timeout leaves the job
// untouched; resuming an exchange reads the same durable job, not a new one.
export async function waitForJob(
  store: ProjectStore,
  projectId: string,
  jobId: string,
  timeoutMs = 60000,
) {
  let project = await store.get(projectId);
  const revision = project.revision;
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const job = project.jobs.find((j) => j.id === jobId);
    if (!job) throw new StudioError("Tâche introuvable dans ce projet.", 404);
    const pending = job.state === "queued" || job.state === "running";
    if (!pending || performance.now() >= deadline)
      return {
        project,
        job,
        timedOut: pending,
        revisionChanged: project.revision !== revision,
      };
    await delay(Math.min(300, Math.max(0, deadline - performance.now())));
    project = await store.get(projectId);
  }
}
