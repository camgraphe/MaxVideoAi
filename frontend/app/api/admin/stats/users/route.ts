import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

type CountAccumulator = {
  total: number;
  today: number;
  last7: number;
  last30: number;
};

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error: 'SERVICE_ROLE_NOT_CONFIGURED',
        message: 'Add SUPABASE_SERVICE_ROLE_KEY to fetch user statistics.',
      },
      { status: 200 }
    );
  }

  const admin = getSupabaseAdmin();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inLastDays = (createdAt: Date, days: number) => createdAt >= new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const accumulator: CountAccumulator = {
    total: 0,
    today: 0,
    last7: 0,
    last30: 0,
  };

  let page = 1;
  const perPage = 1000;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const users = data?.users ?? [];
    if (!users.length) break;

    for (const user of users) {
      accumulator.total += 1;
      if (!user.created_at) continue;
      const createdAt = new Date(user.created_at);
      if (createdAt >= startOfToday) accumulator.today += 1;
      if (inLastDays(createdAt, 7)) accumulator.last7 += 1;
      if (inLastDays(createdAt, 30)) accumulator.last30 += 1;
    }

    if (users.length < perPage) break;
    page += 1;
  }

  return NextResponse.json({ ok: true, stats: accumulator });
}
