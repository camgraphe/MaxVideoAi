import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseMiddlewareClient } from '@/lib/supabase-ssr';

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

function markAuthRedirectResponse(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.append('Vary', 'Cookie');
  return response;
}

function buildLoginRedirect(origin: string, nextPath: string): URL {
  const loginUrl = new URL('/login', origin);
  loginUrl.searchParams.set('mode', 'signin');
  if (nextPath && nextPath !== DEFAULT_NEXT_PATH) {
    loginUrl.searchParams.set('next', nextPath);
  }
  return loginUrl;
}

async function exchangeCodeOnServer(req: NextRequest, code: string, nextPath: string): Promise<NextResponse | null> {
  const redirectUrl = new URL(nextPath, req.url);
  const response = markAuthRedirectResponse(NextResponse.redirect(redirectUrl));
  const supabase = createSupabaseMiddlewareClient(req, response);

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return null;
    }
    return response;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const providerError = requestUrl.searchParams.get('error');
  const nextParam = requestUrl.searchParams.get('next');
  const nextPath = sanitizeNextPath(nextParam);

  if (providerError || code) {
    const loginUrl = buildLoginRedirect(requestUrl.origin, nextPath);
    if (providerError) {
      loginUrl.searchParams.set('authError', 'oauth_callback_failed');
      return markAuthRedirectResponse(NextResponse.redirect(loginUrl));
    }
    if (!code) {
      return markAuthRedirectResponse(NextResponse.redirect(loginUrl));
    }

    const serverExchangeResponse = await exchangeCodeOnServer(req, code, nextPath);
    if (serverExchangeResponse) {
      return serverExchangeResponse;
    }

    loginUrl.searchParams.set('code', code);
    if (state) {
      loginUrl.searchParams.set('state', state);
    }
    return markAuthRedirectResponse(NextResponse.redirect(loginUrl));
  }

  return markAuthRedirectResponse(NextResponse.redirect(new URL(nextPath, requestUrl.origin)));
}
