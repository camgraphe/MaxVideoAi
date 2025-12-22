import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-ssr';

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
  const nextParam = requestUrl.searchParams.get('next');
  const nextPath = sanitizeNextPath(nextParam);

  if (code) {
    const supabase = createSupabaseRouteClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth.callback] exchange failed', error);
      const fallbackUrl = new URL('/login', requestUrl.origin);
      fallbackUrl.searchParams.set('code', code);
      if (nextPath && nextPath !== DEFAULT_NEXT_PATH) {
        fallbackUrl.searchParams.set('next', nextPath);
      }
      return NextResponse.redirect(fallbackUrl);
    }
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
