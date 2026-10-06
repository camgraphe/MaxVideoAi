import {automaticallyNameStudioProject} from './conversation-project-naming';
import {assistanceError, reserveStudioAssistanceCall, settleStudioAssistanceCall, markStudioAssistanceUnknown, stopStudioAssistanceReplay, type AssistanceCall} from './assistance-ledger';
import type {StudioAssistancePolicy} from './assistance-policy';
import {studioPreparedExportSchema} from '@/lib/studio/conversation-export-contract';
import {createHash} from 'node:crypto';
import {query, withDbTransaction, type TransactionQueryExecutor} from '@/lib/db';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {AgentApiError} from '@/server/agent-api/errors';
import {requireGenerationActor, type StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {studioMemorySchema, type StudioActionRequest, type StudioActionResult, type StudioConversationProject, type StudioConversationMemory} from '@/lib/studio/conversation-action-contract';
import type {StoredImageTurn} from './image-conversation-repository';
import {isReplayableStudioResponse, type StudioDirectorResponse} from './conversation-director';
import {readStudioAnalysisFacts} from './media-analysis/repository';
import type {ImageModelUsage} from './image-model-usage';
import {projectStudioConversationQuotes,STUDIO_QUOTE_SETTING_KEYS,type StudioConversationQuoteRow} from './conversation-quote-facts';

export async function readStudioConversationProject(actor: StudioGenerationActor,options:{exportsEnabled?:boolean}={}): Promise<StudioConversationProject> {
  requireGenerationActor(actor);
  const row = (await query<{name: string; revision: number | string; memory_revision: number | string | null; brief: string | null; decisions: string[] | null}>(`
    SELECT p.name, p.revision, m.revision AS memory_revision, m.brief, m.decisions FROM studio_projects p
    LEFT JOIN studio_conversation_memory m ON m.project_id = p.id AND m.user_id = p.user_id
    WHERE p.id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL`, [actor.projectId, actor.userId]))[0];
  if (!row) throw new AgentApiError('PARAMETER_INVALID', 'This Studio project is not available.');
  const quoteRows = await query<StudioConversationQuoteRow>(`
    SELECT q.quote_id AS "quoteId",q.request_json->>'surface' AS surface,q.state AS "quoteState",q.job_id AS "jobId",j.status,
      q.price_cents AS "amountCents",q.currency,q.expires_at AS "expiresAt",clock_timestamp() AS "databaseNow",
      q.request_json->>'engineId' AS "modelId",q.request_json->>'mode' AS mode,q.request_json->'outputCount' AS "outputCount",
      q.pricing_snapshot->'canonicalPricing'->'meta'->'output_duration_sec' AS "outputDurationSec",
      (SELECT jsonb_object_agg(key,value) FROM jsonb_each(q.request_json->'settings') WHERE key=ANY($3::text[])) AS settings,
      jsonb_array_length(q.request_json->'references') AS "referenceCount",
      ARRAY(SELECT reference->>'role' FROM jsonb_array_elements(q.request_json->'references') AS reference) AS "referenceRoles"
    FROM studio_image_turns t JOIN mcp_generation_quotes q ON q.quote_id=t.quote_id AND q.user_id=t.user_id AND q.studio_project_id=t.project_id
    LEFT JOIN app_jobs j ON j.job_id=q.job_id AND j.user_id=q.user_id
    WHERE t.user_id=$1 AND t.project_id=$2 AND q.auth_origin='studio-session' ORDER BY t.created_at DESC LIMIT 30`, [actor.userId, actor.projectId,STUDIO_QUOTE_SETTING_KEYS]);
  const generations = projectStudioConversationQuotes(quoteRows);
  const analyses=await readStudioAnalysisFacts(actor);
  const exports = options.exportsEnabled ? await query<{safe_result: unknown}>(`SELECT safe_result FROM studio_project_commands WHERE user_id=$1 AND project_id=$2 AND command_kind='timeline_export_prepare' AND command_version=1 AND request_payload->'scope'->>'authOrigin'='studio-session' AND request_payload->'scope'->>'clientId' IS NULL ORDER BY created_at DESC LIMIT 8`,[actor.userId,actor.projectId]) : null;
  return {...(analyses.length?{analyses}:{}),...(exports ? {exports: exports.flatMap(value => {const parsed=studioPreparedExportSchema.safeParse(value.safe_result);return parsed.success ? [parsed.data] : [];})} : {}),name: row.name, revision: Number(row.revision), memory: studioMemorySchema.parse({revision: Number(row.memory_revision ?? 0), brief: row.brief ?? '', decisions: row.decisions ?? []}), generations};
}

export async function saveStudioConversationMemory(actor: StudioGenerationActor, value: StudioConversationMemory & {projectTitle?:string|null}, executor?: TransactionQueryExecutor) {
  requireGenerationActor(actor);
  const {projectTitle,...memoryInput}=value;
  const memory = studioMemorySchema.parse(memoryInput);
  const save = async (tx: TransactionQueryExecutor) => {
    const rows = await tx.query<{revision: string; brief: string; decisions: string[]}>(`
      INSERT INTO studio_conversation_memory (user_id,project_id,revision,brief,decisions)
      SELECT $1,$2,1,$3,$4::jsonb FROM studio_projects p WHERE p.id=$2 AND p.user_id=$1 AND p.deleted_at IS NULL
        AND ($5::bigint = 0 OR EXISTS (SELECT 1 FROM studio_conversation_memory m WHERE m.user_id=$1 AND m.project_id=$2))
      ON CONFLICT (user_id,project_id) DO UPDATE SET brief=EXCLUDED.brief, decisions=EXCLUDED.decisions,
        revision=studio_conversation_memory.revision+1, updated_at=clock_timestamp()
      WHERE studio_conversation_memory.revision=$5
      RETURNING revision,brief,decisions`, [actor.userId, actor.projectId, memory.brief, JSON.stringify(memory.decisions), memory.revision]);
    if (!rows[0]) throw new AgentApiError('PARAMETER_INVALID', 'The project brief changed. Read the current project before updating it.');
    await automaticallyNameStudioProject(actor,'assistant',projectTitle,tx);
    return studioMemorySchema.parse({...rows[0], revision: Number(rows[0].revision)});
  };
  return executor ? save(executor) : withDbTransaction(save);
}

export async function beginStudioAction(actor: StudioGenerationActor, turn: StoredImageTurn, callId: string, action: StudioActionRequest): Promise<StudioActionResult | null> {
  if (!callId || callId.length > 200) throw new AgentApiError('PARAMETER_INVALID', 'Invalid action identity.');
  const hash = createHash('sha256').update(stableJson(action)).digest('hex');
  return withDbTransaction(async tx => {
    const active = await tx.query(`SELECT t.request_id FROM studio_image_turns t JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
      WHERE t.user_id=$1 AND t.project_id=$2 AND t.request_id=$3 AND t.lease_id=$4 AND t.state='thinking' FOR UPDATE OF t`,
      [actor.userId, actor.projectId, turn.request_id, turn.lease_id]);
    if (!active.length) throw new AgentApiError('PARAMETER_INVALID', 'This message has been superseded.');
    // Replay a durable completed action before checking the current lease.
    const existing = (await tx.query<{action_hash: string; result_json: StudioActionResult | null}>(`
      SELECT action_hash,result_json FROM studio_conversation_steps WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND call_id=$4`,
      [actor.userId, actor.projectId, turn.request_id, callId]))[0];
    if (existing) {
      if (existing.action_hash !== hash) throw new AgentApiError('PARAMETER_INVALID', 'This action identity belongs to another request.');
      if (existing.result_json) return existing.result_json;
      // The current turn lease may resume a read or an uncommitted transaction.
      // Its original action identity remains immutable; completion verifies the new lease.
      return null;
    }
    const rows = await tx.query(`INSERT INTO studio_conversation_steps (user_id,project_id,request_id,call_id,lease_id,action_hash,action_json,observed_revision)
      SELECT t.user_id,t.project_id,t.request_id,$4,t.lease_id,$5,$6::jsonb,p.revision FROM studio_image_turns t
      JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
      WHERE t.user_id=$1 AND t.project_id=$2 AND t.request_id=$3 AND t.lease_id=$7 AND t.state='thinking'
      ON CONFLICT (user_id,project_id,request_id,call_id) DO NOTHING RETURNING call_id`,
      [actor.userId, actor.projectId, turn.request_id, callId, hash, JSON.stringify(action), turn.lease_id]);
    if (!rows.length) throw new AgentApiError('PARAMETER_INVALID', 'This unfinished action cannot be replayed automatically. Resume the saved message.');
    return null;
  });
}

export async function completeStudioAction(actor: StudioGenerationActor, turn: StoredImageTurn, callId: string, result: StudioActionResult, executor?: TransactionQueryExecutor) {
  const save = async (tx: TransactionQueryExecutor) => {
    const rows = await tx.query(`UPDATE studio_conversation_steps SET state='completed',result_json=$6::jsonb
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND call_id=$4 AND state='started'
        AND EXISTS (SELECT 1 FROM studio_image_turns t JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
          WHERE t.user_id=$1 AND t.project_id=$2 AND t.request_id=$3 AND t.lease_id=$5 AND t.state IN ('thinking','ready')) RETURNING call_id`,
      [actor.userId, actor.projectId, turn.request_id, callId, turn.lease_id, JSON.stringify(result)]);
    if (!rows.length) throw new AgentApiError('PARAMETER_INVALID', 'This action was superseded.');
  };
  return executor ? save(executor) : withDbTransaction(save);
}

/** Checkpoint each paid text request before dispatch and its complete output before any action. */
export async function checkpointStudioResponse(actor: StudioGenerationActor, turn: StoredImageTurn, index: number, create: () => Promise<StudioDirectorResponse>, meter?: {prepare(): Promise<{inputTokens: number;outputTokens: number;policy: StudioAssistancePolicy}>}, options: {replayOnly?: boolean} = {}): Promise<StudioDirectorResponse> {
  const scope = [actor.userId, actor.projectId, turn.request_id, turn.lease_id, index];
  const prior = (await query<{response_json: StudioDirectorResponse}>(`SELECT response_json FROM studio_conversation_responses
    WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND response_index=$4 AND state='reported' ORDER BY created_at DESC LIMIT 1`, [actor.userId, actor.projectId, turn.request_id, index]))[0];
  if (prior) {
    if (meter) {
      const savedCall = (await query<{id: string}>(`SELECT id FROM studio_assistance_calls WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND response_index=$4 AND (response_id=$5 OR state<>'settled') ORDER BY created_at DESC LIMIT 1`, [actor.userId,actor.projectId,turn.request_id,index,prior.response_json.id]))[0];
      if (savedCall && !await settleStudioAssistanceCall(savedCall.id,actor.userId,prior.response_json)) assistanceError('usage_unresolved','Provider usage for this saved response is unresolved.');
    }
    if (isReplayableStudioResponse(prior.response_json)) return prior.response_json;
  }
  // Recovery beyond the model retry limit is settlement/replay only, including
  // when a saved tool needs another response or the saved response is malformed.
  if (options.replayOnly) {
    if (meter) return stopStudioAssistanceReplay(actor,turn.request_id);
    throw new AgentApiError('RATE_LIMITED','This message reached its retry limit.');
  }
  const bounds = await meter?.prepare();
  let assistanceCall: AssistanceCall | undefined;
  await withDbTransaction(async tx => {
    const start = await tx.query(`INSERT INTO studio_conversation_responses (user_id,project_id,request_id,lease_id,response_index)
    SELECT user_id,project_id,request_id,lease_id,$5 FROM studio_image_turns t WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND lease_id=$4 AND state='thinking'
      AND EXISTS (SELECT 1 FROM studio_projects p WHERE p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL)
    ON CONFLICT DO NOTHING RETURNING lease_id`, scope);
    if (!start.length) throw new AgentApiError('PARAMETER_INVALID', 'This model step is already in progress or superseded.');
    if (bounds) assistanceCall = await reserveStudioAssistanceCall({userId: actor.userId,projectId: actor.projectId,requestId: turn.request_id,leaseId: turn.lease_id,index,inputTokens: bounds.inputTokens,outputTokens: bounds.outputTokens},bounds.policy,tx);
  });
  const began = performance.now();
  try {
    const response = await create();
    const saved = await query(`UPDATE studio_conversation_responses SET state='reported',response_id=$6,response_json=$7::jsonb,elapsed_ms=$8
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND lease_id=$4 AND response_index=$5 AND state='started' RETURNING lease_id`,
      [...scope, response.id, JSON.stringify({id: response.id, model: response.model, status: response.status, service_tier: response.service_tier ?? null,
        usage: response.usage ?? null, output_text: response.output_text, output: response.output,incomplete_details: response.incomplete_details ?? null}), Math.round(performance.now() - began)]);
    if (!saved.length) throw new AgentApiError('INTERNAL_ERROR', 'The model response could not be saved. No action was performed.');
    if (assistanceCall && !await settleStudioAssistanceCall(assistanceCall.id,actor.userId,response)) assistanceError('usage_unresolved','Provider usage for this response is unresolved.');
    return response;
  } catch (error) {
    if (assistanceCall) {try {await markStudioAssistanceUnknown(assistanceCall.id,actor.userId);} catch {/* Preserve reserved exposure if storage is unavailable. */}}
    try { await query(`UPDATE studio_conversation_responses SET state='unknown' WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND lease_id=$4 AND response_index=$5 AND state='started'`, scope); }
    catch { /* Keep unresolved started evidence; do not label it zero or repeat the call. */ }
    throw error;
  }
}

export async function listStudioConversationUsage(actor: StudioGenerationActor): Promise<ImageModelUsage[]> {
  const rows = await query<{request_id: string; lease_id: string; response_index: number; state: ImageModelUsage['state']; response_json: StudioDirectorResponse | null; elapsed_ms: number | null; created_at: Date}>(`
    SELECT r.* FROM studio_conversation_responses r JOIN studio_projects p ON p.id=r.project_id AND p.user_id=r.user_id AND p.deleted_at IS NULL
    WHERE r.user_id=$1 AND r.project_id=$2 ORDER BY r.created_at,r.response_index`, [actor.userId, actor.projectId]);
  return rows.map(row => ({requestId: row.request_id, attemptId: row.lease_id + ':' + row.response_index, state: row.state, createdAt: row.created_at,
    response: row.response_json ? {responseId: row.response_json.id, model: row.response_json.model, status: row.response_json.status, serviceTier: row.response_json.service_tier ?? null, usage: row.response_json.usage ?? null, elapsedMs: row.elapsed_ms ?? 0} : null}));
}
