import {query} from '@/lib/db';
import {readMediaFacts} from '@/lib/media-identity';
import {ZodError} from 'zod';
import type {ToolAssetRef} from '@/lib/toolbox/contract';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import type {StudioMediaIntent} from '@/lib/studio/conversation-media-contract';
import {conversationSelectionSettings} from '@/lib/studio/conversation-creation-contract';
import type {StudioProjectMedia} from '@/lib/studio/conversation-action-contract';
import {studioReferenceFingerprint,type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {AgentApiError} from '@/server/agent-api/errors';
import {saveJobOutputToLibrary} from '@/server/media-library/assets';
import {createStudioImageGenerationService, createStudioVideoGenerationService} from './image-generation-service';
import {createStudioAudioGenerationService} from './audio-generation-service';
import {resolveStudioMedia,type StudioResolvedMedia} from './media-resolver';
import type {CanonicalGenerationRequest} from '@/server/agent-api/generation-types';
import type {CanonicalAudioRequest} from '@/server/agent-api/audio-normalization';
import {GenerationNormalizationError, normalizeGenerationRequest} from '@/server/agent-api/generation-normalization';
import {GenerationCapabilityError, validateCanonicalGenerationCapabilities} from '@/server/agent-api/generation-capability-validation';
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import type {AgentPublicGenerationEngine} from '@/server/agent-api/model-catalog';
import {toEngineGenerationMode} from '@/server/agent-api/generation-mode-aliases';
import {normalizeVideoDurationOption} from '@/server/video-generation/execution-constraints';
import {AudioGenerationError} from '@/server/audio/audio-generate-validation';
import {StudioPreparationInputError,validateStudioPreparationInput} from './conversation-preparation-validation';
import {validateStudioAudioRequest} from './conversation-audio-generation';
import type {ResolvedReference} from '@/server/agent-api/reference-types';
import {isLumaRay2EngineId} from '@/lib/luma-ray2';

export type StudioMediaFactories = {
  image: typeof createStudioImageGenerationService;
  video: typeof createStudioVideoGenerationService;
  audio: typeof createStudioAudioGenerationService;
};
export const defaultStudioMediaFactories: StudioMediaFactories = {image: createStudioImageGenerationService, video: createStudioVideoGenerationService, audio: createStudioAudioGenerationService};

/** Exact ready outputs of accepted session jobs. No bootstrap, promotion or provider polling in this read. */
export async function readStudioProjectMedia(actor: StudioGenerationActor): Promise<StudioProjectMedia> {
  const rows = await query<{id: string; job_id: string; kind: ToolAssetRef['kind']; duration_sec: number | null; metadata: Record<string,unknown> | null}>(`
    SELECT o.id,o.job_id,o.kind,o.duration_sec,o.metadata FROM job_outputs o
    JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=o.user_id
    JOIN mcp_generation_quotes q ON q.job_id=j.job_id AND q.user_id=j.user_id
    JOIN studio_projects p ON p.id=q.studio_project_id AND p.user_id=q.user_id
    WHERE o.user_id=$1 AND q.studio_project_id=$2 AND q.auth_origin='studio-session' AND q.state='accepted'
      AND p.deleted_at IS NULL AND j.status='completed' AND j.hidden IS NOT TRUE AND o.status='ready'
      AND o.kind IN ('image','video','audio') ORDER BY o.created_at DESC LIMIT 30`, [actor.userId, actor.projectId]);
  return rows.map(row => ({ref: {type: 'job-output', jobId: row.job_id, outputId: row.id, kind: row.kind}, name: `${row.kind} output`,
    durationSec: row.kind === 'image' ? row.duration_sec : readMediaFacts(row.metadata?.mediaFacts)?.durationSec ?? null}));
}

export type StudioMotionSourceDependencies = {
  saveOutput?: typeof saveJobOutputToLibrary;
  readProjectMedia?: typeof readStudioProjectMedia;
  resolveMedia?: typeof resolveStudioMedia;
  reviewedReferences?:readonly ResolvedReference[];
};

async function requireStudioMediaSource(actor: StudioGenerationActor, source: ToolAssetRef, input: ImageTurnInput, dependencies: StudioMotionSourceDependencies,referenceFactsSignal?:AbortSignal) {
  if (source.type === 'asset') {
    // Library media must be explicitly attached; the model cannot browse arbitrary private assets.
    const attached=source.kind==='image'?input.references.includes(source.assetId):input.attachments?.some(ref=>ref.type==='asset'&&ref.assetId===source.assetId&&ref.kind===source.kind);
    if (!attached) throw new AgentApiError('REFERENCE_INVALID', 'Attach this library media before using it.');
  } else {
    const outputs = await (dependencies.readProjectMedia ?? readStudioProjectMedia)(actor);
    if (!outputs.some(item => item.ref.type === 'job-output' && item.ref.jobId === source.jobId && item.ref.outputId === source.outputId && item.ref.kind === source.kind))
      throw new AgentApiError('REFERENCE_INVALID', 'This media is not a ready output in this project.');
  }
  try {return await (dependencies.resolveMedia ?? resolveStudioMedia)(actor.userId, source,undefined,referenceFactsSignal?{completeReferenceFacts:true,referenceFactsSignal}:undefined);}
  catch {throw new AgentApiError('REFERENCE_INVALID', 'The selected media is no longer available.');}
}

async function promoteStudioMediaSource(actor: StudioGenerationActor, source: ToolAssetRef, dependencies: StudioMotionSourceDependencies,expected?:ResolvedReference): Promise<string> {
  if (source.type === 'asset') return source.assetId;
  // Explicit creation action uses the existing idempotent library-save owner, preserving original output provenance.
  const asset = await (dependencies.saveOutput ?? saveJobOutputToLibrary)({userId: actor.userId, jobId: source.jobId, outputId: source.outputId});
  if (!asset.publicId) throw new AgentApiError('REFERENCE_INVALID', 'The media identity is unavailable.');
  if(expected&&(asset.userId!==actor.userId||asset.kind!==source.kind||asset.sourceJobId!==source.jobId||asset.sourceOutputId!==source.outputId||asset.status!=='ready'||asset.metadata.originUrl!==expected.storageUrl))
    throw new AgentApiError('REFERENCE_INVALID','The saved media no longer matches the selected project output.');
  try {await (dependencies.resolveMedia ?? resolveStudioMedia)(actor.userId, {type: 'asset', assetId: asset.publicId, kind: source.kind});}
  catch {throw new AgentApiError('REFERENCE_INVALID', 'The saved media is no longer available.');}
  return asset.publicId;
}

export async function studioMotionSource(actor: StudioGenerationActor, source: ToolAssetRef, input: ImageTurnInput, dependencies: StudioMotionSourceDependencies = {}): Promise<string> {
  if(source.kind!=='image')throw new AgentApiError('REFERENCE_INVALID','Choose an image reference.');
  await requireStudioMediaSource(actor, source, input, dependencies);
  return promoteStudioMediaSource(actor, source, dependencies);
}

function canonicalPreparation<T>(build: () => T, correctable=false): T {
  try {return build();}
  catch (error) {
    const reject=(failure:AgentApiError):never=>{
      if(correctable)return validateStudioPreparationInput(()=>{throw failure;});
      throw failure;
    };
    if (error instanceof AgentApiError) return reject(error);
    if (error instanceof GenerationCapabilityError)
      return reject(new AgentApiError(error.kind === 'reference_required' ? 'REFERENCE_REQUIRED' : error.kind === 'reference_invalid' ? 'REFERENCE_INVALID' : 'PARAMETER_INVALID',
        `${error.field} is not supported for the selected model and mode.`));
    if (error instanceof GenerationNormalizationError)
      return reject(new AgentApiError(error.field.startsWith('references') ? 'REFERENCE_INVALID' : 'PARAMETER_INVALID', error.message));
    if (error instanceof AudioGenerationError) return reject(new AgentApiError('PARAMETER_INVALID', error.message));
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return reject(new AgentApiError('PARAMETER_INVALID', `${issue.path.join('.') || 'settings'}: ${issue.message}`));
    }
    // Untyped failures (including legacy Audio cross-field Errors) remain terminal.
    if (error instanceof Error) throw new AgentApiError('PARAMETER_INVALID', error.message);
    throw error;
  }
}

