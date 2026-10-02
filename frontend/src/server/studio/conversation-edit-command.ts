import {createHash} from 'node:crypto';
import {withDbTransaction, type QueryExecutor} from '@/lib/db';
import {applyConversationTimelineEdit, conversationTimelineCommandSchema} from '@/lib/studio/conversation-timeline-editing';
import type {ConversationTimelineCommand} from '@/lib/studio/conversation-timeline-editing';
import type {WorkspaceAssetRecord, WorkspaceTimelineItem, WorkspaceTimelineTrack, WorkspaceProjectSettings} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {buildWorkspaceTimelineItemsForAsset, insertWorkspaceTimelineItems, timelineEditTouchesLockedTracks} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-editing';
import {createWorkspaceSequenceRecord} from '@/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state';
import {timelineFrameToSeconds, secondsToTimelineFrame} from '@/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-frames';
import {readStudioWorkspace, saveStudioWorkspace} from './workspace-command';
import {StudioConnectedPersistenceError} from './montage-command';
import {resolveStudioMedia} from './media-resolver';
import {assertStudioConnectedSchemaReady} from './connected-schema';
export {createStudioConversationProject} from './conversation-project-command';

type TransactionRunner = <T>(callback: (executor: QueryExecutor) => Promise<T>) => Promise<T>;
export type ConversationEditResult = {projectId: string; sequenceId: string; revision: number; clipCount: number; totalFrames: number;changed: boolean;clip: {id: string;startFrame: number;durationFrames: number;sourceInFrame: number} | null};
export type ConversationEditDependencies = {withTransaction?: TransactionRunner; featureEnabled?: boolean; afterMutation?: (executor: QueryExecutor, result: ConversationEditResult) => Promise<void> | void};

