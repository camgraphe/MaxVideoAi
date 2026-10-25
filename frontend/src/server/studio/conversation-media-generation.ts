import { isFluxLtxSourceOperation } from '@/lib/flux-ltx-operations';
import { qualifyFluxLtxSourceReference } from '@/server/agent-api/flux-ltx-source-reference';
import type { inspectOwnedFluxLtxSource } from '@/server/video-excerpts/flux-ltx-source';
import { prepareStudioFluxDraftSource, resolveStudioFluxDraftSource } from './flux-draft-source';
import { hashH3PromotionImage } from './h3-promotion-identity';
import { qualifyH3SourceReference } from '@/server/agent-api/h3-source-reference';
import type { inspectOwnedH3Source } from '@/server/video-excerpts/h3-relight';
import { isH3SourceOperation } from '@/lib/h3-source-operations';
import { resolveStudioLumaGenerationSource } from './luma-generation-source';
import { normalizeVideoOperation, resolveVideoOperationEngine } from '@/lib/video-operation';
import {videoDurationPolicy} from '@/lib/video-workflow-capabilities';
import {query} from '@/lib/db';
import {readMediaFacts} from '@/lib/media-identity';
import {ZodError} from 'zod';
import type {ToolAssetRef} from '@/lib/toolbox/contract';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import {studioShotPlanSchema, type StudioMediaIntent} from '@/lib/studio/conversation-media-contract';
import {conversationSelectionSettings,STUDIO_CONVERSATION_MAX_ATTACHMENTS} from '@/lib/studio/conversation-creation-contract';
import type {StudioProjectMedia} from '@/lib/studio/conversation-action-contract';
import {studioReferenceFingerprint,type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {AgentApiError} from '@/server/agent-api/errors';
import {saveJobOutputToLibrary} from '@/server/media-library/assets';
import {createStudioImageGenerationService, createStudioVideoGenerationService} from './image-generation-service';
import {createStudioAudioGenerationService} from './audio-generation-service';
import {resolveStudioMedia,type StudioResolvedMedia} from './media-resolver';
import type {CanonicalGenerationRequest} from '@/server/agent-api/generation-types';
import type {CanonicalAudioRequest} from '@/server/agent-api/audio-normalization';
import {GenerationNormalizationError, normalizeGenerationRequest,stableJson} from '@/server/agent-api/generation-normalization';
import {GenerationCapabilityError, validateCanonicalGenerationCapabilities} from '@/server/agent-api/generation-capability-validation';
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import type {AgentPublicGenerationEngine} from '@/server/agent-api/model-catalog';
import {toEngineGenerationMode} from '@/server/agent-api/generation-mode-aliases';
import {normalizeVideoDurationOption} from '@/server/video-generation/execution-constraints';
import {AudioGenerationError} from '@/server/audio/audio-generate-validation';
import {StudioPreparationInputError,validateStudioPreparationInput} from './conversation-preparation-validation';
import {validateStudioAudioRequest} from './conversation-audio-generation';
import type {ResolvedReference} from '@/server/agent-api/reference-types';

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
  resolveFluxDraftSource?: (input:Parameters<typeof import('@/server/flux-draft-cache-store').resolveOwnedFluxDraftSource>[0])=>ReturnType<typeof import('@/server/flux-draft-cache-store').resolveOwnedFluxDraftSource>;
  prepareFluxDraftSource?: typeof import('@/server/prepare-flux-draft-source').prepareOwnedFluxDraftSource;
  lumaSourceExecutor?: import('@/lib/db').QueryExecutor;
  saveOutput?: typeof saveJobOutputToLibrary;
  readProjectMedia?: typeof readStudioProjectMedia;
  resolveMedia?: typeof resolveStudioMedia;
  reviewedReferences?:readonly ResolvedReference[];
  inspectH3Source?: typeof inspectOwnedH3Source;
  inspectFluxLtxSource?: typeof inspectOwnedFluxLtxSource;
  hashH3Image?: typeof hashH3PromotionImage;
};

