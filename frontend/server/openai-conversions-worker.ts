import type { QueryExecutor } from '@/lib/db';
import { buildOpenAIOrderEvent, parseOpenAIAttribution } from '@/lib/analytics/openai-contract';
import {
  claimOpenAIConversions,
  enqueueOpenAIConversion,
  finishOpenAIConversion,
  openAIEventId,
} from './openai-conversions-outbox';
import { sendOpenAIConversion, type OpenAIDeliveryResult } from './openai-conversions-transport';

async function accountEligibility(db: QueryExecutor, userId: string): Promise<OpenAIDeliveryResult | null> {
  const [tables] = await db.query<{ roles: boolean; legacy: boolean }>(
    `SELECT to_regclass('public.user_roles') IS NOT NULL AS roles,to_regclass('public.app_admins') IS NOT NULL AS legacy`
  );
  if (!tables?.roles && !tables?.legacy) return { status: 'retry', code: 'role_unavailable' };
  for (const sql of [
    ...(tables.roles
      ? ["SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id::text=$1 AND role='admin') AS excluded"]
      : []),
    ...(tables.legacy ? ['SELECT EXISTS(SELECT 1 FROM app_admins WHERE user_id::text=$1) AS excluded'] : []),
  ]) {
    const [role] = await db.query<{ excluded: boolean }>(sql, [userId]);
    if (!role) return { status: 'retry', code: 'role_unavailable' };
    if (role.excluded) return { status: 'suppressed', code: 'admin' };
  }
  return null;
}

/** Repair only receipts carrying the new checkout marker, never historical purchases. */
export async function repairOpenAIOrders(db: QueryExecutor): Promise<number> {
  const receipts = await db.query<{
    id: string;
    user_id: string;
    created_at: Date;
    metadata: Record<string, unknown>;
  }>(`SELECT r.id::text,r.user_id,r.created_at,r.metadata
    FROM app_receipts r WHERE r.type='topup' AND r.created_at>now()-interval '167 hours'
      AND r.metadata->>'openai_conversion_version'='1' AND r.metadata->>'stripe_livemode'='true'
      AND (r.stripe_payment_intent_id IS NOT NULL OR r.stripe_charge_id IS NOT NULL)
      AND NOT EXISTS(SELECT 1 FROM openai_conversion_outbox o
        WHERE o.event_key=encode(sha256(convert_to('maxvideoai:openai:receipt:'||r.id::text,'UTF8')),'hex'))
    ORDER BY r.created_at,r.id LIMIT 20`);
  let queued = 0;
  for (const receipt of receipts) {
    const m = receipt.metadata;
    const policyVersion = typeof m.openai_policy_version === 'string' ? m.openai_policy_version : '';
    const attribution = parseOpenAIAttribution(
      JSON.stringify({
        oppref: m.openai_oppref,
        capturedAt: Number(m.openai_click_at),
        consentAt: Number(m.openai_consent_at),
        policyVersion,
      }),
      { analytics: true, ads: true, version: policyVersion },
      receipt.created_at.getTime()
    );
    const event = buildOpenAIOrderEvent({
      id: openAIEventId('receipt', receipt.id),
      occurredAt: receipt.created_at.getTime(),
      liveMode: m.stripe_livemode,
      amountMinor: Number(m.settlement_amount_cents),
      currency: String(m.settlement_currency ?? ''),
      attribution,
    });
    const consentObservedAt = new Date(String(m.openai_consent_observed_at ?? ''));
    if (!event || !Number.isFinite(consentObservedAt.getTime()) || consentObservedAt > receipt.created_at) {
      // Retain a non-identifying tombstone so malformed rows cannot starve repair.
      await db.query(
        `INSERT INTO openai_conversion_outbox(event_key,event_name,policy_version,occurred_at,consent_observed_at,status,outcome)
        VALUES($1,'order_created',$2,$3,$3,'dead','invalid_receipt_metadata') ON CONFLICT(event_key) DO NOTHING`,
        [openAIEventId('receipt', receipt.id), policyVersion, receipt.created_at]
      );
      continue;
    }
    await enqueueOpenAIConversion(db, { userId: receipt.user_id, policyVersion, consentObservedAt, event });
    queued++;
  }
  return queued;
}

export async function drainOpenAIConversions(
  db: QueryExecutor,
  options: { policyVersion: string; send?: typeof sendOpenAIConversion }
) {
  const rows = await claimOpenAIConversions(db);
  const counts = { claimed: rows.length, accepted: 0, pending: 0, suppressed: 0, dead: 0, stale: 0 };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, rows.length) }, async () => {
      while (next < rows.length) {
        const row = rows[next++];
        let result: OpenAIDeliveryResult;
        try {
          const account = await accountEligibility(db, row.user_id);
          if (row.policy_version !== options.policyVersion) result = { status: 'suppressed', code: 'policy_changed' };
          else if (account) result = account;
          else {
            const changes = await db.query(
              `SELECT 1 FROM user_consents WHERE user_id::text=$1
            AND doc_key IN ('cookies.analytics','cookies.ads')
            AND (accepted_at>$2 OR (accepted=false AND NOT EXISTS(SELECT 1 FROM user_consents newer
              WHERE newer.user_id=user_consents.user_id AND newer.doc_key=user_consents.doc_key AND newer.accepted_at>user_consents.accepted_at))) LIMIT 1`,
              [row.user_id, row.consent_observed_at]
            );
            result = changes.length
              ? { status: 'suppressed', code: 'consent_changed' }
              : await (options.send ?? sendOpenAIConversion)(row.payload);
          }
        } catch {
          result = { status: 'retry', code: 'delivery_unavailable' };
        }
        if (!(await finishOpenAIConversion(db, row, result))) {
          counts.stale++;
          continue;
        }
        if (result.status === 'retry') counts[row.attempts < 8 ? 'pending' : 'dead']++;
        else if (result.status === 'validated') counts.dead++;
        else counts[result.status]++;
      }
    })
  );
  return counts;
}
