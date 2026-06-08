import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export function studioJson(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function resolveStudioRouteContext(req: NextRequest): Promise<
  | { userId: string; response: null }
  | { userId: null; response: NextResponse }
> {
  const { userId } = await getRouteAuthContext(req);
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