function isMeasuredSourceOperation(operation:unknown) {return isH3SourceOperation(operation)||isFluxLtxSourceOperation(operation);}
function qualifyMeasuredSource(reference:ResolvedReference,operation:unknown,userId:string,dependencies:StudioMotionSourceDependencies) {
  return isH3SourceOperation(operation) ? qualifyH3SourceReference(reference,operation,userId,dependencies.inspectH3Source)
    : qualifyFluxLtxSourceReference(reference,operation,userId,dependencies.inspectFluxLtxSource);
}

/** Read-only pricing aliases keep native project outputs out of the asset library. */
export function studioPricingSourceSelection(actor:StudioGenerationActor,selections:NonNullable<Extract<StudioMediaIntent,{action:'video.prepare'}>['references']>,input:Pick<ImageTurnInput,'references'|'attachments'>,dependencies:StudioMotionSourceDependencies={}) {
  const ids=selections.map(({ref})=>ref.type==='asset'?ref.assetId:`studio-project-output-${selections.findIndex(selection=>selection.ref.type==='job-output'&&selection.ref.jobId===ref.jobId&&selection.ref.outputId===ref.outputId&&selection.ref.kind===ref.kind)}`);
  return {
    references:selections.map((selection,index)=>({kind:'asset' as const,assetId:ids[index],role:selection.role,...(selection.slot==null?{}:{slot:selection.slot})})),
    resolveReferences:async(request:CanonicalGenerationRequest):Promise<ResolvedReference[]>=>{
      const signal=AbortSignal.timeout(8_000);
      const references:ResolvedReference[]=[];
      for(const reference of request.references){
        const index=reference.kind==='asset'?ids.indexOf(reference.assetId):-1;
        if(index<0)throw new AgentApiError('REFERENCE_INVALID','Select attached media or a ready output in this project.');
        const media=await requireStudioMediaSource(actor,selections[index].ref,input,dependencies,signal);
        const facts=mediaReference(media,{assetId:ids[index],role:reference.role,...(reference.slot===undefined?{}:{slot:reference.slot})});
        references.push(await qualifyMeasuredSource(facts,request.operation,actor.userId,dependencies));
      }
      return references;
    },
  };
}

async function requireStudioMediaSource(actor: StudioGenerationActor, source: ToolAssetRef, input: Pick<ImageTurnInput,'references'|'attachments'>, dependencies: StudioMotionSourceDependencies,referenceFactsSignal?:AbortSignal) {
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

async function promoteStudioMediaSource(actor: StudioGenerationActor, source: ToolAssetRef, dependencies: StudioMotionSourceDependencies,expected?:ResolvedReference, verifyPromotionUrl=false): Promise<{assetId:string; promoted?:{storageUrl:string;originalName?:string|null}}> {
  if (source.type === 'asset') return {assetId:source.assetId};
  // Explicit creation action uses the existing idempotent library-save owner, preserving original output provenance.
  const asset = await (dependencies.saveOutput ?? saveJobOutputToLibrary)({userId: actor.userId, jobId: source.jobId, outputId: source.outputId});
  if (!asset.publicId) throw new AgentApiError('REFERENCE_INVALID', 'The media identity is unavailable.');
  if(expected&&(asset.userId!==actor.userId||asset.kind!==source.kind||asset.sourceJobId!==source.jobId||asset.sourceOutputId!==source.outputId||asset.status!=='ready'||asset.metadata.originUrl!==expected.storageUrl))
    throw new AgentApiError('REFERENCE_INVALID','The saved media no longer matches the selected project output.');
  let promoted:StudioResolvedMedia;
  try {promoted=await (dependencies.resolveMedia ?? resolveStudioMedia)(actor.userId, {type: 'asset', assetId: asset.publicId, kind: source.kind});}
  catch {throw new AgentApiError('REFERENCE_INVALID', 'The saved media is no longer available.');}
  if (verifyPromotionUrl && (promoted.url !== asset.url || promoted.kind !== source.kind))
    throw new AgentApiError('REFERENCE_INVALID','The saved media no longer matches the promoted asset.');
  return {assetId:asset.publicId,promoted:{storageUrl:promoted.url,originalName:promoted.originalName}};
}

export async function studioMotionSource(actor: StudioGenerationActor, source: ToolAssetRef, input: ImageTurnInput, dependencies: StudioMotionSourceDependencies = {}): Promise<string> {
  if(source.kind!=='image')throw new AgentApiError('REFERENCE_INVALID','Choose an image reference.');
  await requireStudioMediaSource(actor, source, input, dependencies);
  return (await promoteStudioMediaSource(actor, source, dependencies)).assetId;
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
    ...(!(candidate.engine.id === 'kling-v4' && mode === 'v2v') && details.durationPolicy === 'requested' ? { durationSec: legacy ? 5 : normalizeVideoDurationOption(caps.duration?.default) ?? details.duration?.options?.[0] ?? details.duration?.range?.min } : {}),
    resolution: legacy ? '480p' : resolution,
    ...(details.aspectRatios.length ? {aspectRatio} : {}),
    ...(details.audio === 'optional' ? {audio: legacy ? false : true} : {}),
  };
}

