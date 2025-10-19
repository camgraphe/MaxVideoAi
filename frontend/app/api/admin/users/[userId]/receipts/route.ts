import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { query } from '@/lib/db';

type ReceiptRow = {
  id: number;
  type: string;
  amount_cents: number;
  currency: string;
  description: string | null;
  created_at: string;
  job_id: string | null;
  metadata: unknown;
};

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 501 });
  }

  const userId = params.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50')));
  const cursorRaw = url.searchParams.get('cursor');

  const values: (string | number)[] = [userId];
  let where = 'WHERE user_id = $1';
  if (cursorRaw) {
    const cursor = Number(cursorRaw);
    if (!Number.isFinite(cursor)) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
    }
    values.push(cursor);
    where += ` AND id < $${values.length}`;
  }

  values.push(limit + 1);

  const rows = await query<ReceiptRow>(
    `SELECT id, type, amount_cents, currency, description, created_at, job_id, metadata
     FROM app_receipts
     ${where}
     ORDER BY id DESC
     LIMIT $${values.length}`,
    values
  );

  const hasMore = rows.length > limit;
  const list = hasMore ? rows.slice(0, -1) : rows;

  return NextResponse.json({
    ok: true,
    receipts: list,
    nextCursor: hasMore ? String(list[list.length - 1]?.id ?? '') : null,
  });
}
