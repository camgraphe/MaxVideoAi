import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export async function GET(req: NextRequest) {
  const databaseConfigured = isDatabaseConfigured();
  if (!databaseConfigured) {
    return NextResponse.json({ ok: true, receipts: [], nextCursor: null, mock: true });
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/receipts] schema init failed, returning mock ledger', error);
    return NextResponse.json({ ok: true, receipts: [], nextCursor: null, mock: true });
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
  const cursor = url.searchParams.get('cursor');

  const { userId } = await getRouteAuthContext(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params: Array<string | number> = [userId];
  let where = 'WHERE user_id = $1';
  if (cursor) {
    params.push(Number(cursor));
    where += ` AND id < $${params.length}`;
  }

  params.push(limit + 1);
  type ReceiptRow = {
    id: number;
    kind: string;
    amount_cents: number;
    currency: string;
    description: string | null;
    created_at: string;
    job_id: string | null;
    tax_amount_cents: number | null;
    discount_amount_cents: number | null;
  };

  let rows: ReceiptRow[];
  try {
    rows = await query<ReceiptRow>(
      `SELECT id, kind, amount_cents, currency, description, created_at, job_id, tax_amount_cents, discount_amount_cents
       FROM app_receipts_public
       ${where}
       ORDER BY id DESC
       LIMIT $${params.length}`,
      params
    );
  } catch (error) {
    console.warn('[api/receipts] query failed, returning mock ledger', error);
    return NextResponse.json({ ok: true, receipts: [], nextCursor: null, mock: true });
  }

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1].id) : null;

  const sanitized = items.map((row) => ({
    id: row.id,
    type: row.kind,
    amount_cents: row.amount_cents,
    currency: row.currency,
    description: row.description,
    created_at: row.created_at,
    job_id: row.job_id,
    tax_amount_cents: row.tax_amount_cents ?? null,
    discount_amount_cents: row.discount_amount_cents ?? null,
  }));

  return NextResponse.json({ ok: true, receipts: sanitized, nextCursor });
}
