import { z } from 'zod';
import type { PreparedGeneration } from '@/server/agent-api/prepare-generation';
import type { AgentGenerationStatus } from '@/server/generations/generation-status';
import type { AgentApiFailure } from '@/server/agent-api/errors';
import {studioVideoActionSchema, studioVoiceActionSchema, studioMusicActionSchema, STUDIO_MEDIA_DIRECTOR_TOOLS} from './conversation-media-contract';
import type {PreparedAudioGeneration} from '@/server/agent-api/prepare-audio-generation';
import type {ToolAssetRef} from '@/lib/toolbox/contract';

export const studioMemorySchema = z.object({
  revision: z.number().int().nonnegative(),
  brief: z.string().max(3000),
  decisions: z.array(z.string().min(1).max(400)).max(12),
}).strict();
export type StudioConversationMemory = z.infer<typeof studioMemorySchema>;
export type StudioConversationProject = {
  name: string;
  revision: number;
  memory: StudioConversationMemory;
  generations?: {quoteId: string; surface: string; quoteState: string; jobId: string | null; status: string | null}[];
};
export const studioActionRequestSchema = z.discriminatedUnion('action', [
  z.object({action: z.literal('project.read')}).strict(),
  z.object({action: z.literal('catalog.read')}).strict(),
  z.object({action: z.literal('project.remember'), ...studioMemorySchema.shape}).strict(),
  z.object({action: z.literal('image.prepare'), reply: z.string().min(1).max(2400),
    prompt: z.string().min(1).max(12000), aspectRatio: z.enum(['16:9', '9:16', '1:1'])}).strict(),
  z.object({action: z.literal('generation.read'), quoteId: z.string().uuid()}).strict(),
  z.object({action: z.literal('media.read')}).strict(),
  studioVideoActionSchema, studioVoiceActionSchema, studioMusicActionSchema,
]);
export type StudioActionRequest = z.infer<typeof studioActionRequestSchema>;
export type StudioImageCapability = {modelId: string; label: string; modes: string[]; formats: string[]};
export type StudioProjectMedia = {ref: ToolAssetRef; name: string; durationSec: number | null}[];
export type StudioActionResult =
  | {ok: true; action: 'project.read'; data: StudioConversationProject}
  | {ok: true; action: 'project.remember'; data: StudioConversationMemory}
  | {ok: true; action: 'catalog.read'; data: StudioImageCapability[]}
  | {ok: true; action: 'image.prepare'; data: Omit<PreparedGeneration, 'balance' | 'topupRequired'>}
  | {ok: true; action: 'generation.read'; data: AgentGenerationStatus | null}
  | {ok: true; action: 'media.read'; data: StudioProjectMedia}
  | {ok: true; action: 'video.prepare'; data: Omit<PreparedGeneration, 'balance' | 'topupRequired'>}
  | {ok: true; action: 'voice.prepare' | 'music.prepare'; data: Omit<PreparedAudioGeneration, 'balance' | 'topupRequired'>}
  | (AgentApiFailure & {action: StudioActionRequest['action']});

export const STUDIO_DIRECTOR_TOOLS = [
  {action: 'project.read', name: 'project_read', description: 'Read this owned project, current revision and durable brief.', properties: {}},
  {action: 'catalog.read', name: 'catalog_read', description: 'Read the currently executable, certified image capabilities. No prices are guessed.', properties: {}},
  {action: 'project.remember', name: 'project_remember', description: 'Replace the durable brief and decisions, preserving prior constraints. Use the memory revision just read.', properties: {
    revision: {type: 'integer', minimum: 0}, brief: {type: 'string'}, decisions: {type: 'array', items: {type: 'string'}},
  }},
  {action: 'image.prepare', name: 'image_prepare', description: 'Write your own image prompt and prepare one exact quote. Does not generate or charge. This ends the turn; reply must explain that the client reviews the quote.', properties: {
    reply: {type: 'string'}, prompt: {type: 'string'}, aspectRatio: {type: 'string', enum: ['16:9', '9:16', '1:1']},
  }},
  {action: 'generation.read', name: 'generation_read', description: 'Recover a generation from an exact quote belonging to this project. Never starts another job.', properties: {quoteId: {type: 'string'}}},
] as const;

export function actionFromTool(name: string, value: unknown): StudioActionRequest {
  const tool = [...STUDIO_DIRECTOR_TOOLS, ...STUDIO_MEDIA_DIRECTOR_TOOLS].find(tool => tool.name === name);
  if (!tool || !value || typeof value !== 'object' || Array.isArray(value) || Object.hasOwn(value, 'action')) throw new Error('UNKNOWN_STUDIO_ACTION');
  // The discriminator is supplied by the server; model identity/scope arguments are rejected.
  return studioActionRequestSchema.parse({...value, action: tool.action});
}
