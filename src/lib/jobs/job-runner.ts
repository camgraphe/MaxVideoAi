import { updateJobRecord, insertJobEvent } from "@/db/repositories/jobs-repo";
import type { ProviderAdapter } from "@/providers/types";

export function simulateJobLifecycle({
  jobId,
  providerJobId,
  adapter,
}: {
  jobId: string;
  providerJobId: string;
  adapter: ProviderAdapter;
}) {
  setTimeout(async () => {
    try {
      await updateJobRecord(jobId, { status: "running", progress: 35 });
      await insertJobEvent({
        jobId,
        status: "running",
        progress: 35,
        message: "Provider acknowledged the job.",
      });

      const result = await adapter.pollJob(providerJobId);

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
        message: result.error ?? "Job finished in the simulator.",
        payload: result.outputUrl ? { outputUrl: result.outputUrl } : undefined,
      });
    } catch (error) {
      console.error("Failed to simulate job lifecycle", error);
      await updateJobRecord(jobId, {
        status: "failed",
        progress: 100,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      await insertJobEvent({
        jobId,
        status: "failed",
        progress: 100,
        message: "Simulation error",
        payload: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }, 500);
}
