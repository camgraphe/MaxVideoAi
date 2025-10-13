import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getUserIdFromSupabase } from '@/lib/supabase';

const LOGIN_PATH = '/login';

export async function middleware(req: NextRequest) {
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
  matcher: ['/app/:path*', '/dashboard/:path*', '/jobs/:path*', '/billing/:path*', '/settings/:path*'],
};
