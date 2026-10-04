import {query} from '@/lib/db';
import {readMediaFacts} from '@/lib/media-identity';
import {ZodError} from 'zod';
import type {ToolAssetRef} from '@/lib/toolbox/contract';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import type {StudioMediaIntent} from '@/lib/studio/conversation-media-contract';
import {conversationSelectionSettings} from '@/lib/studio/conversation-creation-contract';
import type {StudioProjectMedia} from '@/lib/studio/conversation-action-contract';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {AgentApiError} from '@/server/agent-api/errors';
import {saveJobOutputToLibrary} from '@/server/media-library/assets';
import {createStudioImageGenerationService, createStudioVideoGenerationService} from './image-generation-service';
import {createStudioAudioGenerationService} from './audio-generation-service';
import {resolveStudioMedia} from './media-resolver';
import type {CanonicalGenerationRequest} from '@/server/agent-api/generation-types';
import {normalizeAudioGenerationRequest, audioGenerationSettingsSchema, type CanonicalAudioRequest} from '@/server/agent-api/audio-normalization';
import {GenerationNormalizationError, normalizeGenerationRequest} from '@/server/agent-api/generation-normalization';
import {GenerationCapabilityError, validateCanonicalGenerationCapabilities} from '@/server/agent-api/generation-capability-validation';
import {projectAgentModelModeDetails} from '@/server/agent-api/model-details';
import type {AgentPublicGenerationEngine} from '@/server/agent-api/model-catalog';
import {toEngineGenerationMode} from '@/server/agent-api/generation-mode-aliases';
import {normalizeVideoDurationOption} from '@/server/video-generation/execution-constraints';
import {AudioGenerationError} from '@/server/audio/audio-generate-validation';
import {StudioPreparationInputError,validateStudioPreparationInput} from './conversation-preparation-validation';

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
};

async function requireStudioImageSource(actor: StudioGenerationActor, source: ToolAssetRef, input: ImageTurnInput, dependencies: StudioMotionSourceDependencies): Promise<void> {
  if (source.kind !== 'image') throw new AgentApiError('REFERENCE_INVALID', 'Choose an image reference.');
  if (source.type === 'asset') {
    // Library media must be explicitly attached; the model cannot browse arbitrary private assets.
    if (!input.references.includes(source.assetId)) throw new AgentApiError('REFERENCE_INVALID', 'Attach this library image before using it.');
  } else {
    const outputs = await (dependencies.readProjectMedia ?? readStudioProjectMedia)(actor);
    if (!outputs.some(item => item.ref.type === 'job-output' && item.ref.jobId === source.jobId && item.ref.outputId === source.outputId && item.ref.kind === source.kind))
      throw new AgentApiError('REFERENCE_INVALID', 'This image is not a ready output in this project.');
  }
  try {await (dependencies.resolveMedia ?? resolveStudioMedia)(actor.userId, source);}
  catch {throw new AgentApiError('REFERENCE_INVALID', 'The selected image is no longer available.');}
}

async function promoteStudioImageSource(actor: StudioGenerationActor, source: ToolAssetRef, dependencies: StudioMotionSourceDependencies): Promise<string> {
  if (source.type === 'asset') return source.assetId;
  // Explicit creation action uses the existing idempotent library-save owner, preserving original output provenance.
  const asset = await (dependencies.saveOutput ?? saveJobOutputToLibrary)({userId: actor.userId, jobId: source.jobId, outputId: source.outputId});
  if (!asset.publicId) throw new AgentApiError('REFERENCE_INVALID', 'The image identity is unavailable.');
  try {await (dependencies.resolveMedia ?? resolveStudioMedia)(actor.userId, {type: 'asset', assetId: asset.publicId, kind: 'image'});}
  catch {throw new AgentApiError('REFERENCE_INVALID', 'The saved image is no longer available.');}
  return asset.publicId;
}

