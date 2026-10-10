import {createHash} from 'node:crypto';
import {withDbTransaction, type QueryExecutor} from '@/lib/db';
import {applyConversationTimelineEdit, conversationTimelineCommandSchema} from '@/lib/studio/conversation-timeline-editing';
import type {ConversationTimelineCommand} from '@/lib/studio/conversation-timeline-editing';
import type {WorkspaceAssetRecord, WorkspaceTimelineItem, WorkspaceTimelineTrack, WorkspaceProjectSettings} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
import {buildWorkspaceTimelineItemsForAsset, insertWorkspaceTimelineItems, layerWorkspaceTimelineAudioItem, timelineEditTouchesLockedTracks} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-editing';
import {createWorkspaceSequenceRecord, MAX_TIMELINE_AUDIO_TRACKS} from '@/app/(core)/(workspace)/app/studio/_shared/_state/workspace-state';
import {timelineFrameToSeconds, secondsToTimelineFrame} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/timeline/timeline-frames';
import {workspaceProjectDimensions} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-project-settings';
import {buildWorkspaceClipComposition} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-clip-composition';
import {readStudioWorkspace, saveStudioWorkspace} from './workspace-command';
import {StudioConnectedPersistenceError} from './montage-command';
import {resolveStudioMedia} from './media-resolver';
import {assertStudioConnectedSchemaReady} from './connected-schema';
import {hydrateOwnedVideoMediaFacts} from '@/server/media-library/owned-video-facts';
import type {StudioResolvedMedia} from './media-resolver';
export {createStudioConversationProject} from './conversation-project-command';

type TransactionRunner = <T>(callback: (executor: QueryExecutor) => Promise<T>) => Promise<T>;
export type ConversationEditResult = {projectId: string; sequenceId: string; revision: number; clipCount: number; totalFrames: number;changed: boolean;clip: {id: string;startFrame: number;durationFrames: number;sourceInFrame: number} | null};
export type ConversationEditDependencies = {withTransaction?: TransactionRunner; featureEnabled?: boolean; hydrateVideoFacts?: typeof hydrateOwnedVideoMediaFacts; afterMutation?: (executor: QueryExecutor, result: ConversationEditResult) => Promise<void> | void};
/** OAuth identity is derived by the agent adapter; browser/session calls retain project-output scope. */
export type ConversationEditActor = {userId: string; authOrigin?: 'studio-session'; clientId?: null}
  | {userId: string; authOrigin: 'oauth'; clientId: string};

class VideoFactsPreparationRequired extends Error {
  constructor(readonly media: StudioResolvedMedia) { super('MEDIA_METADATA_REQUIRED'); }
}

