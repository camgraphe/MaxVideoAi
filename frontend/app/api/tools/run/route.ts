import { NextRequest, NextResponse } from 'next/server';
import { FEATURES } from '@/content/feature-flags';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { getActiveAccountRestriction } from '@/server/fraud-cleanup';
import { requireCurrentWebPricingPolicy } from '@/server/pricing/web-pricing-policy';
import { runFinishingTool } from '@/server/tools/finishing-run';
import { refreshFinishingTool } from '@/server/tools/finishing-status';
export const runtime = 'nodejs';
export const maxDuration = 800;
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(req: NextRequest) {
  if (!FEATURES.workflows.toolsSection) return NextResponse.json({ ok: false }, { status: 404 });
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const policyError = requireCurrentWebPricingPolicy(req, 'tool');
  if (policyError) return policyError;
  if (await getActiveAccountRestriction(userId)) return NextResponse.json({ ok: false, error: 'Account restricted.' }, { status: 403 });
  try { return NextResponse.json(await runFinishingTool(await req.json(), userId), { headers }); }
  catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status = code === 'TOOL_QUALIFICATION_REQUIRED' || code === 'TOOL_STORAGE_UNAVAILABLE' ? 503 : code === 'QUOTE_CHANGED' || code === 'REQUEST_CONFLICT' ? 409 : code === 'INSUFFICIENT_FUNDS' ? 402 : 422;
    const publicCode = ['TOOL_QUALIFICATION_REQUIRED', 'TOOL_STORAGE_UNAVAILABLE', 'QUOTE_CHANGED', 'REQUEST_CONFLICT', 'INSUFFICIENT_FUNDS', 'CURRENCY_MISMATCH', 'SOURCE_UNAVAILABLE'].includes(code) ? code : 'TOOL_RUN_FAILED';
    return NextResponse.json({ ok: false, error: publicCode }, { status, headers });
  }
}
export async function GET(req: NextRequest) {
  if (!FEATURES.workflows.toolsSection) return NextResponse.json({ ok: false }, { status: 404 });
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const jobId = req.nextUrl.searchParams.get('jobId') ?? '';
  if (!/^tool_finish_[a-f0-9]{64}$/.test(jobId)) return NextResponse.json({ ok: false }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...await refreshFinishingTool(userId, jobId) }, { headers }); }
  catch (error) { return NextResponse.json({ ok: false }, { status: error instanceof Error && error.message === 'JOB_UNAVAILABLE' ? 404 : 503, headers }); }
}
