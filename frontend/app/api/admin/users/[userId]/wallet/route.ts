import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { getWalletBalanceCents } from '@/lib/wallet';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = params.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const { balanceCents, mock } = await getWalletBalanceCents(userId);

  let stats = null;
  if (process.env.DATABASE_URL) {
    const aggregates = await query<{ type: string; total: number }>(
      `SELECT type, COALESCE(SUM(amount_cents), 0) AS total
       FROM app_receipts
       WHERE user_id = $1
       GROUP BY type`,
      [userId]
    );
    stats = aggregates.reduce<Record<string, number>>((acc, row) => {
      acc[row.type] = Number(row.total ?? 0);
      return acc;
    }, {});
  }

  return NextResponse.json({
    ok: true,
    balanceCents,
    balance: balanceCents / 100,
    currency: 'USD',
    mock,
    stats,
  });
}
