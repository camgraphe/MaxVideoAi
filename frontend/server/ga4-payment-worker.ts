import type { QueryExecutor } from '@/lib/db';
import { sendGa4EventWithResult } from '@/server/ga4';
import { claimGa4PaymentEvents, finishGa4PaymentEvent, type PaymentOutboxRow, type PaymentDeliveryResult } from '@/server/ga4-payment-outbox';

async function eligibility(db: QueryExecutor, row: PaymentOutboxRow): Promise<PaymentDeliveryResult | null> {
  const [tables] = await db.query<{roles:boolean;legacy:boolean}>(`SELECT
    to_regclass('public.user_roles') IS NOT NULL AS roles,to_regclass('public.app_admins') IS NOT NULL AS legacy`);
  if (!tables?.roles && !tables?.legacy) return {status:'retry',code:'role_unavailable'};
  for (const sql of [
    ...(tables.roles ? ["SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id::text=$1 AND role='admin') AS excluded"] : []),
    ...(tables.legacy ? ['SELECT EXISTS(SELECT 1 FROM app_admins WHERE user_id::text=$1) AS excluded'] : []),
  ]) {
    const [role] = await db.query<{excluded:boolean}>(sql,[row.user_id]);
    if (!role) return {status:'retry',code:'role_unavailable'};
    if (role.excluded) return {status:'suppressed',code:'admin'};
  }
  const [consent] = await db.query<{accepted:boolean;accepted_at:Date}>(`SELECT accepted,accepted_at FROM user_consents
    WHERE user_id::text=$1 AND doc_key='cookies.analytics' ORDER BY accepted_at DESC,accepted ASC LIMIT 1`,[row.user_id]);
  // A later grant cannot revive an old checkout snapshot after a withdrawal.
  // Anonymous cookie grants have no account row: the original granted snapshot remains required by producers.
  if (consent && (consent.accepted !== true || consent.accepted_at > row.consent_observed_at)) {
    return {status:'suppressed',code:'consent_changed'};
  }
  if (row.occurred_at.getTime() <= Date.now()-71*3600_000) return {status:'dead',code:'age_limit'};
  return null;
}

export async function drainGa4Payments(db: QueryExecutor, options: {send?: typeof sendGa4EventWithResult} = {}) {
  const rows = await claimGa4PaymentEvents(db);
  const counts = {claimed:rows.length,accepted:0,pending:0,suppressed:0,dead:0,stale:0};
  const send = options.send ?? sendGa4EventWithResult;
  let next = 0;
  await Promise.all(Array.from({length:Math.min(4,rows.length)},async()=>{
    while (next < rows.length) {
      const row = rows[next++];
      let result: PaymentDeliveryResult;
      try { result = await eligibility(db,row) ?? await send(row.payload); }
      catch { result = {status:'retry',code:'delivery_unavailable'}; }
      if (!await finishGa4PaymentEvent(db,row,result)) { counts.stale++; continue; }
      if (result.status === 'retry') counts[row.attempts < 8 ? 'pending' : 'dead']++;
      else counts[result.status]++;
    }
  }));
  return counts;
}
