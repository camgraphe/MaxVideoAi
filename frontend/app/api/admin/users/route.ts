import { NextRequest, NextResponse } from 'next/server';
import { isUserAdmin, requireAdmin } from '@/server/admin';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

type AuthUserRow = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  factors?: Array<unknown> | null;
};

async function mapUsers(users: AuthUserRow[]) {
  const adminFlags = await Promise.all(users.map((user) => isUserAdmin(user.id)));
  return users.map((user, index) => ({
    id: user.id,
    email: user.email ?? null,
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    appMetadata: user.app_metadata ?? null,
    userMetadata: user.user_metadata ?? null,
    factors: user.factors?.length ?? 0,
    isAdmin: adminFlags[index] ?? false,
  }));
}

function matchesSearch(user: AuthUserRow, search: string) {
  if (!search) return true;
  const email = (user.email ?? '').toLowerCase();
  const id = (user.id ?? '').toLowerCase();
  return email.includes(search) || id.includes(search);
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error: 'SERVICE_ROLE_NOT_CONFIGURED',
        message: 'Supabase service role key is not set. Add SUPABASE_SERVICE_ROLE_KEY to enable admin user listing.',
      },
      { status: 200 }
    );
  }

  const url = new URL(req.url);
  const search = (url.searchParams.get('search') ?? '').toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const perPage = Math.min(200, Math.max(1, Number(url.searchParams.get('perPage') ?? '25')));

  const admin = getSupabaseAdmin();

  if (!search) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data?.users ?? []) as AuthUserRow[];
    const payload = await mapUsers(rows);
    const hasMore = rows.length === perPage;

    return NextResponse.json({
      ok: true,
      users: payload,
      pagination: {
        page,
        perPage,
        returned: payload.length,
        nextPage: hasMore ? page + 1 : null,
        totalMatches: null,
      },
    });
  }

  const matchingUsers: AuthUserRow[] = [];
  let scanPage = 1;
  const scanPerPage = 1000;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page: scanPage, perPage: scanPerPage });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data?.users ?? []) as AuthUserRow[];
    if (!rows.length) break;

    for (const user of rows) {
      if (matchesSearch(user, search)) {
        matchingUsers.push(user);
      }
    }

    if (rows.length < scanPerPage) break;
    scanPage += 1;
  }

  const offset = (page - 1) * perPage;
  const slicedUsers = matchingUsers.slice(offset, offset + perPage);
  const payload = await mapUsers(slicedUsers);

  return NextResponse.json({
    ok: true,
    users: payload,
    pagination: {
      page,
      perPage,
      returned: payload.length,
      nextPage: offset + perPage < matchingUsers.length ? page + 1 : null,
      totalMatches: matchingUsers.length,
    },
  });
}
