import { NextRequest, NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { previewSeedance25LasTariffRelease, confirmSeedance25LasTariffRelease } from '@/server/pricing-admin/seedance-las-tariff-release';
import { PricingAdminError } from '@/server/pricing-admin/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const noStore = { headers: { 'Cache-Control': 'no-store' } };

function failure(error: unknown) {
  return error instanceof PricingAdminError
    ? NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status })
    : NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try { await requireAdmin(req); } catch (error) { return adminErrorToResponse(error); }
  try { return NextResponse.json({ ok: true, preview: await previewSeedance25LasTariffRelease() }, noStore); }
  catch (error) { return failure(error); }
}

export async function POST(req: NextRequest) {
  let actorId: string;
  try { actorId = await requireAdmin(req); } catch (error) { return adminErrorToResponse(error); }
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ ok: false, error: 'Forbidden origin' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || Array.isArray(body) || typeof body !== 'object' || body.confirm !== true || typeof body.fingerprint !== 'string') {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }
  try { return NextResponse.json({ ok: true, confirmation: await confirmSeedance25LasTariffRelease(body.fingerprint, actorId) }, noStore); }
  catch (error) { return failure(error); }
}
