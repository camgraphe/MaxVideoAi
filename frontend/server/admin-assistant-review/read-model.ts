import { randomUUID } from 'node:crypto';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import { redactReviewText } from '@/server/admin-studio-review/projection';
import { assistantReviewFilter, assistantReviewScope, assistantReviewAnnotation, AssistantReviewError, type AssistantReviewScope, type AssistantReviewDetail, type Annotation, type ReviewList } from './contracts';
import { metadataSql, projectItem, readNativeEvidence, scopeClause, scopeValues, sourceDefinitions } from './sources';
import { assertAssistantReviewActive } from './retention';

export async function loadAssistantReviews(input: unknown): Promise<ReviewList> {
  const parsed = assistantReviewFilter.safeParse(input);
  if (!parsed.success) throw new AssistantReviewError('invalid_request', 400);
  const f = parsed.data;
  try {
    const rows = await query<Record<string, unknown>>(`SELECT r.*,COALESCE(a.verdict,'unreviewed') AS review_verdict FROM (${metadataSql(f.source)}) r
      LEFT JOIN LATERAL (SELECT verdict,issues FROM admin_assistant_review_annotations a WHERE a.source=$7 AND a.user_id=r.user_id AND a.scope_id=r.scope_id AND a.request_id=r.request_id ORDER BY a.created_at DESC,a.id DESC LIMIT 1) a ON TRUE
      WHERE ($1::text IS NULL OR r.user_id=$1) AND ($2::text IS NULL OR r.scope_id=$2) AND ($3::text IS NULL OR media_model=$3) AND ($4::text IS NULL OR state=$4)
      AND ($8::text IS NULL OR COALESCE(a.verdict,'unreviewed')=$8) AND ($9::text IS NULL OR a.issues ? $9)
      ORDER BY created_at ${f.scopeId ? 'ASC' : 'DESC'},request_id ${f.scopeId ? 'ASC' : 'DESC'},r.user_id,r.scope_id LIMIT $5 OFFSET $6`, [f.userId ?? null, f.scopeId ?? null, f.mediaModel ?? null, f.state ?? null, f.limit + 1, f.page * f.limit, f.source, f.verdict ?? null, f.issue ?? null]);
    return { status: 'available', items: rows.slice(0, f.limit).map(row => projectItem(f.source, row)), hasMore: rows.length > f.limit };
  } catch { return { status: 'unavailable' }; }
}
export async function loadAssistantReviewItem(input: unknown) {
  const parsed = assistantReviewScope.safeParse(input);
  if (!parsed.success) throw new AssistantReviewError('invalid_request', 400);
  const scope = parsed.data;
  try {
    const [row] = await query<Record<string, unknown>>(`${metadataSql(scope.source)} AND ${scopeClause(scope)}`, scopeValues(scope));
    if (!row) throw new AssistantReviewError('not_found', 404);
    return projectItem(scope.source, row);
  } catch (error) { return failure(error); }
}
async function lockedItem(tx: QueryExecutor, scope: AssistantReviewScope) {
  const [row] = await tx.query<Record<string, unknown>>(`${metadataSql(scope.source)} AND ${scopeClause(scope)} FOR SHARE OF ${sourceDefinitions[scope.source].lock}`, scopeValues(scope));
  if (!row) throw new AssistantReviewError('not_found', 404);
  const item = projectItem(scope.source, row);
  await assertAssistantReviewActive(tx, item.createdAt);
  return item;
}
const annotationProjection = (r: Record<string, unknown>): Annotation => ({ id: String(r.id), actorId: String(r.actor_id), verdict: String(r.verdict), issues: Array.isArray(r.issues) ? r.issues as string[] : [], note: redactReviewText(r.note, 2000) ?? '', createdAt: new Date(String(r.created_at)).toISOString() });
async function annotations(tx: QueryExecutor, scope: AssistantReviewScope): Promise<AssistantReviewDetail['annotations']> {
  await tx.query('SAVEPOINT assistant_review_annotations');
  try {
    const rows = await tx.query<Record<string, unknown>>('SELECT id,actor_id,verdict,issues,note,created_at FROM admin_assistant_review_annotations WHERE source=$1 AND user_id=$2 AND scope_id=$3 AND request_id=$4 ORDER BY created_at DESC,id DESC LIMIT 21', [scope.source, ...scopeValues(scope)]);
    await tx.query('RELEASE SAVEPOINT assistant_review_annotations');
    return { status: 'available', items: rows.slice(0, 20).map(annotationProjection), truncated: rows.length > 20 };
  } catch {
    await tx.query('ROLLBACK TO SAVEPOINT assistant_review_annotations'); await tx.query('RELEASE SAVEPOINT assistant_review_annotations');
    return { status: 'unavailable', items: [], truncated: false };
  }
}
async function audit(tx: QueryExecutor, actorId: string, scope: AssistantReviewScope, action: 'reveal' | 'annotate') {
  const id = randomUUID();
  await tx.query("INSERT INTO admin_assistant_review_access(id,actor_id,source,user_id,scope_id,request_id,action,projection_version) VALUES($1,$2,$3,$4,$5,$6,$7,'assistant-review-v1')", [id, actorId, scope.source, ...scopeValues(scope), action]);
  return id;
}
const validActor = (actorId: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(actorId);
function failure(error: unknown): never { if (error instanceof AssistantReviewError) throw error; throw new AssistantReviewError('unavailable', 503); }

export async function revealAssistantReview(actorId: string, input: unknown): Promise<AssistantReviewDetail> {
  const parsed = assistantReviewScope.safeParse(input);
  if (!parsed.success || !validActor(actorId)) throw new AssistantReviewError('invalid_request', 400);
  const scope = parsed.data;
  try {
    return await withDbTransaction(async tx => {
      await tx.query("SET LOCAL statement_timeout='5s'");
      const item = await lockedItem(tx, scope);
      const accessId = await audit(tx, actorId, scope, 'reveal');
      const content = await readNativeEvidence(tx, scope);
      return { item, accessId, ...content, annotations: await annotations(tx, scope), limitations: [
        'Retained evidence only. Missing historical inputs cannot be reconstructed. Text is redacted; truncation is marked. Media bytes and hidden reasoning are not included.',
        scope.source === 'mcp' ? 'MCP preparations are individual server-observed requests, not external host transcripts. Host model, reasoning, token usage and unseen messages are unknown. Quote acceptance is not generation success.' : 'A completed reply is not a quality rating. Using a suggested prompt or generating media afterwards is not yet attributed to this turn.',
      ] };
    });
  } catch (error) { return failure(error); }
}

export async function annotateAssistantReview(actorId: string, input: unknown) {
  const parsed = assistantReviewAnnotation.safeParse(input);
  if (!parsed.success || !validActor(actorId)) throw new AssistantReviewError('invalid_request', 400);
  const a = parsed.data, note = redactReviewText(a.note, 2000) ?? '', issues = [...new Set(a.issues)].sort();
  try {
    return await withDbTransaction(async tx => {
      await tx.query("SET LOCAL statement_timeout='5s'");
      await lockedItem(tx, a);
      await audit(tx, actorId, a, 'annotate');
      const params = [a.id, actorId, a.source, ...scopeValues(a), a.verdict, JSON.stringify(issues), note];
      await tx.query('INSERT INTO admin_assistant_review_annotations(id,actor_id,source,user_id,scope_id,request_id,verdict,issues,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) ON CONFLICT(id) DO NOTHING', params);
      const [saved] = await tx.query<Record<string, unknown>>('SELECT * FROM admin_assistant_review_annotations WHERE id=$1', [a.id]);
      if (!saved || saved.actor_id !== actorId || saved.source !== a.source || saved.user_id !== a.userId || saved.scope_id !== a.scopeId || saved.request_id !== a.requestId || saved.verdict !== a.verdict || saved.note !== note || JSON.stringify(saved.issues) !== JSON.stringify(issues)) throw new AssistantReviewError('conflict', 409);
      return annotationProjection(saved);
    });
  } catch (error) { return failure(error); }
}
