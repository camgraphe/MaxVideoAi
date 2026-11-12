import { timingSafeEqual } from 'node:crypto';
import { query } from '@/lib/db';
import { getLegalDocumentUncached } from '@/lib/legal';
import { repairOpenAIOrders, drainOpenAIConversions } from '@/server/openai-conversions-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (process.env.VERCEL_ENV !== 'production' || !secret || process.env.OPENAI_ADS_CONVERSIONS_DISABLED === '1')
    return Response.json({ ok: false }, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.headers.get('authorization') ?? '');
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
    return Response.json({ ok: false }, { status: 401 });
  try {
    const policy = await getLegalDocumentUncached('cookies');
    if (!policy) throw Error('Unavailable policy');
    const repaired = await repairOpenAIOrders({ query });
    const result = await drainOpenAIConversions({ query }, { policyVersion: policy.version });
    const states = await query(
      'SELECT status,event_name,count(*)::int AS count FROM openai_conversion_outbox GROUP BY status,event_name ORDER BY status,event_name'
    );
    const summary = { repaired, ...result, states };
    console.info('[openai-conversions]', summary);
    return Response.json({ ok: true, ...summary });
  } catch {
    return Response.json({ ok: false, error: 'delivery_unavailable' }, { status: 503 });
  }
}
