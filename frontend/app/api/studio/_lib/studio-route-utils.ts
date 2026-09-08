import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { FEATURES } from '@/content/feature-flags';
import { AdminAuthError, requireAdmin } from '@/server/admin';

export function studioJson(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function resolveStudioRouteContext(req: NextRequest): Promise<
  | { userId: string; response: null }
  | { userId: null; response: NextResponse }
> {
  if (!FEATURES.studio.maxVideoAiEditor) {
    return { userId: null, response: studioJson({ ok: false, error: 'NOT_FOUND' }, { status: 404 }) };
  }

  let userId: string | null = null;
  if (FEATURES.studio.adminOnly) {
    try {
      userId = await requireAdmin(req);
    } catch (error) {
      const status = error instanceof AdminAuthError ? error.status : 500;
      const code = status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'ACCESS_CHECK_FAILED';
      return { userId: null, response: studioJson({ ok: false, error: code }, { status }) };
    }
  } else {
    ({ userId } = await getRouteAuthContext(req));
  }
  if (!userId) {
    return { userId: null, response: studioJson({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }) };
  }
  if (!isDatabaseConfigured()) {
    return { userId: null, response: studioJson({ ok: false, error: 'DATABASE_NOT_CONFIGURED' }, { status: 503 }) };
  }
  return { userId, response: null };
}

export function payloadRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function payloadString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