function videoDefaults(candidate: AgentPublicGenerationEngine, mode: CanonicalGenerationRequest['mode'], aspectRatio: string, legacy: boolean) {
  const details = projectAgentModelModeDetails(candidate, mode);
  const caps = candidate.modeCaps[mode]!;
  const engineMode = toEngineGenerationMode(candidate.engine.id, mode);
  const resolutionField = [...(candidate.engine.inputSchema?.required ?? []), ...(candidate.engine.inputSchema?.optional ?? [])]
    .find(field => field.id === 'resolution' && (!field.modes?.length || field.modes.includes(engineMode)));
  const resolution = typeof resolutionField?.default === 'string' && details.resolutions.includes(resolutionField.default)
    ? resolutionField.default : details.resolutions[0];
  return {
    ...Object.fromEntries(details.settings.filter(setting => setting.default !== null).map(setting => [setting.key, setting.default])),
    durationSec: legacy ? 5 : normalizeVideoDurationOption(caps.duration?.default) ?? details.duration?.options?.[0] ?? details.duration?.range?.min,
    resolution: legacy ? '480p' : resolution,
    ...(details.aspectRatios.length ? {aspectRatio} : {}),
    ...(details.audio === 'optional' ? {audio: legacy ? false : true} : {}),
  };
}

