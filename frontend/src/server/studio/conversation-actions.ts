import {studioActionRequestSchema, type StudioActionRequest, type StudioActionResult} from '@/lib/studio/conversation-action-contract';
import {AgentApiError, toAgentApiFailure} from '@/server/agent-api/errors';
import {requireGenerationActor, type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {createStudioImageGenerationService} from './image-generation-service';
import {readStudioConversationProject, saveStudioConversationMemory} from './conversation-run-repository';
import type {PreparedGeneration} from '@/server/agent-api/prepare-generation';
import type {PreparedAudioGeneration} from '@/server/agent-api/prepare-audio-generation';
import type {StudioMediaIntent} from '@/lib/studio/conversation-media-contract';
import type {AgentGenerationStatus} from '@/server/generations/generation-status';
import {readStudioProjectMedia, type StudioMediaFactories} from './conversation-media-generation';
import {readStudioConversationTimeline} from './conversation-timeline';
import type {ConversationEditResult} from './conversation-edit-command';

export function createStudioActionExecutor(actor: StudioGenerationActor, dependencies: {
  enabled: boolean;
  generation?: ReturnType<typeof createStudioImageGenerationService>;
  prepareImage(request: Extract<StudioActionRequest, {action: 'image.prepare'}>): Promise<PreparedGeneration>;
  mediaEnabled?: boolean;
  factories?: StudioMediaFactories;
  prepareMedia?(request: StudioMediaIntent): Promise<PreparedGeneration | PreparedAudioGeneration>;
  recover?(quoteId: string): Promise<AgentGenerationStatus | null>;
  editingEnabled?: boolean;
  editTimeline?(request: Extract<StudioActionRequest,{action: 'timeline.edit'}>): Promise<ConversationEditResult>;
}) {
  requireGenerationActor(actor);
  if (actor.authMethod !== 'studio-session') throw new AgentApiError('AUTH_REQUIRED', 'Studio session required.');
  const generation = dependencies.generation ?? createStudioImageGenerationService(actor, {enabled: dependencies.enabled});
  return async (value: StudioActionRequest): Promise<StudioActionResult> => {
    const request = studioActionRequestSchema.parse(value);
    try {
      if (!dependencies.enabled) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Studio actions are unavailable.');
      const project = await readStudioConversationProject(actor);
      switch (request.action) {
        case 'project.read': return {ok: true, action: request.action, data: project};
        case 'timeline.read':
          if (!dependencies.editingEnabled) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio editing tools are unavailable.');
          return {ok: true,action: request.action,data: (await readStudioConversationTimeline(actor)).data};
        case 'timeline.edit':
          if (!dependencies.editingEnabled || !dependencies.editTimeline) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio editing tools are unavailable.');
          return {ok: true,action: request.action,data: await dependencies.editTimeline(request)};
        case 'project.remember': return {ok: true, action: request.action, data: await saveStudioConversationMemory(actor, {revision: request.revision, brief: request.brief, decisions: request.decisions})};
        case 'catalog.read': {
          const image = (await generation.catalog()).map(entry => ({modelId: entry.engine.id, label: entry.engine.label, modes: entry.publicModes, formats: entry.engine.aspectRatios}));
          if (!dependencies.mediaEnabled || !dependencies.factories) return {ok: true, action: request.action, data: image};
          const video = (await dependencies.factories.video(actor, {enabled: dependencies.enabled}).catalog()).filter(entry => entry.engine.id === 'wan-3')
            .map(entry => ({modelId: entry.engine.id, label: entry.engine.label, modes: entry.publicModes, formats: entry.engine.aspectRatios}));
          const audio = (await dependencies.factories.audio(actor, {enabled: dependencies.enabled}).catalog()).modes
            .filter(entry => entry.variants.some(variant => variant.available && (entry.mode === 'voice_only' ? variant.settings.voiceModel === 'seed' : variant.settings.musicModel === 'clip')))
            .map(entry => ({modelId: entry.engineId, label: entry.label, modes: [entry.mode], formats: []}));
          return {ok: true, action: request.action, data: [...image, ...video, ...audio]};
        }
        case 'image.prepare': return {ok: true, action: request.action, data: await dependencies.prepareImage(request)};
        case 'generation.read': return {ok: true, action: request.action, data: await (dependencies.recover ?? generation.recover)(request.quoteId)};
        case 'media.read': {
          if (!dependencies.mediaEnabled) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Studio media tools are unavailable.');
          return {ok: true, action: request.action, data: await readStudioProjectMedia(actor)};
        }
        case 'video.prepare': case 'voice.prepare': case 'music.prepare': {
          if (!dependencies.mediaEnabled || !dependencies.prepareMedia) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Studio media tools are unavailable.');
          return {ok: true, action: request.action, data: await dependencies.prepareMedia(request)} as StudioActionResult;
        }
      }
    } catch (error) {
      return {...toAgentApiFailure(error instanceof AgentApiError ? error : new AgentApiError('INTERNAL_ERROR', 'Studio could not complete this action. Resume the saved request.', true)), action: request.action};
    }
  };
}