/** Same typed mutation owner for authenticated gestures and director tools. No provider, billing or request DDL. */
export async function editStudioConversationTimeline(actor: ConversationEditActor, rawInput: unknown, dependencies: ConversationEditDependencies = {}): Promise<ConversationEditResult> {
  if (dependencies.featureEnabled !== true) throw new Error('STUDIO_CONVERSATION_EDITING_DISABLED');
  if (!actor.userId || actor.userId !== actor.userId.trim()) throw new Error('UNAUTHORIZED');
  if (actor.authOrigin === 'oauth' && (!actor.clientId || actor.clientId !== actor.clientId.trim() || actor.clientId.length > 256)) throw new Error('UNAUTHORIZED');
  const parsed = conversationTimelineCommandSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error('Invalid Studio timeline command.');
  const input = parsed.data;
  const kind = 'conversation_timeline_edit';
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const run = dependencies.withTransaction ?? ((callback) => withDbTransaction(callback));
  const selectedInserts = input.edit.kind === 'insert' ? [input.edit] : input.edit.kind === 'assemble' ? input.edit.clips : [];
  const selectedVideoRefs = new Set(selectedInserts.filter(edit => edit.ref.kind === 'video').map(edit => JSON.stringify(edit.ref)));
  const preparedVideoSources = new Map<string,string>();
  const mutate = () => run(async executor => {
    await assertStudioConnectedSchemaReady(executor);
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${actor.userId}:${kind}:${input.idempotencyKey}`]);
    // Exclusive aggregate lock precedes snapshot reads, including receipt replay.
    const projects = await executor.query<{id: string}>(`SELECT id FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE`, [input.projectId, actor.userId]);
    if (!projects[0]) throw new Error('STUDIO_PROJECT_NOT_FOUND');
    const receipts = await executor.query<{request_hash: string; safe_result: ConversationEditResult}>(`SELECT request_hash,safe_result FROM studio_project_commands WHERE user_id=$1 AND command_kind=$2 AND command_version=1 AND idempotency_key=$3`, [actor.userId,kind,input.idempotencyKey]);
    if (receipts[0]) {
      if (receipts[0].request_hash !== requestHash) throw new StudioConnectedPersistenceError('STUDIO_IDEMPOTENCY_CONFLICT',409);
      await dependencies.afterMutation?.(executor, receipts[0].safe_result);
      return receipts[0].safe_result;
    }
    const sameTransaction: TransactionRunner = callback => callback(executor);
    const {project, sequences} = await readStudioWorkspace(actor,input.projectId,{withTransaction: sameTransaction});
    if (project.revision !== input.expectedRevision) throw new StudioConnectedPersistenceError('STUDIO_REVISION_CONFLICT',409);
    const sequence = sequences.find(value => value.id === input.sequenceId);
    if (!sequence) throw new Error('STUDIO_SEQUENCE_CONFLICT');
    const settings = sequence.settings as WorkspaceProjectSettings;
    const state = sequence.timelineState as {timelineItems: WorkspaceTimelineItem[]; lockedTimelineTracks?: WorkspaceTimelineTrack[]; mutedAudioTracks?: WorkspaceTimelineTrack[]};
    const workspace = project.workspaceState as Record<string, unknown>;
    const existingAssets = Array.isArray(workspace.projectAssets) ? workspace.projectAssets as WorkspaceAssetRecord[] : [];
    let projectAssets = existingAssets;
    let items: WorkspaceTimelineItem[];
    if (input.edit.kind === 'insert' || input.edit.kind === 'assemble') {
      const inserts=input.edit.kind==='insert'?[input.edit]:input.edit.clips.map(clip=>({kind:'insert' as const,...clip}));
      items=state.timelineItems;
      for(const [index,edit] of inserts.entries()){
        const inserted = await insertion(actor,{...input,edit,idempotencyKey:requestHash.slice(0,32)+':'+index},settings,executor,preparedVideoSources.get(JSON.stringify(edit.ref)));
        const previousItems=items;
        items = inserted.asset.kind === 'audio'
          ? layerWorkspaceTimelineAudioItem({items: previousItems,item: inserted.items[0],startFrame: edit.startFrame,fps: settings.fps,maxAudioTracks: MAX_TIMELINE_AUDIO_TRACKS,unavailableTracks: [...state.lockedTimelineTracks ?? [],...state.mutedAudioTracks ?? []]})
          : insertWorkspaceTimelineItems({items: previousItems, newItems: inserted.items, mode: 'insert', playheadSec: timelineFrameToSeconds(edit.startFrame,settings.fps), idSeed: requestHash.slice(0,20)+':'+index});
        if (timelineEditTouchesLockedTracks(state.timelineItems,items,state.lockedTimelineTracks ?? [])) throw new Error('Timeline track is locked.');
        if (!projectAssets.some(asset => JSON.stringify(asset.ref) === JSON.stringify(inserted.asset.ref))) projectAssets = [...projectAssets,inserted.asset];
      }
    } else items = applyConversationTimelineEdit(state.timelineItems,input.edit,settings.fps,state.lockedTimelineTracks ?? []);
    const canonicalSequences = sequences.map(value => createWorkspaceSequenceRecord({
      ...value.timelineState as Parameters<typeof createWorkspaceSequenceRecord>[0],
      id: value.id, name: value.name, projectSettings: value.settings as WorkspaceProjectSettings,
      timelineItems: value.id === sequence.id ? items : (value.timelineState as {timelineItems: WorkspaceTimelineItem[]}).timelineItems,
      createdAt: value.createdAt, updatedAt: value.updatedAt,
    }));
    const saved = await saveStudioWorkspace(actor,{projectId: project.id, expectedRevision: input.expectedRevision, snapshot: {
      name: project.name, canvasTemplateId: project.canvasTemplateId, settings: project.settings,
      workspaceState: {...workspace, projectAssets, sequences: canonicalSequences},
    }},{withTransaction: sameTransaction});
    const changedClip = input.edit.kind === 'insert' || input.edit.kind==='assemble' ? items.find(item => !state.timelineItems.some(previous => previous.id === item.id)) : items.find(item => input.edit.kind !== 'insert' && input.edit.kind !== 'assemble' && item.id === input.edit.clipId);
    const result = {projectId: project.id, sequenceId: sequence.id, revision: saved.revision, clipCount: items.length,changed: JSON.stringify(items) !== JSON.stringify(state.timelineItems),
      clip: changedClip ? {id: changedClip.id,startFrame: secondsToTimelineFrame(changedClip.startSec,settings.fps),durationFrames: secondsToTimelineFrame(changedClip.durationSec,settings.fps),sourceInFrame: secondsToTimelineFrame(changedClip.sourceStartSec ?? 0,settings.fps)} : null,
      totalFrames: secondsToTimelineFrame(items.reduce((end,item) => Math.max(end,item.startSec + item.durationSec),0),settings.fps)};
    await executor.query(`INSERT INTO studio_project_commands(user_id,command_kind,command_version,idempotency_key,request_hash,project_id,sequence_id,request_payload,safe_result) VALUES($1,$2,1,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,[actor.userId,kind,input.idempotencyKey,requestHash,project.id,sequence.id,JSON.stringify(input),JSON.stringify(result)]);
    await dependencies.afterMutation?.(executor,result);
    return result;
  });
  // One qualification per selected video identity (at most 12), then a final mutation.
  for (let attempt = 0; attempt <= selectedVideoRefs.size; attempt++) {
    try { return await mutate(); }
    catch (error) {
      if (!(error instanceof VideoFactsPreparationRequired)) throw error;
      const refKey = JSON.stringify(error.media.ref);
      if (!selectedVideoRefs.has(refKey) || preparedVideoSources.has(refKey)) throw error;
      preparedVideoSources.set(refKey,error.media.url);
      // Receipt/revision/ownership validation ran first. Network inspection starts only
      // after that transaction releases its locks; every retry repeats every guard.
      await (dependencies.hydrateVideoFacts ?? hydrateOwnedVideoMediaFacts)({userId: actor.userId,ref: error.media.ref,expectedUrl: error.media.url});
    }
  }
  throw new Error('MEDIA_METADATA_REQUIRED');
}

