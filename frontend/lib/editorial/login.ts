import { NextRequest, NextResponse } from 'next/server';
import { buildLoginHref } from '@/lib/auth-entry-href';

/** Used only after the existing session check has found no signed-in user. */
export function editorialSignInRedirect(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (!['GET', 'HEAD'].includes(request.method) || !request.headers.get('accept')?.includes('text/html') || !(pathname === '/admin/editorial' || pathname.startsWith('/admin/editorial/'))) return null;
  const response = NextResponse.redirect(new URL(buildLoginHref({ mode: 'signin', nextPath: pathname + search }), request.url));
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.append('Vary', 'Cookie');
  return response;
}
