import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getUserIdFromSupabase } from '@/lib/supabase';

const LOGIN_PATH = '/login';
const PROTECTED_PREFIXES = ['/app', '/dashboard', '/jobs', '/billing', '/settings'];

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  if (host.startsWith('www.')) {
    const url = new URL(req.url);
    url.host = host.replace(/^www\./, '');
    return NextResponse.redirect(url, 308);
  }

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => req.nextUrl.pathname.startsWith(prefix));
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  try {
    const userId = await getUserIdFromSupabase(req);
    if (userId) {
      return NextResponse.next();
    }
  } catch {
    // ignore and fall through to redirect
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = LOGIN_PATH;
  redirectUrl.search = '';

  const target =
    req.nextUrl.pathname + (req.nextUrl.search && req.nextUrl.search !== '?' ? req.nextUrl.search : '');
  if (target && target !== LOGIN_PATH) {
    redirectUrl.searchParams.set('next', target);
  }

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: '/:path*',
};
