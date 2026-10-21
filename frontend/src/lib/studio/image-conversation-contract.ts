import type {SeedanceEditSourceFacts} from '../seedance-edit-source';
import { z } from "zod";
import {studioPreparedAnalysisSchema,type StudioPreparedAnalysis} from '@/lib/studio/media-analysis-contract';
import {studioPreparedExportSchema,type StudioPreparedExport} from "@/lib/studio/conversation-export-contract";
import type { PreparedGeneration } from "@/server/agent-api/prepare-generation";
import type { AgentGenerationStatus } from "@/server/generations/generation-status";
import {studioMediaIntentSchema} from '@/lib/studio/conversation-media-contract';
import {toolAssetRefSchema} from '@/lib/toolbox/contract';
import type {PreparedAudioGeneration} from '@/server/agent-api/prepare-audio-generation';
import {imageSelectionSchema,STUDIO_CONVERSATION_MAX_ATTACHMENTS} from '@/lib/studio/conversation-creation-contract';
import {projectStudioReply} from './conversation-reply';
import type {StudioPricingEstimate} from '@/lib/studio/conversation-pricing-contract';
import {studioTaskSelectionSchema,type StudioTaskSelection,type StudioTaskStatus} from './task-budget-contract';

export const studioReferenceMentionSchema = z.object({
  assetId: z.string().min(1).max(256),
  label: z.string().regex(/^(Image|Video|Audio) [1-9]\d{0,5}$/),
}).strict();

export const imageTurnInputSchema = z
  .object({
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(4000),
    references: z.array(z.string().regex(/^ma_[a-f0-9]{32}$/)).max(STUDIO_CONVERSATION_MAX_ATTACHMENTS),
    attachments: z.array(toolAssetRefSchema.refine(ref => ref.type === 'asset' && ref.kind !== 'image')).max(STUDIO_CONVERSATION_MAX_ATTACHMENTS).optional(),
    referenceMentions: z.array(studioReferenceMentionSchema).max(STUDIO_CONVERSATION_MAX_ATTACHMENTS).optional(),
    renewedFromRequestId: z.string().uuid().optional(),
    taskBudget:studioTaskSelectionSchema.optional(),
    locale:z.enum(['en','fr','es']).optional(),
  })
  .strict().superRefine((input, context) => {
    const ids = [...input.references, ...(input.attachments ?? []).map(ref => ref.type === 'asset' ? ref.assetId : ref.outputId)];
    if (ids.length > STUDIO_CONVERSATION_MAX_ATTACHMENTS || new Set(ids).size !== ids.length) context.addIssue({code: z.ZodIssueCode.custom, message: 'Attach up to ten distinct references.'});
    const labels = new Set<string>();
    const mentionedIds = new Set<string>();
    for (const [index, mention] of (input.referenceMentions ?? []).entries()) {
      const kind = input.references.includes(mention.assetId) ? 'image' : input.attachments?.find(ref => ref.type === 'asset' && ref.assetId === mention.assetId)?.kind;
      if (!kind || !mention.label.startsWith(kind[0].toUpperCase() + kind.slice(1) + ' ') || labels.has(mention.label) || mentionedIds.has(mention.assetId)) {
        context.addIssue({code: z.ZodIssueCode.custom, path: ['referenceMentions', index], message: 'Each label must identify one distinct attached reference of the same media kind.'});
      }
      labels.add(mention.label);
      mentionedIds.add(mention.assetId);
    }
  });
