import { randomUUID } from "crypto";
import { wait } from "@/utils/wait";
import type {
  PollJobResult,
  ProviderAdapter,
  StartJobInput,
  StartJobResult,
} from "@/providers/types";

const MOCK_LATENCY_MS = 400;

export const veoProvider: ProviderAdapter = {
  async startJob(input: StartJobInput): Promise<StartJobResult> {
    await wait(MOCK_LATENCY_MS);
    return {
      jobId: randomUUID(),
      provider: "veo",
      status: "pending",
      estimatedSeconds: input.durationSeconds,
      externalId: randomUUID(),
    };
  },
  async pollJob(
    _providerJobId: string,
    _options?: { withLogs?: boolean; engine?: string },
  ): Promise<PollJobResult> {
    void _options;
    await wait(MOCK_LATENCY_MS);
    return {
      jobId: _providerJobId,
      provider: "veo",
      status: "completed",
      progress: 100,
      outputUrl: "https://example.com/mock-veo.mp4",
      thumbnailUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800",
      durationSeconds: 8,
      costActualCents: 480,
    };
  },
};
