import type { QueryExecutor } from '@/lib/db';
import { projectReviewData } from '@/server/assistant-review/context';
import { redactReviewText, reviewToken } from '@/server/admin-studio-review/projection';
import type { AssistantReviewScope, ReviewItem, Evidence } from './contracts';

export const sourceDefinitions = {
  composer: {
    from: 'prompt_assistance_requests t JOIN prompt_assistance_sessions s ON s.user_id=t.user_id AND s.id=t.session_id',
    scope: 't.session_id::text', id: 't.request_id', where: 'TRUE', lock: 't,s',
    dimensions: "t.input_json->'draft'->>'surface' AS surface,t.input_json->'draft'->>'engineId' AS media_model,t.model AS assistant_model",
  },
  studio: {
    from: 'studio_image_turns t JOIN studio_projects p ON p.user_id=t.user_id AND p.id=t.project_id',
    scope: 't.project_id', id: 't.request_id', where: 'p.deleted_at IS NULL', lock: 't,p',
    dimensions: 'NULL::text AS surface,NULL::text AS media_model,NULL::text AS assistant_model',
  },
  mcp: {
    from: 'mcp_generation_quotes t', scope: 't.quote_id::text', id: 't.quote_id',
    where: "t.auth_origin='oauth'", lock: 't',
    dimensions: "t.request_json->>'surface' AS surface,t.request_json->>'engineId' AS media_model,NULL::text AS assistant_model",
  },
} as const;
export function metadataSql(source: AssistantReviewScope['source']) {
  const s = sourceDefinitions[source];
  return `SELECT t.user_id,${s.scope} AS scope_id,${s.id} AS request_id,t.state,t.created_at,${s.dimensions} FROM ${s.from} WHERE ${s.where}`;
}
export function scopeClause(scope: AssistantReviewScope) {
  const s = sourceDefinitions[scope.source];
  return `t.user_id=$1 AND ${s.scope}=$2 AND ${s.id}=$3`;
}
export const scopeValues = (scope: AssistantReviewScope) => [scope.userId, scope.scopeId, scope.requestId];
export function projectItem(source: AssistantReviewScope['source'], row: Record<string, unknown>): ReviewItem {
  return { source, userId: String(row.user_id), scopeId: String(row.scope_id), requestId: String(row.request_id),
    state: reviewToken(row.state), surface: reviewToken(row.surface), mediaModel: reviewToken(row.media_model), assistantModel: reviewToken(row.assistant_model), reviewVerdict: reviewToken(row.review_verdict),
    createdAt: new Date(String(row.created_at)).toISOString() };
}
const boundedJson = (column: string) => `CASE WHEN octet_length((${column})::text)<=512000 THEN ${column} ELSE jsonb_build_object('reviewOmission','Stored value exceeds review limit') END`;

async function optionalEvidence(tx: QueryExecutor, title: string, sql: string, params: string[]): Promise<Evidence> {
  await tx.query('SAVEPOINT assistant_review_source');
  try {
    const rows = await tx.query<Record<string, unknown>>(sql, params);
    await tx.query('RELEASE SAVEPOINT assistant_review_source');
    return { title, status: 'available', data: projectReviewData(rows.slice(0, 24)), rowsTruncated: rows.length > 24 };
  } catch {
    await tx.query('ROLLBACK TO SAVEPOINT assistant_review_source'); await tx.query('RELEASE SAVEPOINT assistant_review_source');
    return { title, status: 'unavailable', data: projectReviewData(null) };
  }
}

