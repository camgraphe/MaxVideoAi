import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 501 });
  }

  const url = new URL(req.url);
  const search = (url.searchParams.get('search') ?? '').toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const perPage = Math.min(200, Math.max(1, Number(url.searchParams.get('perPage') ?? '25')));

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = (data?.users ?? []).filter((user) => {
    if (!search) return true;
    const email = (user.email ?? '').toLowerCase();
    const id = (user.id ?? '').toLowerCase();
    return email.includes(search) || id.includes(search);
  });

  const payload = users.map((user) => ({
    id: user.id,
    email: user.email,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
    appMetadata: user.app_metadata,
    userMetadata: user.user_metadata,
    factors: user.factors?.length ?? 0,
  }));

  const hasMore = (data?.users?.length ?? 0) === perPage;

  return NextResponse.json({
    ok: true,
    users: payload,
    pagination: {
      page,
      perPage,
      nextPage: hasMore ? page + 1 : null,
    },
  });
}
