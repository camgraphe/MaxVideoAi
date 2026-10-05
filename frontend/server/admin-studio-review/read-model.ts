import { randomUUID } from 'node:crypto';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import { reviewListSchema, reviewScopeSchema, StudioReviewError, type ReviewDetail, type ReviewList, type ReviewScope, type ReviewSource, type ReviewTurn } from './contracts';
import { projectAction, projectAssistance, projectTurn, projectUsage, redactReviewText } from './projection';

type Row = Record<string, unknown>;
// A saved reply (state=ready) can retain unfinished work. Only bounded operational
// facts cross this pre-reveal boundary; continuation error messages stay private.
const incomplete = "COALESCE(t.draft_json->'continuation' <> 'null'::jsonb,false)";
const metadata = `t.user_id,t.project_id,t.request_id,t.state,t.model_attempts,t.created_at,t.quote_id,
  ${incomplete} AS incomplete,CASE WHEN t.draft_json->'continuation'->>'reason' IN ('action_limit','output_limit')
  THEN t.draft_json->'continuation'->>'reason' ELSE NULL END AS continuation_reason`;
const ownedProject = 'JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL';
const exactScope = 't.user_id=$1 AND t.project_id=$2 AND t.request_id=$3';
const scopeParams = (scope: ReviewScope) => [scope.userId, scope.projectId, scope.requestId];

export async function loadStudioReviewList(input: unknown): Promise<ReviewList> {
  const parsed = reviewListSchema.safeParse(input);
  if (!parsed.success) throw new StudioReviewError('invalid_request', 400);
  const filter = parsed.data;
  try {
    const rows = await query<Row>(`SELECT ${metadata} FROM studio_image_turns t ${ownedProject}
      WHERE ($1::text IS NULL OR t.user_id=$1) AND ($2::text IS NULL OR t.project_id=$2) AND ($3::text IS NULL OR t.state=$3)
      AND ($6::text IS NULL OR ${incomplete})
      ORDER BY t.created_at DESC,t.request_id DESC,t.user_id,t.project_id LIMIT $4 OFFSET $5`,
    [filter.userId ?? null, filter.projectId ?? null, filter.state ?? null, filter.limit + 1, filter.page * filter.limit, filter.completion ?? null]);
    return { status: 'available', turns: rows.slice(0, filter.limit).map(projectTurn), hasMore: rows.length > filter.limit };
  } catch { return { status: 'unavailable' }; }
}

export async function loadStudioReviewTurn(input: unknown): Promise<ReviewTurn> {
  const parsed = reviewScopeSchema.safeParse(input);
  if (!parsed.success) throw new StudioReviewError('invalid_request', 400);
  try {
    const rows = await query<Row>(`SELECT ${metadata} FROM studio_image_turns t ${ownedProject} WHERE ${exactScope}`, scopeParams(parsed.data));
    if (!rows[0]) throw new StudioReviewError('not_found', 404);
    return projectTurn(rows[0]);
  } catch (error) {
    if (error instanceof StudioReviewError) throw error;
    throw new StudioReviewError('unavailable', 503);
  }
}

// A savepoint lets an optional missing/old source stay unavailable without losing the access audit.
async function optionalSource<T>(tx: QueryExecutor, sql: string, params: string[], project: (row: Row) => T): Promise<ReviewSource<T>> {
  await tx.query('SAVEPOINT review_source');
  try {
    const rows = await tx.query<Row>(sql, params);
    const items = rows.slice(0, 20).map(project);
    await tx.query('RELEASE SAVEPOINT review_source');
    return { status: 'available', items, truncated: rows.length > 20 };
  } catch {
    await tx.query('ROLLBACK TO SAVEPOINT review_source');
    await tx.query('RELEASE SAVEPOINT review_source');
    return { status: 'unavailable', items: [], truncated: false };
  }
}

export async function revealStudioReview(actorId: string, input: unknown): Promise<ReviewDetail> {
  const parsed = reviewScopeSchema.safeParse(input);
  if (!parsed.success || !actorId || actorId.length > 128) throw new StudioReviewError('invalid_request', 400);
  const params = scopeParams(parsed.data);
  try {
    return await withDbTransaction(async tx => {
      await tx.query("SET LOCAL statement_timeout = '5s'");
      const rows = await tx.query<Row>(`SELECT ${metadata} FROM studio_image_turns t ${ownedProject} WHERE ${exactScope} FOR SHARE OF t,p`, params);
      if (!rows[0]) throw new StudioReviewError('not_found', 404);
      const accessId = randomUUID();
      // Fail closed before reading content if audit persistence is unavailable.
      await tx.query(`INSERT INTO admin_studio_review_access(id,actor_id,user_id,project_id,request_id,projection_version) VALUES ($1,$2,$3,$4,$5,'studio-review-v1')`, [accessId, actorId, ...params]);
      const text = (await tx.query<Row>(`SELECT left(t.input_json->>'message',4000) AS message,left(t.draft_json->>'reply',2400) AS reply
        FROM studio_image_turns t ${ownedProject} WHERE ${exactScope}`, params))[0];
      const actions = await optionalSource(tx, `SELECT action_json->>'action' AS action,state,observed_revision,
        action_json->>'modelId' AS model_id,result_json->>'ok' AS ok,result_json->'error'->>'code' AS error_code,created_at
        FROM studio_conversation_steps WHERE user_id=$1 AND project_id=$2 AND request_id=$3 ORDER BY created_at,call_id LIMIT 21`, params, projectAction);
      const responses = await optionalSource(tx, `SELECT state,response_json->>'model' AS model,response_json->'usage' AS usage,elapsed_ms,created_at
        FROM studio_conversation_responses WHERE user_id=$1 AND project_id=$2 AND request_id=$3 ORDER BY created_at,response_index LIMIT 21`, params, row => projectUsage(row, 'conversation'));
      const legacyUsage = await optionalSource(tx, `SELECT state,response_json->>'model' AS model,response_json->'usage' AS usage,response_json->>'elapsedMs' AS elapsed_ms,created_at
        FROM studio_image_model_usage WHERE user_id=$1 AND project_id=$2 AND request_id=$3 ORDER BY created_at LIMIT 21`, params, row => projectUsage(row, 'legacy'));
      const assistance = await optionalSource(tx, `SELECT c.state,c.model,c.returned_model,c.mode,c.policy_version,c.rate_version,c.tariff_version,
        c.reserved_nano_usd,c.reserved_cents,c.provider_min_nano_usd,c.provider_max_nano_usd,c.charged_cents,c.created_at,w.refund_cents AS waived_cents
        FROM studio_assistance_calls c LEFT JOIN studio_assistance_resolutions w ON w.call_id=c.id AND w.action='waive_unknown'
        WHERE c.user_id=$1 AND c.project_id=$2 AND c.request_id=$3 ORDER BY c.created_at,c.response_index LIMIT 21`, params, projectAssistance);
      return { turn: projectTurn(rows[0]), message: redactReviewText(text?.message, 4000), reply: redactReviewText(text?.reply, 2400), actions, responses, legacyUsage, assistance, accessId, coverage: 'partial' };
    });
  } catch (error) {
    if (error instanceof StudioReviewError) throw error;
    throw new StudioReviewError('unavailable', 503);
  }
}
