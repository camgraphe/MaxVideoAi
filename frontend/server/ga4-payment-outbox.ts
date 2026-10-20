import { randomUUID } from 'node:crypto';
import type { QueryExecutor } from '@/lib/db';
import type { SendGa4EventArgs, Ga4DeliveryResult } from '@/server/ga4';

export type PaymentEventInput = {
  key: string;
  userId: string;
  occurredAt: Date;
  consentObservedAt: Date;
  event: SendGa4EventArgs & { name: 'purchase' | 'topup_completed' | 'topup_refunded' };
};
export type PaymentOutboxRow = {
  event_key: string;
  user_id: string;
  payload: SendGa4EventArgs;
  occurred_at: Date;
  consent_observed_at: Date;
  attempts: number;
  lease_token: string;
};
export type PaymentDeliveryResult = Ga4DeliveryResult | { status: 'suppressed'; code: string };

export async function enqueueGa4PaymentEvent(db: QueryExecutor, input: PaymentEventInput): Promise<void> {
  await db.query(`INSERT INTO ga4_payment_outbox
    (event_key,event_name,user_id,payload,occurred_at,consent_observed_at)
    VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (event_key) DO NOTHING`,
  [input.key,input.event.name,input.userId,{...input.event,timestampMicros:input.occurredAt.getTime()*1000},input.occurredAt,input.consentObservedAt]);
}

export async function claimGa4PaymentEvents(db: QueryExecutor, limit = 20): Promise<PaymentOutboxRow[]> {
  // Recover crash leases, but never re-age an event or exceed the retry budget.
  await db.query(`UPDATE ga4_payment_outbox SET
    status=CASE WHEN occurred_at <= now()-interval '71 hours' THEN 'expired' ELSE 'dead' END,
    outcome=CASE WHEN occurred_at <= now()-interval '71 hours' THEN 'age_limit' ELSE 'attempt_limit' END,
    payload=NULL,user_id=NULL,lease_token=NULL,lease_until=NULL,updated_at=now()
    WHERE status IN ('pending','leased') AND (lease_until IS NULL OR lease_until<=now())
      AND (occurred_at<=now()-interval '71 hours' OR attempts>=8)`);
  return db.query<PaymentOutboxRow>(`WITH due AS (
    SELECT event_key FROM ga4_payment_outbox
    WHERE status IN ('pending','leased') AND available_at<=now()
      AND (lease_until IS NULL OR lease_until<=now()) AND attempts<8
      AND occurred_at>now()-interval '71 hours'
    ORDER BY available_at,event_key FOR UPDATE SKIP LOCKED LIMIT $1
  ) UPDATE ga4_payment_outbox o SET status='leased',attempts=o.attempts+1,
      lease_token=$2,lease_until=now()+interval '2 minutes',updated_at=now()
    FROM due WHERE o.event_key=due.event_key
    RETURNING o.event_key,o.user_id,o.payload,o.occurred_at,o.consent_observed_at,o.attempts,o.lease_token`,
  [Math.max(1,Math.min(20,Math.floor(limit))),randomUUID()]);
}

export async function finishGa4PaymentEvent(db: QueryExecutor, row: PaymentOutboxRow, result: PaymentDeliveryResult): Promise<boolean> {
  const retry = result.status === 'retry' && row.attempts < 8;
  const status = retry ? 'pending' : result.status === 'retry' ? 'dead' : result.status;
  const delaySeconds = Math.min(6*3600,300*2**(row.attempts-1));
  const updated = await db.query(`UPDATE ga4_payment_outbox SET status=$3,outcome=$4,http_status=$5,
    available_at=now()+$6*interval '1 second',lease_until=NULL,lease_token=NULL,
    payload=CASE WHEN $3='pending' THEN payload ELSE NULL END,
    user_id=CASE WHEN $3='pending' THEN user_id ELSE NULL END,updated_at=now()
    WHERE event_key=$1 AND status='leased' AND lease_token=$2 AND lease_until>now()
    RETURNING event_key`,[row.event_key,row.lease_token,status,result.code,
    'httpStatus' in result ? result.httpStatus ?? null : null,delaySeconds]);
  return updated.length === 1;
}
