import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_NEXT_PATH = '/generate';

function sanitizeNextPath(value: string | null): string {
  if (!value) return DEFAULT_NEXT_PATH;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return DEFAULT_NEXT_PATH;
  if (trimmed.startsWith('/login') || trimmed.startsWith('/api') || trimmed.startsWith('/_next')) {
    return DEFAULT_NEXT_PATH;
  }
  return trimmed;
}

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const providerError = requestUrl.searchParams.get('error');
  const nextParam = requestUrl.searchParams.get('next');
  const nextPath = sanitizeNextPath(nextParam);

  if (providerError || code) {
    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('mode', 'signin');
    if (nextPath && nextPath !== DEFAULT_NEXT_PATH) {
      loginUrl.searchParams.set('next', nextPath);
    }
    if (providerError) {
      loginUrl.searchParams.set('authError', 'oauth_callback_failed');
      return NextResponse.redirect(loginUrl);
    }
    if (!code) {
      return NextResponse.redirect(loginUrl);
    }
    loginUrl.searchParams.set('code', code);
    if (state) {
      loginUrl.searchParams.set('state', state);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