/** Same typed mutation owner for authenticated gestures and director tools. No provider, billing or request DDL. */
export async function editStudioConversationTimeline(actor: {userId: string}, rawInput: unknown, dependencies: ConversationEditDependencies = {}): Promise<ConversationEditResult> {
  if (dependencies.featureEnabled !== true) throw new Error('STUDIO_CONVERSATION_EDITING_DISABLED');
  if (!actor.userId || actor.userId !== actor.userId.trim()) throw new Error('UNAUTHORIZED');
  const parsed = conversationTimelineCommandSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error('Invalid Studio timeline command.');
  const input = parsed.data;
  const kind = 'conversation_timeline_edit';
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const run = dependencies.withTransaction ?? ((callback) => withDbTransaction(callback));
  return run(async executor => {
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
    const state = sequence.timelineState as {timelineItems: WorkspaceTimelineItem[]; lockedTimelineTracks?: WorkspaceTimelineTrack[]};
    const workspace = project.workspaceState as Record<string, unknown>;
    const existingAssets = Array.isArray(workspace.projectAssets) ? workspace.projectAssets as WorkspaceAssetRecord[] : [];
    let projectAssets = existingAssets;
    let items: WorkspaceTimelineItem[];
    if (input.edit.kind === 'insert') {
      const inserted = await insertion(actor,input,settings,executor);
      items = insertWorkspaceTimelineItems({items: state.timelineItems, newItems: inserted.items, mode: 'insert', playheadSec: timelineFrameToSeconds(input.edit.startFrame,settings.fps), idSeed: requestHash.slice(0,20)});
      if (timelineEditTouchesLockedTracks(state.timelineItems,items,state.lockedTimelineTracks ?? [])) throw new Error('Timeline track is locked.');
      if (!existingAssets.some(asset => JSON.stringify(asset.ref) === JSON.stringify(inserted.asset.ref))) projectAssets = [...existingAssets,inserted.asset];
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
    const changedClip = input.edit.kind === 'insert' ? items.find(item => !state.timelineItems.some(previous => previous.id === item.id)) : items.find(item => input.edit.kind !== 'insert' && item.id === input.edit.clipId);
    const result = {projectId: project.id, sequenceId: sequence.id, revision: saved.revision, clipCount: items.length,changed: JSON.stringify(items) !== JSON.stringify(state.timelineItems),
      clip: changedClip ? {id: changedClip.id,startFrame: secondsToTimelineFrame(changedClip.startSec,settings.fps),durationFrames: secondsToTimelineFrame(changedClip.durationSec,settings.fps),sourceInFrame: secondsToTimelineFrame(changedClip.sourceStartSec ?? 0,settings.fps)} : null,
      totalFrames: secondsToTimelineFrame(items.reduce((end,item) => Math.max(end,item.startSec + item.durationSec),0),settings.fps)};
    await executor.query(`INSERT INTO studio_project_commands(user_id,command_kind,command_version,idempotency_key,request_hash,project_id,sequence_id,request_payload,safe_result) VALUES($1,$2,1,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,[actor.userId,kind,input.idempotencyKey,requestHash,project.id,sequence.id,JSON.stringify(input),JSON.stringify(result)]);
    await dependencies.afterMutation?.(executor,result);
    return result;
  });
}

async function insertion(actor: {userId: string}, input: ConversationTimelineCommand, settings: WorkspaceProjectSettings, executor: QueryExecutor) {
  if (input.edit.kind !== 'insert') throw new Error('Invalid Studio timeline command.');
  const edit = input.edit;
  if (edit.ref.type === 'job-output') {
    const rows = await executor.query(`SELECT o.id FROM job_outputs o JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=o.user_id JOIN mcp_generation_quotes q ON q.job_id=j.job_id AND q.user_id=j.user_id WHERE o.id=$1 AND o.job_id=$2 AND o.user_id=$3 AND q.studio_project_id=$4 AND q.auth_origin='studio-session' AND q.state='accepted' AND j.status='completed' AND j.hidden IS NOT TRUE AND o.status='ready' FOR SHARE OF o,j,q`,[edit.ref.outputId,edit.ref.jobId,actor.userId,input.projectId]);
    if (!rows[0]) throw new Error('MEDIA_NOT_AVAILABLE');
  }
  const media = await resolveStudioMedia(actor.userId,edit.ref,(sql,values) => executor.query(sql,values),{lockAsset: true});
  const durationSec = timelineFrameToSeconds(edit.durationFrames,settings.fps);
  if (durationSec < 1 || durationSec > 1800) throw new Error('Invalid Studio timeline clip duration.');
  if (media.kind !== 'image' && (!media.mediaFacts?.durationSec || media.mediaFacts.source !== 'probe')) throw new Error('MEDIA_METADATA_REQUIRED');
  if (media.kind !== 'image' && durationSec > media.mediaFacts!.durationSec! + .000001) throw new Error('Invalid Studio timeline clip duration.');
  const id = createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0,24);
  const asset: WorkspaceAssetRecord = {id: `studio-media-${media.id}`,ref: media.ref,kind: media.kind,filename: media.originalName ?? `${media.kind} clip`,subtitle: media.kind,url: media.url,mimeType: media.mime,thumbUrl: media.thumbUrl ?? undefined,mediaFacts: media.mediaFacts,mediaAccessRequired: true,durationSec: media.mediaFacts?.durationSec,width: media.mediaFacts?.width,height: media.mediaFacts?.height,hasAudio: media.mediaFacts?.hasAudio,audioProvenance: media.mediaFacts?.hasAudio ? 'embedded' : 'none'};
  const drafts = buildWorkspaceTimelineItemsForAsset({assetNodeId: asset.id,title: asset.filename,asset,startSec: 0,idSeed: id});
  const draft = drafts[0];
  if (!draft) throw new Error('MEDIA_NOT_AVAILABLE');
  const item: WorkspaceTimelineItem = {...draft,id: `clip-${id}`,ref: media.ref,mediaFacts: media.mediaFacts,linkedGroupId: null,linkedGroupKind: null,mediaAccessRequired: true,sourceStartSec: 0,sourceDurationSec: media.kind === 'image' ? durationSec : media.mediaFacts!.durationSec,durationSec, audioMix: {volume: 100,muted: false}};
  return {asset,items: [item]};
}
