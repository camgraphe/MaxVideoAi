import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { ModelReply } from "./ai-director";

export type ModelUsageMetric = {
  attemptId?: string;
  responseId: string | null;
  status?: string;
  model?: string | null;
  serviceTier?: string | null;
  durationMs: number;
  usage?: ModelReply["usage"] | null;
};
type UsageEntry = ModelUsageMetric & { attemptId: string; requestId: string };

/** Private, metadata-only project history, separate from the current turn journal. */
export async function checkpointModelUsage(root: string, projectId: string, requestId: string, metrics: ModelUsageMetric[]) {
  if (!metrics.length) return;
  const file = join(root, "assistant", projectId + ".usage.json");
  let entries: UsageEntry[] = [];
  try {
    entries = JSON.parse(await readFile(file, "utf8"));
    if (!Array.isArray(entries)) throw new Error("Invalid model usage history");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  metrics.forEach((metric, index) => {
    const attemptId = metric.attemptId ?? createHash("sha256").update(JSON.stringify([requestId, index, metric.responseId])).digest("hex");
    const entry: UsageEntry = {
      attemptId, requestId, responseId: metric.responseId, status: metric.status ?? "unclassified",
      model: metric.model ?? null, serviceTier: metric.serviceTier ?? null,
      durationMs: metric.durationMs, usage: metric.usage ?? null,
    };
    const existing = entries.findIndex((saved) => saved.attemptId === attemptId);
    if (existing < 0) entries.push(entry);
    else if (!entries[existing].responseId) entries[existing] = entry;
    else if (entry.responseId && entries[existing].responseId !== entry.responseId)
      throw new Error("Model attempt response identity changed");
  });
  const temp = file + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(entries), { mode: 0o600 });
  await rename(temp, file);
}
