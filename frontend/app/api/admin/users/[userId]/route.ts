import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isUserAdmin } from '@/server/admin';
import { getSupabaseAdmin } from '@/server/supabase-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 501 });
  }

  const userId = params.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    return NextResponse.json({ error: error?.message ?? 'User not found' }, { status: 404 });
  }

  const user = data.user;

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      appMetadata: user.app_metadata,
      userMetadata: user.user_metadata,
      factors: user.factors ?? [],
      isAdmin: await isUserAdmin(user.id),
    },
  });
}
