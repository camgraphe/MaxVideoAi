import { z } from 'zod';
import {studioProjectNameSchema} from './conversation-project-title';
import {studioPricingReadSchema,STUDIO_PRICING_DIRECTOR_TOOL,type StudioPricingEstimate} from './conversation-pricing-contract';
import {studioExportPrepareActionSchema,studioExportReadActionSchema,STUDIO_EXPORT_DIRECTOR_TOOLS,type StudioPreparedExport} from './conversation-export-contract';
import type {TimelineExportJobResponse} from '@/server/timeline-exports/contracts';
import type { PreparedGeneration } from '@/server/agent-api/prepare-generation';
import type { AgentGenerationStatus } from '@/server/generations/generation-status';
import type { AgentApiFailure } from '@/server/agent-api/errors';
import {studioVideoActionSchema, studioVoiceActionSchema, studioMusicActionSchema,studioAudioActionSchema, STUDIO_MEDIA_DIRECTOR_TOOLS} from './conversation-media-contract';
import type {PreparedAudioGeneration} from '@/server/agent-api/prepare-audio-generation';
import type {ToolAssetRef} from '@/lib/toolbox/contract';
import {studioTimelineReadSchema,studioTimelineEditSchema,STUDIO_EDITING_DIRECTOR_TOOLS,type StudioConversationTimeline} from './conversation-editing-contract';
import type {ConversationEditResult} from '@/server/studio/conversation-edit-command';
import type {StudioQuoteDiscardResult} from '@/server/studio/conversation-quote-command';
import {imageSelectionSchema,imageSelectionProperties,conversationPreparationReplyProperty} from './conversation-creation-contract';
import type {AgentModelModeDetails,AgentModelLifecycle} from '@/server/agent-api/types';
import type {listAudioCapabilities} from '@/server/agent-api/audio-capabilities';
import type {AudioSettingDetails,projectAudioVariantFixedOutput} from '@/server/agent-api/audio-capabilities';
import type {AgentModelGuidance,AgentModelEditorialGuidance,AgentModelEditorialSummary} from '@/server/agent-api/model-guidance';
import type {AgentModelPromptingSource} from '@/server/agent-api/model-prompting-sources';
import type {CustomerDisplayPrice} from '@/lib/customer-price-presentation';
import type {StudioAudioWorkflowFacts} from '@/server/studio/conversation-audio-discovery';