type StudioCanonicalMediaRequest=(CanonicalGenerationRequest & {surface:'video'})|CanonicalAudioRequest;
type ValidatedStudioMediaRequest={materialize():Promise<StudioCanonicalMediaRequest>;referenceFingerprint?():string|undefined;extensionOutput?:'continuation'|'combined';extensionSource?:StudioResolvedMedia};
function comparableReference(reference:ResolvedReference):ResolvedReference{const {slot,...facts}=reference;return {...facts,...(slot===undefined?{}:{slot}),sizeBytes:reference.sizeBytes??null,originalName:reference.originalName??null};}
function mediaReference(media:StudioResolvedMedia,identity:Pick<ResolvedReference,'assetId'|'role'|'slot'>):ResolvedReference {
  return {...identity,mediaKind:media.kind,storageUrl:media.url,mimeType:media.mime,width:media.width??media.mediaFacts?.width??null,height:media.height??media.mediaFacts?.height??null,durationSec:media.durationSec??media.mediaFacts?.durationSec??null,sizeBytes:media.sizeBytes,originalName:media.originalName};
}
// FPS is added by exact owned-original verification after review. Compare all previously
// observed facts, then bind the complete enriched fingerprint to preparation.
function matchesReviewedReference(previous:ResolvedReference,current:ResolvedReference):boolean {
  const comparableCurrent={...current};
  if(previous.fps===undefined)delete comparableCurrent.fps;
  return sameReferenceFacts(previous,comparableCurrent);
}
function sameReferenceFacts(previous:ResolvedReference,current:ResolvedReference):boolean{return studioReferenceFingerprint([comparableReference(previous)])===studioReferenceFingerprint([comparableReference(current)]);}

