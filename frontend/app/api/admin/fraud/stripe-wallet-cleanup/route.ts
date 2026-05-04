import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ENV } from '@/lib/env';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { getUserIdentity } from '@/server/supabase-admin';
import { runStripeFraudWalletCleanup } from '@/server/fraud-cleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_API_VERSION = '2023-10-16';

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}

export async function POST(req: NextRequest) {
  let adminUserId: string;
  try {
    adminUserId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }
  if (!ENV.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'Stripe unavailable' }, { status: 503 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const dryRun = body.apply === true || body.dryRun === false ? false : true;
  const since = parseDate(body.since) ?? new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const until = parseDate(body.until);
  const limitInput = typeof body.limit === 'number' ? body.limit : Number(body.limit);
  const maxTopupInput =
    body.maxTopupAmountCents == null
      ? null
      : typeof body.maxTopupAmountCents === 'number'
        ? body.maxTopupAmountCents
        : Number(body.maxTopupAmountCents);

  let adminEmail: string | null = null;
  try {
    const identity = await getUserIdentity(adminUserId);
    adminEmail = identity?.email ?? null;
  } catch {
    adminEmail = null;
  }

  const stripe = new Stripe(ENV.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });

  try {
    const plan = await runStripeFraudWalletCleanup({
      stripe,
      adminUserId,
      adminEmail,
      dryRun,
      since,
      until,
      limit: Number.isFinite(limitInput) ? Math.round(limitInput) : undefined,
      maxTopupAmountCents:
        typeof maxTopupInput === 'number' && Number.isFinite(maxTopupInput) ? Math.round(maxTopupInput) : null,
      paymentIntentIds: parseStringList(body.paymentIntentIds),
      chargeIds: parseStringList(body.chargeIds),
      checkoutSessionIds: parseStringList(body.checkoutSessionIds),
      includeStripeAttemptCounts: body.includeStripeAttemptCounts !== false,
    });

    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fraud cleanup failed';
    console.error('[admin/fraud/stripe-wallet-cleanup] failed', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
