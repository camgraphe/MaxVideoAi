import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/user';
import { query } from '@/lib/db';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { checkOpenAIAccountEligibility } from '@/server/openai-conversions-eligibility';
import { readOpenAIRequestAttribution } from '@/server/openai-conversions-context';
import { buildOpenAIRegistrationEvent } from '@/lib/analytics/openai-contract';
import { enqueueOpenAIConversion, openAIEventId } from '@/server/openai-conversions-outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const reply = (status = 202) =>
    NextResponse.json({ ok: status === 202 }, { status, headers: { 'Cache-Control': 'private, no-store' } });
  if (
    req.headers.get('origin') !== 'https://maxvideoai.com' &&
    req.headers.get('origin') !== 'https://www.maxvideoai.com'
  )
    return reply(403);
  try {
    const attribution = await readOpenAIRequestAttribution(req);
    if (!attribution) return reply();
    const userId = await getUserIdFromRequest(req);
    if (!userId) return reply(401);
    const account = await checkOpenAIAccountEligibility({ query }, userId);
    if (account) return reply(account.status === 'retry' ? 503 : 202);
    const { data, error } = await getSupabaseAdmin().auth.admin.getUserById(userId);
    if (error || !data.user) return reply(503);
    if (!data.user.email_confirmed_at && !data.user.phone_confirmed_at) return reply();
    const event = buildOpenAIRegistrationEvent({
      id: openAIEventId('registration', userId),
      createdAt: new Date(data.user.created_at).getTime(),
      now: Date.now(),
      attribution,
    });
    if (event)
      await enqueueOpenAIConversion(
        { query },
        { event, userId, consentObservedAt: new Date(), policyVersion: attribution.policyVersion }
      );
    return reply();
  } catch {
    return reply(503);
  }
}