export async function studioMotionSource(actor: StudioGenerationActor, source: ToolAssetRef, input: ImageTurnInput, dependencies: StudioMotionSourceDependencies = {}): Promise<string> {
  await requireStudioImageSource(actor, source, input, dependencies);
  return promoteStudioImageSource(actor, source, dependencies);
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

/** Validate selection and owned sources before any draft or library write. */
export async function validateStudioMediaRequest(actor: StudioGenerationActor, action: StudioMediaIntent, input: ImageTurnInput, factories: StudioMediaFactories, enabled: boolean, dependencies: StudioMotionSourceDependencies = {}):Promise<{materialize():Promise<StudioCanonicalMediaRequest>}> {
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
      throw new StudioPreparationInputError('REFERENCE_INVALID', 'Choose either the source image or explicit image reference roles.');
    const selections = action.source ? [{ref: action.source, role: 'first_frame' as const, slot: null}] : action.references ?? [];
    if (selections.some(selection => selection.ref.kind !== 'image'))
      throw new StudioPreparationInputError('REFERENCE_INVALID', 'Only image references are available in this Studio workflow.');
    if (selections.some(({ref})=>ref.type==='asset'&&!input.references.includes(ref.assetId)))
      throw new StudioPreparationInputError('REFERENCE_INVALID','Attach this library image before using it.');
    const mode = action.mode ?? (action.source || selections.some(selection => ['source', 'first_frame', 'last_frame'].includes(selection.role)) ? 'i2v' : selections.length ? 'ref2v' : 't2v');
    if (mode==='ref2v' && !selections.length)
      throw new AgentApiError('REFERENCE_REQUIRED','Reference-to-video requires an attached or ready project reference image.');
    const catalog = await factories.video(actor, {enabled}).catalog();
    const candidate = catalog.find(entry => entry.surface === 'video' && entry.engine.id === (action.modelId ?? 'wan-3'));
    if (!candidate) throw new StudioPreparationInputError('ENGINE_UNAVAILABLE', 'The selected video model is unavailable in this Studio workflow.');
    if (!candidate.publicModes.includes(mode) || !candidate.modeCaps[mode])
      throw new AgentApiError('MODE_UNSUPPORTED', 'The selected video model does not support this Studio mode.');
    const legacy = !action.modelId && action.settings == null;
    // Validate model/parameters/roles before resolving images or promoting job outputs.
    const build = (assetIds: string[],correctable=false) => canonicalPreparation(() => {
      const request = normalizeGenerationRequest({schemaVersion: 1, surface: 'video', engineId: candidate.engine.id, mode, prompt: action.prompt,
        settings: {...videoDefaults(candidate, mode, action.aspectRatio, legacy), ...settings},
        references: selections.map((selection, index) => ({kind: 'asset', assetId: assetIds[index], role: selection.role,
          ...(selection.slot === null || selection.slot === undefined ? {} : {slot: selection.slot})})), outputCount: 1});
      validateCanonicalGenerationCapabilities(request, candidate);
      return request as CanonicalGenerationRequest & {surface: 'video'};
    },correctable);
    const outputIdentities = new Map<string, string>();
    build(selections.map(({ref}, index) => {
      if (ref.type === 'asset') return ref.assetId;
      const identity = JSON.stringify([ref.jobId, ref.outputId]);
      if (!outputIdentities.has(identity)) outputIdentities.set(identity, `project-output-${index}`);
      return outputIdentities.get(identity)!;
    }),true);
    // Check every source before the first library write; an unattached later
    // selection must not cause an earlier ready output to be promoted.
    for (const selection of selections) await requireStudioImageSource(actor, selection.ref, input, dependencies);
    return {materialize:async()=>{
      const assetIds: string[] = [];
      for (const selection of selections) assetIds.push(await promoteStudioImageSource(actor, selection.ref, dependencies));
      return build(assetIds);
    }};
  }
  const caps = await factories.audio(actor, {enabled}).catalog();
  const mode = action.action === 'voice.prepare' ? 'voice_only' : 'music_only';
  const entry = caps.modes.find(entry => entry.mode === mode && (!action.modelId || entry.engineId === action.modelId));
  const key = mode === 'voice_only' ? 'voiceModel' : 'musicModel';
  canonicalPreparation(() => audioGenerationSettingsSchema.parse(settings),true);
  const variant = entry?.variants.find(variant => variant.available && variant.settings[key] === (settings[key] ?? (mode === 'voice_only' ? 'seed' : 'clip')))
    ?? (settings[key] === undefined ? entry?.variants.find(variant => variant.available) : undefined);
  if (!entry) throw new StudioPreparationInputError('ENGINE_UNAVAILABLE','This Audio model ID is not in the current Studio catalog. Use its top-level modelId and select the provider through settings.');
  if (!variant) throw new AgentApiError('ENGINE_UNAVAILABLE', `The qualified ${mode === 'voice_only' ? 'voice' : 'music'} provider is unavailable.`);
  const defaultDuration = 'clipSeconds' in entry.duration && variant.settings.musicModel === 'clip' ? entry.duration.clipSeconds
    : 'suggestedSeconds' in entry.duration ? entry.duration.suggestedSeconds?.find(seconds => seconds > 30) ?? 30 : 30;
  const request = canonicalPreparation(() => normalizeAudioGenerationRequest({schemaVersion: 1, surface: 'audio', engineId: entry.engineId, mode,
    prompt: action.action === 'music.prepare' ? action.prompt : '',
    settings: {...variant.settings, ...(action.action === 'voice.prepare' ? {script: action.script, language: action.language,
      ...(variant.settings.voiceModel === 'seed' ? {seedAudioOutputFormat: 'mp3'} : {})} : {durationSec: defaultDuration, mood: action.mood}), ...settings},
    references: [], outputCount: 1}),true);
  for (const [name, value] of Object.entries(settings)) {
    const normalized = request.settings[name as keyof CanonicalAudioRequest['settings']];
    if (normalized !== (typeof value === 'string' ? value.trim() : value))
      throw new StudioPreparationInputError('PARAMETER_INVALID', `${name} is not supported with the selected Audio variant.`);
  }
  return {materialize:async()=>request};
}

export async function studioMediaRequest(actor: StudioGenerationActor, action: StudioMediaIntent, input: ImageTurnInput, factories: StudioMediaFactories, enabled: boolean, dependencies: StudioMotionSourceDependencies = {}):Promise<StudioCanonicalMediaRequest> {
  return (await validateStudioMediaRequest(actor,action,input,factories,enabled,dependencies)).materialize();
}
