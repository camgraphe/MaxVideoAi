import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { LOGOUT_INTENT_COOKIE } from '@/lib/logout-intent-cookie';

export const LOGIN_PATH = '/login';
const LOCAL_ADMIN_BYPASS_COOKIE = 'mva_local_admin_bypass';
export const PROTECTED_PREFIXES = ['/app', '/dashboard', '/jobs', '/billing', '/settings', '/admin'];

export function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const normalized = host.trim().toLowerCase().split(':')[0] ?? '';
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function hasLocalAdminBypass(req: NextRequest): boolean {
  if ((process.env.LOCAL_ADMIN_BYPASS ?? '').trim() !== '1') return false;
  if (!isLoopbackHost(req.headers.get('x-forwarded-host') ?? req.headers.get('host'))) return false;
  return req.cookies.get(LOCAL_ADMIN_BYPASS_COOKIE)?.value === '1';
}

export function finalizeResponse(res: NextResponse, clearLogoutIntent: boolean, trackingNoindex = false, appNoindex = false) {
  if ((trackingNoindex || appNoindex) && !res.headers.has('X-Robots-Tag')) {
    res.headers.set('X-Robots-Tag', 'noindex, follow');
  }
  if (clearLogoutIntent) {
    res.cookies.set(LOGOUT_INTENT_COOKIE, '', { path: '/', maxAge: 0 });
  }
  return res;
}

export function mergeResponseCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}
