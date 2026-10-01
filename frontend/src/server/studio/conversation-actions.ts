import {studioActionRequestSchema, type StudioActionRequest, type StudioActionResult} from '@/lib/studio/conversation-action-contract';
import {AgentApiError, toAgentApiFailure} from '@/server/agent-api/errors';
import {requireGenerationActor, type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {createStudioImageGenerationService} from './image-generation-service';
import {readStudioConversationProject, saveStudioConversationMemory} from './conversation-run-repository';
import type {PreparedGeneration} from '@/server/agent-api/prepare-generation';

export function createStudioActionExecutor(actor: StudioGenerationActor, dependencies: {
  enabled: boolean;
  generation?: ReturnType<typeof createStudioImageGenerationService>;
  prepareImage(request: Extract<StudioActionRequest, {action: 'image.prepare'}>): Promise<PreparedGeneration>;
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
        case 'project.remember': return {ok: true, action: request.action, data: await saveStudioConversationMemory(actor, {revision: request.revision, brief: request.brief, decisions: request.decisions})};
        case 'catalog.read': return {ok: true, action: request.action, data: (await generation.catalog()).map(entry => ({modelId: entry.engine.id, label: entry.engine.label, modes: entry.publicModes, formats: entry.engine.aspectRatios}))};
        case 'image.prepare': return {ok: true, action: request.action, data: await dependencies.prepareImage(request)};
        case 'generation.read': return {ok: true, action: request.action, data: await generation.recover(request.quoteId)};
      }
    } catch (error) {
      return {...toAgentApiFailure(error instanceof AgentApiError ? error : new AgentApiError('INTERNAL_ERROR', 'Studio could not complete this action. Resume the saved request.', true)), action: request.action};
    }
  };
}
