import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {withDbTransaction,type QueryExecutor} from '@/lib/db';
import {createWorkspaceSequenceRecord} from '@/app/(core)/(workspace)/app/studio/_shared/_state/workspace-state';
import {assertStudioConnectedSchemaReady} from './connected-schema';
import {StudioConnectedPersistenceError} from './montage-command';

/** Keep the journal, generated assets and billing records intact. Both clients list live projects only. */
export async function removeStudioConversationProject(actor: {userId: string; projectId: string}) {
  const scope = [actor.userId, actor.projectId];
  return withDbTransaction(async tx => {
    // Enqueue takes a share lock on the same project before it can start work.
    const project = await tx.query(
      `SELECT id FROM studio_projects WHERE user_id=$1 AND id=$2
       AND persistence_mode='connected' AND deleted_at IS NULL FOR UPDATE`, scope);
    if (!project.length) return 'missing';
    const working = await tx.query(
      `SELECT 1 FROM studio_tasks WHERE user_id=$1 AND project_id=$2 AND state IN ('queued','running','unknown')
       UNION ALL SELECT 1 FROM studio_image_turns WHERE user_id=$1 AND project_id=$2
       AND state='thinking' AND lease_expires_at > clock_timestamp()
       LIMIT 1`, scope);
    if (working.length) return 'busy';
    await tx.query('UPDATE studio_projects SET deleted_at=NOW(), updated_at=NOW() WHERE user_id=$1 AND id=$2', scope);
    return 'removed';
  });
}

const inputSchema = z.object({name: z.string().trim().min(1).max(200),idempotencyKey: z.string().min(1).max(128)}).strict();
type Result = {projectId: string;sequenceId: string;revision: number};
type TransactionRunner = <T>(callback: (executor: QueryExecutor) => Promise<T>) => Promise<T>;

/** Creates a fresh canonical empty sequence. Existing canvas projects are never converted. */
export async function createStudioConversationProject(actor: {userId: string},rawInput: unknown,dependencies: {featureEnabled?: boolean;withTransaction?: TransactionRunner} = {}): Promise<Result> {
  if (dependencies.featureEnabled !== true) throw new Error('STUDIO_CONVERSATION_EDITING_DISABLED');
  if (!actor.userId || actor.userId !== actor.userId.trim()) throw new Error('UNAUTHORIZED');
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) throw new Error('Invalid Studio conversation project.');
  const input = parsed.data;
  const kind = 'create_studio_conversation';
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const run = dependencies.withTransaction ?? (callback => withDbTransaction(callback));
  return run(async executor => {
    await assertStudioConnectedSchemaReady(executor);
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${actor.userId}:${kind}:${input.idempotencyKey}`]);
    const receipts = await executor.query<{request_hash: string;safe_result: Result}>(`SELECT request_hash,safe_result FROM studio_project_commands WHERE user_id=$1 AND command_kind=$2 AND command_version=1 AND idempotency_key=$3`,[actor.userId,kind,input.idempotencyKey]);
    if (receipts[0]) {
      if (receipts[0].request_hash !== hash) throw new StudioConnectedPersistenceError('STUDIO_IDEMPOTENCY_CONFLICT',409);
      const alive = await executor.query(`SELECT id FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR SHARE`,[receipts[0].safe_result.projectId,actor.userId]);
      if (!alive.length) throw new Error('STUDIO_PROJECT_NOT_FOUND');
      return receipts[0].safe_result;
    }
    const projectId = `project_${randomUUID()}`;
    const sequenceId = `sequence_${randomUUID()}`;
    const settings = {fps: 30 as const,aspectRatio: '16:9' as const,resolution: '720p' as const};
    const sequence = createWorkspaceSequenceRecord({id: sequenceId,name: 'Main sequence',timelineItems: [],projectSettings: settings});
    const timelineState = {timelineItems: [],audioTrackCount: sequence.audioTrackCount,videoTrackCount: sequence.videoTrackCount,hiddenVideoTracks: [],lockedTimelineTracks: [],mutedAudioTracks: [],timelinePanelHeight: null,timelineInPointSec: null,timelineOutPointSec: null};
    const workspace = {nodes: [],edges: [],timelineItems: [],sequences: [],activeSequenceId: sequenceId,activeTemplateId: 'minimal-start',projectSettings: settings,projectAssets: [],projectMediaFolders: [],focusMode: 'viewer'};
    await executor.query(`INSERT INTO studio_projects(id,user_id,name,canvas_template_id,settings,workspace_state,persistence_mode,revision) VALUES($1,$2,$3,'minimal-start',$4::jsonb,$5::jsonb,'connected',0)`,[projectId,actor.userId,input.name,JSON.stringify(settings),JSON.stringify(workspace)]);
    await executor.query(`INSERT INTO studio_sequences(id,user_id,project_id,name,settings,timeline_state) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,[sequenceId,actor.userId,projectId,sequence.name,JSON.stringify(settings),JSON.stringify(timelineState)]);
    const result = {projectId,sequenceId,revision: 0};
    await executor.query(`INSERT INTO studio_project_commands(user_id,command_kind,command_version,idempotency_key,request_hash,project_id,sequence_id,request_payload,safe_result) VALUES($1,$2,1,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,[actor.userId,kind,input.idempotencyKey,hash,projectId,sequenceId,JSON.stringify(input),JSON.stringify(result)]);
    return result;
  });
}
