import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { AssistantReviewError } from './contracts';

// Use elapsed hours rather than calendar days so the limit is independent of DST.
const expired = "created_at <= clock_timestamp() - interval '2160 hours'";
const targets = [
  { key: 'composer', table: 'prompt_assistance_requests', keys: ['user_id','session_id','request_id'], present: "context_json ? 'reviewInput'", clear: "context_json = t.context_json - 'reviewInput'" },
  { key: 'studio', table: 'studio_conversation_responses', keys: ['user_id','project_id','request_id','lease_id','response_index'], present: 'review_context_json IS NOT NULL', clear: 'review_context_json = NULL' },
  { key: 'notes', table: 'admin_assistant_review_annotations', keys: ['id'], present: "note <> ''", clear: "note = ''" },
] as const;

export async function assertAssistantReviewActive(tx: QueryExecutor, createdAt: string | Date) {
  const [row] = await tx.query<{ active: boolean }>("SELECT $1::timestamptz > clock_timestamp() - interval '2160 hours' AS active", [createdAt]);
  if (!row?.active) throw new AssistantReviewError('review_expired', 410);
}

export type ReviewRetentionResult = { dryRun: boolean; composer: number; studio: number; notes: number; hasMore: boolean };
export async function cleanupAssistantReviewContext({ limit = 100, dryRun = false }: { limit?: number; dryRun?: boolean } = {}): Promise<ReviewRetentionResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new RangeError('Retention limit must be an integer from 1 to 500');
  return withDbTransaction(async tx => {
    if (dryRun) await tx.query('SET TRANSACTION READ ONLY');
    await tx.query("SET LOCAL statement_timeout='10s'");
    await tx.query("SET LOCAL lock_timeout='1s'");
    const result: ReviewRetentionResult = { dryRun, composer: 0, studio: 0, notes: 0, hasMore: false };
    for (const target of targets) {
      const eligible = `${target.present} AND ${expired}`;
      if (dryRun) {
        const [row] = await tx.query<{ count: number }>(`SELECT count(*)::int AS count FROM (SELECT 1 FROM ${target.table} WHERE ${eligible} LIMIT $1) eligible`, [limit + 1]);
        result[target.key] = Math.min(row.count, limit);
        result.hasMore ||= row.count > limit;
      } else {
        const [row] = await tx.query<{ count: number }>(`WITH candidates AS (
          SELECT ${target.keys.join(',')} FROM ${target.table} WHERE ${eligible}
          ORDER BY created_at,${target.keys.join(',')} LIMIT $1 FOR UPDATE SKIP LOCKED
        ), cleared AS (
          UPDATE ${target.table} t SET ${target.clear} FROM candidates c
          WHERE ${target.keys.map(key=>`t.${key}=c.${key}`).join(' AND ')} RETURNING 1
        ) SELECT count(*)::int AS count FROM cleared`, [limit]);
        result[target.key] = row.count;
        const [remaining] = await tx.query<{ exists: boolean }>(`SELECT EXISTS(SELECT 1 FROM ${target.table} WHERE ${eligible})`);
        result.hasMore ||= remaining.exists;
      }
    }
    return result;
  });
}
