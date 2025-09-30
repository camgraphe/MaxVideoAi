import { insertJobEvent, updateJobRecord } from "@/db/repositories/jobs-repo";
import type { ProviderAdapter } from "@/providers/types";

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_POLL_MAX_MS = 20 * 60 * 1000; // 20 minutes

export function simulateJobLifecycle({
  jobId,
  providerJobId,
  adapter,
  engine,
}: {
  jobId: string;
  providerJobId: string;
  adapter: ProviderAdapter;
  engine?: string;
}) {
  const pollIntervalMs = Number(process.env.PROVIDER_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);
  const pollMaxMs = Number(process.env.PROVIDER_POLL_MAX_MS ?? DEFAULT_POLL_MAX_MS);
  const startedAt = Date.now();
  const completionRecheckDelays = [2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
  let completionRecheckIndex = 0;

  async function handleFailure(message: string) {
    await updateJobRecord(jobId, {
      status: "failed",
      progress: 100,
      error: message,
    });
    await insertJobEvent({
      jobId,
      status: "failed",
      progress: 100,
      message,
    });
  }

  async function pollOnce(hasMarkedRunning: boolean): Promise<void> {
    try {
      if (!hasMarkedRunning) {
        await updateJobRecord(jobId, { status: "running", progress: 20 });
        await insertJobEvent({
          jobId,
          status: "running",
          progress: 20,
          message: "Job acknowledged by provider. Polling for completion...",
        });
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed > pollMaxMs) {
        await handleFailure("Provider polling timed out.");
        return;
      }

      const result = await adapter.pollJob(providerJobId, { engine });

      await updateJobRecord(jobId, {
        status: result.status,
        progress: result.progress,
        outputUrl: result.outputUrl ?? null,
        thumbnailUrl: result.thumbnailUrl ?? null,
        costActualCents: result.costActualCents ?? null,
        durationActualSeconds: result.durationSeconds ?? null,
        error: result.error ?? null,
      });

      await insertJobEvent({
        jobId,
        status: result.status,
        progress: result.progress,
        message: result.error ?? "Polling update",
        payload: result.outputUrl ? { outputUrl: result.outputUrl } : undefined,
      });

      if (result.status === "completed" || result.status === "failed") {
        if (result.status === "completed" && !result.outputUrl && completionRecheckIndex < completionRecheckDelays.length) {
          const delay = completionRecheckDelays[completionRecheckIndex++];
          await insertJobEvent({
            jobId,
            status: "running",
            progress: result.progress,
            message: `Completed without outputUrl. Scheduling recheck in ${Math.round(delay / 60000)} min...`,
          });
          setTimeout(() => {
            void pollOnce(true);
          }, delay);
          return;
        }
        return;
      }

      setTimeout(() => {
        void pollOnce(true);
      }, pollIntervalMs);
    } catch (error) {
      console.error("Polling error", error);
      const message = error instanceof Error ? error.message : "Unknown polling error";
      await handleFailure(message);
    }
  }

  void pollOnce(false);
}