/** Validate selection and owned sources before any draft or library write. */
export async function validateStudioMediaRequest(actor: StudioGenerationActor, action: StudioMediaIntent, input: ImageTurnInput, factories: StudioMediaFactories, enabled: boolean, dependencies: StudioMotionSourceDependencies = {}):Promise<ValidatedStudioMediaRequest> {
  if(input.shotPlanRevision && action.action!=='video.prepare')throw new StudioPreparationInputError('PARAMETER_INVALID','The revised shot plan requires a new video quote.');
  if(action.action!=='video.prepare')return validateStudioAudioRequest(actor,action,input,factories.audio,enabled,{readProjectMedia:dependencies.readProjectMedia??readStudioProjectMedia,resolveMedia:dependencies.resolveMedia});
  const settings = canonicalPreparation(() => conversationSelectionSettings(action.settings),true);
  if (action.action === 'video.prepare') {
    const shotPlan = action.shotPlan == null ? undefined : canonicalPreparation(() => studioShotPlanSchema.parse(action.shotPlan), true);
    if (shotPlan && action.prompt.trim()) throw new StudioPreparationInputError('PARAMETER_INVALID', 'Choose a prompt or shot plan, exclusively.');
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
    const revision=input.shotPlanRevision;
    if(revision&&(action.modelId!==revision.modelId||mode!==revision.mode||stableJson(shotPlan??null)!==stableJson(revision.shots)
      ||(settings.durationSec!==undefined&&settings.durationSec!==revision.durationSec)))
      throw new StudioPreparationInputError('PARAMETER_INVALID','Preserve the exact model, mode, duration and ordered shots from the client revision.');
    if (mode==='ref2v' && !selections.length)
      throw new AgentApiError('REFERENCE_REQUIRED','Reference-to-video requires attached or ready project reference media.');
    if (selections.length > (action.modelId==='kling-v4'?50:STUDIO_CONVERSATION_MAX_ATTACHMENTS))
      throw new StudioPreparationInputError('REFERENCE_INVALID','Too many selected references for this Studio model.');
    const catalog = await factories.video(actor, {enabled}).catalog();
    let candidate = catalog.find(entry => entry.surface === 'video' && entry.engine.id === (action.modelId ?? 'wan-3'));
    if (!candidate) throw new StudioPreparationInputError('ENGINE_UNAVAILABLE', 'The selected video model is unavailable in this Studio workflow.');
    const operation=normalizeVideoOperation(candidate.engine.id,mode,action.operation??undefined);
    if (operation) {
      const engine = resolveVideoOperationEngine(candidate.engine, toEngineGenerationMode(candidate.engine.id, mode), operation);
      candidate = { ...candidate, engine, modeCaps: { ...candidate.modeCaps, ...engine.modeCaps } };
    }
    if (!candidate.publicModes.includes(mode) || !candidate.modeCaps[mode])
      throw new AgentApiError('MODE_UNSUPPORTED', 'The selected video model does not support this Studio mode.');
    if(operation==='flux-draft-enhance') {
      if(selections.length!==1||selections[0].role!=='source')throw new AgentApiError('REFERENCE_REQUIRED','Select one attached or ready native Draft output.');
      const selected=selections[0].ref;await requireStudioMediaSource(actor,selected,input,dependencies);
      const request=normalizeGenerationRequest({surface:'video',engineId:'flux-3-draft',mode:'v2v',operation:'flux-draft-enhance',prompt:'',settings:{resolution:'1080p',...settings},references:[],outputCount:1});
      validateCanonicalGenerationCapabilities(request,candidate);
      const source=await prepareStudioFluxDraftSource(actor.userId,selected,dependencies.lumaSourceExecutor,dependencies.prepareFluxDraftSource);
      request.sourceJobId=source.jobId; request.sourceOutputId=source.outputId;
      return {materialize:async()=>{
        await requireStudioMediaSource(actor,selected,input,dependencies);
        const current=await resolveStudioFluxDraftSource(actor.userId,selected,dependencies.lumaSourceExecutor,dependencies.resolveFluxDraftSource);
        if(current.fingerprint!==source.fingerprint)throw new AgentApiError('REFERENCE_INVALID','The Draft source changed.');
        return request as CanonicalGenerationRequest & {surface:'video'};
      }};
    }
    if (candidate.engine.id === 'luma-ray-3-2' && mode === 'extend') {
      if (selections.length !== 1 || selections[0].role !== 'source') throw new AgentApiError('REFERENCE_REQUIRED', 'Select one attached or ready project generation.');
      const selected = selections[0].ref;
      const media = await requireStudioMediaSource(actor, selected, input, dependencies);
      const source = await resolveStudioLumaGenerationSource(actor.userId, selected, dependencies.lumaSourceExecutor);
      const request = normalizeGenerationRequest({ schemaVersion: 1, surface: 'video', engineId: candidate.engine.id,
        mode, operation: 'luma-extend', sourceJobId: source.sourceJobId, sourceOutputId: source.sourceOutputIdentity,
        prompt: action.prompt, settings: { durationSec: 5, resolution: '720p', ...settings }, references: [], outputCount: 1 });
      validateCanonicalGenerationCapabilities(request, candidate);
      return { extensionSource: media, materialize: async () => {
        await requireStudioMediaSource(actor, selected, input, dependencies);
        const current = await resolveStudioLumaGenerationSource(actor.userId, selected, dependencies.lumaSourceExecutor);
        if (current.fingerprint !== source.fingerprint) throw new AgentApiError('REFERENCE_INVALID', 'The source generation changed.');
        return request as CanonicalGenerationRequest & { surface: 'video' };
      } };
    }
    const legacy = !action.modelId && action.settings == null;
    // Validate model/parameters/roles before resolving images or promoting job outputs.
    let derivedSettings:Record<string,number>={};
    const build = (assetIds: string[],correctable=false,resolvedReferences?:ResolvedReference[]) => {try {return canonicalPreparation(() => {
      const request = normalizeGenerationRequest({schemaVersion: 1, surface: 'video', engineId: candidate.engine.id, mode, prompt: action.prompt, ...(operation ? { operation: operation } : {}), ...(action.elements ? {elements:action.elements}:{}),
        settings: {...videoDefaults(candidate, mode, action.aspectRatio, legacy),...derivedSettings,
          ...(shotPlan ? {multiPrompt:shotPlan,durationSec:shotPlan.reduce((total,shot)=>total+shot.durationSec,0)} : {}), ...settings},
        ...(action.subjects == null ? {} : {subjects:action.subjects}),
        references: selections.map((selection, index) => ({kind: 'asset', assetId: assetIds[index], role: selection.role,
          ...(selection.slot === null || selection.slot === undefined ? {} : {slot: selection.slot})})), outputCount: 1});
      validateCanonicalGenerationCapabilities(request, candidate,{resolvedReferences});
      return request as CanonicalGenerationRequest & {surface: 'video'};
    },correctable);}catch(error){
      if(error instanceof StudioPreparationInputError)throw new StudioPreparationInputError(error.code as 'PARAMETER_INVALID'|'ENGINE_UNAVAILABLE'|'REFERENCE_INVALID',error.message,projectAgentModelModeDetails(candidate,mode));
      throw error;
    }};
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
    let extensionSource:StudioResolvedMedia|undefined;
    const nativeBaselines=new Map<number,ResolvedReference>();
    const nativeImageHashes=new Map<number,string>();
    const used=new Set<string>();
    const referenceFactsSignal=AbortSignal.timeout(8_000);
    for (const [index,selection]of selections.entries()){
      const canonicalRef=preflight.references.find(reference=>reference.kind==='asset'&&reference.assetId===preflightIds[index]&&reference.role===selection.role
        &&(selection.slot==null?!used.has(JSON.stringify([reference.assetId,reference.role,reference.slot])):reference.slot===selection.slot))!;
      used.add(JSON.stringify([canonicalRef.kind==='asset'?canonicalRef.assetId:'',canonicalRef.role,canonicalRef.slot]));
      const identity={assetId:preflightIds[index],role:selection.role,...(canonicalRef.slot===undefined?{}:{slot:canonicalRef.slot})};
      const raw=selection.ref.type==='job-output'?await requireStudioMediaSource(actor,selection.ref,input,dependencies):null;
      const media=await requireStudioMediaSource(actor,selection.ref,input,dependencies,referenceFactsSignal);
      if(mode==='extend'&&selection.role==='source')extensionSource=raw??media;
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
    if (isMeasuredSourceOperation(operation)) {
      for (let index=0; index<resolvedReferences.length; index++) {
        resolvedReferences[index]=await qualifyMeasuredSource(resolvedReferences[index],operation,actor.userId,dependencies);
        if(isH3SourceOperation(operation)&&selections[index].ref.type==='job-output' && resolvedReferences[index].mediaKind==='image')
          nativeImageHashes.set(index,await (dependencies.hashH3Image??hashH3PromotionImage)(resolvedReferences[index].storageUrl,actor.userId));
      }
    }
    if(operation !== 'kling-edit' && !isMeasuredSourceOperation(operation)&&!Object.hasOwn(settings,'durationSec')&&videoDurationPolicy(candidate.engine,mode,candidate.modeCaps[mode])!=='requested'){
      const duration=resolvedReferences.find(reference=>reference.role==='source')?.durationSec;
      if(typeof duration==='number')derivedSettings={durationSec:Math.max(1,Math.ceil(duration))};
    }
    build(preflightIds,true,resolvedReferences);
    let preparedFingerprint:string|undefined;
    return {extensionSource,extensionOutput:candidate.modeCaps[mode]?.extensionOutput,referenceFingerprint:()=>preparedFingerprint,materialize:async()=>{
      const verifyNativeSources=async()=>{
        for(const [index,selection]of selections.entries())if(selection.ref.type==='job-output'){
          const media=await requireStudioMediaSource(actor,selection.ref,input,dependencies);
          const previous=nativeBaselines.get(index)!;const current=mediaReference(media,{assetId:previous.assetId,role:previous.role,...(previous.slot===undefined?{}:{slot:previous.slot})});
          if(!sameReferenceFacts(previous,current))
            throw new AgentApiError('REFERENCE_INVALID','The project output changed before quote preparation. Send a new message to review it again.');
          if(isMeasuredSourceOperation(operation)) {
            // Native images were already compared with their raw baseline above.
            // Completed byte-size facts may come from HEAD/a saved copy and are not
            // present on the raw output row. Their freshness is bound by the byte hash.
            const measured=current.mediaKind==='video'
              ? await qualifyMeasuredSource(current,operation,actor.userId,dependencies) : undefined;
            const imageHash=nativeImageHashes.has(index) ? await (dependencies.hashH3Image??hashH3PromotionImage)(current.storageUrl,actor.userId) : undefined;
            if((measured && !sameReferenceFacts(resolvedReferences[index],measured)) || (nativeImageHashes.has(index) && imageHash!==nativeImageHashes.get(index)))
              throw new AgentApiError('REFERENCE_INVALID','The project output bytes changed before quote preparation.');
          }
        }
      };
      // Check the entire ready-output selection before the first library write.
      await verifyNativeSources();
      const promotions:Awaited<ReturnType<typeof promoteStudioMediaSource>>[]=[];
      for (const [index,selection]of selections.entries()) promotions.push(await promoteStudioMediaSource(actor, selection.ref, dependencies,resolvedReferences[index],isMeasuredSourceOperation(operation)));
      const assetIds=promotions.map(promotion=>promotion.assetId);
      // Copy time is separate from preflight. Reauthorize native outputs again;
      // Measured source operations also reject changed bytes during promotion.
      await verifyNativeSources();
      const request=build(assetIds,false,resolvedReferences.map((reference,index)=>({...reference,assetId:assetIds[index]})));
      if(dependencies.reviewedReferences || isMeasuredSourceOperation(operation)){
        const current=await factories.video(actor,{enabled}).resolveReferences(request);
        for(const [index,selection]of selections.entries()){
          if(selection.ref.type!=='asset' && !isMeasuredSourceOperation(operation))continue;
          // Only the URL/display-name transition certified by the save owner is allowed.
          // All measured fields, source hash and role/slot stay bound to the original.
          const previous={...resolvedReferences[index],assetId:assetIds[index],...(promotions[index].promoted??{})};
          const next=current.find(reference=>reference.assetId===previous.assetId&&reference.role===previous.role&&reference.slot===previous.slot);
          if(!next||!matchesReviewedReference(previous,next))
            throw new AgentApiError('REFERENCE_INVALID','The selected references changed before quote preparation. Send a new message to review them again.');
          if(next && nativeImageHashes.has(index) && await (dependencies.hashH3Image??hashH3PromotionImage)(next.storageUrl,actor.userId)!==nativeImageHashes.get(index))
            throw new AgentApiError('REFERENCE_INVALID','The promoted image bytes changed before quote preparation.');
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

export async function studioLumaPricingSource(actor: StudioGenerationActor,
  selections: NonNullable<Extract<StudioMediaIntent, { action: 'video.prepare' }>['references']>,
  input: Pick<ImageTurnInput, 'references' | 'attachments'>) {
  if (selections.length !== 1 || selections[0].role !== 'source') throw new AgentApiError('REFERENCE_REQUIRED', 'Select one attached or ready project generation.');
  await requireStudioMediaSource(actor, selections[0].ref, input, {});
  const source = await resolveStudioLumaGenerationSource(actor.userId, selections[0].ref);
  return { sourceJobId: source.sourceJobId, sourceOutputId: source.sourceOutputIdentity, references: [] };
}

export async function studioFluxPricingSource(actor:StudioGenerationActor,selections:NonNullable<Extract<StudioMediaIntent,{action:'video.prepare'}>['references']>,input:Pick<ImageTurnInput,'references'|'attachments'>) {
  if(selections.length!==1||selections[0].role!=='source')throw new AgentApiError('REFERENCE_REQUIRED','Select one owned Draft generation.');
  await requireStudioMediaSource(actor,selections[0].ref,input,{});
  const source=await resolveStudioFluxDraftSource(actor.userId,selections[0].ref);
  return {sourceJobId:source.jobId,sourceOutputId:source.outputId,references:[]};
}