async function insertion(actor: ConversationEditActor, input: ConversationTimelineCommand, settings: WorkspaceProjectSettings, executor: QueryExecutor, expectedUrl?: string) {
  if (input.edit.kind !== 'insert') throw new Error('Invalid Studio timeline command.');
  const edit = input.edit;
  if (edit.ref.type === 'job-output') {
    const rows = actor.authOrigin === 'oauth'
      ? await executor.query(`SELECT o.id FROM job_outputs o JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=o.user_id WHERE o.id=$1 AND o.job_id=$2 AND o.user_id=$3 AND j.status='completed' AND j.hidden IS NOT TRUE AND o.status='ready' FOR SHARE OF o,j`,[edit.ref.outputId,edit.ref.jobId,actor.userId])
      : await executor.query(`SELECT o.id FROM job_outputs o JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=o.user_id JOIN mcp_generation_quotes q ON q.job_id=j.job_id AND q.user_id=j.user_id WHERE o.id=$1 AND o.job_id=$2 AND o.user_id=$3 AND q.studio_project_id=$4 AND q.auth_origin='studio-session' AND q.state='accepted' AND j.status='completed' AND j.hidden IS NOT TRUE AND o.status='ready' FOR SHARE OF o,j,q`,[edit.ref.outputId,edit.ref.jobId,actor.userId,input.projectId]);
    if (!rows[0]) throw new Error('MEDIA_NOT_AVAILABLE');
  }
  const media = await resolveStudioMedia(actor.userId,edit.ref,(sql,values) => executor.query(sql,values),{lockAsset: true});
  if (expectedUrl !== undefined && media.url !== expectedUrl) throw new Error('MEDIA_NOT_AVAILABLE');
  const durationSec = timelineFrameToSeconds(edit.durationFrames,settings.fps);
  const sourceStartSec=timelineFrameToSeconds(edit.sourceInFrame??0,settings.fps);
  if(media.kind==='image'&&sourceStartSec!==0)throw new Error('Invalid Studio image source offset.');
  if (durationSec < 1 || durationSec > 1800) throw new Error('Invalid Studio timeline clip duration.');
  if (media.kind !== 'image' && (!media.mediaFacts?.durationSec || media.mediaFacts.source !== 'probe')) {
    if (media.kind === 'video') throw new VideoFactsPreparationRequired(media);
    throw new Error('MEDIA_METADATA_REQUIRED');
  }
  if (media.kind !== 'image' && durationSec+sourceStartSec > media.mediaFacts!.durationSec! + .000001) throw new Error('Invalid Studio timeline clip duration.');
  const id = createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0,24);
  const asset: WorkspaceAssetRecord = {id: `studio-media-${media.id}`,ref: media.ref,kind: media.kind,filename: media.originalName ?? `${media.kind} clip`,subtitle: media.kind,url: media.url,mimeType: media.mime,thumbUrl: media.thumbUrl ?? undefined,mediaFacts: media.mediaFacts,mediaAccessRequired: true,durationSec: media.mediaFacts?.durationSec,width: media.mediaFacts?.width,height: media.mediaFacts?.height,hasAudio: media.mediaFacts?.hasAudio,audioProvenance: media.mediaFacts?.hasAudio ? 'embedded' : 'none'};
  const drafts = buildWorkspaceTimelineItemsForAsset({assetNodeId: asset.id,title: asset.filename,asset,startSec: 0,idSeed: id});
  const draft = drafts[0];
  if (!draft) throw new Error('MEDIA_NOT_AVAILABLE');
  const dimensions = workspaceProjectDimensions(settings);
  const sourceWidth = media.mediaFacts?.width;const sourceHeight = media.mediaFacts?.height;
  const transform = media.kind !== 'audio' && sourceWidth && sourceHeight ? {opacity: 1,rotation: 0,positionX: 0,positionY: 0,scale: buildWorkspaceClipComposition({sequenceWidth: dimensions.width,sequenceHeight: dimensions.height,sourceWidth,sourceHeight,transform: {opacity: 1,rotation: 0,scale: 1,x: 0,y: 0}}).fitScale} : draft.transform;
  const item: WorkspaceTimelineItem = {...draft,transform,id: `clip-${id}`,ref: media.ref,mediaFacts: media.mediaFacts,linkedGroupId: null,linkedGroupKind: null,mediaAccessRequired: true,sourceStartSec,sourceDurationSec: media.kind === 'image' ? durationSec : media.mediaFacts!.durationSec,durationSec, audioMix: {volume: 100,muted: false}};
  return {asset,items: [item]};
}
