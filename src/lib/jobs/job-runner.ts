import { getJobById, insertJobEvent, updateJobRecord } from "@/db/repositories/jobs-repo";
import { recordUsageEvent } from "@/db/repositories/usage-repo";
import { getUsageMeterForEngine } from "@/lib/pricing";
import { reportUsageToStripe } from "@/lib/billing/stripe-usage";
import type { ProviderAdapter } from "@/providers/types";

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_POLL_MAX_MS = 20 * 60 * 1000; // 20 minutes

export function simulateJobLifecycle({
  jobId,
  providerJobId,
  adapter,
  engine,
  costEstimateCents,
}: {
  jobId: string;
  providerJobId: string;
  adapter: ProviderAdapter;
  engine?: string;
  costEstimateCents?: number | null;
}) {
  const pollIntervalMs = Number(process.env.PROVIDER_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);
  const pollMaxMs = Number(process.env.PROVIDER_POLL_MAX_MS ?? DEFAULT_POLL_MAX_MS);
  const startedAt = Date.now();
  const completionRecheckDelays = [2 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
  let completionRecheckIndex = 0;

  const estimatedCents = typeof costEstimateCents === "number" ? costEstimateCents : null;
  const markupMultiplier = Number(process.env.FAL_PRICE_MARKUP ?? 1.3);

  const formatCents = (value: number) => (value / 100).toFixed(2);

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

      const actualCents = typeof result.costActualCents === "number" ? result.costActualCents : null;

      await updateJobRecord(jobId, {
        status: result.status,
        progress: result.progress,
        outputUrl: result.outputUrl ?? null,
        thumbnailUrl: result.thumbnailUrl ?? null,
        costActualCents: result.costActualCents ?? null,
        durationActualSeconds: result.durationSeconds ?? null,
        error: result.error ?? null,
      });

      let eventMessage = result.error ?? "Polling update";

      if (result.status === "completed") {
        if (actualCents !== null && estimatedCents !== null) {
          const deltaCents = actualCents - estimatedCents;
          const deltaPrefix = deltaCents === 0 ? "=" : deltaCents > 0 ? "+" : "";
          const billedCents = Math.round(actualCents * markupMultiplier);
          const summary = `Charged ${formatCents(actualCents)} $ vs estimate ${formatCents(estimatedCents)} $ (${deltaPrefix}${formatCents(deltaCents)} $). Marked-up total: ${formatCents(billedCents)} $.`;
          eventMessage = summary;
          console.info(
            `[pricing] job ${jobId} actual ${actualCents}c vs estimate ${estimatedCents}c (${deltaPrefix}${deltaCents}c). billed=${billedCents}c markup=${markupMultiplier}.`,
          );
        } else if (actualCents !== null) {
          const billedCents = Math.round(actualCents * markupMultiplier);
          const summary = `Charged ${formatCents(actualCents)} $. Estimate unavailable. Marked-up total: ${formatCents(billedCents)} $.`;
          eventMessage = summary;
          console.info(
            `[pricing] job ${jobId} actual ${actualCents}c (no estimate recorded). billed=${billedCents}c markup=${markupMultiplier}.`,
          );
        }
      }

      await insertJobEvent({
        jobId,
        status: result.status,
        progress: result.progress,
        message: eventMessage,
        payload: result.outputUrl ? { outputUrl: result.outputUrl } : undefined,
      });

      if (result.status === "completed" || result.status === "failed") {
        if (result.status === "completed") {
          try {
            const jobRecord = await getJobById(jobId);
            if (jobRecord && jobRecord.provider === "fal") {
              const metadata = { ...(jobRecord.metadata ?? {}) } as Record<string, unknown>;
              const hasRecordedUsage = Boolean(metadata.usageRecorded);
              if (!hasRecordedUsage) {
                const meter = getUsageMeterForEngine(jobRecord.engine);
                const baseDuration =
                  result.durationSeconds ?? jobRecord.durationActualSeconds ?? jobRecord.durationSeconds;
                const seconds = Math.max(0, baseDuration ?? 0);
                const quantity = meter === "video_seconds_rendered"
                  ? Math.max(0, seconds * (jobRecord.quantity ?? 1))
                  : Math.max(0, jobRecord.quantity ?? 1);

                if (quantity <= 0) {
                  console.warn(`[usage] Skipping usage record for job ${jobId} – non-positive quantity.`);
                } else {
                  await recordUsageEvent({
                    organizationId: jobRecord.organizationId,
                    jobId,
                    meter,
                    quantity,
                    engine: jobRecord.engine,
                    provider: jobRecord.provider,
                  });

                  void reportUsageToStripe({ meter, quantity });
                }

                const updatedMetadata = { ...metadata, usageRecorded: true };
                await updateJobRecord(jobId, { metadata: updatedMetadata });
              }
            }
          } catch (usageError) {
            console.error("Failed to record usage", usageError);
          }
        }

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
