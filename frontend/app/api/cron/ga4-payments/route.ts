import { query } from '@/lib/db';
import { createGa4PaymentCronHandler } from '@/server/ga4-payment-cron';
import { repairGa4WalletIntents } from '@/server/ga4-wallet-events';
import { drainGa4Payments } from '@/server/ga4-payment-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = createGa4PaymentCronHandler({
  VERCEL_ENV: process.env.VERCEL_ENV,
  CRON_SECRET: process.env.CRON_SECRET,
  GA4_PAYMENTS_DISABLED: process.env.GA4_PAYMENTS_DISABLED,
}, async () => {
  const db = {query};
  const repaired = await repairGa4WalletIntents(db);
  const result = await drainGa4Payments(db);
  const states = await query(`SELECT status,event_name,count(*)::int AS count,
    max(attempts) AS max_attempts,
    round(extract(epoch FROM (now()-min(occurred_at))))::int AS oldest_age_seconds
    FROM ga4_payment_outbox GROUP BY status,event_name ORDER BY status,event_name`);
  const summary = {repaired,...result,states};
  console.info('[ga4-payments]',summary);
  return summary;
});