export type ImageTurnInput = z.infer<typeof imageTurnInputSchema>;
export const studioContinuationSchema = z.object({
  reason: z.enum(['action_limit','output_limit']),
  completedEdits: z.number().int().min(0).max(24),
  lastError: z.object({code: z.string().min(1).max(80),message: z.string().min(1).max(800)}).strict().optional(),
}).strict();
export const studioExtensionAssemblyPlanSchema=z.object({
  sequenceId:z.string().min(1).max(200),expectedRevision:z.number().int().nonnegative(),fps:z.number().int().min(1).max(60),
  source:toolAssetRefSchema.refine(ref=>ref.kind==='video'),includeSource:z.boolean(),position:z.enum(['before','after']),
  sourceOriginalHash:z.string().regex(/^[a-f0-9]{64}$/),sourceDurationSec:z.number().positive().nullable(),sourceSizeBytes:z.number().int().positive().nullable(),
}).strict();
export type StudioExtensionAssemblyPlan=z.infer<typeof studioExtensionAssemblyPlanSchema>;
export const imageDraftSchema = z
  .object({
    reply: z.string().min(1).max(2400).transform(projectStudioReply),
    image: imageSelectionSchema.nullable(),
    media: studioMediaIntentSchema.transform(media=>({...media,reply:projectStudioReply(media.reply)})).optional(),
    continuation: studioContinuationSchema.optional(),
    extensionAssembly:studioExtensionAssemblyPlanSchema.optional(),
    exportQuote: studioPreparedExportSchema.optional(),
    analysisQuote:studioPreparedAnalysisSchema.optional(),
  })
  .strict().refine(draft => [draft.image,draft.media,draft.exportQuote,draft.analysisQuote].filter(Boolean).length <= 1, 'One quote per turn.');
export type ImageDraft = z.infer<typeof imageDraftSchema>;
export type ImageConversationTurn = {
  requestId: string;
  message: string;
  references: string[];
  attachments?: ImageTurnInput['attachments'];
  referenceMentions?: ImageTurnInput['referenceMentions'];
  renewedFromRequestId?: string;
  taskBudget?:StudioTaskSelection;
  locale?:ImageTurnInput['locale'];
  task?:StudioTaskStatus;
  reply: string | null;
  exportQuote?: StudioPreparedExport;
  analysisQuote?:StudioPreparedAnalysis;
  continuation?: z.infer<typeof studioContinuationSchema>;
  extensionAssembly?:{state:'pending'|'saved'|'blocked';durationSec?:number};
  state: "thinking" | "ready" | "failed";
  retryable: boolean;
  quote:
    | (Omit<PreparedGeneration | PreparedAudioGeneration, "balance" | "topupRequired"> & {
        state: "prepared" | "claimed" | "accepted" | "failed" | "expired";
        modelLabel: string;
        wallet: { amountCents: number; currency: string } | null;
        /** Recorded canonical output timing; distinct from a model's ignored request default. */
        outputDurationSec?: number;
        sourceVideoOutput?: SeedanceEditSourceFacts;
      })
    | null;
  generation: AgentGenerationStatus | null;
  createdAt: string;
};
export type ImageConversation = {
  projectId: string;
  projectName: string;
  turns: ImageConversationTurn[];
  taskPolicyVersion?:string;
};
export type ImageConversationHistoryTurn = Pick<ImageConversationTurn, 'message' | 'reply' | 'referenceMentions'>;
export type StudioConversationHistoryFacts = {
  quoteDirections:{requestId:string;quoteId:string;text:string;truncated:boolean}[];
  estimates:(StudioPricingEstimate & {requestId:string;historical:true})[];
};
export function hasDraftCreation(draft: ImageDraft | null) {return !!(draft?.image || draft?.media);}
export function draftSurface(draft: ImageDraft | null) {return draft?.media?.action === 'video.prepare' ? 'video' : draft?.media ? 'audio' : 'image';}
/** Reproduce the saved immutable request, including renewal identity, in a fresh tab. */
export function imageTurnRetryInput(turn: ImageConversationTurn): ImageTurnInput {
  return {requestId: turn.requestId,message: turn.message,references: turn.references,
    ...(turn.attachments ? {attachments: turn.attachments} : {}),
    ...(turn.referenceMentions ? {referenceMentions: turn.referenceMentions} : {}),
    ...(turn.taskBudget ? {taskBudget:turn.taskBudget} : {}),
    ...(turn.locale ? {locale:turn.locale} : {}),
    ...(turn.renewedFromRequestId ? {renewedFromRequestId: turn.renewedFromRequestId} : {})};
}
