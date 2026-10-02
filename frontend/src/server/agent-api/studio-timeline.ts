import * as z from 'zod/v4';
import {conversationTimelineCommandSchema,type ConversationTimelineCommand} from '@/lib/studio/conversation-timeline-editing';
import {editStudioConversationTimeline,type ConversationEditDependencies,type ConversationEditResult} from '@/server/studio/conversation-edit-command';
import {projectStudioConversationTimeline} from '@/server/studio/conversation-timeline';
import {readStudioWorkspace} from '@/server/studio/workspace-command';
import {StudioConnectedPersistenceError} from '@/server/studio/montage-command';
import {requireOAuthGenerationActor} from './generation-actor';
import {AgentApiError} from './errors';
import type {AgentPrincipal} from './principal';
import type {StudioConversationTimeline} from '@/lib/studio/conversation-editing-contract';
const identifier = z.string().trim().min(1).max(200);

export const getStudioTimelineInputSchema = z.object({
  projectId: identifier,
  sequenceId: identifier.optional(),
}).strict();
export type GetStudioTimelineInput = z.infer<typeof getStudioTimelineInputSchema>;
const frame = z.number().int().nonnegative();
const refIdentifier = z.string().trim().min(1).max(256);
const mediaKind = z.enum(['image','video','audio']);
export const studioTimelineAssetRefSchema = z.discriminatedUnion('type',[
  z.object({type: z.literal('asset'),assetId: refIdentifier,kind: mediaKind}).strict(),
  z.object({type: z.literal('job-output'),jobId: refIdentifier,outputId: refIdentifier,kind: mediaKind}).strict(),
]);
export const studioTimelineOutputSchema = z.object({
  projectId: identifier,sequenceId: identifier,sequenceName: z.string(),updatedAt: z.string(),
  revision: z.number().int().nonnegative(),fps: z.number().int().min(1).max(60),
  lockedTracks: z.array(z.string()).optional(),mutedAudioTracks: z.array(z.string()).optional(),
  clips: z.array(z.object({
    id: identifier,title: z.string(),kind: z.string(),track: z.string(),
    startFrame: frame,durationFrames: frame.positive(),sourceInFrame: frame,
    volume: z.number().min(0).max(100).optional(),muted: z.boolean().optional(),ref: studioTimelineAssetRefSchema.optional(),
  }).strict()).max(5_000),
}).strict();
export const studioTimelineEditOutputSchema = z.object({
  projectId: identifier,sequenceId: identifier,revision: z.number().int().nonnegative(),
  clipCount: z.number().int().nonnegative(),totalFrames: frame,changed: z.boolean(),
  clip: z.object({id: identifier,startFrame: frame,durationFrames: frame.positive(),sourceInFrame: frame}).strict().nullable(),
}).strict();

export function asStudioTimelineAgentError(error: unknown,projectId: string): unknown {
  if (error instanceof AgentApiError) return error;
  if (error instanceof StudioConnectedPersistenceError) {
    if (error.code === 'STUDIO_REVISION_CONFLICT') return new AgentApiError('PARAMETER_INVALID','The saved timeline changed. Read it again and preserve the latest edits before retrying.',false,{action: 'read_timeline',projectId});
    if (error.code === 'STUDIO_IDEMPOTENCY_CONFLICT') return new AgentApiError('PARAMETER_INVALID','This idempotencyKey already identifies a different edit. Use a new key for changed content.');
    if (error.code === 'STUDIO_CONNECTED_PROJECT_REQUIRED') return new AgentApiError('PARAMETER_INVALID','This project does not use connected Studio persistence.');
  }
  const message = error instanceof Error ? error.message : '';
  if (['STUDIO_PROJECT_NOT_FOUND','STUDIO_SEQUENCE_CONFLICT','MEDIA_NOT_AVAILABLE'].includes(message)) return new AgentApiError('REFERENCE_NOT_FOUND','The requested project, sequence or media is not available.');
  if (message === 'STUDIO_CONVERSATION_EDITING_DISABLED') return new AgentApiError('ENGINE_UNAVAILABLE','Studio timeline tools are not available.');
  if (message === 'UNAUTHORIZED') return new AgentApiError('AUTH_REQUIRED','Connect MaxVideoAI before editing a Studio timeline.');
  if (message === 'STUDIO_CONNECTED_SCHEMA_UNAVAILABLE') return new AgentApiError('RATE_LIMITED','Studio timeline tools are temporarily unavailable.',true);
  if (message === 'MEDIA_METADATA_REQUIRED') return new AgentApiError('REFERENCE_INVALID','This media needs measured duration before it can be inserted. Choose another ready asset.');
  if (/^(Invalid Studio timeline|Timeline clip not found|Timeline track is locked|Timeline track capacity|Edit would change a locked|Clip duration must|This clip has no audio)/u.test(message)) return new AgentApiError('PARAMETER_INVALID',message);
  return error;
}

/** OAuth authority remains separate from Studio session access; commands retain one business owner. */
export function createAgentStudioTimelineService(dependencies: ConversationEditDependencies = {}) {
  function actor(principal: AgentPrincipal) {
    requireOAuthGenerationActor(principal);
    if (!principal.clientId) throw new AgentApiError('AUTH_REQUIRED','Connect MaxVideoAI before using Studio timeline tools.');
    if (dependencies.featureEnabled !== true) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio timeline tools are not available.');
    return {userId: principal.userId,authOrigin: 'oauth' as const,clientId: principal.clientId};
  }
  return {
    async read(rawInput: GetStudioTimelineInput,principal: AgentPrincipal): Promise<StudioConversationTimeline> {
      const currentActor = actor(principal);
      const parsed = getStudioTimelineInputSchema.safeParse(rawInput);
      if (!parsed.success) throw new AgentApiError('PARAMETER_INVALID','Provide a projectId and an optional sequenceId.');
      try {
        const workspace = await readStudioWorkspace(currentActor,parsed.data.projectId,dependencies);
        return projectStudioConversationTimeline(workspace,parsed.data.sequenceId).data;
      } catch(error) {throw asStudioTimelineAgentError(error,parsed.data.projectId);}
    },
    async edit(rawInput: ConversationTimelineCommand,principal: AgentPrincipal): Promise<ConversationEditResult> {
      const currentActor = actor(principal);
      const parsed = conversationTimelineCommandSchema.safeParse(rawInput);
      if (!parsed.success) throw new AgentApiError('PARAMETER_INVALID','Provide one supported frame-aligned timeline command with the current revision and an idempotencyKey.');
      try {return await editStudioConversationTimeline(currentActor,parsed.data,dependencies);}
      catch(error) {throw asStudioTimelineAgentError(error,parsed.data.projectId);}
    },
  };
}
