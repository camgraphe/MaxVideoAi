import type {StudioPreparedExport} from '@/lib/studio/conversation-export-contract';
import type {TimelineExportJobResponse} from '@/server/timeline-exports/contracts';
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
import type {StudioQuoteDiscardResult} from './conversation-quote-command';
import {studioVisualCapabilityDetails,studioVisualCapabilitySummary,studioAudioCapabilityDetails} from './conversation-capabilities';
import {conversationSelectionSettings} from '@/lib/studio/conversation-creation-contract';
import {studioAudioCapabilitySummary} from './conversation-audio-discovery';

export function createStudioActionExecutor(actor: StudioGenerationActor, dependencies: {
  enabled: boolean;
  generation?: ReturnType<typeof createStudioImageGenerationService>;
  prepareImage(request: Extract<StudioActionRequest, {action: 'image.prepare'}>): Promise<PreparedGeneration>;
  mediaEnabled?: boolean;
  factories?: StudioMediaFactories;
  prepareMedia?(request: StudioMediaIntent): Promise<PreparedGeneration | PreparedAudioGeneration>;
  recover?(quoteId: string): Promise<AgentGenerationStatus | null>;
  editingEnabled?: boolean;
  exportsEnabled?: boolean;
  prepareExport?(request: Extract<StudioActionRequest,{action: 'export.prepare'}>): Promise<StudioPreparedExport>;
  readExport?(quoteId: string): Promise<TimelineExportJobResponse | null>;
  editTimeline?(request: Extract<StudioActionRequest,{action: 'timeline.edit'}>): Promise<ConversationEditResult>;
  discardQuote?(quoteId: string): Promise<StudioQuoteDiscardResult>;
  attachedImageIds?: readonly string[];
  attachedMedia?:readonly {assetId:string;mediaKind:'image'|'video'|'audio'}[];
  analysisEnabled?:boolean;
  prepareAnalysis?(request:Extract<StudioActionRequest,{action:'analysis.prepare'}>):Promise<import('@/lib/studio/media-analysis-contract').StudioPreparedAnalysis>;
  readAnalysis?(id:string):Promise<import('@/lib/studio/media-analysis-contract').StudioAnalysisStatus>;
}) {
  requireGenerationActor(actor);
  if (actor.authMethod !== 'studio-session') throw new AgentApiError('AUTH_REQUIRED', 'Studio session required.');
  const generation = dependencies.generation ?? createStudioImageGenerationService(actor, {enabled: dependencies.enabled});
  return async (value: StudioActionRequest): Promise<StudioActionResult> => {
    const request = studioActionRequestSchema.parse(value);
    try {
      if (!dependencies.enabled) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Studio actions are unavailable.');
      const project = await readStudioConversationProject(actor,{exportsEnabled:dependencies.editingEnabled&&dependencies.exportsEnabled});
      switch (request.action) {
        case 'analysis.prepare':
          if(!dependencies.analysisEnabled||!dependencies.prepareAnalysis)throw new AgentApiError('ENGINE_UNAVAILABLE','Studio analysis is unavailable.');
          return {ok:true,action:request.action,data:await dependencies.prepareAnalysis(request)};
        case 'analysis.read':
          if(!dependencies.readAnalysis)throw new AgentApiError('ENGINE_UNAVAILABLE','Studio analysis results are unavailable.');
          return {ok:true,action:request.action,data:await dependencies.readAnalysis(request.analysisId)};
        case 'pricing.read': {
          if (request.references.some(({ref})=>ref.type!=='asset'||!(ref.kind==='image'?dependencies.attachedImageIds?.includes(ref.assetId):dependencies.attachedMedia?.some(attached=>attached.assetId===ref.assetId&&attached.mediaKind===ref.kind)))) {
            throw new AgentApiError('REFERENCE_INVALID','Attach this saved library media before estimating its use.');
          }
          const service=request.surface==='image' ? generation : dependencies.mediaEnabled && dependencies.factories
            ? dependencies.factories.video(actor,{enabled:dependencies.enabled}) : null;
          if (!service) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio video estimates are unavailable.');
          const data=await service.estimate({surface:request.surface,engineId:request.modelId,mode:request.mode,prompt:'Studio pricing scenario',
            settings:conversationSelectionSettings(request.settings),outputCount:1,references:request.references.map(selection=>{
              if(selection.ref.type!=='asset') throw new AgentApiError('REFERENCE_INVALID','Attach a saved library image.');
              return {kind:'asset' as const,assetId:selection.ref.assetId,role:selection.role,...(selection.slot==null?{}:{slot:selection.slot})};
            })});
          return {ok:true,action:request.action,data};
        }
        case 'export.prepare':
          if (!dependencies.editingEnabled || !dependencies.exportsEnabled || !dependencies.prepareExport) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio export tools are unavailable.');
          return {ok: true,action: request.action,data: await dependencies.prepareExport(request)};
        case 'export.read':
          if (!dependencies.editingEnabled || !dependencies.exportsEnabled || !dependencies.readExport) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio export tools are unavailable.');
          return {ok: true,action: request.action,data: await dependencies.readExport(request.quoteId)};
        case 'project.read': return {ok: true, action: request.action, data: project};
        case 'timeline.read':
          if (!dependencies.editingEnabled) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio editing tools are unavailable.');
          return {ok: true,action: request.action,data: (await readStudioConversationTimeline(actor)).data};
        case 'timeline.edit':
          if (!dependencies.editingEnabled || !dependencies.editTimeline) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio editing tools are unavailable.');
          return {ok: true,action: request.action,data: await dependencies.editTimeline(request)};
        case 'project.remember': return {ok: true, action: request.action, data: await saveStudioConversationMemory(actor, {revision: request.revision, brief: request.brief, decisions: request.decisions, projectTitle: request.projectTitle})};
        case 'catalog.read': {
          const image = (await generation.catalog()).map(studioVisualCapabilitySummary);
          if (!dependencies.mediaEnabled || !dependencies.factories) return {ok: true, action: request.action, data: image};
          const video = (await dependencies.factories.video(actor, {enabled: dependencies.enabled}).catalog()).map(studioVisualCapabilitySummary);
          const audio = (await dependencies.factories.audio(actor, {enabled: dependencies.enabled}).catalog()).modes
            .filter(entry => entry.variants.some(variant => variant.available))
            .map(studioAudioCapabilitySummary);
          return {ok: true, action: request.action, data: [...image, ...video, ...audio]};
        }
        case 'model.details': {
          const image=(await generation.catalog()).find(candidate=>candidate.engine.id===request.modelId);
          if (image) return {ok: true,action: request.action,data: studioVisualCapabilityDetails(image)};
          if (dependencies.mediaEnabled && dependencies.factories) {
            const video=(await dependencies.factories.video(actor,{enabled: dependencies.enabled}).catalog()).find(candidate=>candidate.engine.id===request.modelId);
            if (video) return {ok: true,action: request.action,data: studioVisualCapabilityDetails(video)};
            const audio=studioAudioCapabilityDetails(await dependencies.factories.audio(actor,{enabled: dependencies.enabled}).catalog(),request.modelId);
            if (audio) return {ok: true,action: request.action,data: audio};
          }
          throw new AgentApiError('ENGINE_UNAVAILABLE','This model is not available in the current Studio catalog. Read catalog_read to choose an executable model.');
        }
        case 'image.prepare': return {ok: true, action: request.action, data: await dependencies.prepareImage(request)};
        case 'generation.read': return {ok: true, action: request.action, data: await (dependencies.recover ?? generation.recover)(request.quoteId)};
        case 'quote.discard':
          if (!dependencies.discardQuote) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio quote actions are unavailable.');
          return {ok: true,action: request.action,data: await dependencies.discardQuote(request.quoteId)};
        case 'media.read': {
          if (!dependencies.mediaEnabled) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Studio media tools are unavailable.');
          return {ok: true, action: request.action, data: await readStudioProjectMedia(actor)};
        }
        case 'video.prepare': case 'voice.prepare': case 'music.prepare': case 'audio.prepare': {
          if (!dependencies.mediaEnabled || !dependencies.prepareMedia) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Studio media tools are unavailable.');
          return {ok: true, action: request.action, data: await dependencies.prepareMedia(request)} as StudioActionResult;
        }
      }
    } catch (error) {
      return {...toAgentApiFailure(error instanceof AgentApiError ? error : new AgentApiError('INTERNAL_ERROR', 'Studio could not complete this action. Resume the saved request.', true)), action: request.action};
    }
  };
}
