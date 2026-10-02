import {query} from '@/lib/db';
import {readMediaFacts} from '@/lib/media-identity';
import type {ToolAssetRef} from '@/lib/toolbox/contract';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import type {StudioMediaIntent} from '@/lib/studio/conversation-media-contract';
import type {StudioProjectMedia} from '@/lib/studio/conversation-action-contract';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {AgentApiError} from '@/server/agent-api/errors';
import {saveJobOutputToLibrary} from '@/server/media-library/assets';
import {createStudioImageGenerationService, createStudioVideoGenerationService} from './image-generation-service';
import {createStudioAudioGenerationService} from './audio-generation-service';
import {resolveStudioMedia} from './media-resolver';
import type {CanonicalGenerationRequest} from '@/server/agent-api/generation-types';
import type {CanonicalAudioRequest} from '@/server/agent-api/audio-normalization';

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

export async function studioMotionSource(actor: StudioGenerationActor, source: ToolAssetRef, input: ImageTurnInput, dependencies: {saveOutput?: typeof saveJobOutputToLibrary} = {}): Promise<string> {
  if (source.kind !== 'image') throw new AgentApiError('REFERENCE_INVALID', 'Choose an image to animate.');
  if (source.type === 'asset') {
    // Library media must be explicitly attached; the model cannot browse arbitrary private assets.
    if (!input.references.includes(source.assetId)) throw new AgentApiError('REFERENCE_INVALID', 'Attach this library image before using it.');
    await resolveStudioMedia(actor.userId, source);
    return source.assetId;
  }
  const outputs = await readStudioProjectMedia(actor);
  if (!outputs.some(item => item.ref.type === 'job-output' && item.ref.jobId === source.jobId && item.ref.outputId === source.outputId && item.ref.kind === source.kind))
    throw new AgentApiError('REFERENCE_INVALID', 'This image is not a ready output in this project.');
  await resolveStudioMedia(actor.userId, source);
  // Explicit creation action uses the existing idempotent library-save owner, preserving original output provenance.
  const asset = await (dependencies.saveOutput ?? saveJobOutputToLibrary)({userId: actor.userId, jobId: source.jobId, outputId: source.outputId});
  if (!asset.publicId) throw new AgentApiError('REFERENCE_INVALID', 'The image identity is unavailable.');
  await resolveStudioMedia(actor.userId, {type: 'asset', assetId: asset.publicId, kind: 'image'});
  return asset.publicId;
}

export async function studioMediaRequest(actor: StudioGenerationActor, action: StudioMediaIntent, input: ImageTurnInput, factories: StudioMediaFactories, enabled: boolean): Promise<(CanonicalGenerationRequest & {surface: 'video'}) | CanonicalAudioRequest> {
  if (action.action === 'video.prepare') {
    const mode = action.source ? 'i2v' : 't2v';
    const catalog = await factories.video(actor, {enabled}).catalog();
    if (!catalog.some(entry => entry.engine.id === 'wan-3' && entry.publicModes.includes(mode)))
      throw new AgentApiError('ENGINE_UNAVAILABLE', 'The qualified economic animation is unavailable.');
    const sourceId = action.source ? await studioMotionSource(actor, action.source, input) : null;
    return {schemaVersion: 1 as const, surface: 'video' as const, engineId: 'wan-3', mode,
      prompt: action.prompt, settings: {aspectRatio: action.aspectRatio, durationSec: 5, resolution: '480p', audio: false},
      references: sourceId ? [{kind: 'asset' as const, assetId: sourceId, role: 'first_frame' as const}] : [], outputCount: 1 as const};
  }
  const caps = await factories.audio(actor, {enabled}).catalog();
  const mode = action.action === 'voice.prepare' ? 'voice_only' : 'music_only';
  const entry = caps.modes.find(entry => entry.mode === mode);
  const variant = entry?.variants.find(variant => variant.available && (mode === 'voice_only' ? variant.settings.voiceModel === 'seed' : variant.settings.musicModel === 'clip'));
  if (!entry || !variant) throw new AgentApiError('ENGINE_UNAVAILABLE', `The qualified ${mode === 'voice_only' ? 'voice' : 'music'} provider is unavailable.`);
  return {schemaVersion: 1 as const, surface: 'audio' as const, engineId: entry.engineId, mode,
    prompt: action.action === 'music.prepare' ? action.prompt : '',
    settings: action.action === 'voice.prepare' ? {script: action.script, language: action.language, voiceModel: 'seed' as const, seedAudioOutputFormat: 'mp3' as const}
      : {musicModel: 'clip' as const, durationSec: 30, mood: action.mood}, references: [], outputCount: 1 as const};
}
