import { createHash, randomUUID } from 'node:crypto';
import type { QueryExecutor } from '@/lib/db';
import type { OpenAIConversionEvent } from '@/lib/analytics/openai-contract';
import type { OpenAIDeliveryResult } from './openai-conversions-transport';

export function openAIEventId(kind: 'registration' | 'receipt', canonicalId: string): string {
  return createHash('sha256').update(`maxvideoai:openai:${kind}:${canonicalId}`).digest('hex');
}
export type OpenAIOutboxRow = {
  event_key: string;
  user_id: string;
  payload: OpenAIConversionEvent;
  policy_version: string;
  occurred_at: Date;
  consent_observed_at: Date;
  attempts: number;
  lease_token: string;
};
export async function enqueueOpenAIConversion(
  db: QueryExecutor,
  input: { userId: string; consentObservedAt: Date; policyVersion: string; event: OpenAIConversionEvent }
) {
  await db.query(
    `INSERT INTO openai_conversion_outbox
    (event_key,event_name,user_id,payload,policy_version,occurred_at,consent_observed_at)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_key) DO NOTHING`,
    [
      input.event.id,
      input.event.type,
      input.userId,
      input.event,
      input.policyVersion,
      new Date(input.event.timestamp_ms),
      input.consentObservedAt,
    ]
  );
}
export async function claimOpenAIConversions(db: QueryExecutor): Promise<OpenAIOutboxRow[]> {
  await db.query(`UPDATE openai_conversion_outbox SET
    status=CASE WHEN occurred_at<=now()-interval '167 hours' THEN 'expired' ELSE 'dead' END,
    outcome=CASE WHEN occurred_at<=now()-interval '167 hours' THEN 'age_limit' ELSE 'attempt_limit' END,
    payload=NULL,user_id=NULL,lease_token=NULL,lease_until=NULL,updated_at=now()
    WHERE status IN ('pending','leased') AND (lease_until IS NULL OR lease_until<=now())
      AND (occurred_at<=now()-interval '167 hours' OR attempts>=8)`);
  return db.query<OpenAIOutboxRow>(
    `WITH due AS (
    SELECT event_key FROM openai_conversion_outbox WHERE status IN ('pending','leased')
      AND available_at<=now() AND (lease_until IS NULL OR lease_until<=now()) AND attempts<8
      AND occurred_at>now()-interval '167 hours'
    ORDER BY available_at,event_key FOR UPDATE SKIP LOCKED LIMIT 20
  ) UPDATE openai_conversion_outbox o SET status='leased',attempts=o.attempts+1,
    lease_token=$1,lease_until=now()+interval '2 minutes',updated_at=now()
    FROM due WHERE o.event_key=due.event_key
    RETURNING o.event_key,o.user_id,o.payload,o.policy_version,o.occurred_at,o.consent_observed_at,o.attempts,o.lease_token`,
    [randomUUID()]
  );
}
export async function finishOpenAIConversion(
  db: QueryExecutor,
  row: OpenAIOutboxRow,
  result: OpenAIDeliveryResult
): Promise<boolean> {
  // A validation response must never acknowledge real queue delivery.
  const status =
    result.status === 'validated'
      ? 'dead'
      : result.status === 'retry'
        ? row.attempts < 8
          ? 'pending'
          : 'dead'
        : result.status;
  const updated = await db.query(
    `UPDATE openai_conversion_outbox SET status=$3,outcome=$4,http_status=$5,
    available_at=now()+$6*interval '1 second',lease_until=NULL,lease_token=NULL,
    payload=CASE WHEN $3='pending' THEN payload ELSE NULL END,user_id=CASE WHEN $3='pending' THEN user_id ELSE NULL END,updated_at=now()
    WHERE event_key=$1 AND status='leased' AND lease_token=$2 AND lease_until>now() RETURNING event_key`,
    [
      row.event_key,
      row.lease_token,
      status,
      result.code,
      result.httpStatus ?? null,
      Math.min(21600, 300 * 2 ** (row.attempts - 1)),
    ]
  );
  return updated.length === 1;
}
