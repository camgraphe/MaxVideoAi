import { z } from "zod";
import type { PreparedGeneration } from "@/server/agent-api/prepare-generation";
import type { AgentGenerationStatus } from "@/server/generations/generation-status";

export const imageTurnInputSchema = z
  .object({
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(4000),
    references: z.array(z.string().regex(/^ma_[a-f0-9]{32}$/)).max(8),
  })
  .strict();
export type ImageTurnInput = z.infer<typeof imageTurnInputSchema>;
export const imageDraftSchema = z
  .object({
    reply: z.string().min(1).max(2400),
    image: z
      .object({
        prompt: z.string().min(1).max(12000),
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type ImageDraft = z.infer<typeof imageDraftSchema>;
export type ImageConversationTurn = {
  requestId: string;
  message: string;
  references: string[];
  reply: string | null;
  state: "thinking" | "ready" | "failed";
  retryable: boolean;
  quote:
    | (Omit<PreparedGeneration, "balance" | "topupRequired"> & {
        state: "prepared" | "claimed" | "accepted" | "failed" | "expired";
        modelLabel: string;
      })
    | null;
  generation: AgentGenerationStatus | null;
  createdAt: string;
};
export type ImageConversation = {
  projectId: string;
  projectName: string;
  turns: ImageConversationTurn[];
};
