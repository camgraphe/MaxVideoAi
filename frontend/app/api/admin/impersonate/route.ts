import { NextRequest, NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { logAdminAction } from '@/server/admin-audit';
import {
  encodeImpersonationSession,
  encodeImpersonationTarget,
  impersonationCookieNames,
  impersonationCookieOptions,
  sanitizeRelativePath,
} from '@/lib/admin/impersonation';

const WORKSPACE_REDIRECT = '/app';

export const runtime = 'nodejs';

type ImpersonatePayload = {
  userId?: string;
  redirectTo?: string;
  returnTo?: string;
};

async function parsePayload(req: NextRequest): Promise<ImpersonatePayload> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => null);
    if (body && typeof body === 'object') {
      return {
        userId: typeof body.userId === 'string' ? body.userId : undefined,
        redirectTo: typeof body.redirectTo === 'string' ? body.redirectTo : undefined,
        returnTo: typeof body.returnTo === 'string' ? body.returnTo : undefined,
      };
    }
    return {};
  }
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    return {
      userId: typeof formData.get('userId') === 'string' ? (formData.get('userId') as string) : undefined,
      redirectTo: typeof formData.get('redirectTo') === 'string' ? (formData.get('redirectTo') as string) : undefined,
      returnTo: typeof formData.get('returnTo') === 'string' ? (formData.get('returnTo') as string) : undefined,
    };
  }
  return {};
}

function resolveRedirect(value: string | null | undefined, fallback: string): string {
  const sanitized = sanitizeRelativePath(value);
  return sanitized ?? fallback;
}

export async function POST(req: NextRequest) {
  let adminUserId: string;
  try {
    adminUserId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: 'SERVICE_ROLE_NOT_CONFIGURED', message: 'Supabase service role key is not set.' },
      { status: 501 }
    );
  }

  const payload = await parsePayload(req);
  const targetUserId = payload.userId?.trim();
  if (!targetUserId) {
    return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 });
  }

  const redirectTo = resolveRedirect(payload.redirectTo, WORKSPACE_REDIRECT);
  const returnTo = resolveRedirect(payload.returnTo, `/admin/users/${targetUserId}`);

  const supabase = createSupabaseRouteClient();
  const {
    data: { session: currentSession },
  } = await supabase.auth.getSession();

  if (!currentSession?.access_token || !currentSession.refresh_token) {
    return NextResponse.json({ ok: false, error: 'Admin session not found' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(targetUserId);
  if (userError || !userData?.user) {
    return NextResponse.json({ ok: false, error: userError?.message ?? 'User not found' }, { status: 404 });
  }

  const targetEmail = userData.user.email;
  if (!targetEmail) {
    return NextResponse.json({ ok: false, error: 'User has no email associated' }, { status: 400 });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  });
  if (linkError || !linkData?.properties) {
    return NextResponse.json({ ok: false, error: linkError?.message ?? 'Unable to generate login link' }, { status: 500 });
  }

  const properties = linkData.properties as Record<string, unknown>;
  const emailOtp =
    (typeof properties.email_otp === 'string' && properties.email_otp) ||
    (typeof properties.user_email_otp === 'string' && properties.user_email_otp) ||
    null;
  if (!emailOtp) {
    return NextResponse.json({ ok: false, error: 'Magic link token unavailable' }, { status: 500 });
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({ email: targetEmail, token: emailOtp, type: 'magiclink' });
  if (verifyError) {
    return NextResponse.json({ ok: false, error: verifyError.message ?? 'Failed to exchange impersonation token' }, { status: 500 });
  }

  const response = NextResponse.redirect(new URL(redirectTo, req.url));
  const cookieOptions = impersonationCookieOptions();
  response.cookies.set(
    impersonationCookieNames.session,
    encodeImpersonationSession({
      adminId: adminUserId,
      accessToken: currentSession.access_token,
      refreshToken: currentSession.refresh_token,
      returnTo,
    }),
    cookieOptions
  );
  response.cookies.set(
    impersonationCookieNames.target,
    encodeImpersonationTarget({
      userId: targetUserId,
      email: targetEmail,
      startedAt: new Date().toISOString(),
    }),
    cookieOptions
  );

  await logAdminAction({
    adminId: adminUserId,
    targetUserId,
    action: 'IMPERSONATE_START',
    route: '/api/admin/impersonate',
    metadata: { redirectTo, returnTo },
  });

  return response;
}
