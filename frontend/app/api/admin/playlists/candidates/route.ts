import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { searchPlaylistCandidates } from '@/server/playlists';

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const engine = url.searchParams.get('engine');
  const limitValue = Number(url.searchParams.get('limit') ?? '18');
  const limit = Number.isFinite(limitValue) ? limitValue : 18;

  try {
    const candidates = await searchPlaylistCandidates({ q, engine, limit });
    return NextResponse.json({ ok: true, candidates });
  } catch (error) {
    console.error('[admin/playlists/candidates] failed to search', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