export const studioMemorySchema = z.object({
  revision: z.number().int().nonnegative(),
  brief: z.string().max(3000),
  decisions: z.array(z.string().min(1).max(400)).max(12),
}).strict();
export type StudioConversationMemory = z.infer<typeof studioMemorySchema>;
export type StudioConversationQuoteSettings = {
  audio?: boolean; durationSec?: number; resolution?: string; aspectRatio?: string;
  quality?: string; imageWidth?: number; imageHeight?: number; outputFormat?: string;
  fps?: number; loop?: boolean; hdr?: boolean; exrExport?: boolean; enableWebSearch?: boolean;
  voiceModel?: string; musicModel?: string; seedAudioOutputFormat?: string; seedAudioSampleRate?: number;
  musicEnabled?: boolean; exportAudioFile?: boolean; language?: string;
  startTimeSec?: number; retakeMode?: string; extendPosition?: string;
};
export type StudioConversationQuoteFacts = {
  price: CustomerDisplayPrice;
  expiresAt: string;
  /** Prepared TTL elapsed or stored expired state; never authorizes another purchase. */
  expiredUnconfirmedQuote: boolean;
  modelId: string; mode: string;
  settings: StudioConversationQuoteSettings;
  outputCount: number;
  outputDurationSec?: number;
  referenceCount: number;
  referenceRoles: ('source' | 'reference' | 'first_frame' | 'last_frame' | 'mask' | 'source_video' | 'voice_sample')[];
};
export type StudioConversationProject = {
  name: string;
  revision: number;
  exports?: StudioPreparedExport[];
  memory: StudioConversationMemory;
  generations?: {quoteId: string; surface: string; quoteState: string; jobId: string | null; status: string | null; quote?: StudioConversationQuoteFacts}[];
};
export const studioActionRequestSchema = z.discriminatedUnion('action', [
  z.object({action: z.literal('project.read')}).strict(),
  z.object({action: z.literal('catalog.read')}).strict(),
  studioPricingReadSchema,
  z.object({action: z.literal('model.details'), modelId: z.string().trim().min(1).max(128)}).strict(),
  z.object({action: z.literal('project.remember'), ...studioMemorySchema.shape, projectTitle:studioProjectNameSchema.refine(value=>value.length<=80).nullable().optional().catch(null)}).strict(),
  z.object({action: z.literal('image.prepare'), reply: z.string().min(1).max(2400), ...imageSelectionSchema.shape}).strict(),
  z.object({action: z.literal('generation.read'), quoteId: z.string().uuid()}).strict(),
  z.object({action: z.literal('quote.discard'), quoteId: z.string().uuid()}).strict(),
  z.object({action: z.literal('media.read')}).strict(),
  studioVideoActionSchema, studioVoiceActionSchema, studioMusicActionSchema,studioAudioActionSchema,
  studioTimelineReadSchema,studioTimelineEditSchema,
  studioExportPrepareActionSchema,studioExportReadActionSchema,
]);
export type StudioActionRequest = z.infer<typeof studioActionRequestSchema>;
export type StudioImageCapability = {modelId: string; label: string; lifecycle: AgentModelLifecycle | null; modes: string[]; formats: string[]; customImageSize?: boolean; bestFor?: readonly string[]; editorialGuidance?: AgentModelEditorialSummary; audioWorkflow?: StudioAudioWorkflowFacts};
type AudioCapabilities=ReturnType<typeof listAudioCapabilities>;
type StudioAudioMode=Omit<AudioCapabilities['modes'][number],'variants'> & {
  audioWorkflow:StudioAudioWorkflowFacts;
  variants: (AudioCapabilities['modes'][number]['variants'][number] & {parameters: AudioSettingDetails[];fixedOutput: ReturnType<typeof projectAudioVariantFixedOutput>;voiceSample:'optional'|'unsupported'})[];
};
type StudioAudioOptions={readonly [K in keyof AudioCapabilities['options']]: readonly AudioCapabilities['options'][K][number][]};
export type StudioCapabilityDetails =
  | {modelId: string; label: string; lifecycle: AgentModelLifecycle | null; surface: 'image' | 'video'; modes: readonly AgentModelModeDetails[]; referenceIdentity: 'attached_image_asset' | 'attached_owned_media_or_ready_project_output'; outputCount: 1; maxReferences: number; guidance: AgentModelGuidance | null; editorialGuidance?: AgentModelEditorialGuidance; promptingSources: readonly AgentModelPromptingSource[]}
  | {modelId: string; label: string; surface: 'audio'; modes: StudioAudioMode[]; options: StudioAudioOptions; references: ('source_video'|'voice_sample')[]; outputCount: 1};
export type StudioProjectMedia = {ref: ToolAssetRef; name: string; durationSec: number | null}[];
export type StudioActionResult =
  | {ok: true; action: 'export.prepare'; data: StudioPreparedExport}
  | {ok: true; action: 'export.read'; data: TimelineExportJobResponse | null}
  | {ok: true; action: 'project.read'; data: StudioConversationProject}
  | {ok: true; action: 'project.remember'; data: StudioConversationMemory}
  | {ok: true; action: 'catalog.read'; data: StudioImageCapability[]}
  | {ok: true; action: 'pricing.read'; data: StudioPricingEstimate}
  | {ok: true; action: 'model.details'; data: StudioCapabilityDetails}
  | {ok: true; action: 'image.prepare'; data: Omit<PreparedGeneration, 'balance' | 'topupRequired'>}
  | {ok: true; action: 'generation.read'; data: AgentGenerationStatus | null}
  | {ok: true; action: 'quote.discard'; data: StudioQuoteDiscardResult}
  | {ok: true; action: 'media.read'; data: StudioProjectMedia}
  | {ok: true; action: 'timeline.read'; data: StudioConversationTimeline}
  | {ok: true; action: 'timeline.edit'; data: ConversationEditResult}
  | {ok: true; action: 'video.prepare'; data: Omit<PreparedGeneration, 'balance' | 'topupRequired'>}
  | {ok: true; action: 'voice.prepare' | 'music.prepare' | 'audio.prepare'; data: Omit<PreparedAudioGeneration, 'balance' | 'topupRequired'>}
  | (AgentApiFailure & {action: StudioActionRequest['action']});

