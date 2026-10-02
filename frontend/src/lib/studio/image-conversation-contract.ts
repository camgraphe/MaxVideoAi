import { z } from "zod";
import type { PreparedGeneration } from "@/server/agent-api/prepare-generation";
import type { AgentGenerationStatus } from "@/server/generations/generation-status";
import {studioMediaIntentSchema} from '@/lib/studio/conversation-media-contract';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import type {PreparedAudioGeneration} from '@/server/agent-api/prepare-audio-generation';

export const imageTurnInputSchema = z
  .object({
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(4000),
    references: z.array(z.string().regex(/^ma_[a-f0-9]{32}$/)).max(8),
    attachments: z.array(toolAssetRefSchema.refine(ref => ref.type === 'asset' && ref.kind !== 'image')).max(8).optional(),
    renewedFromRequestId: z.string().uuid().optional(),
  })
  .strict().superRefine((input, context) => {
    const ids = [...input.references, ...(input.attachments ?? []).map(ref => ref.type === 'asset' ? ref.assetId : ref.outputId)];
    if (ids.length > 8 || new Set(ids).size !== ids.length) context.addIssue({code: z.ZodIssueCode.custom, message: 'Attach up to eight distinct references.'});
  });
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
    media: studioMediaIntentSchema.optional(),
  })
  .strict().refine(draft => !(draft.image && draft.media), 'One quote per turn.');
export type ImageDraft = z.infer<typeof imageDraftSchema>;
export type ImageConversationTurn = {
  requestId: string;
  message: string;
  references: string[];
  attachments?: ImageTurnInput['attachments'];
  reply: string | null;
  state: "thinking" | "ready" | "failed";
  retryable: boolean;
  quote:
    | (Omit<PreparedGeneration | PreparedAudioGeneration, "balance" | "topupRequired"> & {
        state: "prepared" | "claimed" | "accepted" | "failed" | "expired";
        modelLabel: string;
        wallet: { amountCents: number; currency: string } | null;
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
export function hasDraftCreation(draft: ImageDraft | null) {return !!(draft?.image || draft?.media);}
export function draftSurface(draft: ImageDraft | null) {return draft?.media?.action === 'video.prepare' ? 'video' : draft?.media ? 'audio' : 'image';}
