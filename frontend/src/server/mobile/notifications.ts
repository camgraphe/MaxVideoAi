import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { query } from '@/lib/db';
import {
  readOwnedGenerationRecord,
  mapGenerationStatusRecordToAgent,
} from '@/server/generations/generation-status';
import { MobileHttpError } from './errors';

const enabled = () =>
  process.env.MOBILE_PUSH_ENABLED === '1' && !!process.env.MOBILE_EXPO_PUSH_ACCESS_TOKEN?.trim();
export const pushAvailability = () => ({ enabled: enabled() });
const token = z
  .string()
  .max(180)
  .regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/);
const jobId = z.string().min(1).max(180);
const registration = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('watch'),
      jobId,
      token,
      locale: z.enum(['en', 'es', 'fr']),
    })
    .strict(),
  z.object({ action: z.literal('remove'), token }).strict(),
  z.object({ action: z.literal('summary'), token }).strict(),
  z.object({ action: z.literal('cancelPending'), token }).strict(),
  z.object({ action: z.literal('status'), jobId, token }).strict(),
  z.object({ action: z.literal('unwatch'), jobId, token }).strict(),
]);

export async function changeNotification(userId: string, body: unknown) {
  if (!enabled()) throw new MobileHttpError('PUSH_DISABLED', 503, 'Notifications are unavailable.');
  const parsed = registration.safeParse(body);
  if (!parsed.success) throw new MobileHttpError('INVALID_NOTIFICATION', 400, 'Invalid notification.');
  const input = parsed.data;
  if (input.action === 'remove') {
    await query('DELETE FROM mobile_job_notifications WHERE user_id=$1 AND token=$2', [userId, input.token]);
    return { watching: false };
  }
  if (input.action === 'summary' || input.action === 'cancelPending') {
    const device = [userId, input.token];
    if (input.action === 'cancelPending') {
      await query(`DELETE FROM mobile_job_notifications
        WHERE user_id=$1 AND token=$2 AND state='waiting' AND expires_at>now()
        AND (lease_until IS NULL OR lease_until<=now())`, device);
    }
    const [counts] = await query<{ pending: number; processing: number }>(
      `SELECT count(*) FILTER (WHERE lease_until IS NULL OR lease_until<=now())::int AS pending,
              count(*) FILTER (WHERE lease_until>now())::int AS processing
       FROM mobile_job_notifications
       WHERE user_id=$1 AND token=$2 AND state='waiting' AND expires_at>now()`, device);
    return counts;
  }
  if (input.action === 'status' || input.action === 'unwatch') {
    const key = [userId, input.jobId, input.token];
    if (input.action === 'unwatch') {
      // A worker that has already claimed this row may be sending to the device.
      await query(`DELETE FROM mobile_job_notifications
        WHERE user_id=$1 AND job_id=$2 AND token=$3 AND state='waiting'
        AND (lease_until IS NULL OR lease_until<=now())`, key);
    }
    const rows = await query<{ state: 'sending' | 'watching' }>(
      `SELECT CASE WHEN lease_until>now() THEN 'sending' ELSE 'watching' END AS state
       FROM mobile_job_notifications
       WHERE user_id=$1 AND job_id=$2 AND token=$3 AND state='waiting' AND expires_at>now()`, key,
    );
    return { state: rows[0]?.state ?? 'off' };
  }
  const record = await readOwnedGenerationRecord({ userId, jobId: input.jobId });
  const job = record && mapGenerationStatusRecordToAgent(record);
  if (!job) throw new MobileHttpError('JOB_NOT_FOUND', 404, 'Generation not found.');
  if (job.status === 'failed' || job.status === 'completed') return { watching: false };
  const rows = await query<{ job_id: string }>(
    `INSERT INTO mobile_job_notifications(user_id,job_id,token,locale)
    VALUES($1,$2,$3,$4) ON CONFLICT(user_id,job_id) DO UPDATE
    SET token=excluded.token,locale=excluded.locale,expires_at=excluded.expires_at
    WHERE mobile_job_notifications.state='waiting' AND (mobile_job_notifications.token=excluded.token
      OR mobile_job_notifications.lease_until IS NULL OR mobile_job_notifications.lease_until<=now())
    RETURNING job_id`,
    [userId, input.jobId, input.token, input.locale],
  );
  if (rows.length) return { watching: true };
  const pending = await query<{ job_id: string }>(
    `SELECT job_id FROM mobile_job_notifications
     WHERE user_id=$1 AND job_id=$2 AND state='waiting' AND lease_until>now()`,
    [userId, input.jobId],
  );
  return pending.length ? { watching: false, retry: true } : { watching: false };
}

