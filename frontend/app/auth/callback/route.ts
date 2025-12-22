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
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