export const STUDIO_DIRECTOR_TOOLS = [
  STUDIO_PRICING_DIRECTOR_TOOL,
  {action: 'project.read', name: 'project_read', description: 'Read this owned project, current revision, durable brief and recorded quote facts. Use the recorded price and configuration to explain an existing quote; amountCents is cents, not whole currency units. A prepared or expired quote is not a purchase, and an expired quote requires fresh preparation before confirmation.', properties: {}},
  {action: 'catalog.read', name: 'catalog_read', description: 'Read the bounded, executable and certified creation catalog. Inspect model_details before selecting settings or reference roles. No prices are guessed.', properties: {}},
  {action: 'model.details', name: 'model_details', description: 'Inspect exact supported modes, settings, formats, durations and reference roles of one model from catalog_read. Numeric min/max are range boundaries, not discrete choices; values lists are allowed choices when present, and suggested durations are examples. A missing setting applies to this model, not the whole catalog: inspect a suitable alternative before declaring the requested size or workflow unavailable. Use customImageSize in discovery for exact image dimensions, then check these constraints. Never prepare a different size or duration without the client accepting that change. Read-only; no quote, generation or charge.', properties: {modelId: {type: 'string'}}},
  {action: 'project.remember', name: 'project_remember', description: 'Replace the durable brief and decisions, preserving prior constraints. Use the memory revision just read.', properties: {
    projectTitle: {type: ['string','null'],minLength:1,maxLength:80, description: 'Optional concise 3–7 word topic title in the user’s language. Supply alongside useful memory; never call memory only to name a project. Use null otherwise.'},
    revision: {type: 'integer', minimum: 0}, brief: {type: 'string'}, decisions: {type: 'array', items: {type: 'string'}},
  }},
  {action: 'image.prepare', name: 'image_prepare', description: 'Write your own image prompt and prepare one exact quote with a model and supported settings from model_details. Settings are name/value pairs; references are explicitly selected attached library images with supported roles. Null selection fields use defaults; an empty reference list means text-only. Does not generate or charge. Success ends the turn; explain that the client reviews the quote.', properties: {
    reply: conversationPreparationReplyProperty, ...imageSelectionProperties,
  }},
  {action: 'generation.read', name: 'generation_read', description: 'Recover a generation from an exact quote belonging to this project. Never starts another job.', properties: {quoteId: {type: 'string'}}},
  {action: 'quote.discard', name: 'quote_discard', description: 'Withdraw exactly one prepared quote when the client explicitly asks to cancel or discard it. Use an exact quoteId from project facts. Never use for a clarification or cost question. An already submitted generation cannot be cancelled by this tool. No charge.', properties: {quoteId: {type: 'string'}}},
] as const;

export function actionFromTool(name: string, value: unknown): StudioActionRequest {
  const tool = [...STUDIO_DIRECTOR_TOOLS, ...STUDIO_MEDIA_DIRECTOR_TOOLS,...STUDIO_EDITING_DIRECTOR_TOOLS,...STUDIO_EXPORT_DIRECTOR_TOOLS].find(tool => tool.name === name);
  if (!tool || !value || typeof value !== 'object' || Array.isArray(value) || Object.hasOwn(value, 'action')) throw new Error('UNKNOWN_STUDIO_ACTION');
  // The discriminator is supplied by the server; model identity/scope arguments are rejected.
  return studioActionRequestSchema.parse({...value, action: tool.action});
}
