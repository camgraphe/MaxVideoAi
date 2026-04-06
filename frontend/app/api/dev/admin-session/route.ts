import { NextRequest, NextResponse } from 'next/server';
import {
  LOCAL_ADMIN_BYPASS_COOKIE,
  resolveConfiguredLocalAdminUserId,
} from '@/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveRedirectPath(req: NextRequest, fallback: string): string {
  const value = req.nextUrl.searchParams.get('redirectTo')?.trim();
  if (!value || !value.startsWith('/')) {
    return fallback;
  }
  return value;
}

function getCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: false,
    path: '/',
    ...(typeof maxAge === 'number' ? { maxAge } : {}),
  };
}

function assertLocalBypassConfig(req: NextRequest) {
  if ((process.env.LOCAL_ADMIN_BYPASS ?? '').trim() !== '1') {
    return NextResponse.json({ ok: false, error: 'Local admin session is disabled' }, { status: 404 });
  }

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const normalizedHost = host.trim().toLowerCase().split(':')[0] ?? '';
  if (!['localhost', '127.0.0.1', '::1'].includes(normalizedHost)) {
    return NextResponse.json({ ok: false, error: 'Local admin session is only available on localhost' }, { status: 403 });
  }

  return null;
}

export async function GET(req: NextRequest) {
  const configError = assertLocalBypassConfig(req);
  if (configError) return configError;

  if (req.nextUrl.searchParams.get('disable') === '1') {
    const redirectTo = resolveRedirectPath(req, '/');
    const response = NextResponse.redirect(new URL(redirectTo, req.url));
    response.cookies.set(LOCAL_ADMIN_BYPASS_COOKIE, '', getCookieOptions(0));
    return response;
  }

  const redirectTo = resolveRedirectPath(req, '/admin/playlists');
  const adminUserId = await resolveConfiguredLocalAdminUserId();
  if (!adminUserId) {
    return NextResponse.json(
      { ok: false, error: 'No local admin user available for bypass' },
      { status: 409 }
    );
  }

  const response = NextResponse.redirect(new URL(redirectTo, req.url));
  response.cookies.set(LOCAL_ADMIN_BYPASS_COOKIE, '1', getCookieOptions(60 * 60 * 8));
  return response;
}

export async function DELETE(req: NextRequest) {
  const configError = assertLocalBypassConfig(req);
  if (configError) return configError;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(LOCAL_ADMIN_BYPASS_COOKIE, '', getCookieOptions(0));
  return response;
}