export async function readNativeEvidence(tx: QueryExecutor, scope: AssistantReviewScope) {
  const params = scopeValues(scope), evidence: Evidence[] = [];
  let message: string | null = null, reply: string | null = null, proposal: string | null = null;
  if (scope.source === 'composer') {
    const [row] = await tx.query<Record<string, unknown>>(`SELECT left(input_json->>'message',8000) AS message,left(reply_json->>'reply',6000) AS reply,left(reply_json->>'text',50000) AS proposal,
      ${boundedJson("input_json->'draft'")} AS draft,${boundedJson('context_json')} AS context,response_json->'usage' AS usage,error
      FROM prompt_assistance_requests t WHERE ${scopeClause(scope)}`, params);
    message = redactReviewText(row.message, 8000); reply = redactReviewText(row.reply, 6000); proposal = redactReviewText(row.proposal, 50000);
    evidence.push({ title: 'Selected draft, settings and owned references', status: 'available', data: projectReviewData(row.draft) },
      { title: 'Historical model guide, perception and dispatched input', status: 'available', data: projectReviewData(row.context) },
      { title: 'Provider usage and request error', status: 'available', data: projectReviewData({ usage: row.usage, error: row.error }) });
  } else if (scope.source === 'studio') {
    const [row] = await tx.query<Record<string, unknown>>(`SELECT left(input_json->>'message',4000) AS message,left(draft_json->>'reply',2400) AS reply,
      ${boundedJson('input_json')} AS input,${boundedJson("draft_json->'continuation'")} AS continuation FROM studio_image_turns t WHERE ${scopeClause(scope)}`, params);
    message = redactReviewText(row.message, 4000); reply = redactReviewText(row.reply, 2400);
    evidence.push({ title: 'Submitted Studio context and continuation', status: 'available', data: projectReviewData({ input: row.input, continuation: row.continuation }) });
    evidence.push(await optionalEvidence(tx, 'Historical dispatched inputs', `SELECT response_index,state,${boundedJson('review_context_json')} AS context,created_at FROM studio_conversation_responses
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3 ORDER BY created_at,response_index,lease_id LIMIT 25`, params));
    evidence.push(await optionalEvidence(tx, 'Provider usage', `SELECT response_index,state,response_json->>'model' AS model,response_json->'usage' AS usage,elapsed_ms,created_at FROM studio_conversation_responses
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3 ORDER BY created_at,response_index,lease_id LIMIT 25`, params));
    evidence.push(await optionalEvidence(tx, 'Studio actions and observed results', `SELECT ${boundedJson('action_json')} AS action,state,observed_revision,
      result_json->>'ok' AS ok,result_json->'error'->>'code' AS error_code,result_json->'data'->>'quoteId' AS quote_id,result_json->'data'->>'jobId' AS job_id,created_at
      FROM studio_conversation_steps WHERE user_id=$1 AND project_id=$2 AND request_id=$3 ORDER BY created_at,call_id LIMIT 25`, params));
  } else {
    const [row] = await tx.query<Record<string, unknown>>(`SELECT ${boundedJson('t.request_json')} AS request,t.catalog_revision,t.price_cents,t.currency,t.state AS quote_state,t.job_id,t.oauth_client_id,
      (SELECT j.status FROM app_jobs j WHERE j.job_id=t.job_id AND j.user_id=t.user_id LIMIT 1) AS generation_state
      FROM mcp_generation_quotes t WHERE ${scopeClause(scope)} AND t.auth_origin='oauth'`, params);
    evidence.push({ title: 'Server-observed MCP preparation and generation outcome', status: 'available', data: projectReviewData(row) });
  }
  if (scope.source !== 'mcp') evidence.push(await optionalEvidence(tx, 'Assistant runtime, costs and credits (reservations are not charges)', `SELECT state,model,returned_model,mode,policy_version,rate_version,tariff_version,
    input_token_bound,output_token_bound,reserved_nano_usd::text,provider_min_nano_usd::text,provider_max_nano_usd::text,reserved_cents,
    CASE WHEN state='settled' THEN charged_cents ELSE NULL END AS charged_cents,created_at
    FROM studio_assistance_calls WHERE user_id=$1 AND project_id=$2 AND request_id=$3 ORDER BY created_at,response_index LIMIT 25`, [scope.userId, scope.source === 'composer' ? `composer:${scope.scopeId}` : scope.scopeId, scope.requestId]));
  return { message, reply, proposal, evidence };
}
