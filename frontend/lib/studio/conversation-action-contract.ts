import { z } from 'zod';
import {studioPricingReadSchema,STUDIO_PRICING_DIRECTOR_TOOL,type StudioPricingEstimate} from './conversation-pricing-contract';
import {studioExportPrepareActionSchema,studioExportReadActionSchema,STUDIO_EXPORT_DIRECTOR_TOOLS,type StudioPreparedExport} from './conversation-export-contract';
import type {TimelineExportJobResponse} from '@/server/timeline-exports/contracts';
import type { PreparedGeneration } from '@/server/agent-api/prepare-generation';
import type { AgentGenerationStatus } from '@/server/generations/generation-status';
import type { AgentApiFailure } from '@/server/agent-api/errors';
import {studioVideoActionSchema, studioVoiceActionSchema, studioMusicActionSchema, STUDIO_MEDIA_DIRECTOR_TOOLS} from './conversation-media-contract';
import type {PreparedAudioGeneration} from '@/server/agent-api/prepare-audio-generation';
import type {ToolAssetRef} from '@/lib/toolbox/contract';
import {studioTimelineReadSchema,studioTimelineEditSchema,STUDIO_EDITING_DIRECTOR_TOOLS,type StudioConversationTimeline} from './conversation-editing-contract';
import type {ConversationEditResult} from '@/server/studio/conversation-edit-command';
import type {StudioQuoteDiscardResult} from '@/server/studio/conversation-quote-command';
import {imageSelectionSchema,imageSelectionProperties} from './conversation-creation-contract';
import type {AgentModelModeDetails,AgentModelLifecycle} from '@/server/agent-api/types';
import type {listAudioCapabilities} from '@/server/agent-api/audio-capabilities';
import type {AudioSettingDetails,projectAudioVariantFixedOutput} from '@/server/agent-api/audio-capabilities';
import type {AgentModelGuidance,AgentModelEditorialGuidance,AgentModelEditorialSummary} from '@/server/agent-api/model-guidance';
import type {AgentModelPromptingSource} from '@/server/agent-api/model-prompting-sources';

export const studioMemorySchema = z.object({
  revision: z.number().int().nonnegative(),
  brief: z.string().max(3000),
  decisions: z.array(z.string().min(1).max(400)).max(12),
}).strict();
export type StudioConversationMemory = z.infer<typeof studioMemorySchema>;
export type StudioConversationProject = {
  name: string;
  revision: number;
  exports?: StudioPreparedExport[];
  memory: StudioConversationMemory;
  generations?: {quoteId: string; surface: string; quoteState: string; jobId: string | null; status: string | null}[];
};
export const studioActionRequestSchema = z.discriminatedUnion('action', [
  z.object({action: z.literal('project.read')}).strict(),
  z.object({action: z.literal('catalog.read')}).strict(),
  studioPricingReadSchema,
  z.object({action: z.literal('model.details'), modelId: z.string().trim().min(1).max(128)}).strict(),
  z.object({action: z.literal('project.remember'), ...studioMemorySchema.shape}).strict(),
  z.object({action: z.literal('image.prepare'), reply: z.string().min(1).max(2400), ...imageSelectionSchema.shape}).strict(),
  z.object({action: z.literal('generation.read'), quoteId: z.string().uuid()}).strict(),
  z.object({action: z.literal('quote.discard'), quoteId: z.string().uuid()}).strict(),
  z.object({action: z.literal('media.read')}).strict(),
  studioVideoActionSchema, studioVoiceActionSchema, studioMusicActionSchema,
  studioTimelineReadSchema,studioTimelineEditSchema,
  studioExportPrepareActionSchema,studioExportReadActionSchema,
]);
export type StudioActionRequest = z.infer<typeof studioActionRequestSchema>;
export type StudioImageCapability = {modelId: string; label: string; lifecycle: AgentModelLifecycle | null; modes: string[]; formats: string[]; bestFor?: readonly string[]; editorialGuidance?: AgentModelEditorialSummary};
type AudioCapabilities=ReturnType<typeof listAudioCapabilities>;
type StudioAudioMode=Omit<AudioCapabilities['modes'][number],'variants'> & {
  variants: (AudioCapabilities['modes'][number]['variants'][number] & {parameters: AudioSettingDetails[];fixedOutput: ReturnType<typeof projectAudioVariantFixedOutput>})[];
};
type StudioAudioOptions={readonly [K in keyof AudioCapabilities['options']]: readonly AudioCapabilities['options'][K][number][]};
export type StudioCapabilityDetails =
  | {modelId: string; label: string; lifecycle: AgentModelLifecycle | null; surface: 'image' | 'video'; modes: readonly AgentModelModeDetails[]; referenceIdentity: 'attached_image_asset' | 'attached_image_asset_or_ready_project_output'; outputCount: 1; maxReferences: number; guidance: AgentModelGuidance | null; editorialGuidance?: AgentModelEditorialGuidance; promptingSources: readonly AgentModelPromptingSource[]}
  | {modelId: string; label: string; surface: 'audio'; modes: StudioAudioMode[]; options: StudioAudioOptions; references: []; outputCount: 1};
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
  | {ok: true; action: 'voice.prepare' | 'music.prepare'; data: Omit<PreparedAudioGeneration, 'balance' | 'topupRequired'>}
  | (AgentApiFailure & {action: StudioActionRequest['action']});

export const STUDIO_DIRECTOR_TOOLS = [
  STUDIO_PRICING_DIRECTOR_TOOL,
  {action: 'project.read', name: 'project_read', description: 'Read this owned project, current revision and durable brief.', properties: {}},
  {action: 'catalog.read', name: 'catalog_read', description: 'Read the bounded, executable and certified creation catalog. Inspect model_details before selecting settings or reference roles. No prices are guessed.', properties: {}},
  {action: 'model.details', name: 'model_details', description: 'Inspect exact supported modes, settings, formats, durations and reference roles of one model from catalog_read. Read-only; no quote, generation or charge.', properties: {modelId: {type: 'string'}}},
  {action: 'project.remember', name: 'project_remember', description: 'Replace the durable brief and decisions, preserving prior constraints. Use the memory revision just read.', properties: {
    revision: {type: 'integer', minimum: 0}, brief: {type: 'string'}, decisions: {type: 'array', items: {type: 'string'}},
  }},
  {action: 'image.prepare', name: 'image_prepare', description: 'Write your own image prompt and prepare one exact quote with a model and supported settings from model_details. Settings are name/value pairs; references are explicitly selected attached library images with supported roles. Null selection fields use defaults; an empty reference list means text-only. Does not generate or charge. Ends the turn; explain that the client reviews the quote.', properties: {
    reply: {type: 'string'}, ...imageSelectionProperties,
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
