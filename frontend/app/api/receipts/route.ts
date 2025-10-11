import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import type { PricingSnapshot } from '@/types/engines';
import { ensureBillingSchema } from '@/lib/schema';

export async function GET(req: NextRequest) {
  await ensureBillingSchema();

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
  const cursor = url.searchParams.get('cursor');

  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params: Array<string | number> = [userId];
  let where = 'WHERE user_id = $1';
  if (cursor) {
    params.push(Number(cursor));
    where += ` AND id < $${params.length}`;
  }

  params.push(limit + 1);
  const rows = await query<{
    id: number;
    type: string;
    amount_cents: number;
    currency: string;
    description: string | null;
    created_at: string;
    job_id: string | null;
    pricing_snapshot: PricingSnapshot | null;
    application_fee_cents: number | null;
    vendor_account_id: string | null;
    stripe_payment_intent_id: string | null;
    stripe_charge_id: string | null;
    stripe_refund_id: string | null;
  }>(
    `SELECT id, type, amount_cents, currency, description, created_at, job_id, pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, stripe_refund_id
     FROM app_receipts
     ${where}
     ORDER BY id DESC
     LIMIT $${params.length}`,
    params
  );

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1].id) : null;

  return NextResponse.json({ ok: true, receipts: items, nextCursor });
}