type Watch = {
  user_id: string;
  job_id: string;
  locale: 'fr' | 'en' | 'es';
  state: 'waiting' | 'receipt';
  token: string | null;
  ticket: string | null;
  failures: number;
};
type Ticket = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };
type Transition = {
  state: 'closed' | 'receipt' | 'waiting';
  delay: number;
  ticket?: string;
  failed?: boolean;
};
type PushTransport = (
  endpoint: 'send' | 'getReceipts',
  body: unknown,
) => Promise<{ data: Ticket[] | Record<string, Ticket> }>;
const send: PushTransport = async (endpoint, body) => {
  const response = await fetch('https://exp.host/--/api/v2/push/' + endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.MOBILE_EXPO_PUSH_ACCESS_TOKEN,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw Error('Push service unavailable');
  return response.json();
};
const close: Transition = { state: 'closed', delay: 0 };
const bodyCopy = {
  ready: {
    fr: 'Votre création est prête dans la bibliothèque.',
    en: 'Your creation is ready in your library.',
    es: 'Tu creación está lista en la biblioteca.',
  },
  failed: {
    fr: 'Votre rendu a échoué. Consultez les détails dans Activité.',
    en: 'Your render failed. Open Activity for details.',
    es: 'La generación ha fallado. Consulta los detalles en Actividad.',
  },
};

async function readNotificationJob(userId: string, jobId: string) {
  const { readMobileJob } = await import('./generations');
  try {
    return await readMobileJob(userId, jobId, { includeOutputs: true });
  } catch (error) {
    if (error instanceof MobileHttpError && error.code === 'JOB_NOT_FOUND') return null;
    throw error;
  }
}

export async function nextDelivery(
  watch: Watch,
  read = readNotificationJob,
  transport: PushTransport = send,
): Promise<Transition> {
  if (watch.state === 'receipt') {
    if (!watch.ticket) return close;
    const result = await transport('getReceipts', { ids: [watch.ticket] });
    const receipt = !Array.isArray(result.data) && result.data[watch.ticket];
    if (!receipt) return { state: 'receipt', ticket: watch.ticket, delay: 900 };
    return close;
  }
  if (!watch.token) return close;
  const job = await read(watch.user_id, watch.job_id);
  if (!job) return close;
  if (job.status !== 'failed' && (job.status !== 'completed' || !job.url))
    return { state: 'waiting', delay: 90 };
  const response = await transport('send', [
    {
      to: watch.token,
      title: 'MaxVideoAI',
      body: bodyCopy[job.status === 'completed' ? 'ready' : 'failed'][watch.locale],
      channelId: 'generations',
      data: { screen: 'library', jobId: job.jobId },
      ttl: 3600,
      collapseId: watch.job_id,
    },
  ]);
  const ticket = Array.isArray(response.data) && response.data[0];
  if (ticket && ticket.status === 'ok' && ticket.id)
    return { state: 'receipt', delay: 900, ticket: ticket.id };
  if (ticket && ticket.details?.error === 'DeviceNotRegistered') return close;
  throw Error('Missing push ticket');
}
export async function drainNotifications(deliver = nextDelivery) {
  if (!enabled()) return { enabled: false, checked: 0 };
  const key = randomUUID();
  await query(`DELETE FROM mobile_job_notifications WHERE ctid IN
    (SELECT ctid FROM mobile_job_notifications WHERE expires_at<=now() ORDER BY expires_at LIMIT 200)`);
  const rows = await query<Watch>(
    `WITH batch AS (SELECT user_id,job_id FROM mobile_job_notifications
    WHERE state<>'closed' AND next_check<=now() AND expires_at>now() AND (lease_until IS NULL OR lease_until<now())
    ORDER BY next_check LIMIT 12 FOR UPDATE SKIP LOCKED)
    UPDATE mobile_job_notifications n SET lease=$1,lease_until=now()+interval '2 minutes' FROM batch b
    WHERE n.user_id=b.user_id AND n.job_id=b.job_id RETURNING n.*`,
    [key],
  );
  await Promise.all(
    rows.map(async (row) => {
      let next: Transition;
      try {
        next = await deliver(row);
      } catch {
        next =
          row.failures >= 5
            ? close
            : {
                state: row.state,
                ticket: row.ticket ?? undefined,
                delay: Math.min(3600, 60 * 2 ** row.failures),
                failed: true,
              };
      }
      await query(
        `UPDATE mobile_job_notifications SET state=$4,token=CASE WHEN $4='waiting' THEN token ELSE NULL END,
      ticket=$5,next_check=now()+($6 * interval '1 second'),failures=CASE WHEN $7 THEN failures+1 ELSE 0 END,lease=NULL,lease_until=NULL
      WHERE user_id=$1 AND job_id=$2 AND lease=$3`,
        [row.user_id, row.job_id, key, next.state, next.ticket ?? null, next.delay, !!next.failed],
      );
    }),
  );
  return { enabled: true, checked: rows.length };
}