type StudioCanonicalMediaRequest=(CanonicalGenerationRequest & {surface:'video'})|CanonicalAudioRequest;
type ValidatedStudioMediaRequest={materialize():Promise<StudioCanonicalMediaRequest>;referenceFingerprint?():string|undefined};
function comparableReference(reference:ResolvedReference):ResolvedReference{const {slot,...facts}=reference;return {...facts,...(slot===undefined?{}:{slot}),sizeBytes:reference.sizeBytes??null,originalName:reference.originalName??null};}
function mediaReference(media:StudioResolvedMedia,identity:Pick<ResolvedReference,'assetId'|'role'|'slot'>):ResolvedReference {
  return {...identity,mediaKind:media.kind,storageUrl:media.url,mimeType:media.mime,width:media.width??media.mediaFacts?.width??null,height:media.height??media.mediaFacts?.height??null,durationSec:media.durationSec??media.mediaFacts?.durationSec??null,sizeBytes:media.sizeBytes,originalName:media.originalName};
}
function sameReferenceFacts(previous:ResolvedReference,current:ResolvedReference):boolean{return studioReferenceFingerprint([comparableReference(previous)])===studioReferenceFingerprint([comparableReference(current)]);}

/** Validate selection and owned sources before any draft or library write. */
export async function validateStudioMediaRequest(actor: StudioGenerationActor, action: StudioMediaIntent, input: ImageTurnInput, factories: StudioMediaFactories, enabled: boolean, dependencies: StudioMotionSourceDependencies = {}):Promise<ValidatedStudioMediaRequest> {
  if(action.action!=='video.prepare')return validateStudioAudioRequest(actor,action,input,factories.audio,enabled,{readProjectMedia:dependencies.readProjectMedia??readStudioProjectMedia,resolveMedia:dependencies.resolveMedia});
  const settings = canonicalPreparation(() => conversationSelectionSettings(action.settings),true);
  if (action.action === 'video.prepare') {
    // Recover saved director intents without rewriting their immutable draft.
    // The canonical API remains strict and accepts only durationSec.
    if (Object.hasOwn(settings, 'duration')) {
      if (Object.hasOwn(settings, 'durationSec'))
        throw new StudioPreparationInputError('PARAMETER_INVALID', 'Choose the video duration once, using durationSec.');
      settings.durationSec = settings.duration;
      delete settings.duration;
    }
    if (action.source && action.references?.length)
      throw new StudioPreparationInputError('REFERENCE_INVALID', 'Choose either the single source shortcut or explicit reference roles.');
    const selections = action.source ? [{ref: action.source, role: action.source.kind==='image'?'first_frame' as const:'source' as const, slot: null}] : action.references ?? [];
    if (selections.some(({ref})=>ref.type==='asset'&&!(ref.kind==='image'?input.references.includes(ref.assetId):input.attachments?.some(attached=>attached.type==='asset'&&attached.assetId===ref.assetId&&attached.kind===ref.kind))))
      throw new StudioPreparationInputError('REFERENCE_INVALID','Attach this library media before using it.');
    if(Object.hasOwn(settings,'documentUrl')||Object.hasOwn(settings,'webpageUrl'))throw new StudioPreparationInputError('PARAMETER_INVALID','Select owned media references; external document and webpage URLs are not Studio inputs.');
    const sourceSelection=selections.find(selection=>selection.role==='source');
    const mode = action.mode ?? (sourceSelection?.ref.kind==='video'?'v2v':sourceSelection?.ref.kind==='audio'?'a2v':action.source || selections.some(selection => ['source', 'first_frame', 'last_frame'].includes(selection.role)) ? 'i2v' : selections.length ? 'ref2v' : 't2v');
    if (mode==='ref2v' && !selections.length)
      throw new AgentApiError('REFERENCE_REQUIRED','Reference-to-video requires attached or ready project reference media.');
    const catalog = await factories.video(actor, {enabled}).catalog();
    const candidate = catalog.find(entry => entry.surface === 'video' && entry.engine.id === (action.modelId ?? 'wan-3'));
    if (!candidate) throw new StudioPreparationInputError('ENGINE_UNAVAILABLE', 'The selected video model is unavailable in this Studio workflow.');
    if (!candidate.publicModes.includes(mode) || !candidate.modeCaps[mode])
      throw new AgentApiError('MODE_UNSUPPORTED', 'The selected video model does not support this Studio mode.');
    const legacy = !action.modelId && action.settings == null;
    // Validate model/parameters/roles before resolving images or promoting job outputs.
    let derivedSettings:Record<string,number>={};
    const build = (assetIds: string[],correctable=false,resolvedReferences?:ResolvedReference[]) => canonicalPreparation(() => {
      const request = normalizeGenerationRequest({schemaVersion: 1, surface: 'video', engineId: candidate.engine.id, mode, prompt: action.prompt,
        settings: {...videoDefaults(candidate, mode, action.aspectRatio, legacy),...derivedSettings, ...settings},
        references: selections.map((selection, index) => ({kind: 'asset', assetId: assetIds[index], role: selection.role,
          ...(selection.slot === null || selection.slot === undefined ? {} : {slot: selection.slot})})), outputCount: 1});
      validateCanonicalGenerationCapabilities(request, candidate,{resolvedReferences});
      return request as CanonicalGenerationRequest & {surface: 'video'};
    },correctable);
    const outputIdentities = new Map<string, string>();
    const preflightIds=selections.map(({ref}, index) => {
      if (ref.type === 'asset') return ref.assetId;
      const identity = JSON.stringify([ref.jobId, ref.outputId]);
      if (!outputIdentities.has(identity)) outputIdentities.set(identity, `project-output-${index}`);
      return outputIdentities.get(identity)!;
    });
    const preflight=build(preflightIds,true);
    // Check every source before the first library write; an unattached later
    // selection must not cause an earlier ready output to be promoted.
    const resolvedReferences:ResolvedReference[]=[];
    const nativeBaselines=new Map<number,ResolvedReference>();
    const used=new Set<string>();
    const referenceFactsSignal=AbortSignal.timeout(8_000);
    for (const [index,selection]of selections.entries()){
      const canonicalRef=preflight.references.find(reference=>reference.kind==='asset'&&reference.assetId===preflightIds[index]&&reference.role===selection.role
        &&(selection.slot==null?!used.has(JSON.stringify([reference.assetId,reference.role,reference.slot])):reference.slot===selection.slot))!;
      used.add(JSON.stringify([canonicalRef.kind==='asset'?canonicalRef.assetId:'',canonicalRef.role,canonicalRef.slot]));
      const identity={assetId:preflightIds[index],role:selection.role,...(canonicalRef.slot===undefined?{}:{slot:canonicalRef.slot})};
      const raw=selection.ref.type==='job-output'?await requireStudioMediaSource(actor,selection.ref,input,dependencies):null;
      const media=await requireStudioMediaSource(actor,selection.ref,input,dependencies,referenceFactsSignal);
      if(raw){
        const baseline=mediaReference(raw,identity);const current=await requireStudioMediaSource(actor,selection.ref,input,dependencies);
        if(!sameReferenceFacts(baseline,mediaReference(current,identity)))throw new AgentApiError('REFERENCE_INVALID','The project output changed while its reference facts were verified.');
        nativeBaselines.set(index,baseline);
      }
      resolvedReferences.push(mediaReference(media,identity));
      if(selection.ref.type==='asset'&&dependencies.reviewedReferences){
        const seen=dependencies.reviewedReferences.find(reference=>reference.assetId===preflightIds[index]&&reference.mediaKind===media.kind);
        const current=resolvedReferences.at(-1)!;
        if(!seen||studioReferenceFingerprint([comparableReference({...seen,role:current.role,slot:current.slot})])!==studioReferenceFingerprint([comparableReference(current)]))
          throw new AgentApiError('REFERENCE_INVALID','The attached references changed after Studio reviewed them. Send a new message to review them again.');
      }
    }
    if(!Object.hasOwn(settings,'durationSec')&&(mode==='a2v'||mode==='reframe'||(mode==='v2v'&&isLumaRay2EngineId(candidate.engine.id)))){
      const duration=resolvedReferences.find(reference=>reference.role==='source')?.durationSec;
      if(typeof duration==='number')derivedSettings={durationSec:Math.max(1,Math.ceil(duration))};
    }
    build(preflightIds,true,resolvedReferences);
    let preparedFingerprint:string|undefined;
    return {referenceFingerprint:()=>preparedFingerprint,materialize:async()=>{
      const verifyNativeSources=async()=>{
        for(const [index,selection]of selections.entries())if(selection.ref.type==='job-output'){
          const media=await requireStudioMediaSource(actor,selection.ref,input,dependencies);
          const previous=nativeBaselines.get(index)!;const current=mediaReference(media,{assetId:previous.assetId,role:previous.role,...(previous.slot===undefined?{}:{slot:previous.slot})});
          if(!sameReferenceFacts(previous,current))
            throw new AgentApiError('REFERENCE_INVALID','The project output changed before quote preparation. Send a new message to review it again.');
        }
      };
      // Check the entire ready-output selection before the first library write.
      await verifyNativeSources();
      const assetIds: string[] = [];
      for (const [index,selection]of selections.entries()) assetIds.push(await promoteStudioMediaSource(actor, selection.ref, dependencies,resolvedReferences[index]));
      // Copy time is separate from the bounded HEAD preflight. Compare native
      // snapshots without I/O; enriched facts remain bound to that exact original.
      await verifyNativeSources();
      const request=build(assetIds,false,resolvedReferences.map((reference,index)=>({...reference,assetId:assetIds[index]})));
      if(dependencies.reviewedReferences){
        const current=await factories.video(actor,{enabled}).resolveReferences(request);
        for(const [index,selection]of selections.entries()){
          if(selection.ref.type!=='asset')continue;
          const previous=resolvedReferences[index];const next=current.find(reference=>reference.assetId===previous.assetId&&reference.role===previous.role&&reference.slot===previous.slot);
          if(!next||studioReferenceFingerprint([comparableReference(previous)])!==studioReferenceFingerprint([comparableReference(next)]))
            throw new AgentApiError('REFERENCE_INVALID','The selected references changed before quote preparation. Send a new message to review them again.');
        }
        preparedFingerprint=studioReferenceFingerprint(current);
      }
      return request;
    }};
  }
  throw new AgentApiError('MODE_UNSUPPORTED','This Studio creation mode is unavailable.');
}

export async function studioMediaRequest(actor: StudioGenerationActor, action: StudioMediaIntent, input: ImageTurnInput, factories: StudioMediaFactories, enabled: boolean, dependencies: StudioMotionSourceDependencies = {}):Promise<StudioCanonicalMediaRequest> {
  return (await validateStudioMediaRequest(actor,action,input,factories,enabled,dependencies)).materialize();
}
