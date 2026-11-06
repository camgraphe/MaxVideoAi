import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { isDatabaseConfigured } from '@/lib/db';
import { FEATURES } from '@/content/feature-flags';
import { StudioLibraryError } from './source';

export async function studioRoute(req: NextRequest, action: (userId: string) => Promise<object>) {
  const json = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  if (!FEATURES.workflows.toolsSection) return json({ ok: false, error: 'tools_disabled' }, 404);
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return json({ ok: false, error: 'auth_required' }, 401);
  if (!isDatabaseConfigured()) return json({ ok: false, error: 'library_unavailable' }, 503);
  try {
    return json({ ok: true, ...(await action(userId)) });
  } catch (error) {
    if (error instanceof StudioLibraryError) return json({ ok: false, error: error.code }, error.status);
    return json({ ok: false, error: 'library_unavailable' }, 503);
  }
}

export async function studioBody(req: NextRequest): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 12_000) throw new StudioLibraryError('invalid_payload', 413);
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new StudioLibraryError('invalid_payload');
  }
}
